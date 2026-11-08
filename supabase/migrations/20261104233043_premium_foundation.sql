-- Verified grants are an integration boundary, never a client-editable subscription.
create table private.premium_grants (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 tier text not null check(tier in ('plus','pro')),
 verified_at timestamptz not null default now(),
 valid_until timestamptz,
 revoked_at timestamptz,
 check(valid_until is null or valid_until > verified_at)
);
alter table private.premium_grants enable row level security;
revoke all on private.premium_grants from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.premium_grants to service_role;

create function private.premium_tier(owner uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select tier from private.premium_grants where owner_id=owner and revoked_at is null and (valid_until is null or valid_until>now())),'free')
$$;
revoke all on function private.premium_tier(uuid) from public,anon,authenticated;

-- SQL authority mirrors the typed client catalog; parity is covered by database tests.
create function private.premium_limits(tier text) returns jsonb language sql immutable set search_path='' as $$
 select case tier when 'pro' then '{"beacon_templates":null,"plan_templates":null,"squad_boosts":5}'::jsonb
 when 'plus' then '{"beacon_templates":50,"plan_templates":10,"squad_boosts":2}'::jsonb
 else '{"beacon_templates":10,"plan_templates":2,"squad_boosts":0}'::jsonb end
$$;
revoke all on function private.premium_limits(text) from public,anon,authenticated;

create function private.check_personal_template_quota() returns trigger language plpgsql security definer set search_path='' as $$
declare used integer; cap integer; kind text; begin
 if tg_table_name='plan_templates' then
  if new.squad_id is not null then return new; end if;
  if tg_op='UPDATE' and old.squad_id is null and old.owner_id=new.owner_id then return new; end if;
  kind:='Plan';
 else
  if tg_op='UPDATE' and old.owner_id=new.owner_id then return new; end if;
  kind:='Beacon';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
 if kind='Beacon' then
  cap:=(private.premium_limits(private.premium_tier(new.owner_id))->>'beacon_templates')::integer;
  select count(*) into used from public.templates where owner_id=new.owner_id;
 else
  cap:=(private.premium_limits(private.premium_tier(new.owner_id))->>'plan_templates')::integer;
  select count(*) into used from public.plan_templates where owner_id=new.owner_id and squad_id is null;
 end if;
 if cap is not null and used>=cap then
  raise exception 'PREMIUM_QUOTA: %/% personal % templates saved. % Existing templates stay available.',used,cap,kind,
   case when private.premium_tier(new.owner_id)='plus' then 'BEACON+ Pro offers unlimited templates.' else 'BEACON+ offers more saved templates.' end;
 end if;
 return new;
end $$;
revoke all on function private.check_personal_template_quota() from public,anon,authenticated;
create trigger personal_beacon_template_quota before insert or update on public.templates for each row execute function private.check_personal_template_quota();
create trigger personal_plan_template_quota before insert or update on public.plan_templates for each row execute function private.check_personal_template_quota();

alter table public.plan_routines add column premium_pause_reason text check(premium_pause_reason is null or premium_pause_reason='plus_required');
create function private.routine_premium_allowed(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select r.run_mode='manual' or jsonb_array_length(private.plan_routine_steps(r.plan_id))<=1 or private.premium_tier(r.owner_id) in ('plus','pro') from public.plan_routines r where r.id=rid),false)
$$;
revoke all on function private.routine_premium_allowed(uuid) from public,anon,authenticated;

create function private.pause_own_premium_routines() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
 update public.plan_routines r set status='paused',premium_pause_reason='plus_required',updated_at=now()
 where r.owner_id=auth.uid() and r.status='active' and not private.routine_premium_allowed(r.id);
end $$;
revoke all on function private.pause_own_premium_routines() from public,anon;
grant execute on function private.pause_own_premium_routines() to authenticated;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_premium;
create function private.premium_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; rid uuid; uid uuid:=auth.uid(); begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 -- All template writers and retries share the same account lock.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into result from private.requests r where r.user_id=uid and r.request_id=premium_action.request_id;
 if found then return result; end if;
 result:=public.beacon_action_before_premium(action,payload,request_id);
 if action in ('repeat_beacon','create_routine','edit_routine','update_routine_source','resume_routine','run_routine_once','run_routine_now') then
  rid:=coalesce(nullif(payload->>'id','')::uuid,nullif(result->>'id','')::uuid);
  if not private.routine_premium_allowed(rid) then
   raise exception 'PREMIUM_REQUIRED: Multi-Beacon repeats need the Routine owner''s BEACON+ membership. Single-Beacon repeats and manual Plan reuse are Free.';
  end if;
  if action in ('resume_routine','edit_routine') then update public.plan_routines set premium_pause_reason=null where id=rid; end if;
 end if;
 return result;
end $$;
revoke all on function public.beacon_action_before_premium(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.premium_action(text,jsonb,uuid) from public,anon;
grant execute on function private.premium_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select private.premium_action(action,payload,request_id)$$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

-- Guard trusted materialization independently of client action entrypoints.
alter function private.materialize_plan_routine_occurrence(uuid,date) rename to materialize_plan_routine_before_premium;
create or replace function private.materialize_plan_routine_before_premium(routine_id uuid,occurrence_on date) returns uuid
language plpgsql security definer set search_path='' as $$
declare routine public.plan_routines; source_plan public.plans; steps jsonb; action_result jsonb; occurrence_plan_id uuid;
 old_sub text; source_step record; target_activity_id uuid;
begin
 select * into routine from public.plan_routines where id=routine_id;
 if routine.id is null or routine.status<>'active' then raise exception 'Routine unavailable.'; end if;
 select * into source_plan from public.plans where id=routine.plan_id;
 if source_plan.id is null or not private.plan_routine_source_is_active(source_plan.id) then raise exception 'The source Beacon Plan is no longer active or accessible.'; end if;
 select o.occurrence_plan_id into occurrence_plan_id from private.plan_routine_occurrences o
  where o.routine_id=materialize_plan_routine_before_premium.routine_id
   and o.occurrence_on=materialize_plan_routine_before_premium.occurrence_on;
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
create function private.materialize_plan_routine_occurrence(routine_id uuid,occurrence_on date) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not private.routine_premium_allowed(routine_id) then raise exception 'PREMIUM_REQUIRED: Multi-Beacon repeats need BEACON+.'; end if;
 return private.materialize_plan_routine_before_premium(routine_id,occurrence_on);
end $$;
revoke all on function private.materialize_plan_routine_before_premium(uuid,date),private.materialize_plan_routine_occurrence(uuid,date) from public,anon,authenticated;

create function private.personal_premium_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); tier text; until_at timestamptz; begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 tier:=private.premium_tier(uid);
 if tier<>'free' then select g.valid_until into until_at from private.premium_grants g where g.owner_id=uid; end if;
 return jsonb_build_object('owner_id',uid,'tier',tier,'source',case when tier='free' then 'free' else 'verified' end,'valid_until',until_at,
 'usage',jsonb_build_object('beacon_templates',(select count(*) from public.templates where owner_id=uid),'plan_templates',(select count(*) from public.plan_templates where owner_id=uid and squad_id is null)));
end $$;
revoke all on function private.personal_premium_snapshot() from public,anon;
grant execute on function private.personal_premium_snapshot() to authenticated;

-- Restrict context projections to authorized Plans; never publish another owner's grant.
create function private.read_routine_premium(rid uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare pid uuid; begin
 select plan_id into pid from public.plan_routines where id=rid;
 if auth.uid() is null or not private.can_read_living_plan(pid) then return false; end if;
 return private.routine_premium_allowed(rid);
end $$;
revoke all on function private.read_routine_premium(uuid) from public,anon;
grant execute on function private.read_routine_premium(uuid) to authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_premium;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; begin
 perform private.pause_own_premium_routines();
 result:=public.beacon_snapshot_before_premium();
 return result||jsonb_build_object('premium',private.personal_premium_snapshot(),
 'plan_routines',coalesce((select jsonb_agg(r||jsonb_build_object('premium_eligible',private.read_routine_premium((r->>'id')::uuid))||
 case when r->>'status'='active' and not private.read_routine_premium((r->>'id')::uuid)
 then '{"status":"paused","premium_pause_reason":"plus_required"}'::jsonb else '{}'::jsonb end) from jsonb_array_elements(result->'plan_routines') r),'[]'::jsonb),
 'capabilities',coalesce(result->'capabilities','{}'::jsonb)||'{"premium":true}'::jsonb);
end $$;
revoke all on function public.beacon_snapshot_before_premium() from public,anon,authenticated;
-- The existing invoker snapshot chain needs its previous entrypoint.
grant execute on function public.beacon_snapshot_before_premium() to authenticated;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

create or replace function public.run_due_plan_routines(horizon_days integer default 30) returns integer
language plpgsql security definer set search_path='' as $$
declare routine public.plan_routines; source_plan public.plans; local_today date; horizon date; occurrence date;
 made integer:=0; attempts integer; old_sub text; run_row record; first_start timestamptz; beacon_id uuid; recipient uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Only the service role may run Beacon Plan Routines.'; end if;
 if horizon_days not between 1 and 60 then raise exception 'Routine runner horizon must be between 1 and 60 days.'; end if;
 for routine in select * from public.plan_routines where status='active' and next_occurrence_on is not null
  order by next_occurrence_on,id for update skip locked loop
  if not private.routine_premium_allowed(routine.id) then
   update public.plan_routines set status='paused',premium_pause_reason='plus_required',updated_at=now() where id=routine.id;
   continue;
  end if;
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


-- A deferred constraint sees the final state of legacy create/edit operations,
-- including their subsequent switch to manual mode. Internal dispatcher calls
-- cannot bypass eligibility by skipping the public Premium wrapper.
create function private.enforce_routine_premium() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.plan_routines r where r.id=new.id and r.status='active' and not private.routine_premium_allowed(r.id)) then
  raise exception 'PREMIUM_REQUIRED: Scheduled multi-Beacon routines need the owner''s BEACON+ membership.';
 end if;
 return null;
end $$;
revoke all on function private.enforce_routine_premium() from public,anon,authenticated;
create constraint trigger routine_premium_write after insert or update on public.plan_routines deferrable initially deferred for each row execute function private.enforce_routine_premium();
