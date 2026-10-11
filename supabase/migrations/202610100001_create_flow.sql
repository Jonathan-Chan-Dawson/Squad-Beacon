-- Extend the existing Plan/Beacon writers; no second activity or template model.
alter table
  public.activities
add
  column plan_step jsonb;

alter table
  public.activities
add
  column plan_started_at timestamptz;

alter table
  public.activities
add
  column template_source_id text;

alter table
  public.plan_routines
add
  column run_mode text not null default 'scheduled' check(run_mode in ('scheduled', 'manual'));

create function private.plan_beacon_end(step jsonb, starts timestamptz, zone text) returns timestamptz language plpgsql stable
set
  search_path = '' as $ $ declare ends timestamptz;

local_day date :=(starts at time zone zone) :: date;

begin if step ->> 'end_mode' = 'manual' then return starts + interval '366 days';

end if;

if step ->> 'end_mode' = 'specific' then if coalesce(step ->> 'end_time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Choose a valid end time.';

end if;

ends :=(local_day +(step ->> 'end_time') :: time) at time zone zone;

if ends <= starts then ends :=((local_day + 1) +(step ->> 'end_time') :: time) at time zone zone;

end if;

if to_char(ends at time zone zone, 'HH24:MI') <> step ->> 'end_time' then raise exception 'That local time does not exist because of a clock change.';

end if;

if ends - starts > interval '24 hours' then raise exception 'A Beacon can last up to 24 hours.';

end if;

return ends;

end if;

return starts +(step ->> 'duration_minutes') :: int * interval '1 minute';

end $ $;

create function private.resolve_plan_steps(steps jsonb, start_date date, zone text) returns jsonb language plpgsql stable
set
  search_path = '' as $ $ declare step jsonb;

result jsonb := '[]';

starts timestamptz;

ends timestamptz;

previous_end timestamptz;

begin for step in
select
  value
from
  jsonb_array_elements(steps) loop if coalesce(step ->> 'start_mode', 'specific') not in ('specific', 'after_previous', 'manual')
  or coalesce(step ->> 'end_mode', 'duration') not in ('duration', 'specific', 'manual') then raise exception 'Choose valid Plan timing behavior.';

end if;

if step ->> 'start_mode' = 'after_previous' then if previous_end is null then raise exception 'The first Beacon needs a specific time or manual start.';

end if;

starts := previous_end;

else starts :=(
  (start_date +(step ->> 'day_offset') :: int) +(step ->> 'start_time') :: time
) at time zone zone;

if (starts at time zone zone) <>(
  (start_date +(step ->> 'day_offset') :: int) +(step ->> 'start_time') :: time
) then raise exception 'That local time does not exist because of a clock change.';

end if;

end if;

-- A manual end has an estimate in the reusable itinerary, never a fixed deadline.
ends := private.plan_beacon_end(
  case
    when step ->> 'end_mode' = 'manual' then step || jsonb_build_object('end_mode', 'duration')
    else step
  end,
  starts,
  zone
);

step := step || jsonb_build_object(
  'day_offset',
(starts at time zone zone) :: date - start_date,
  'start_time',
  to_char(starts at time zone zone, 'HH24:MI'),
  'duration_minutes',
  round(
    extract(
      epoch
      from
        (ends - starts)
    ) / 60
  ) :: int
);

result := result || jsonb_build_array(step);

previous_end := ends;

end loop;

return result;

end $ $;

create function private.prepare_plan_beacon() returns trigger language plpgsql security definer
set
  search_path = '' as $ $ declare previous public.activities;

begin if new.plan_id is null
or new.plan_step is null then return new;

end if;

if coalesce(new.plan_step ->> 'start_mode', 'specific') not in ('specific', 'after_previous', 'manual')
or coalesce(new.plan_step ->> 'end_mode', 'duration') not in ('duration', 'specific', 'manual') then raise exception 'Choose valid Plan timing behavior.';

end if;

if new.plan_step ->> 'start_mode' = 'after_previous' then
select
  * into previous
from
  public.activities
where
  plan_id = new.plan_id
  and plan_step_index = new.plan_step_index -1;

if not found then raise exception 'The first Beacon cannot start after a previous Beacon.';

end if;

end if;

if new.plan_step ->> 'start_mode' = 'manual'
or (
  new.plan_step ->> 'start_mode' = 'after_previous'
  and (
    previous.plan_started_at is null
    or previous.plan_step ->> 'end_mode' = 'manual'
  )
) then new.plan_started_at := null;

-- Pending Beacons stay scheduled, away from live discovery. The itinerary
-- keeps its estimated local times in plan_step, used by templates/Routines.
new.starts_at := greatest(new.starts_at, now()) + interval '366 days';

new.ends_at := new.starts_at +(new.plan_step ->> 'duration_minutes') :: int * interval '1 minute';

else new.plan_started_at := new.starts_at;

if new.plan_step ->> 'end_mode' = 'manual' then new.ends_at := new.starts_at + interval '366 days';

end if;

end if;

return new;

end $ $;

create trigger prepare_plan_beacon before
insert
  on public.activities for each row execute function private.prepare_plan_beacon();

-- Retain the established writer's authorization, conflict checking and places.
do $ $ declare definition text;

original text;

begin
select
  pg_get_functiondef(
    'private.apply_plan_action(text,jsonb)' :: regprocedure
  ) into definition;

original := definition;

definition := replace(
  definition,
  'aspiration_ids,description)',
  'aspiration_ids,description,plan_step)'
);

definition := replace(
  definition,
  'coalesce(step->>''description'','''')) returning id',
  'coalesce(step->>''description'',''''),step) returning id'
);

definition := replace(
  definition,
  'insert into public.plans(owner_id,squad_id,title,description,timezone,start_date)',
  'steps:=private.resolve_plan_steps(steps,start_date,timezone_name); insert into public.plans(owner_id,squad_id,title,description,timezone,start_date)'
);

if definition = original
or position('description,plan_step)' in definition) = 0 then raise exception 'Plan writer patch failed.';

end if;

execute definition;

end $ $;

-- Source metadata survives manual execution, template saves and each repeat.
create
or replace function private.plan_routine_steps(pid uuid) returns jsonb language sql stable security definer
set
  search_path = '' as $ $
select
  coalesce(
    jsonb_agg(
      coalesce(
        a.plan_step,
        jsonb_build_object(
          'title',
          a.title,
          'description',
          coalesce(a.description, ''),
          'category',
          a.category,
          'location_name',
          coalesce(pl.label, ''),
          'lat',
          pl.latitude,
          'lng',
          pl.longitude,
          'day_offset',
(a.starts_at at time zone p.timezone) :: date - p.start_date,
          'start_time',
          to_char(a.starts_at at time zone p.timezone, 'HH24:MI'),
          'duration_minutes',
          greatest(
            1,
            round(
              extract(
                epoch
                from
                  (a.ends_at - a.starts_at)
              ) / 60
            ) :: integer
          ),
          'aspiration_ids',
          to_jsonb(a.aspiration_ids)
        )
      ) || jsonb_build_object(
        'title',
        a.title,
        'description',
        coalesce(a.description, ''),
        'category',
        a.category,
        'location_name',
        coalesce(pl.label, ''),
        'lat',
        pl.latitude,
        'lng',
        pl.longitude,
        'aspiration_ids',
        to_jsonb(a.aspiration_ids)
      )
      order by
        a.plan_step_index,
        a.starts_at
    ),
    '[]' :: jsonb
  )
from
  public.plans p
  join public.activities a on a.plan_id = p.id
  left join public.places pl on pl.activity_id = a.id
where
  p.id = pid $ $;

create function private.advance_plan_beacon() returns trigger language plpgsql security definer
set
  search_path = '' as $ $ declare following public.activities;

actual_start timestamptz;

zone text;

begin if new.plan_id is null
or new.status = 'cancelled'
or new.plan_started_at is null then return new;

end if;

if new.status <> 'completed'
and new.plan_step ->> 'end_mode' = 'manual' then return new;

end if;

select
  * into following
from
  public.activities
where
  plan_id = new.plan_id
  and plan_step_index = new.plan_step_index + 1
  and status = 'scheduled' for
update
;

if following.id is not null
and following.plan_step ->> 'start_mode' = 'after_previous' then actual_start := new.ends_at;

select
  timezone into zone
from
  public.plans
where
  id = new.plan_id;

update
  public.activities
set
  starts_at = actual_start,
  plan_started_at = actual_start,
  ends_at = private.plan_beacon_end(plan_step, actual_start, zone)
where
  id = following.id;

end if;

return new;

end $ $;

create trigger advance_plan_beacon
after
update
  of status,
  starts_at,
  ends_at on public.activities for each row execute function private.advance_plan_beacon();

alter function public.beacon_action(text, jsonb, uuid) rename to beacon_action_create_flow_legacy;

revoke all on function public.beacon_action_create_flow_legacy(text, jsonb, uuid)
from
  public,
  anon,
  authenticated;

do $ $ declare definition text;

begin
select
  pg_get_functiondef(
    'public.beacon_action_create_flow_legacy(text,jsonb,uuid)' :: regprocedure
  ) into definition;

definition := replace(
  definition,
  'beacon_action.request_id',
  'beacon_action_create_flow_legacy.request_id'
);

execute definition;

end $ $;

create function public.beacon_action(
  action text,
  payload jsonb default '{}',
  request_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer
set
  search_path = '' as $ $ < < create_flow > > declare uid uuid := auth.uid();

prior jsonb;

result jsonb;

source public.plans;

activity public.activities;

previous public.activities;

routine public.plan_routines;

pid uuid;

aid uuid;

position_value int;

total int;

steps jsonb;

step jsonb;

shifted jsonb := '[]';

first_start timestamptz;

starts timestamptz;

run_start timestamptz;

local_day date;

step_index int;

begin if uid is null then raise exception 'Sign in to continue.';

end if;

perform pg_advisory_xact_lock(hashtextextended(uid :: text, 0));

select
  r.result into prior
from
  private.requests r
where
  r.user_id = uid
  and r.request_id = beacon_action.request_id;

if found then return prior;

end if;

if action = 'create_plan_beacon' then pid := nullif(payload ->> 'plan_id', '') :: uuid;

select
  * into source
from
  public.plans
where
  id = pid for
update
;

if not found
or source.owner_id <> uid
or source.status <> 'scheduled' then raise exception 'Plan unavailable.';

end if;

select
  count(*) into total
from
  public.activities
where
  plan_id = pid;

position_value :=(payload ->> 'position') :: int;

if total >= 30
or position_value is null
or position_value < 0
or position_value > total then raise exception 'Choose a valid position in this Plan.';

end if;

if payload ->> 'audience' is distinct
from
  (
    case
      when source.squad_id is null then 'private'
      else 'squad'
    end
  )
  or nullif(payload ->> 'audience_id', '') :: uuid is distinct
from
  source.squad_id then raise exception 'Use the Plan audience for this Beacon.';

end if;

if exists(
  select
    1
  from
    public.activities a
  where
    a.plan_id = pid
    and a.status = 'scheduled'
    and (payload ->> 'starts_at') :: timestamptz < a.ends_at
    and (payload ->> 'ends_at') :: timestamptz > a.starts_at
) then raise exception 'This Beacon overlaps another Beacon in the Plan.';

end if;

result := public.beacon_action_create_flow_legacy(
  'create_activity',
  payload,
  beacon_action.request_id
);

aid :=(result ->> 'id') :: uuid;

update
  public.activities
set
  plan_step_index = plan_step_index + 1
where
  plan_id = pid
  and plan_step_index >= position_value;

update
  public.activities
set
  plan_id = pid,
  plan_step_index = position_value,
  plan_started_at = starts_at,
  template_source_id = left(payload ->> 'template_source_id', 200)
where
  id = aid
  and owner_id = uid;

result := result || jsonb_build_object('plan_id', pid, 'event', action);

update
  private.requests r
set
  result = create_flow.result
where
  r.user_id = uid
  and r.request_id = beacon_action.request_id;

return result;

elsif action in ('start_plan_beacon', 'end_plan_beacon') then
select
  * into activity
from
  public.activities
where
  id = nullif(payload ->> 'id', '') :: uuid for
update
;

if not found
or activity.owner_id <> uid
or activity.plan_id is null
or activity.status <> 'scheduled' then raise exception 'Plan Beacon unavailable.';

end if;

select
  * into source
from
  public.plans
where
  id = activity.plan_id;

if source.status <> 'scheduled' then raise exception 'This Plan is cancelled.';

end if;

if action = 'start_plan_beacon' then if activity.plan_started_at is not null then raise exception 'This Beacon has already started or is scheduled to start.';

end if;

if activity.plan_step ->> 'start_mode' = 'after_previous' then
select
  * into previous
from
  public.activities
where
  plan_id = activity.plan_id
  and plan_step_index = activity.plan_step_index -1;

if previous.status <> 'completed'
and (
  previous.plan_started_at is null
  or previous.ends_at > now()
  or previous.plan_step ->> 'end_mode' = 'manual'
) then raise exception 'End the previous Beacon first.';

end if;

end if;

update
  public.activities
set
  plan_started_at = now(),
  starts_at = now(),
  ends_at = private.plan_beacon_end(plan_step, now(), source.timezone)
where
  id = activity.id;

else if activity.plan_started_at is null
or activity.starts_at > now() then raise exception 'Start this Beacon first.';

end if;

update
  public.activities
set
  status = 'completed',
  ends_at = greatest(starts_at + interval '1 second', now())
where
  id = activity.id;

end if;

result := jsonb_build_object('id', activity.id, 'event', action);

elsif action = 'run_routine_now' then
select
  * into routine
from
  public.plan_routines
where
  id = nullif(payload ->> 'id', '') :: uuid for
update
;

if not found
or routine.status = 'ended'
or not private.plan_routine_can_manage(routine.plan_id)
or not private.plan_routine_source_is_active(routine.plan_id) then raise exception 'Routine unavailable.';

end if;

select
  * into source
from
  public.plans
where
  id = routine.plan_id;

steps := private.plan_routine_steps(source.id);

if jsonb_array_length(steps) = 0 then raise exception 'This Routine needs at least one Beacon.';

end if;

run_start := date_trunc('minute', now()) + interval '2 minutes';

local_day :=(run_start at time zone source.timezone) :: date;

select
  min(
    (
      (source.start_date +(value ->> 'day_offset') :: int) +(value ->> 'start_time') :: time
    ) at time zone source.timezone
  ) into first_start
from
  jsonb_array_elements(steps);

for step in
select
  value
from
  jsonb_array_elements(steps) loop starts :=(
    (source.start_date +(step ->> 'day_offset') :: int) +(step ->> 'start_time') :: time
  ) at time zone source.timezone;

starts := run_start +(starts - first_start);

step := step || jsonb_build_object(
  'day_offset',
(starts at time zone source.timezone) :: date - local_day,
  'start_time',
  to_char(starts at time zone source.timezone, 'HH24:MI')
);

if step ->> 'end_mode' = 'specific' then step := step || jsonb_build_object(
  'end_time',
  to_char(
    (
      starts +(step ->> 'duration_minutes') :: int * interval '1 minute'
    ) at time zone source.timezone,
    'HH24:MI'
  )
);

end if;

shifted := shifted || jsonb_build_array(step);

end loop;

-- Preserve the source owner and permissions just as scheduled occurrences do.
perform set_config(
  'request.jwt.claim.sub',
  source.owner_id :: text,
  true
);

result := private.apply_plan_action(
  'create_plan',
  jsonb_build_object(
    'title',
    source.title,
    'description',
    source.description,
    'timezone',
    source.timezone,
    'start_date',
    local_day,
    'squad_id',
    source.squad_id,
    'steps',
    shifted
  )
);

update
  public.places target_place
set
  online_url = source_place.online_url
from
  public.activities target_activity
  join public.activities source_activity on source_activity.plan_id = source.id
  and source_activity.plan_step_index = target_activity.plan_step_index
  join public.places source_place on source_place.activity_id = source_activity.id
where
  target_place.activity_id = target_activity.id
  and target_activity.plan_id =(result ->> 'id') :: uuid;

perform set_config('request.jwt.claim.sub', uid :: text, true);

result := result || jsonb_build_object(
  'occurrence_plan_id',
  result ->> 'id',
  'event',
  action
);

elsif action in ('create_routine', 'edit_routine') then if action = 'edit_routine' then
select
  * into routine
from
  public.plan_routines
where
  id = nullif(payload ->> 'id', '') :: uuid;

payload := payload || jsonb_build_object(
  'run_mode',
  coalesce(
    payload ->> 'run_mode',
    routine.run_mode,
    'scheduled'
  )
);

end if;

if coalesce(payload ->> 'run_mode', 'scheduled') not in ('manual', 'scheduled') then raise exception 'Choose a start behavior.';

end if;

result := public.beacon_action_create_flow_legacy(action, payload, beacon_action.request_id);

update
  public.plan_routines
set
  run_mode = coalesce(payload ->> 'run_mode', 'scheduled'),
  status =case
    when payload ->> 'run_mode' = 'manual' then 'paused'
    when action = 'edit_routine'
    and routine.run_mode = 'manual' then 'active'
    else status
  end,
  next_occurrence_on =case
    when payload ->> 'run_mode' = 'manual' then null
    else next_occurrence_on
  end
where
  id =(result ->> 'id') :: uuid;

select
  * into routine
from
  public.plan_routines
where
  id =(result ->> 'id') :: uuid;

result := result || jsonb_build_object(
  'run_mode',
  routine.run_mode,
  'status',
  routine.status,
  'next_occurrence_on',
  routine.next_occurrence_on
);

update
  private.requests r
set
  result = create_flow.result
where
  r.user_id = uid
  and r.request_id = beacon_action.request_id;

return result;

else result := public.beacon_action_create_flow_legacy(action, payload, beacon_action.request_id);

if action = 'create_activity'
and payload ? 'template_source_id' then
update
  public.activities
set
  template_source_id = left(payload ->> 'template_source_id', 200)
where
  id =(result ->> 'id') :: uuid
  and owner_id = uid;

end if;

if action = 'add_council_proposal'
and payload ->> 'approve_if_manager' = 'true'
and private.can_manage_planning_thread((payload ->> 'thread_id') :: uuid) then perform private.apply_planning_action(
  'approve_council_proposal',
  jsonb_build_object(
    'thread_id',
    payload ->> 'thread_id',
    'proposal_id',
    result ->> 'id',
    'approved',
    true
  )
);

end if;

return result;

end if;

perform private.limit_action('all', 300);

insert into
  private.requests(user_id, request_id, result)
values
(uid, beacon_action.request_id, result);

return result;

end $ $;

revoke all on function public.beacon_action(text, jsonb, uuid)
from
  public,
  anon;

grant execute on function public.beacon_action(text, jsonb, uuid) to authenticated;

revoke all on function private.prepare_plan_beacon(),
private.advance_plan_beacon(),
private.plan_beacon_end(jsonb, timestamptz, text),
private.resolve_plan_steps(jsonb, date, text)
from
  public,
  anon,
  authenticated;