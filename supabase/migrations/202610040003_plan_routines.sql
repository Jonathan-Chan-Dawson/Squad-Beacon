-- Beacon Plan membership and recurring Plan occurrences. Each Routine keeps its
-- original Plan/Beacon steps as the template; generated occurrences go through
-- private.apply_plan_action('create_plan', ...), so Plan validation and writes
-- remain centralized.

create table public.plan_members (
  plan_id uuid not null references public.plans on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(plan_id,user_id)
);
alter table public.plan_members enable row level security;
revoke all on public.plan_members from public,anon,authenticated;
grant select on public.plan_members to authenticated;
create policy read_plan_members on public.plan_members for select to authenticated using(
 exists(select 1 from public.plans p where p.id=plan_id and
  (p.owner_id=auth.uid() or (p.squad_id is not null and private.member(p.squad_id) and not private.blocked(p.owner_id))))
);

create table public.plan_routines (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  weekdays smallint[] not null check(cardinality(weekdays) between 1 and 7),
  interval_weeks smallint not null check(interval_weeks between 1 and 52),
  anchor_date date not null,
  ends_on date,
  reminder_minutes integer check(reminder_minutes between 1 and 10080),
  status text not null default 'active' check(status in ('active','paused','ended')),
  next_occurrence_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_on is null or ends_on>=anchor_date),
  check(next_occurrence_on is null or ends_on is null or next_occurrence_on<=ends_on)
);
create index plan_routines_next_active on public.plan_routines(next_occurrence_on) where status='active';
create index plan_routines_plan on public.plan_routines(plan_id,created_at desc);
alter table public.plan_routines enable row level security;
revoke all on public.plan_routines from public,anon,authenticated;
grant select on public.plan_routines to authenticated;
create policy read_plan_routines on public.plan_routines for select to authenticated using(
 exists(select 1 from public.plans p where p.id=plan_id and
  (p.owner_id=auth.uid() or (p.squad_id is not null and private.member(p.squad_id) and not private.blocked(p.owner_id))))
);

create table private.plan_routine_occurrences (
  routine_id uuid not null references public.plan_routines on delete cascade,
  occurrence_on date not null,
  occurrence_plan_id uuid references public.plans on delete set null,
  status text not null check(status in ('created','skipped')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(routine_id,occurrence_on)
);
create index plan_routine_occurrence_reminders on private.plan_routine_occurrences(reminder_sent_at,occurrence_on) where status='created';

create function private.next_plan_routine_date(anchor date,weekdays smallint[],interval_weeks integer,after_date date,ends_on date default null)
returns date language plpgsql immutable set search_path='' as $$
declare candidate date; anchor_monday date; candidate_monday date; day_offset integer;
begin
 if anchor is null or after_date is null or cardinality(weekdays) not between 1 and 7
   or interval_weeks not between 1 and 52
   or exists(select 1 from unnest(weekdays) day where day<1 or day>7)
   or (select count(*) from unnest(weekdays))<>(select count(distinct day) from unnest(weekdays) day)
   or (ends_on is not null and ends_on<anchor) then
  raise exception 'Invalid routine schedule.';
 end if;
 anchor_monday:=anchor-(extract(isodow from anchor)::integer-1);
 for day_offset in 0..(366*52) loop
  candidate:=greatest(anchor,after_date+1)+day_offset;
  if ends_on is not null and candidate>ends_on then return null; end if;
  if extract(isodow from candidate)::integer=any(weekdays::integer[]) then
   candidate_monday:=candidate-(extract(isodow from candidate)::integer-1);
   if ((candidate_monday-anchor_monday)/7)>=0 and ((candidate_monday-anchor_monday)/7)%interval_weeks=0 then
    return candidate;
   end if;
  end if;
 end loop;
 return null;
end $$;

create function private.next_unrecorded_plan_routine_date(routine_id uuid,anchor date,weekdays smallint[],interval_weeks integer,after_date date,ends_on date)
returns date language plpgsql stable security definer set search_path='' as $$
declare candidate date; attempts integer:=0;
begin
 candidate:=private.next_plan_routine_date(anchor,weekdays,interval_weeks,after_date,ends_on);
 while candidate is not null and attempts<366*52 loop
  if not exists(select 1 from private.plan_routine_occurrences o where o.routine_id=next_unrecorded_plan_routine_date.routine_id and o.occurrence_on=candidate) then
   return candidate;
  end if;
  candidate:=private.next_plan_routine_date(anchor,weekdays,interval_weeks,candidate,ends_on);
  attempts:=attempts+1;
 end loop;
 return null;
end $$;

create function private.plan_routine_can_manage(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.plans p where p.id=pid and
  (p.owner_id=auth.uid() or (p.squad_id is not null and private.admin(p.squad_id) and not private.blocked(p.owner_id))))
$$;

create function private.plan_routine_steps(pid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'title',a.title,'description',coalesce(a.description,''),'category',a.category,
  'location_name',coalesce(pl.label,''),'lat',pl.latitude,'lng',pl.longitude,
  'day_offset',(a.starts_at at time zone p.timezone)::date-p.start_date,
  'start_time',to_char(a.starts_at at time zone p.timezone,'HH24:MI'),
  'duration_minutes',greatest(1,round(extract(epoch from (a.ends_at-a.starts_at))/60)::integer),
  'aspiration_ids',to_jsonb(a.aspiration_ids)
 ) order by a.plan_step_index,a.starts_at),'[]'::jsonb)
 from public.plans p join public.activities a on a.plan_id=p.id
 left join public.places pl on pl.activity_id=a.id
 where p.id=pid
$$;

create function private.plan_routine_source_is_active(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.plans p where p.id=pid and p.status='scheduled' and
  (p.squad_id is null or exists(
   select 1 from public.squad_members m join public.squads s on s.id=m.squad_id
   where m.squad_id=p.squad_id and m.user_id=p.owner_id and not exists(
    select 1 from public.blocks b where (b.blocker_id=p.owner_id and b.blocked_id=s.owner_id)
      or (b.blocker_id=s.owner_id and b.blocked_id=p.owner_id)
   )
  )))
$$;

create function private.materialize_plan_routine_occurrence(routine_id uuid,occurrence_on date) returns uuid
language plpgsql security definer set search_path='' as $$
declare routine public.plan_routines; source_plan public.plans; steps jsonb; action_result jsonb; occurrence_plan_id uuid;
 old_sub text; source_step record; target_activity_id uuid;
begin
 select * into routine from public.plan_routines where id=routine_id;
 if routine.id is null or routine.status<>'active' then raise exception 'Routine unavailable.'; end if;
 select * into source_plan from public.plans where id=routine.plan_id;
 if source_plan.id is null or not private.plan_routine_source_is_active(source_plan.id) then raise exception 'The source Beacon Plan is no longer active or accessible.'; end if;
 select o.occurrence_plan_id into occurrence_plan_id from private.plan_routine_occurrences o
  where o.routine_id=materialize_plan_routine_occurrence.routine_id
   and o.occurrence_on=materialize_plan_routine_occurrence.occurrence_on;
 if found then
  if occurrence_plan_id is not null then return occurrence_plan_id; end if;
  raise exception 'This routine date was already skipped.';
 end if;
 steps:=private.plan_routine_steps(source_plan.id);
 if jsonb_array_length(steps)=0 then raise exception 'The source Beacon Plan has no Beacons to repeat.'; end if;
 old_sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',source_plan.owner_id::text,true);
 action_result:=private.apply_plan_action('create_plan',jsonb_build_object(
  'title',left(source_plan.title,100-char_length(' · '||to_char(occurrence_on,'Mon DD, YYYY')))||' · '||to_char(occurrence_on,'Mon DD, YYYY'),
  'description',source_plan.description,
  'timezone',source_plan.timezone,
  'start_date',occurrence_on,
  'squad_id',source_plan.squad_id,
  'steps',steps
 ));
 -- PlanStep predates online Beacon links; preserve a virtual destination from
 -- the source Place after the shared Plan writer has made its validated rows.
 for source_step in select a.plan_step_index,pl.online_url from public.activities a
   join public.places pl on pl.activity_id=a.id
   where a.plan_id=source_plan.id and pl.online_url is not null order by a.plan_step_index loop
  target_activity_id:=(action_result->'activity_ids'->>source_step.plan_step_index)::uuid;
  update public.places set online_url=source_step.online_url where activity_id=target_activity_id;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 occurrence_plan_id:=(action_result->>'id')::uuid;
 insert into private.plan_routine_occurrences(routine_id,occurrence_on,occurrence_plan_id,status)
  values(routine.id,occurrence_on,occurrence_plan_id,'created');
 return occurrence_plan_id;
end $$;

create function private.apply_plan_membership_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); pid uuid:=nullif(payload->>'plan_id','')::uuid; plan_row public.plans; member_row public.plan_members;
begin
 select * into plan_row from public.plans where id=pid for update;
 if not found or plan_row.status<>'scheduled' or plan_row.squad_id is null
  or not private.member(plan_row.squad_id) or private.blocked(plan_row.owner_id) then
  raise exception 'This Beacon Plan is unavailable to join.';
 end if;
 if plan_row.owner_id=uid then raise exception 'You are already the owner of this Beacon Plan.'; end if;
 if action='join_plan' then
  insert into public.plan_members(plan_id,user_id) values(plan_row.id,uid) on conflict(plan_id,user_id) do nothing;
  select * into member_row from public.plan_members where plan_id=plan_row.id and user_id=uid;
  return jsonb_build_object('plan_id',plan_row.id,'user_id',uid,'joined',true,'joined_at',member_row.joined_at);
 elsif action='leave_plan' then
  delete from public.plan_members where plan_id=plan_row.id and user_id=uid;
  if not found then raise exception 'You have not joined this Beacon Plan.'; end if;
  return jsonb_build_object('plan_id',plan_row.id,'user_id',uid,'joined',false);
 end if;
 raise exception 'Unknown Beacon Plan membership action.';
end $$;

create function private.apply_plan_routine_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); rid uuid:=nullif(payload->>'id','')::uuid; pid uuid:=nullif(payload->>'plan_id','')::uuid;
 routine public.plan_routines; plan_row public.plans; weekdays_value smallint[]; interval_value integer;
 ends_value date; reminder_value integer; local_today date; next_date date; occurrence_plan_id uuid; result jsonb;
begin
 if action='create_routine' then
  select * into plan_row from public.plans where id=pid for update;
  if not found or not private.plan_routine_can_manage(plan_row.id) or plan_row.status<>'scheduled' then
   raise exception 'Only the Plan owner or a scoped Squad admin can make this Plan a Routine.';
  end if;
  weekdays_value:=array(select value::smallint from jsonb_array_elements_text(coalesce(payload->'weekdays','[]'::jsonb)) value);
  interval_value:=coalesce(nullif(payload->>'interval_weeks','')::integer,1);
  ends_value:=nullif(payload->>'ends_on','')::date;
  reminder_value:=nullif(payload->>'reminder_minutes','')::integer;
  if cardinality(weekdays_value) not between 1 and 7 or exists(select 1 from unnest(weekdays_value) day where day<1 or day>7)
    or (select count(*) from unnest(weekdays_value))<>(select count(distinct day) from unnest(weekdays_value) day)
    or interval_value not between 1 and 52 or (ends_value is not null and ends_value<plan_row.start_date)
    or (reminder_value is not null and reminder_value not between 1 and 10080) then
   raise exception 'Check the weekdays, repeat interval, end date, and reminder timing.';
  end if;
  if jsonb_array_length(private.plan_routine_steps(plan_row.id))=0 then raise exception 'A Routine needs at least one Beacon in its source Plan.'; end if;
  local_today:=(now() at time zone plan_row.timezone)::date;
  next_date:=private.next_plan_routine_date(plan_row.start_date,weekdays_value,interval_value,local_today,ends_value);
  if next_date is null then raise exception 'This Routine has no upcoming date before its end date.'; end if;
  insert into public.plan_routines(plan_id,owner_id,weekdays,interval_weeks,anchor_date,ends_on,reminder_minutes,next_occurrence_on)
   values(plan_row.id,plan_row.owner_id,weekdays_value,interval_value,plan_row.start_date,ends_value,reminder_value,next_date)
   returning * into routine;
  return jsonb_build_object('id',routine.id,'plan_id',routine.plan_id,'next_occurrence_on',routine.next_occurrence_on);
 end if;

 select * into routine from public.plan_routines where id=rid for update;
 if not found or not private.plan_routine_can_manage(routine.plan_id) then raise exception 'Routine unavailable.'; end if;
 select * into plan_row from public.plans where id=routine.plan_id;
 if action='edit_routine' then
  if routine.status='ended' then raise exception 'An ended Routine cannot be edited.'; end if;
  weekdays_value:=case when payload ? 'weekdays' then array(select value::smallint from jsonb_array_elements_text(coalesce(payload->'weekdays','[]'::jsonb)) value) else routine.weekdays end;
  interval_value:=case when payload ? 'interval_weeks' then (payload->>'interval_weeks')::integer else routine.interval_weeks end;
  ends_value:=case when payload ? 'ends_on' then nullif(payload->>'ends_on','')::date else routine.ends_on end;
  reminder_value:=case when payload ? 'reminder_minutes' then nullif(payload->>'reminder_minutes','')::integer else routine.reminder_minutes end;
  if cardinality(weekdays_value) not between 1 and 7 or exists(select 1 from unnest(weekdays_value) day where day<1 or day>7)
    or (select count(*) from unnest(weekdays_value))<>(select count(distinct day) from unnest(weekdays_value) day)
    or interval_value not between 1 and 52 or (ends_value is not null and ends_value<routine.anchor_date)
    or (reminder_value is not null and reminder_value not between 1 and 10080) then
   raise exception 'Check the weekdays, repeat interval, end date, and reminder timing.';
  end if;
  local_today:=(now() at time zone plan_row.timezone)::date;
  next_date:=private.next_unrecorded_plan_routine_date(routine.id,routine.anchor_date,weekdays_value,interval_value,local_today,ends_value);
  update public.plan_routines set weekdays=weekdays_value,interval_weeks=interval_value,ends_on=ends_value,
   reminder_minutes=reminder_value,next_occurrence_on=next_date,
   status=case when next_date is null then 'ended' else status end,updated_at=now()
   where id=routine.id returning * into routine;
 elsif action='pause_routine' then
  if routine.status<>'active' then raise exception 'Only an active Routine can be paused.'; end if;
  update public.plan_routines set status='paused',updated_at=now() where id=routine.id returning * into routine;
 elsif action='resume_routine' then
  if routine.status<>'paused' then raise exception 'Only a paused Routine can be resumed.'; end if;
  local_today:=(now() at time zone plan_row.timezone)::date;
  next_date:=private.next_unrecorded_plan_routine_date(routine.id,routine.anchor_date,routine.weekdays,routine.interval_weeks,local_today,routine.ends_on);
  update public.plan_routines set status=case when next_date is null then 'ended' else 'active' end,
   next_occurrence_on=next_date,updated_at=now() where id=routine.id returning * into routine;
 elsif action='end_routine' then
  if routine.status='ended' then raise exception 'This Routine has already ended.'; end if;
  update public.plan_routines set status='ended',next_occurrence_on=null,updated_at=now() where id=routine.id returning * into routine;
 elsif action in ('skip_routine_next','run_routine_once') then
  if routine.status<>'active' or routine.next_occurrence_on is null then raise exception 'This Routine has no upcoming date.'; end if;
  if action='skip_routine_next' then
   insert into private.plan_routine_occurrences(routine_id,occurrence_on,status)
    values(routine.id,routine.next_occurrence_on,'skipped') on conflict(routine_id,occurrence_on) do nothing;
  else
   occurrence_plan_id:=private.materialize_plan_routine_occurrence(routine.id,routine.next_occurrence_on);
  end if;
  next_date:=private.next_unrecorded_plan_routine_date(routine.id,routine.anchor_date,routine.weekdays,routine.interval_weeks,routine.next_occurrence_on,routine.ends_on);
  update public.plan_routines set status=case when next_date is null then 'ended' else 'active' end,
   next_occurrence_on=next_date,updated_at=now() where id=routine.id returning * into routine;
  result:=jsonb_build_object('occurrence_plan_id',occurrence_plan_id);
 else raise exception 'Unknown Routine action.';
 end if;
 return jsonb_build_object('id',routine.id,'plan_id',routine.plan_id,'status',routine.status,
  'next_occurrence_on',routine.next_occurrence_on)||coalesce(result,'{}'::jsonb);
end $$;

-- Service-role runner creates upcoming occurrences before they are due and
-- queues configured reminder notices. It never runs with an end-user token.
create function public.run_due_plan_routines(horizon_days integer default 30) returns integer
language plpgsql security definer set search_path='' as $$
declare routine public.plan_routines; source_plan public.plans; local_today date; horizon date; occurrence date;
 made integer:=0; attempts integer; old_sub text; run_row record; first_start timestamptz; beacon_id uuid; recipient uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Only the service role may run Beacon Plan Routines.'; end if;
 if horizon_days not between 1 and 60 then raise exception 'Routine runner horizon must be between 1 and 60 days.'; end if;
 for routine in select * from public.plan_routines where status='active' and next_occurrence_on is not null
  order by next_occurrence_on,id for update skip locked loop
  select * into source_plan from public.plans where id=routine.plan_id;
  if source_plan.id is null or not private.plan_routine_source_is_active(source_plan.id) then
   update public.plan_routines set status='ended',next_occurrence_on=null,updated_at=now() where id=routine.id;
   continue;
  end if;
  local_today:=(now() at time zone source_plan.timezone)::date;
  horizon:=local_today+horizon_days;
  attempts:=0;
  while routine.next_occurrence_on is not null and routine.next_occurrence_on<=horizon and attempts<60 loop
   occurrence:=routine.next_occurrence_on;
   if occurrence<local_today then
    insert into private.plan_routine_occurrences(routine_id,occurrence_on,status) values(routine.id,occurrence,'skipped') on conflict(routine_id,occurrence_on) do nothing;
   else
    begin
     perform private.materialize_plan_routine_occurrence(routine.id,occurrence);
     made:=made+1;
    exception when others then
     if sqlerrm='That local time does not exist because of a clock change.' then
      insert into private.plan_routine_occurrences(routine_id,occurrence_on,status)
       values(routine.id,occurrence,'skipped') on conflict(routine_id,occurrence_on) do nothing;
     else raise;
     end if;
    end;
   end if;
   routine.next_occurrence_on:=private.next_unrecorded_plan_routine_date(routine.id,routine.anchor_date,routine.weekdays,routine.interval_weeks,occurrence,routine.ends_on);
   if routine.next_occurrence_on is null then routine.status:='ended'; end if;
   attempts:=attempts+1;
  end loop;
  update public.plan_routines set next_occurrence_on=routine.next_occurrence_on,status=routine.status,updated_at=now()
   where id=routine.id;
 end loop;

 for run_row in
  select occurrence.routine_id,occurrence.occurrence_on,occurrence.occurrence_plan_id,
   r.owner_id,r.reminder_minutes,p.title,p.timezone
  from private.plan_routine_occurrences occurrence
  join public.plan_routines r on r.id=occurrence.routine_id
  join public.plans p on p.id=occurrence.occurrence_plan_id
  where occurrence.status='created' and occurrence.reminder_sent_at is null and r.reminder_minutes is not null
 loop
  select a.starts_at,a.id into first_start,beacon_id from public.activities a
   where a.plan_id=run_row.occurrence_plan_id and a.status='scheduled' order by a.plan_step_index,a.starts_at limit 1;
  if first_start is not null and first_start>now() and first_start<=now()+make_interval(mins=>run_row.reminder_minutes)
    and first_start-make_interval(mins=>run_row.reminder_minutes)<=now() then
   update private.plan_routine_occurrences set reminder_sent_at=now()
    where routine_id=run_row.routine_id and occurrence_on=run_row.occurrence_on and reminder_sent_at is null;
   if found then
    for recipient in select run_row.owner_id union
      select user_id from public.plan_members where plan_id=run_row.occurrence_plan_id loop
     perform private.notify(recipient,null,'Reminder: '||run_row.title||' is coming up in your Beacon Plan.',beacon_id);
    end loop;
   end if;
  end if;
 end loop;
 return made;
end $$;
revoke all on function public.run_due_plan_routines(integer) from public,anon,authenticated;
grant execute on function public.run_due_plan_routines(integer) to service_role;

-- If pg_cron is enabled in the target Supabase project, install a service-claim
-- runner job. Otherwise follow the exact deployment command in the Plans inventory.
do $$
declare job_exists boolean;
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute 'select exists(select 1 from cron.job where jobname=$1)' into job_exists using 'beacon-plan-routines';
  if not job_exists then
   execute format('select cron.schedule(%L,%L,%L)',
    'beacon-plan-routines','*/15 * * * *',
    'do $job$ begin perform set_config(''request.jwt.claim.role'',''service_role'',true); perform public.run_due_plan_routines(); end $job$;');
  end if;
 end if;
end $$;

-- A cancelled source Plan no longer drives a Routine.
create function private.end_plan_routines_on_cancel() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status='cancelled' and old.status is distinct from new.status then
  update public.plan_routines set status='ended',next_occurrence_on=null,updated_at=now()
   where plan_id=new.id and status<>'ended';
 end if;
 return new;
end $$;
create trigger end_plan_routines_after_cancel after update of status on public.plans
for each row execute function private.end_plan_routines_on_cancel();

revoke all on function private.next_plan_routine_date(date,smallint[],integer,date,date),
 private.next_unrecorded_plan_routine_date(uuid,date,smallint[],integer,date,date),
 private.plan_routine_can_manage(uuid),private.plan_routine_steps(uuid),private.plan_routine_source_is_active(uuid),
 private.materialize_plan_routine_occurrence(uuid,date),private.apply_plan_membership_action(text,jsonb),
 private.apply_plan_routine_action(text,jsonb),private.end_plan_routines_on_cancel()
 from public,anon,authenticated;

-- Repair the wrapper's qualified parameter references before each rename. A
-- function rename does not rewrite PL/pgSQL source aliases inside its body.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_organizations_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 if position('beacon_action.request_id' in definition)>0 then
  definition:=replace(definition,'beacon_action.request_id','beacon_action_organizations_legacy.request_id');
  execute definition;
 end if;
 select pg_get_functiondef('public.beacon_action(text,jsonb,uuid)'::regprocedure) into definition;
 if position('beacon_action.request_id' in definition)>0 then
  definition:=replace(definition,'beacon_action.request_id','beacon_action_plan_routines_legacy.request_id');
  execute definition;
 end if;
end $$;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_plan_routines_legacy;
revoke all on function public.beacon_action_plan_routines_legacy(text,jsonb,uuid) from public,anon,authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prior jsonb; result jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action in ('join_plan','leave_plan','create_routine','edit_routine','pause_routine','resume_routine',
   'skip_routine_next','end_routine','run_routine_once') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
  if found then return prior; end if;
  perform private.limit_action('all',300);
  if action in ('join_plan','leave_plan') then result:=private.apply_plan_membership_action(action,payload);
  else result:=private.apply_plan_routine_action(action,payload); end if;
  result:=result||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 return public.beacon_action_plan_routines_legacy(action,payload,beacon_action.request_id);
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

-- Extend the currently installed snapshot without replacing unrelated privacy,
-- Organization, group-chat, and Beacon-module projections.
do $snapshot_patch$
declare definition text; original_definition text; old_list text; new_list text;
begin
 select pg_get_functiondef('public.beacon_snapshot()'::regprocedure) into definition;
 original_definition:=definition;
 old_list:='''group_messages'',''group_message_reads'']';
 new_list:='''group_messages'',''group_message_reads'',''plan_members'',''plan_routines'']';
 if position(old_list in definition)=0 then
  old_list:='''beacon_team_members'',''beacon_memories'']';
  new_list:='''beacon_team_members'',''beacon_memories'',''plan_members'',''plan_routines'']';
 end if;
 definition:=replace(definition,old_list,new_list);
 if definition=original_definition or position('plan_members' in definition)=0 then
  raise exception 'Could not add Beacon Plan membership and Routines to the snapshot.';
 end if;
 execute definition;
end $snapshot_patch$;

-- Deployment fallback when pg_cron is not available:
-- select public.run_due_plan_routines();
-- Call every 15 minutes from a trusted server-side scheduler using a Supabase
-- service-role JWT; never expose the service key to a client application.
