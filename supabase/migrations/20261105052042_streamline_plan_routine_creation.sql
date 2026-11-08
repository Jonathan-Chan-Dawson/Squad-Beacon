-- Unpublished Beacon payloads are editor-only. Public stops retain safe summaries.
create table private.plan_editor_beacons (
 stop_id uuid primary key references public.plan_stops(id) on delete cascade,
 include boolean not null default true,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<50000)
);
alter table private.plan_editor_beacons enable row level security;
revoke all on private.plan_editor_beacons from public,anon,authenticated;

alter table public.plan_routines add column frequency text check(frequency in ('daily','weekly','monthly')),
 add column interval_count integer check(interval_count between 1 and 52),
 add column month_day integer check(month_day between 1 and 31);

create function private.next_recurrence_date(anchor date,frequency text,step integer,weekdays smallint[],month_day integer,after_date date,ends_on date)
returns date language plpgsql immutable set search_path='' as $$
declare candidate date; n integer; month_delta integer; last_day integer; begin
 if anchor is null or after_date is null or frequency not in ('daily','weekly','monthly') or step not between 1 and 52 or (ends_on is not null and ends_on<anchor) then raise exception 'Invalid repeat schedule.'; end if;
 if frequency='weekly' and (cardinality(weekdays) not between 1 and 7 or exists(select 1 from unnest(weekdays) d where d not between 1 and 7) or (select count(*) from unnest(weekdays))<>(select count(distinct d) from unnest(weekdays) d)) then raise exception 'Choose valid weekdays.'; end if;
 if frequency='monthly' and coalesce(month_day,extract(day from anchor)::int) not between 1 and 31 then raise exception 'Choose a valid monthly day.'; end if;
 for n in 0..(366*52) loop
  candidate:=greatest(anchor,after_date+1)+n;
  if ends_on is not null and candidate>ends_on then return null; end if;
  if frequency='daily' and (candidate-anchor)%step=0 then return candidate; end if;
  if frequency='weekly' and extract(isodow from candidate)::int=any(weekdays) and ((candidate-(extract(isodow from candidate)::int-1) - (anchor-(extract(isodow from anchor)::int-1)))/7)%step=0 then return candidate; end if;
  if frequency='monthly' then
   month_delta:=(extract(year from candidate)::int-extract(year from anchor)::int)*12+extract(month from candidate)::int-extract(month from anchor)::int;
   last_day:=extract(day from (date_trunc('month',candidate)+interval '1 month - 1 day'))::int;
   if month_delta%step=0 and extract(day from candidate)::int=least(coalesce(month_day,extract(day from anchor)::int),last_day) then return candidate; end if;
  end if;
 end loop; return null;
end $$;
revoke all on function private.next_recurrence_date(date,text,integer,smallint[],integer,date,date) from public,anon,authenticated;

create function private.routine_next_date(rid uuid,after_date date) returns date language plpgsql stable security definer set search_path='' as $$
declare r public.plan_routines; begin
 select * into r from public.plan_routines where id=rid;
 if not found then return null; end if;
 if r.frequency is null then return private.next_plan_routine_date(r.anchor_date,r.weekdays,r.interval_weeks,after_date,r.ends_on); end if;
 return private.next_recurrence_date(r.anchor_date,r.frequency,coalesce(r.interval_count,r.interval_weeks),r.weekdays,r.month_day,after_date,r.ends_on);
end $$;
revoke all on function private.routine_next_date(uuid,date) from public,anon,authenticated;

create or replace function private.next_unrecorded_plan_routine_date(routine_id uuid,anchor date,weekdays smallint[],interval_weeks integer,after_date date,ends_on date)
returns date language plpgsql stable security definer set search_path='' as $$
declare candidate date; attempts integer:=0; modern boolean; begin
 select frequency is not null into modern from public.plan_routines where id=routine_id;
 candidate:=case when modern then private.routine_next_date(routine_id,after_date) else private.next_plan_routine_date(anchor,weekdays,interval_weeks,after_date,ends_on) end;
 while candidate is not null and attempts<366*52 loop
  if not exists(select 1 from private.plan_routine_occurrences o where o.routine_id=next_unrecorded_plan_routine_date.routine_id and o.occurrence_on=candidate) then return candidate; end if;
  candidate:=case when modern then private.routine_next_date(routine_id,candidate) else private.next_plan_routine_date(anchor,weekdays,interval_weeks,candidate,ends_on) end; attempts:=attempts+1;
 end loop; return null;
end $$;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_plan_editor;
create function private.plan_editor_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
<<editor_result>>
declare uid uuid:=auth.uid(); result jsonb; pid uuid; p public.plans; item jsonb; sid uuid; old_stop public.plan_stops; pos integer:=0; draft jsonb; created jsonb; rid uuid; frequency_value text; ids uuid[]:='{}'; begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 if action not in ('save_plan_editor','schedule_plan_editor','create_routine','repeat_beacon','edit_routine','save_living_plan_template') then return public.beacon_action_before_plan_editor(action,payload,request_id); end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into result from private.requests r where r.user_id=uid and r.request_id=plan_editor_action.request_id;
 if found then return result; end if;
 if action in ('save_plan_editor','schedule_plan_editor') then
  if action='schedule_plan_editor' and not exists(select 1 from jsonb_array_elements(payload->'stops') v where v->>'kind'='beacon' and coalesce((v->>'include')::boolean,false)) then raise exception 'Choose at least one new Beacon to schedule.'; end if;
  pid:=nullif(payload->>'plan_id','')::uuid;
  if pid is null then
   result:=private.apply_living_plan_action('create_living_plan',payload-'stops'); pid:=(result->>'id')::uuid;
  end if;
  select * into p from public.plans where id=pid for update;
  if not found or not private.can_edit_living_plan(pid) or p.status='cancelled' then raise exception 'Only current Plan organizers can edit this Plan.'; end if;
  if payload ? 'plan_id' and coalesce((payload->>'revision')::int,-1)<>p.revision then raise exception 'This Plan changed. Your draft is preserved; review the latest version before saving.'; end if;
  if nullif(btrim(payload->>'title'),'') is null or length(payload->>'title')>100 or length(coalesce(payload->>'description',''))>1000 or not exists(select 1 from pg_timezone_names where name=payload->>'timezone') then raise exception 'Check the Plan title, details and timezone.'; end if;
  if jsonb_typeof(payload->'stops')<>'array' or jsonb_array_length(payload->'stops')>30 then raise exception 'Use up to 30 activities.'; end if;
  -- Never delete unseen collaborative stops. Removals must name existing records.
  for item in select value from jsonb_array_elements(coalesce(payload->'removed_stop_ids','[]')) loop
   sid:=(item#>>'{}')::uuid;
   if not exists(select 1 from public.plan_stops where id=sid and plan_id=pid) then raise exception 'An activity changed. Review the Plan.'; end if;
   perform private.apply_living_plan_action('remove_plan_stop',jsonb_build_object('plan_id',pid,'stop_id',sid));
  end loop;
  for item in select value from jsonb_array_elements(payload->'stops') loop
   sid:=(item->>'id')::uuid;
   if sid=any(ids) then raise exception 'Duplicate activity in this save.'; end if; ids:=array_append(ids,sid);
   select * into old_stop from public.plan_stops where id=sid;
   if found and (old_stop.plan_id<>pid or private.blocked(old_stop.author_id)) then raise exception 'Activity unavailable.'; end if;
   if item->>'kind' not in ('idea','beacon','existing','decision') or nullif(btrim(item->>'title'),'') is null or length(item->>'title')>120 or length(coalesce(item->>'details',''))>2000 then raise exception 'Check each activity title and details.'; end if;
   if old_stop.id is not null and (old_stop.activity_id is not null or old_stop.thread_id is not null) then
    if old_stop.activity_id is distinct from nullif(item->>'activity_id','')::uuid or old_stop.thread_id is distinct from nullif(item->>'thread_id','')::uuid then raise exception 'Linked activities must be edited through their own controls.'; end if;
   else
    if item->>'kind' in ('existing','decision') and not private.plan_reference_allowed(pid,nullif(item->>'activity_id','')::uuid,nullif(item->>'thread_id','')::uuid) then raise exception 'Activity is not compatible with this Plan.'; end if;
    if old_stop.id is null then
     if (select count(*) from public.plan_stops where plan_id=pid and approval<>'dismissed')>=30 then raise exception 'Use up to 30 activities.'; end if;
     insert into public.plan_stops(id,plan_id,author_id,position,title,details,activity_id,thread_id)
      values(sid,pid,uid,pos,item->>'title',coalesce(item->>'details',''),nullif(item->>'activity_id','')::uuid,nullif(item->>'thread_id','')::uuid);
    else
     update public.plan_stops set title=item->>'title',details=coalesce(item->>'details',''),activity_id=nullif(item->>'activity_id','')::uuid,thread_id=nullif(item->>'thread_id','')::uuid where id=sid;
    end if;
   end if;
   update public.plan_stops set position=pos where id=sid; pos:=pos+1;
   if item->>'kind'='beacon' and (old_stop.id is null or old_stop.activity_id is null) then
    draft:=item->'beacon';
    if jsonb_typeof(draft)<>'object' or octet_length(draft::text)>49000 then raise exception 'Beacon draft unavailable.'; end if;
    insert into private.plan_editor_beacons(stop_id,payload,include) values(sid,draft,coalesce((item->>'include')::boolean,false)) on conflict(stop_id) do update set payload=excluded.payload,include=excluded.include;
    if action='schedule_plan_editor' and coalesce((item->>'include')::boolean,false) then
     if p.squad_id is not null and (draft->>'audience'<>'squad' or nullif(draft->>'audience_id','')::uuid is distinct from p.squad_id) then raise exception 'Choose this Squad as the Beacon audience.'; end if;
     if nullif(btrim(draft->>'label'),'') is null and nullif(btrim(draft->>'online_url'),'') is null and (draft->>'latitude' is null or draft->>'longitude' is null) then raise exception 'Choose a place or online destination for each selected Beacon.'; end if;
     if draft->>'draft_timing' in ('Now','In 30 min') then
      draft:=draft||jsonb_build_object('starts_at',now()+case when draft->>'draft_timing'='In 30 min' then interval '30 minutes' else interval '0 minutes' end,
       'ends_at',now()+make_interval(mins=>coalesce((draft->>'duration_minutes')::int,60))+case when draft->>'draft_timing'='In 30 min' then interval '30 minutes' else interval '0 minutes' end);
     end if;
     draft:=(draft-'id'-'return_plan_id'-'plan_stop_id'-'expected_actor_id'-'plan_id'-'plan_step'-'plan_step_index')||jsonb_build_object('return_plan_id',pid,'plan_stop_id',sid,'expected_actor_id',uid);
     created:=public.beacon_action_before_plan_editor(case when jsonb_array_length(coalesce(draft->'invitee_ids','[]'))>0 then 'create_activity_with_invitees' else 'create_activity' end,draft,gen_random_uuid());
     if coalesce((draft->'public_listing'->>'enabled')::boolean,false) then
      perform public.set_beacon_discovery((created->>'id')::uuid,true,coalesce(draft->'public_listing'->>'area',''),
       case when draft->>'latitude' is not null then round((draft->>'latitude')::numeric,2) end,
       case when draft->>'longitude' is not null then round((draft->>'longitude')::numeric,2) end);
     end if;
     delete from private.plan_editor_beacons where stop_id=sid;
    end if;
   elsif item->>'kind'='idea' then delete from private.plan_editor_beacons where stop_id=sid;
   end if;
  end loop;
  update public.plans set title=btrim(payload->>'title'),description=coalesce(payload->>'description',''),timezone=payload->>'timezone',start_date=nullif(payload->>'start_date','')::date,
   status=case when action='schedule_plan_editor' then 'scheduled' else status end,revision=revision+1 where id=pid;
  result:=jsonb_build_object('id',pid,'plan_id',pid,'revision',(select revision from public.plans where id=pid),'publications',coalesce((select jsonb_object_agg(id::text,activity_id) from public.plan_stops where plan_id=pid and activity_id is not null),'{}'::jsonb));
 elsif action='save_living_plan_template' then
  result:=public.beacon_action_before_plan_editor(action,payload,request_id);
  update public.plan_templates set stops=(select jsonb_agg(
   jsonb_build_object('title',coalesce(a.title,nullif(s.title,''),t.title),'details',case when s.activity_id is null and s.thread_id is null then s.details else '' end)||
   case when d.payload is not null then jsonb_build_object('beacon',d.payload-'invitee_ids'-'public_listing'-'starts_at'-'ends_at'-'id'-'expected_actor_id') else '{}'::jsonb end order by s.position,s.id)
   from public.plan_stops s left join private.plan_editor_beacons d on d.stop_id=s.id left join public.activities a on a.id=s.activity_id left join public.planning_threads t on t.id=s.thread_id
   where s.plan_id=(plan_editor_action.payload->>'plan_id')::uuid and s.state='active' and s.approval='approved' and not private.blocked(s.author_id)
    and (s.activity_id is null or private.can_activity(s.activity_id)) and (s.thread_id is null or private.can_read_planning_thread(s.thread_id))) where id=(editor_result.result->>'id')::uuid;
 else
  if action='edit_routine' and payload ? 'frequency' then
   select plan_id into pid from public.plan_routines where id=(payload->>'id')::uuid for update;
   if not found or not private.plan_routine_can_manage(pid) then raise exception 'Routine unavailable.'; end if;
   update public.plan_routines set frequency=payload->>'frequency',interval_count=coalesce((payload->>'interval_count')::int,1),
    anchor_date=coalesce(nullif(payload->>'anchor_date','')::date,anchor_date),month_day=coalesce((payload->>'month_day')::int,extract(day from coalesce(nullif(payload->>'anchor_date','')::date,anchor_date))::int) where id=(payload->>'id')::uuid;
  end if;
  result:=public.beacon_action_before_plan_editor(action,
   case when payload->>'frequency' in ('daily','monthly') then payload||'{"weekdays":[1,2,3,4,5,6,7],"interval_weeks":1}'::jsonb else payload end,request_id);
  rid:=coalesce(nullif(payload->>'id','')::uuid,nullif(result->>'id','')::uuid);
  if payload ? 'frequency' then
   frequency_value:=payload->>'frequency';
   update public.plan_routines set frequency=frequency_value,interval_count=coalesce((payload->>'interval_count')::int,1),
    anchor_date=coalesce(nullif(payload->>'anchor_date','')::date,anchor_date),month_day=coalesce((payload->>'month_day')::int,extract(day from coalesce(nullif(payload->>'anchor_date','')::date,anchor_date))::int) where id=rid;
   perform private.routine_next_date(rid,(select anchor_date-1 from public.plan_routines where id=rid));
   update public.plan_routines r set next_occurrence_on=case when run_mode='manual' then null else private.next_unrecorded_plan_routine_date(r.id,r.anchor_date,r.weekdays,r.interval_weeks,greatest((now() at time zone series.timezone)::date,r.anchor_date-1),r.ends_on) end from public.plans series where r.id=rid and series.id=r.plan_id;
   if exists(select 1 from public.plan_routines where id=rid and run_mode<>'manual' and next_occurrence_on is null) then raise exception 'This schedule has no upcoming dates. Check the start and end dates.'; end if;
   result:=result||jsonb_build_object('next_occurrence_on',(select next_occurrence_on from public.plan_routines where id=rid));
  end if;
 end if;
 if exists(select 1 from private.requests q where q.user_id=uid and q.request_id=plan_editor_action.request_id) then
  update private.requests q set result=editor_result.result where q.user_id=uid and q.request_id=plan_editor_action.request_id;
 else insert into private.requests(user_id,request_id,result) values(uid,plan_editor_action.request_id,editor_result.result); end if;
 return result;
end $$;
revoke all on function public.beacon_action_before_plan_editor(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.plan_editor_action(text,jsonb,uuid) from public,anon;
grant execute on function private.plan_editor_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select private.plan_editor_action(action,payload,request_id)$$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create function private.plan_editor_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('stop_id',s.id,'payload',d.payload,'include',d.include)),'[]'::jsonb) from private.plan_editor_beacons d join public.plan_stops s on s.id=d.stop_id where auth.uid() is not null and private.can_edit_living_plan(s.plan_id) and not private.blocked(s.author_id)
$$;
revoke all on function private.plan_editor_snapshot() from public,anon;
grant execute on function private.plan_editor_snapshot() to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_plan_editor;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; begin result:=public.beacon_snapshot_before_plan_editor(); return result||jsonb_build_object('plan_beacon_drafts',private.plan_editor_snapshot(),'capabilities',coalesce(result->'capabilities','{}')||'{"plan_editor":true,"recurrence_v2":true}'::jsonb); end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

-- Bounded, read-only calendar projection. The private occurrence ledger stays private.
create or replace function public.calendar_routine_occurrences(start_on date,end_on date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); routine record; child public.plans; occurrence private.plan_routine_occurrences;
 candidate date; lower_on date; rows jsonb:='[]'::jsonb; entry jsonb; truncated boolean:=false;
begin
 if uid is null then raise exception 'Sign in to view your calendar.'; end if;
 if start_on is null or end_on is null or end_on<start_on or end_on-start_on>61 then raise exception 'Choose a calendar range of 1 to 62 days.'; end if;
 for routine in select r.*,p.timezone,p.start_date from public.plan_routines r join public.plans p on p.id=r.plan_id
  where r.status='active' and r.run_mode='scheduled' and p.status='scheduled'
   and private.plan_routine_source_is_active(p.id)
   -- Preserve both Plan and Routine RLS visibility, then narrow to personal owned/joined schedules.
   and (p.owner_id=uid or (p.squad_id is not null and private.member(p.squad_id) and not private.blocked(p.owner_id)))
   and (p.owner_id=uid or exists(select 1 from public.plan_members m where m.plan_id=p.id and m.user_id=uid))
  order by r.id loop
  lower_on:=greatest(start_on,(now() at time zone routine.timezone)::date);
  candidate:=private.routine_next_date(routine.id,lower_on-1);
  while candidate is not null and candidate<=end_on loop
   entry:=null;
   select * into occurrence from private.plan_routine_occurrences o where o.routine_id=routine.id and o.occurrence_on=candidate;
   if found then
    if occurrence.status='created' and occurrence.occurrence_plan_id is not null then
     select * into child from public.plans where id=occurrence.occurrence_plan_id;
     if found and child.status='scheduled' and (child.owner_id=uid or (child.squad_id is not null and private.member(child.squad_id) and not private.blocked(child.owner_id))) then
      entry:=jsonb_build_object('routine_id',routine.id,'plan_id',routine.plan_id,'occurrence_on',candidate,'state','materialized','occurrence_plan_id',child.id);
     end if;
    end if;
    -- Skipped, missing, unreadable or cancelled child records never turn back into projections.
   elsif routine.next_occurrence_on is not null and candidate>=routine.next_occurrence_on then
    entry:=jsonb_build_object('routine_id',routine.id,'plan_id',routine.plan_id,'occurrence_on',candidate,'state','projected');
   end if;
   if entry is not null then
    if jsonb_array_length(rows)>=500 then truncated:=true; exit; end if;
    rows:=rows||jsonb_build_array(entry);
   end if;
   candidate:=private.routine_next_date(routine.id,candidate);
  end loop;
  if truncated then exit; end if;
 end loop;
 return jsonb_build_object('viewer_id',uid,'rows',rows,'truncated',truncated,'limit',500);
end $$;
revoke all on function public.calendar_routine_occurrences(date,date) from public,anon;
grant execute on function public.calendar_routine_occurrences(date,date) to authenticated;

create function public.routine_upcoming(routine_id uuid,limit_count integer default 10) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.plan_routines; p public.plans; candidate date; record private.plan_routine_occurrences; rows jsonb:='[]'; today date; attempts integer:=0; begin
 if auth.uid() is null or limit_count not between 1 and 10 then raise exception 'Choose up to ten upcoming dates.'; end if;
 select * into r from public.plan_routines where id=routine_id;
 if not found or not private.can_read_living_plan(r.plan_id) then raise exception 'Routine unavailable.'; end if;
 select * into p from public.plans where id=r.plan_id; today:=(now() at time zone p.timezone)::date;
 select coalesce(jsonb_agg(entry),'[]'::jsonb) into rows from (
  select jsonb_build_object('date',o.occurrence_on,'state','materialized','plan_id',o.occurrence_plan_id) entry
  from private.plan_routine_occurrences o where o.routine_id=r.id and o.status='created' and o.occurrence_on>=today and o.occurrence_plan_id is not null and private.can_read_living_plan(o.occurrence_plan_id)
  order by o.occurrence_on limit 10
 ) actual;
 candidate:=private.routine_next_date(r.id,case when r.next_occurrence_on=today then today-1 else today end);
 while candidate is not null and attempts<10 loop
  attempts:=attempts+1;
  select * into record from private.plan_routine_occurrences o where o.routine_id=r.id and o.occurrence_on=candidate;
  if found then
   if record.status='skipped' then rows:=rows||jsonb_build_array(jsonb_build_object('date',candidate,'state','skipped'));
   elsif record.occurrence_plan_id is not null and private.can_read_living_plan(record.occurrence_plan_id) then rows:=rows||jsonb_build_array(jsonb_build_object('date',candidate,'state','materialized','plan_id',record.occurrence_plan_id)); end if;
  else rows:=rows||jsonb_build_array(jsonb_build_object('date',candidate,'state','projected')); end if;
  candidate:=private.routine_next_date(r.id,candidate);
 end loop;
 return jsonb_build_object('viewer_id',auth.uid(),'rows',coalesce((select jsonb_agg(entry order by entry->>'date') from (select distinct on (v->>'date') v entry from jsonb_array_elements(rows) v order by v->>'date' limit limit_count) visible),'[]'::jsonb));
end $$;
revoke all on function public.routine_upcoming(uuid,integer) from public,anon;
grant execute on function public.routine_upcoming(uuid,integer) to authenticated;
