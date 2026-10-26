-- Freeze reviewed source content; keep the existing scheduler and occurrence ledger.
create table private.plan_repeat_sources (
 plan_id uuid primary key references public.plans on delete cascade,
 steps jsonb not null, defaults jsonb not null, activity_ids uuid[] not null,
 reviewed_at timestamptz not null default now()
);
revoke all on private.plan_repeat_sources from public,anon,authenticated;
alter table public.plan_routines add column source_reviewed_at timestamptz, add column source_stop_count integer;
alter table public.plans add column routine_id uuid references public.plan_routines on delete set null, add column routine_occurrence_on date;
create index plans_routine_occurrence on public.plans(routine_id,routine_occurrence_on) where routine_id is not null;

alter function private.plan_routine_steps(uuid) rename to plan_routine_steps_before_repeatable;
create function private.plan_routine_steps(pid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select steps from private.plan_repeat_sources where plan_id=pid),private.plan_routine_steps_before_repeatable(pid))
$$;
revoke all on function private.plan_routine_steps(uuid),private.plan_routine_steps_before_repeatable(uuid) from public,anon,authenticated;

create or replace function private.plan_routine_can_manage(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_edit_living_plan(pid) or (private.can_read_living_plan(pid) and exists(select 1 from public.plans where id=pid and private.admin(squad_id)))
$$;

create function private.capture_plan_repeat_source(pid uuid,confirmed boolean) returns void language plpgsql security definer set search_path='' as $$
declare p public.plans; base date; rows jsonb; controls jsonb; ids uuid[]; old_sub text; begin
 select * into p from public.plans where id=pid for update;
 if not found or not private.plan_routine_can_manage(pid) or p.status='cancelled' then raise exception 'Routine source unavailable.'; end if;
 old_sub:=current_setting('request.jwt.claim.sub',true); perform set_config('request.jwt.claim.sub',p.owner_id::text,true);
 if exists(select 1 from public.plan_stops s left join public.activities a on a.id=s.activity_id where s.plan_id=pid and not private.blocked(s.author_id) and s.approval<>'dismissed' and s.state='active'
   and (s.approval<>'approved' or s.activity_id is null or a.status='cancelled' or not private.can_activity(a.id))) and not confirmed then
  raise exception 'Review unresolved stops before repeating only confirmed activities.';
 end if;
 select min((a.starts_at at time zone p.timezone)::date) into base
 from public.plan_stops s join public.activities a on a.id=s.activity_id where s.plan_id=pid and not private.blocked(s.author_id) and s.approval='approved' and s.state='active' and a.status<>'cancelled' and private.can_activity(a.id);
 if base is null then raise exception 'Confirm at least one Beacon before repeating this Plan.'; end if;
 base:=coalesce(p.start_date,base);
 select jsonb_agg(jsonb_build_object('title',a.title,'description',coalesce(a.description,''),'category',a.category,
   'location_name',coalesce(pl.label,''),'lat',pl.latitude,'lng',pl.longitude,
   'day_offset',case when a.plan_id=pid and a.plan_step is not null then (a.plan_step->>'day_offset')::integer else (a.starts_at at time zone p.timezone)::date-base end,
   'start_time',case when a.plan_id=pid then coalesce(a.plan_step->>'start_time',to_char(a.starts_at at time zone p.timezone,'HH24:MI')) else to_char(a.starts_at at time zone p.timezone,'HH24:MI') end,
   'duration_minutes',coalesce((a.plan_step->>'duration_minutes')::integer,greatest(1,round(extract(epoch from(a.ends_at-a.starts_at))/60)::integer)),
   'start_mode',coalesce(a.plan_step->>'start_mode','specific'),'end_mode',coalesce(a.plan_step->>'end_mode','duration'),'end_time',a.plan_step->>'end_time','aspiration_ids','[]'::jsonb) order by s.position,s.id),
  jsonb_agg(jsonb_build_object('audience',a.audience,'audience_id',a.audience_id,'mode',a.mode,'approval_required',a.approval_required,'online_url',pl.online_url,'place_access',private.can_place(a.id),'controls',case when private.can_place(a.id) then private.planning_review_controls(to_jsonb(a)) else '{}'::jsonb end) order by s.position,s.id),array_agg(a.id order by s.position,s.id)
 into rows,controls,ids from public.plan_stops s join public.activities a on a.id=s.activity_id left join public.places pl on pl.activity_id=a.id and private.can_place(a.id)
 where s.plan_id=pid and not private.blocked(s.author_id) and s.approval='approved' and s.state='active' and a.status<>'cancelled' and private.can_activity(a.id);
 -- Normalize offsets to the first confirmed day; old relative/manual behavior stays intact.
 if exists(select 1 from jsonb_array_elements(rows) v where (v->>'day_offset')::integer<0) then
  select jsonb_agg(v||jsonb_build_object('day_offset',(v->>'day_offset')::integer-(select min((x->>'day_offset')::integer) from jsonb_array_elements(rows) x))) into rows from jsonb_array_elements(rows) v;
 end if;
 perform private.validate_plan_steps(rows,p.timezone,p.owner_id,false);
 insert into private.plan_repeat_sources(plan_id,steps,defaults,activity_ids) values(pid,rows,controls,ids)
 on conflict(plan_id) do update set steps=excluded.steps,defaults=excluded.defaults,activity_ids=excluded.activity_ids,reviewed_at=now();
 update public.plans set start_date=base,status='scheduled' where id=pid;
 update public.plan_routines set source_reviewed_at=now(),source_stop_count=jsonb_array_length(rows) where plan_id=pid;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
exception when others then
 if old_sub is not null then perform set_config('request.jwt.claim.sub',old_sub,true); end if; raise;
end $$;
revoke all on function private.capture_plan_repeat_source(uuid,boolean) from public,anon,authenticated;

-- A revoked source stops generation before the trusted runner attempts publication.
alter function private.plan_routine_source_is_active(uuid) rename to plan_routine_source_is_active_before_review;
create function private.plan_routine_source_is_active(pid uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid; old_sub text; source_id uuid; source private.plan_repeat_sources; position integer:=0; ok boolean:=true; begin
 if not private.plan_routine_source_is_active_before_review(pid) then return false; end if;
 select p.owner_id into owner_id from public.plans p where p.id=pid;
 old_sub:=current_setting('request.jwt.claim.sub',true); perform set_config('request.jwt.claim.sub',owner_id::text,true);
 select * into source from private.plan_repeat_sources where plan_id=pid;
 for source_id in select unnest(source.activity_ids) loop
  if not private.can_activity(source_id) or (coalesce((source.defaults->position->>'place_access')::boolean,false) and not private.can_place(source_id)) or not exists(select 1 from public.activities where id=source_id and status<>'cancelled') then ok:=false; exit; end if;
  position:=position+1;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true); return ok;
end $$;
revoke all on function private.plan_routine_source_is_active(uuid),private.plan_routine_source_is_active_before_review(uuid) from public,anon,authenticated;

create function private.decorate_repeat_plan(source_id uuid,target_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare source private.plan_repeat_sources; p public.plans; a public.activities; v jsonb; original uuid; old_sub text; begin
 select * into source from private.plan_repeat_sources where plan_id=source_id;
 if not found then return; end if;
 select * into p from public.plans where id=source_id;
 old_sub:=current_setting('request.jwt.claim.sub',true); perform set_config('request.jwt.claim.sub',p.owner_id::text,true);
 for a in select * from public.activities where plan_id=target_id order by plan_step_index loop
  v:=source.defaults->a.plan_step_index; original:=source.activity_ids[a.plan_step_index+1];
  if original is not null and not private.can_activity(original) then raise exception 'A repeat source is no longer available to its organizer.'; end if;
  if v is not null then
   perform private.validate_audience((v->>'audience')::public.audience_kind,nullif(v->>'audience_id','')::uuid);
   update public.activities set audience=(v->>'audience')::public.audience_kind,audience_id=nullif(v->>'audience_id','')::uuid,
    mode=v->>'mode',approval_required=coalesce((v->>'approval_required')::boolean,false) where id=a.id;
   update public.places set online_url=nullif(v->>'online_url','') where activity_id=a.id;
   perform private.apply_beacon_control_action('set_beacon_controls',coalesce(v->'controls','{}'::jsonb)||jsonb_build_object('id',a.id));
  end if;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
end $$;
revoke all on function private.decorate_repeat_plan(uuid,uuid) from public,anon,authenticated;

create function private.decorate_routine_occurrence() returns trigger language plpgsql security definer set search_path='' as $$
declare source_id uuid; begin
 if new.status='created' and new.occurrence_plan_id is not null then
  select plan_id into source_id from public.plan_routines where id=new.routine_id;
  if source_id=new.occurrence_plan_id then return new; end if;
  perform private.decorate_repeat_plan(source_id,new.occurrence_plan_id);
  update public.plans set routine_id=new.routine_id,routine_occurrence_on=new.occurrence_on where id=new.occurrence_plan_id;
 end if; return new;
end $$;
revoke all on function private.decorate_routine_occurrence() from public,anon,authenticated;
create trigger reviewed_routine_occurrence after insert on private.plan_routine_occurrences for each row execute function private.decorate_routine_occurrence();
update public.plans p set routine_id=o.routine_id,routine_occurrence_on=o.occurrence_on from private.plan_routine_occurrences o where o.occurrence_plan_id=p.id;

-- Existing routines retain their exact current itinerary as the first reviewed version.
insert into private.plan_repeat_sources(plan_id,steps,defaults,activity_ids)
 select p.id,private.plan_routine_steps_before_repeatable(p.id),
 coalesce((select jsonb_agg(jsonb_build_object('audience',a.audience,'audience_id',a.audience_id,'mode',a.mode,'approval_required',a.approval_required,'online_url',pl.online_url,'place_access',true,'controls',private.planning_review_controls(to_jsonb(a))) order by a.plan_step_index) from public.activities a left join public.places pl on pl.activity_id=a.id where a.plan_id=p.id),'[]'::jsonb),
 array(select a.id from public.activities a where a.plan_id=p.id order by a.plan_step_index)
 from public.plans p where exists(select 1 from public.plan_routines r where r.plan_id=p.id);
update public.plan_routines r set source_reviewed_at=s.reviewed_at,source_stop_count=jsonb_array_length(s.steps) from private.plan_repeat_sources s where s.plan_id=r.plan_id;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_repeatable_plans;
create function private.repeatable_plan_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
<<repeatable_result>>
declare uid uuid:=auth.uid(); result jsonb; pid uuid; a public.activities; rid uuid; begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 if action in ('repeat_beacon','update_routine_source','create_routine','edit_routine','run_routine_now','skip_routine_next') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into result from private.requests r where r.user_id=uid and r.request_id=repeatable_plan_action.request_id;
  if found then return result; end if;
  if action='repeat_beacon' then
   select * into a from public.activities where id=(payload->>'activity_id')::uuid;
   if not found or a.status='cancelled' or a.mode='solo' or not private.can_activity(a.id) or (a.owner_id<>uid and not private.can_manage_beacon(a.id)) then raise exception 'Only authorized Beacon organizers can repeat it.'; end if;
   select jsonb_build_object('id',r.id,'plan_id',r.plan_id,'next_occurrence_on',r.next_occurrence_on,'already_exists',true) into result
    from public.plan_routines r join public.plans p on p.id=r.plan_id
    where p.routine_source and p.owner_id=uid and r.status<>'ended' and exists(select 1 from public.plan_stops s where s.plan_id=p.id and s.activity_id=a.id)
    order by r.created_at desc limit 1;
   if result is not null then insert into private.requests(user_id,request_id,result) values(uid,request_id,result); return result; end if;
   insert into public.plans(owner_id,squad_id,title,description,timezone,start_date,status,routine_source)
    values(uid,case when a.audience='squad' then a.audience_id end,a.title,coalesce(a.description,''),a.timezone,(a.starts_at at time zone a.timezone)::date,'scheduled',true) returning id into pid;
   insert into public.plan_stops(plan_id,author_id,position,activity_id) values(pid,uid,0,a.id);
   perform private.capture_plan_repeat_source(pid,true);
   result:=public.beacon_action_before_repeatable_plans('create_routine',payload||jsonb_build_object('plan_id',pid),request_id);
  elsif action='create_routine' then
   pid:=(payload->>'plan_id')::uuid;
   perform 1 from public.plans where id=pid for update;
   if not private.plan_routine_can_manage(pid) then raise exception 'Routine unavailable.'; end if;
   select jsonb_build_object('id',r.id,'plan_id',r.plan_id,'next_occurrence_on',r.next_occurrence_on,'already_exists',true) into result from public.plan_routines r where r.plan_id=pid and r.status<>'ended' order by r.created_at desc limit 1;
   if result is not null then insert into private.requests(user_id,request_id,result) values(uid,request_id,result); return result; end if;
   perform private.capture_plan_repeat_source(pid,coalesce((payload->>'confirmed_source')::boolean,false));
   result:=public.beacon_action_before_repeatable_plans(action,payload,request_id);
  elsif action='update_routine_source' then
   select plan_id,id into pid,rid from public.plan_routines where id=(payload->>'id')::uuid for update;
   if not found or not private.plan_routine_can_manage(pid) then raise exception 'Routine unavailable.'; end if;
   perform private.capture_plan_repeat_source(pid,coalesce((payload->>'confirmed_source')::boolean,false));
   result:=jsonb_build_object('id',rid,'plan_id',pid);
   insert into private.requests(user_id,request_id,result) values(uid,request_id,result);
  else
   if action='skip_routine_next' and payload ? 'expected_occurrence_on' then
    select plan_id into pid from public.plan_routines where id=(payload->>'id')::uuid for update;
    if not found or not private.plan_routine_can_manage(pid) then raise exception 'Routine unavailable.'; end if;
    if (select next_occurrence_on from public.plan_routines where id=(payload->>'id')::uuid) is distinct from (payload->>'expected_occurrence_on')::date then raise exception 'The next repeat changed. Refresh before skipping it.'; end if;
   end if;
   if action='edit_routine' and coalesce((payload->>'update_source')::boolean,false) then
    select plan_id into pid from public.plan_routines where id=(payload->>'id')::uuid for update;
    perform private.capture_plan_repeat_source(pid,coalesce((payload->>'confirmed_source')::boolean,false));
   end if;
   result:=public.beacon_action_before_repeatable_plans(action,payload,request_id);
   if action='run_routine_now' then
    select plan_id into pid from public.plan_routines where id=(payload->>'id')::uuid;
    perform private.decorate_repeat_plan(pid,(result->>'occurrence_plan_id')::uuid);
    update public.plans set routine_id=(payload->>'id')::uuid where id=(result->>'occurrence_plan_id')::uuid;
   end if;
  end if;
  if action in ('repeat_beacon','create_routine') then
   -- The source itinerary already exists. Record it rather than generating it again.
   insert into private.plan_routine_occurrences(routine_id,occurrence_on,occurrence_plan_id,status)
    select (result->>'id')::uuid,p.start_date,p.id,'created' from public.plans p where p.id=pid on conflict do nothing;
   update public.plan_routines r set next_occurrence_on=private.next_unrecorded_plan_routine_date(r.id,r.anchor_date,r.weekdays,r.interval_weeks,(now() at time zone p.timezone)::date,r.ends_on)
    from public.plans p where r.id=(result->>'id')::uuid and p.id=r.plan_id and r.run_mode<>'manual';
   result:=result||jsonb_build_object('next_occurrence_on',(select next_occurrence_on from public.plan_routines where id=(result->>'id')::uuid));
   update private.requests r set result=repeatable_result.result where r.user_id=uid and r.request_id=repeatable_plan_action.request_id;
   update public.plan_routines r set source_reviewed_at=s.reviewed_at,source_stop_count=jsonb_array_length(s.steps) from private.plan_repeat_sources s where r.id=(result->>'id')::uuid and s.plan_id=r.plan_id;
  end if;
  return result;
 end if;
 return public.beacon_action_before_repeatable_plans(action,payload,request_id);
end $$;
revoke all on function public.beacon_action_before_repeatable_plans(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.repeatable_plan_action(text,jsonb,uuid) from public,anon;
grant execute on function private.repeatable_plan_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$ select private.repeatable_plan_action(action,payload,request_id); $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_repeatable_plans;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$ declare result jsonb; begin
 result:=public.beacon_snapshot_before_repeatable_plans();
 return result||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}'::jsonb)||'{"repeatable_plans":true}'::jsonb);
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
