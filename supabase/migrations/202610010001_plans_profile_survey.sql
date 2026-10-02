-- Plans group scheduled beacons; templates can be personal or squad-scoped.
alter table public.profiles
 add column identity_tags text[] not null default '{}',
 add column aspiration_goals jsonb not null default '[]'::jsonb check(jsonb_typeof(aspiration_goals)='array'),
 add column onboarding_survey_status text not null default 'pending' check(onboarding_survey_status in ('pending','skipped','completed'));

-- Accounts that existed before the survey should not be unexpectedly gated.
update public.profiles set onboarding_survey_status='skipped';

create table public.plans (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles on delete cascade,
 squad_id uuid references public.squads on delete cascade,
 title text not null check(length(title) between 1 and 100),
 description text not null default '' check(length(description)<=1000),
 timezone text not null,
 start_date date not null,
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 created_at timestamptz not null default now()
);
create index plans_owner_created on public.plans(owner_id,created_at desc);
create index plans_squad_created on public.plans(squad_id,created_at desc) where squad_id is not null;

create table public.plan_templates (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles on delete cascade,
 squad_id uuid references public.squads on delete cascade,
 title text not null check(length(title) between 1 and 100),
 description text not null default '' check(length(description)<=1000),
 timezone text not null,
 steps jsonb not null check(jsonb_typeof(steps)='array'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index plan_templates_owner on public.plan_templates(owner_id) where squad_id is null;
create index plan_templates_squad on public.plan_templates(squad_id) where squad_id is not null;

alter table public.activities
 add column plan_id uuid references public.plans on delete set null,
 add column plan_step_index integer,
 add column aspiration_ids text[] not null default '{}',
 add constraint activities_plan_step_pair check((plan_id is null)=(plan_step_index is null)),
 add constraint activities_plan_step_nonnegative check(plan_step_index is null or plan_step_index>=0);
create unique index activities_plan_step on public.activities(plan_id,plan_step_index) where plan_id is not null;
create function private.clear_plan_step_link() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.plan_id is null then new.plan_step_index:=null; end if;
 return new;
end $$;
revoke all on function private.clear_plan_step_link() from public,anon,authenticated;
create trigger clear_plan_step_link before update of plan_id on public.activities
for each row execute function private.clear_plan_step_link();

alter table public.plans enable row level security;
alter table public.plan_templates enable row level security;
revoke all on public.plans,public.plan_templates from public,anon,authenticated;
grant select on public.plans,public.plan_templates to authenticated;
create policy read_plans on public.plans for select to authenticated using(
 owner_id=auth.uid() or (squad_id is not null and private.member(squad_id) and not private.blocked(owner_id))
);
create policy read_plan_templates on public.plan_templates for select to authenticated using(
 (squad_id is null and owner_id=auth.uid()) or
 (squad_id is not null and private.member(squad_id) and not private.blocked(owner_id))
);

create or replace function private.validate_plan_aspirations(ids jsonb,owner uuid) returns text[]
language plpgsql security definer set search_path='' as $$
declare result text[]:='{}'; aspiration_id text;
begin
 if ids is null then return '{}'; end if;
 if jsonb_typeof(ids) is distinct from 'array' then raise exception 'Choose up to 20 aspirations for a beacon.'; end if;
 if jsonb_array_length(ids)>20 then raise exception 'Choose up to 20 aspirations for a beacon.'; end if;
 for aspiration_id in select jsonb_array_elements_text(ids) loop
  if length(trim(aspiration_id)) not between 1 and 80 or not exists(
   select 1 from public.profiles p,jsonb_array_elements(p.aspiration_goals) goal
   where p.id=owner and goal->>'id'=aspiration_id
  ) then raise exception 'Choose aspirations from your profile.'; end if;
  if not aspiration_id=any(result) then result:=array_append(result,aspiration_id); end if;
 end loop;
 return result;
end $$;
revoke all on function private.validate_plan_aspirations(jsonb,uuid) from public,anon,authenticated;

create or replace function private.validate_plan_steps(steps jsonb,timezone_name text,owner uuid,check_aspiration_ids boolean default true) returns void
language plpgsql security definer set search_path='' as $$
declare step jsonb; latitude double precision; longitude double precision; duration int; day_offset int;
begin
 if steps is null or jsonb_typeof(steps) is distinct from 'array' then raise exception 'A plan needs between 1 and 30 beacons.'; end if;
 if jsonb_array_length(steps) not between 1 and 30 then raise exception 'A plan needs between 1 and 30 beacons.'; end if;
 if not exists(select 1 from pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone.'; end if;
 for step in select value from jsonb_array_elements(steps) loop
  if coalesce(length(trim(step->>'title')),0) not between 1 and 120 then raise exception 'Beacon titles must be 1 to 120 characters.'; end if;
  if coalesce(length(step->>'description'),0)>2000 or coalesce(length(step->>'location_name'),0)>200 then raise exception 'Check the description and location lengths.'; end if;
  if coalesce(step->>'category','') not in ('Fitness','Study','Gaming','Creative','Social','Other') then raise exception 'Choose a valid beacon category.'; end if;
  if coalesce(step->>'day_offset','') !~ '^\d{1,3}$' then raise exception 'Beacon dates must be within one year of the plan start.'; end if;
  day_offset:=(step->>'day_offset')::int;
  if day_offset not between 0 and 365 then raise exception 'Beacon dates must be within one year of the plan start.'; end if;
  if coalesce(step->>'start_time','') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Choose a valid beacon start time.'; end if;
  if coalesce(step->>'duration_minutes','') !~ '^\d{1,4}$' then raise exception 'Choose a duration from 1 to 1440 minutes.'; end if;
  duration:=(step->>'duration_minutes')::int;
  if duration not between 1 and 1440 then raise exception 'Choose a duration from 1 to 1440 minutes.'; end if;
  if (nullif(step->>'lat','') is null)<>(nullif(step->>'lng','') is null) then raise exception 'Choose a complete map location.'; end if;
  if nullif(step->>'lat','') is not null then
   latitude:=(step->>'lat')::double precision; longitude:=(step->>'lng')::double precision;
   if latitude not between -90 and 90 or longitude not between -180 and 180 then raise exception 'Choose a valid map location.'; end if;
  end if;
  if check_aspiration_ids then perform private.validate_plan_aspirations(case when jsonb_typeof(step->'aspiration_ids')='array' then step->'aspiration_ids' else '[]'::jsonb end,owner); end if;
 end loop;
end $$;
revoke all on function private.validate_plan_steps(jsonb,text,uuid,boolean) from public,anon,authenticated;

create or replace function private.save_survey_profile(payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare tags text[]; goals jsonb; tag text; goal jsonb; seen text[]:='{}'; goal_id text; target int;
begin
 if payload ? 'identity_tags' then
  if jsonb_typeof(payload->'identity_tags') is distinct from 'array' then raise exception 'Choose up to 50 valid identity tags.'; end if;
  if jsonb_array_length(payload->'identity_tags')>50 then raise exception 'Choose up to 50 valid identity tags.'; end if;
 for tag in select jsonb_array_elements_text(payload->'identity_tags') loop
   if length(trim(tag)) not between 1 and 60 then raise exception 'Identity tags must be 1 to 60 characters.'; end if;
   tag:=trim(tag);
   if not tag=any(seen) then seen:=array_append(seen,tag); end if;
  end loop;
  tags:=seen;
 end if;
 if payload ? 'aspiration_goals' then
  goals:=payload->'aspiration_goals';
  if jsonb_typeof(goals) is distinct from 'array' then raise exception 'Choose up to 20 aspirations.'; end if;
  if jsonb_array_length(goals)>20 then raise exception 'Choose up to 20 aspirations.'; end if;
  for goal in select value from jsonb_array_elements(goals) loop
   goal_id:=goal->>'id';
   if coalesce(length(trim(goal_id)),0) not between 1 and 80 or coalesce(length(trim(goal->>'title')),0) not between 1 and 100 or coalesce(length(trim(goal->>'category')),0) not between 1 and 60 or coalesce(goal->>'target_per_week','') !~ '^\d{1,2}$' then raise exception 'Check each aspiration and its weekly target.'; end if;
   target:=(goal->>'target_per_week')::int;
   if target not between 1 and 7 then raise exception 'Weekly aspiration targets must be from 1 to 7.'; end if;
  end loop;
 end if;
 if payload ? 'onboarding_survey_status' and coalesce(payload->>'onboarding_survey_status','') not in ('pending','skipped','completed') then raise exception 'Choose a valid survey status.'; end if;
 update public.profiles set
  identity_tags=case when payload ? 'identity_tags' then tags else identity_tags end,
  aspiration_goals=case when payload ? 'aspiration_goals' then goals else aspiration_goals end,
  onboarding_survey_status=case when payload ? 'onboarding_survey_status' then payload->>'onboarding_survey_status' else onboarding_survey_status end
 where id=auth.uid();
end $$;
revoke all on function private.save_survey_profile(jsonb) from public,anon,authenticated;

create or replace function private.apply_plan_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 uid uuid:=auth.uid(); rid uuid:=nullif(payload->>'id','')::uuid; squad uuid:=nullif(payload->>'squad_id','')::uuid;
 template_id uuid:=nullif(payload->>'template_id','')::uuid; item uuid; activity_id uuid; plan_row public.plans; template public.plan_templates;
 title text:=trim(coalesce(payload->>'title','')); description text:=coalesce(payload->>'description',''); timezone_name text:=payload->>'timezone';
 start_date date; steps jsonb; step jsonb; step_index int; starts timestamptz; ends timestamptz; aspiration_ids text[];
 result jsonb:='{}'; activity_ids jsonb:='[]'::jsonb; local_today date; recipient uuid; cancelled_ids uuid[]:='{}'; starts_list timestamptz[]:='{}'; ends_list timestamptz[]:='{}'; prior int;
begin
 if not exists(select 1 from public.profiles where id=uid) then raise exception 'Finish your profile first.'; end if;
 perform private.limit_action('all',300);
 if action='save_plan_template' then
  if length(title) not between 1 and 100 or length(description)>1000 then raise exception 'Add a template title and a description under 1000 characters.'; end if;
  if not exists(select 1 from pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone.'; end if;
  perform private.validate_plan_steps(payload->'steps',timezone_name,uid,squad is null);
  steps:=payload->'steps';
  if squad is not null then
   select jsonb_agg(value||jsonb_build_object('aspiration_ids','[]'::jsonb) order by ordinality) into steps from jsonb_array_elements(steps) with ordinality;
  end if;
  if squad is not null and not private.admin(squad) then raise exception 'Only squad admins can edit squad plan templates.'; end if;
  if rid is not null then
   select * into template from public.plan_templates where id=rid for update;
   if template.id is null then raise exception 'Template unavailable.'; end if;
   if template.squad_id is distinct from squad then raise exception 'Template scope cannot be changed.'; end if;
   if (squad is null and template.owner_id<>uid) or (squad is not null and not private.admin(squad)) then raise exception 'Template unavailable.'; end if;
   update public.plan_templates set title=title,description=description,timezone=timezone_name,steps=steps,updated_at=now() where id=rid;
   item:=rid;
  else
   insert into public.plan_templates(owner_id,squad_id,title,description,timezone,steps) values(uid,squad,title,description,timezone_name,steps) returning id into item;
  end if;
  result:=jsonb_build_object('id',item);
 elsif action='delete_plan_template' then
  select * into template from public.plan_templates where id=rid for update;
  if template.id is null then raise exception 'Template unavailable.'; end if;
  if (template.squad_id is null and template.owner_id<>uid) or (template.squad_id is not null and not private.admin(template.squad_id)) then raise exception 'You cannot delete this template.'; end if;
  delete from public.plan_templates where id=rid;
 elsif action='create_plan' then
  if length(title) not between 1 and 100 or length(description)>1000 then raise exception 'Add a plan title and a description under 1000 characters.'; end if;
  if not exists(select 1 from pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone.'; end if;
  if squad is not null and not private.member(squad) then raise exception 'Join that squad before creating a plan for it.'; end if;
  if template_id is not null then
   select * into template from public.plan_templates where id=template_id;
   if template.id is null or
     (template.squad_id is null and template.owner_id<>uid) or
     (template.squad_id is not null and (template.squad_id is distinct from squad or not private.member(template.squad_id))) then raise exception 'That plan template is unavailable.'; end if;
   if payload ? 'steps' then steps:=payload->'steps'; else steps:=template.steps; end if;
  else steps:=payload->'steps'; end if;
  perform private.validate_plan_steps(steps,timezone_name,uid);
  begin start_date:=(payload->>'start_date')::date; exception when others then raise exception 'Choose a valid plan start date.'; end;
  local_today:=(now() at time zone timezone_name)::date;
  if start_date<local_today or start_date>local_today+365 then raise exception 'Choose a plan start date within the next year.'; end if;
  insert into public.plans(owner_id,squad_id,title,description,timezone,start_date) values(uid,squad,title,description,timezone_name,start_date) returning id into item;
  for step,step_index in select value,(ordinality-1)::int from jsonb_array_elements(steps) with ordinality loop
   starts:=((start_date+(step->>'day_offset')::int)+(step->>'start_time')::time) at time zone timezone_name;
   if (starts at time zone timezone_name)<>((start_date+(step->>'day_offset')::int)+(step->>'start_time')::time) then raise exception 'That local time does not exist because of a clock change.'; end if;
   if starts<=now() then raise exception 'Choose future beacon dates and times.'; end if;
   ends:=starts+((step->>'duration_minutes')::int*interval '1 minute');
   for prior in 1..coalesce(cardinality(starts_list),0) loop
    if starts<ends_list[prior] and ends>starts_list[prior] then raise exception 'Beacons in a plan cannot overlap. Choose a suggested time.'; end if;
   end loop;
   starts_list:=array_append(starts_list,starts); ends_list:=array_append(ends_list,ends);
   aspiration_ids:=private.validate_plan_aspirations(coalesce(step->'aspiration_ids','[]'::jsonb),uid);
   insert into public.activities(owner_id,title,category,mode,starts_at,ends_at,timezone,approval_required,status,goal_id,habit_id,audience,audience_id,plan_id,plan_step_index,aspiration_ids,description)
   values(uid,trim(step->>'title'),step->>'category',case when squad is null then 'solo' else 'squad' end,starts,ends,timezone_name,false,'scheduled',null,null,case when squad is null then 'private'::public.audience_kind else 'squad'::public.audience_kind end,squad,item,step_index,aspiration_ids,coalesce(step->>'description','')) returning id into activity_id;
   insert into public.places(activity_id,label,latitude,longitude) values(activity_id,coalesce(step->>'location_name',''),nullif(step->>'lat','')::double precision,nullif(step->>'lng','')::double precision);
   activity_ids:=activity_ids||jsonb_build_array(activity_id);
  end loop;
  result:=jsonb_build_object('id',item,'activity_ids',activity_ids,'squad_id',squad);
 elsif action='cancel_plan' then
  select * into plan_row from public.plans where id=rid for update;
  if plan_row.id is null or plan_row.owner_id<>uid then raise exception 'Plan unavailable.'; end if;
  update public.plans set status='cancelled' where id=rid;
  select coalesce(array_agg(id),'{}'::uuid[]) into cancelled_ids from public.activities where plan_id=rid and owner_id=uid and status='scheduled';
  update public.activities set status='cancelled' where id=any(cancelled_ids);
  for activity_id,recipient in select r.activity_id,r.user_id from public.rsvps r where r.activity_id=any(cancelled_ids) and r.status in ('going','requested','invited') loop
   perform private.notify(recipient,uid,'A beacon in a plan you joined was cancelled.',activity_id);
  end loop;
 else raise exception 'Unknown plan action.';
 end if;
 return result;
end $$;
revoke all on function private.apply_plan_action(text,jsonb) from public,anon,authenticated;

-- Keep the established action body intact and wrap its few new fields/actions.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_legacy;
revoke all on function public.beacon_action_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_legacy.request_id');
 execute definition;
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); previous jsonb; result jsonb; item uuid; aspirations text[];
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select q.result into previous from private.requests q where q.user_id=uid and q.request_id=beacon_action.request_id;
 if found then return previous; end if;
 if action in ('save_plan_template','delete_plan_template','create_plan','cancel_plan') then
  result:=private.apply_plan_action(action,payload);
  result:=result||jsonb_build_object('event',action,'plan_id',case when action in ('create_plan','cancel_plan') then coalesce(nullif(payload->>'id',''),result->>'id') else null end);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 if action='save_profile' then perform private.save_survey_profile(payload); end if;
 result:=public.beacon_action_legacy(action,payload,beacon_action.request_id);
 if action in ('create_activity','edit_activity') and payload ? 'aspiration_ids' then
  aspirations:=private.validate_plan_aspirations(payload->'aspiration_ids',uid);
  item:=case when action='create_activity' then nullif(result->>'id','')::uuid else nullif(payload->>'id','')::uuid end;
  update public.activities set aspiration_ids=aspirations where id=item and owner_id=uid;
  if not found then raise exception 'Activity unavailable.'; end if;
 end if;
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create or replace function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb;
begin
 foreach t in array array['favorites','templates','plan_templates','plans','messages','profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('is_moderator',private.is_moderator());
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
