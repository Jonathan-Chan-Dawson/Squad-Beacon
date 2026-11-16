-- Phase F stage 1. Extend the existing settings/preset/action chain.
alter table private.premium_tool_configs drop constraint premium_tool_configs_kind_check;
alter table private.premium_tool_configs add constraint premium_tool_configs_kind_check check(kind in ('focus','appearance','teams','memories','council','agenda'));
alter table public.beacon_checklist_items add column priority text not null default 'normal' check(priority in ('normal','high')),
 add column prerequisite_id uuid references public.beacon_checklist_items(id) on delete set null,
 add column coordination_revision integer not null default 0;
create index checklist_prerequisite on public.beacon_checklist_items(prerequisite_id);

alter function private.feature_required_tier(text) rename to feature_required_tier_before_expansion;
create function private.feature_required_tier(feature text) returns text language sql immutable set search_path='' as $$
 select case when feature in ('agendas','checklist_organization') then 'plus' when feature in ('agenda_coordination','checklist_dependencies') then 'pro' else private.feature_required_tier_before_expansion(feature) end
$$;
revoke all on function private.feature_required_tier_before_expansion(text),private.feature_required_tier(text) from public,anon,authenticated;
alter function private.validate_tool_config(text,jsonb) rename to validate_tool_config_before_expansion;
create function private.validate_tool_config(kind text,s jsonb) returns void language plpgsql immutable set search_path='' as $$
declare a jsonb:=s->'agenda'; row jsonb; begin
 if kind<>'agenda' then perform private.validate_tool_config_before_expansion(kind,s);return;end if;
 if jsonb_typeof(s) is distinct from 'object' or octet_length(s::text)>12000 or exists(select 1 from jsonb_object_keys(s) k where k<>'agenda') or jsonb_typeof(a) is distinct from 'object' then raise exception 'Choose a compact agenda.';end if;
 if exists(select 1 from jsonb_object_keys(a) k where k not in ('enabled','steps')) or jsonb_typeof(a->'enabled') is distinct from 'boolean' or jsonb_typeof(a->'steps') is distinct from 'array' then raise exception 'Choose valid agenda options.';end if;
 if jsonb_array_length(a->'steps')>40 then raise exception 'Use up to forty agenda items.';end if;
 for row in select value from jsonb_array_elements(a->'steps') loop
  if jsonb_typeof(row) is distinct from 'object' then raise exception 'Choose valid agenda items.';end if;
  if not row ?& array['id','label','offset','minutes','reminder','organizer','tasks','state'] or exists(select 1 from jsonb_object_keys(row) k where k not in ('id','label','offset','minutes','reminder','organizer','tasks','state')) or jsonb_typeof(row->'id')<>'string' or (row->>'id')!~'^[A-Za-z0-9_-]{1,64}$' or jsonb_typeof(row->'label')<>'string' or length(btrim(row->>'label')) not between 1 and 100 or jsonb_typeof(row->'offset')<>'number' or (row->>'offset')::numeric<>trunc((row->>'offset')::numeric) or abs((row->>'offset')::numeric)>43200 or jsonb_typeof(row->'minutes')<>'number' or (row->>'minutes')::numeric<>trunc((row->>'minutes')::numeric) or (row->>'minutes')::numeric not between 1 and 1440 or not private.valid_text_array(row->'tasks',20,64) or row->>'state' not in ('planned','active','done') then raise exception 'Choose valid agenda timing and tasks.';end if;
  if row->'reminder'<>'null'::jsonb and (jsonb_typeof(row->'reminder')<>'number' or (row->>'reminder')::numeric<>trunc((row->>'reminder')::numeric) or (row->>'reminder')::numeric not between 0 and 10080) then raise exception 'Choose valid agenda reminders.';end if;
  if row->'organizer'<>'null'::jsonb and (jsonb_typeof(row->'organizer')<>'string' or length(row->>'organizer')=0) then raise exception 'Choose a valid organizer.';end if;
 end loop;
 if (select count(*) from jsonb_array_elements(a->'steps'))<>(select count(distinct r->>'id') from jsonb_array_elements(a->'steps') r) or (select count(*) from jsonb_array_elements(a->'steps') r where r->>'state'='active')>1 then raise exception 'Use unique agenda items and one active stage.';end if;
end $$;
revoke all on function private.validate_tool_config_before_expansion(text,jsonb),private.validate_tool_config(text,jsonb) from public,anon,authenticated;
alter function private.tool_feature(text,jsonb) rename to tool_feature_before_expansion;
create function private.tool_feature(kind text,s jsonb) returns text language sql immutable set search_path='' as $$
 select case when kind='agenda' then case when exists(select 1 from jsonb_array_elements(s->'agenda'->'steps') r where r->'organizer'<>'null'::jsonb or jsonb_array_length(r->'tasks')>0 or r->>'state'<>'planned') then 'agenda_coordination' else 'agendas' end else private.tool_feature_before_expansion(kind,s) end
$$;
revoke all on function private.tool_feature_before_expansion(text,jsonb),private.tool_feature(text,jsonb) from public,anon,authenticated;

-- Direct table writes cannot bypass entitlement, cross-Beacon or cycle checks.
create function private.task_coordination_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare next_id uuid; seen uuid[]:=array[new.id]; begin
 if new.priority='high' and (tg_op='INSERT' or new.priority is distinct from old.priority or new.activity_id is distinct from old.activity_id) then perform private.require_premium_feature('checklist_organization',new.activity_id);end if;
 if new.prerequisite_id is not null and (tg_op='INSERT' or new.prerequisite_id is distinct from old.prerequisite_id or new.activity_id is distinct from old.activity_id) then
  perform private.require_premium_feature('checklist_dependencies',new.activity_id);
  -- Serialize the dependency graph in this Beacon across different actors.
  perform 1 from public.activities where id=new.activity_id for update;
  next_id:=new.prerequisite_id;
  while next_id is not null loop
   if next_id=any(seen) then raise exception 'Tasks cannot form a cycle.';end if;
   seen:=array_append(seen,next_id);
   select prerequisite_id into next_id from public.beacon_checklist_items where id=next_id and activity_id=new.activity_id and not private.blocked(author_id);
   if not found then raise exception 'Choose a prerequisite from this Beacon.';end if;
  end loop;
 end if;
 if tg_op='INSERT' then new.coordination_revision:=0;elsif (new.priority,new.prerequisite_id) is distinct from (old.priority,old.prerequisite_id) then new.coordination_revision:=old.coordination_revision+1;else new.coordination_revision:=old.coordination_revision;end if;
 return new;
end $$;
revoke all on function private.task_coordination_guard() from public,anon,authenticated;
create trigger task_coordination_guard before insert or update on public.beacon_checklist_items for each row execute function private.task_coordination_guard();

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_expansion;
revoke all on function public.beacon_action_before_expansion(text,jsonb,uuid) from public,anon,authenticated;
create function private.expansion_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; aid uuid; r jsonb; item public.beacon_checklist_items; begin
 if auth.uid() is null then raise exception 'Sign in to continue.';end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>auth.uid()::text then raise exception 'Your account changed.';end if;
 if action='toggle_checklist_item' and coalesce((payload->>'completed')::boolean,false) then
  select * into item from public.beacon_checklist_items where id=(payload->>'id')::uuid;
  if item.prerequisite_id is not null and private.can_edit_beacon_checklist(item.activity_id) and not exists(select 1 from public.beacon_checklist_items where id=item.prerequisite_id and completed) then raise exception 'Complete the prerequisite task first.';end if;
 end if;
 if action='save_task_coordination' then
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select x.result into result from private.requests x where user_id=auth.uid() and x.request_id=$3;if found then return result;end if;
  select activity_id into aid from public.beacon_checklist_items where id=(payload->>'id')::uuid;
  perform 1 from public.activities where id=aid for update;
  select * into item from public.beacon_checklist_items where id=(payload->>'id')::uuid for update;
  if not found or not private.can_edit_beacon_checklist(item.activity_id) or private.blocked(item.author_id) then raise exception 'Task unavailable.';end if;
  if item.coordination_revision<>coalesce((payload->>'revision')::integer,-1) then raise exception 'This task changed. Reopen it.';end if;
  perform private.limit_action('all',300);
  update public.beacon_checklist_items set priority=payload->>'priority',prerequisite_id=nullif(payload->>'prerequisite_id','')::uuid where id=item.id;
  result:=jsonb_build_object('id',item.id);insert into private.requests(user_id,request_id,result) values(auth.uid(),$3,result);return result;
 end if;
 if action in ('save_tool_config','save_tool_preset') and payload->>'kind'='agenda' then
  perform private.validate_tool_config('agenda',payload->'settings');
  if action='save_tool_config' then
   aid:=(payload->>'activity_id')::uuid;
   if not private.can_manage_beacon(aid) then raise exception 'Only current organizers can configure agendas.';end if;
   for r in select value from jsonb_array_elements(payload->'settings'->'agenda'->'steps') loop
    if r->'organizer'<>'null'::jsonb and not exists(select 1 from public.activities a where a.id=aid and (a.owner_id=(r->>'organizer')::uuid or exists(select 1 from public.beacon_roles br where br.activity_id=aid and br.user_id=(r->>'organizer')::uuid and br.role in ('admin','coowner') and private.beacon_approved_going(aid,br.user_id)))) then raise exception 'Choose a current organizer.';end if;
    if exists(select 1 from jsonb_array_elements_text(r->'tasks') t where not exists(select 1 from public.beacon_checklist_items i where i.id=t::uuid and i.activity_id=aid and not private.blocked(i.author_id))) then raise exception 'Choose tasks from this Beacon.';end if;
   end loop;
  else
   payload:=jsonb_set(payload,'{settings,agenda,steps}',coalesce((select jsonb_agg(r||'{"organizer":null,"tasks":[],"state":"planned"}'::jsonb) from jsonb_array_elements(payload->'settings'->'agenda'->'steps') r),'[]'));
  end if;
 end if;
 return public.beacon_action_before_expansion(action,payload,request_id);
end $$;
revoke all on function private.expansion_action(text,jsonb,uuid) from public,anon;
grant execute on function private.expansion_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select private.expansion_action(action,payload,request_id)$$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_expansion;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$declare s jsonb;begin s:=public.beacon_snapshot_before_expansion();return s||jsonb_build_object('capabilities',coalesce(s->'capabilities','{}')||'{"beacon_expansion":true}'::jsonb);end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

-- Agenda reminders join the existing runner, notices and push claim pipeline.
create table private.agenda_reminders(config_id uuid references private.premium_tool_configs on delete cascade,step_id text,recipient_id uuid references public.profiles on delete cascade,signature text,notice_id uuid references public.notices on delete cascade,primary key(config_id,step_id,recipient_id,signature));
alter table private.agenda_reminders enable row level security;
revoke all on private.agenda_reminders from public,anon,authenticated;
create index agenda_reminder_notice on private.agenda_reminders(notice_id);
create function private.agenda_signature(starts timestamptz,step jsonb) returns text language sql immutable set search_path='' as $$select md5(extract(epoch from starts)::text||(step->>'offset')||':'||(step->>'reminder')||':'||(step->>'label'))$$;
revoke all on function private.agenda_signature(timestamptz,jsonb) from public,anon,authenticated;
create function private.send_agenda_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare row record; recipient uuid; prior_sub text:=current_setting('request.jwt.claim.sub',true); nid uuid; sig text; sent integer:=0; begin
 for row in select c.id,c.activity_id,a.owner_id,a.starts_at,r.step from private.premium_tool_configs c join public.activities a on a.id=c.activity_id cross join lateral jsonb_array_elements(c.settings->'agenda'->'steps') r(step)
 where c.kind='agenda' and (c.settings->'agenda'->>'enabled')::boolean and a.status='scheduled' and r.step->>'state'<>'done' and r.step->'reminder'<>'null'::jsonb
 and a.starts_at+make_interval(mins=>(r.step->>'offset')::int)>now()-interval '15 minutes'
 and a.starts_at+make_interval(mins=>(r.step->>'offset')::int-(r.step->>'reminder')::int)<=now() loop
  sig:=private.agenda_signature(row.starts_at,row.step);
  for recipient in select row.owner_id union select user_id from public.rsvps where activity_id=row.activity_id and private.beacon_approved_going(row.activity_id,user_id) loop
   perform set_config('request.jwt.claim.sub',recipient::text,true);
   if private.can_chat(row.activity_id) then
    insert into private.agenda_reminders(config_id,step_id,recipient_id,signature) values(row.id,row.step->>'id',recipient,sig) on conflict do nothing;
    if found then
     insert into public.notices(recipient_id,actor_id,body,activity_id) values(recipient,null,'Agenda reminder: '||(row.step->>'label'),row.activity_id) returning id into nid;
     update private.agenda_reminders set notice_id=nid where config_id=row.id and step_id=row.step->>'id' and recipient_id=recipient and signature=sig;
     insert into private.push_queue(notice_id,token) select nid,token from public.push_tokens where user_id=recipient;sent:=sent+1;
    end if;
   end if;
  end loop;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);return sent;
end $$;
revoke all on function private.send_agenda_reminders() from public,anon,authenticated;
create function private.agenda_push_valid(nid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.agenda_reminders where notice_id=nid) or exists(select 1 from private.agenda_reminders r join private.premium_tool_configs c on c.id=r.config_id join public.activities a on a.id=c.activity_id cross join lateral jsonb_array_elements(c.settings->'agenda'->'steps') s(step) where r.notice_id=nid and r.recipient_id=auth.uid() and a.status='scheduled' and private.can_chat(a.id) and (c.settings->'agenda'->>'enabled')::boolean and s.step->>'id'=r.step_id and s.step->>'state'<>'done' and private.agenda_signature(a.starts_at,s.step)=r.signature)
$$;
revoke all on function private.agenda_push_valid(uuid) from public,anon,authenticated;
do $migration$ declare definition text;begin
 select pg_get_functiondef('public.beacon_claim_push()'::regprocedure) into definition;
 if position('private.checklist_push_valid(n.id)' in definition)=0 then raise exception 'Push validity boundary not found.';end if;
 definition:=replace(definition,'private.checklist_push_valid(n.id)','private.agenda_push_valid(n.id) and private.checklist_push_valid(n.id)');execute definition;
end $migration$;
alter function public.run_due_plan_routines(integer) rename to run_due_plan_routines_before_agenda;
revoke all on function public.run_due_plan_routines_before_agenda(integer) from public,anon,authenticated;
create function public.run_due_plan_routines(horizon_days integer default 30) returns integer language plpgsql security definer set search_path='' as $$declare made integer;begin
 if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'Trusted runner required.';end if;
 made:=public.run_due_plan_routines_before_agenda(horizon_days);perform private.send_agenda_reminders();return made;
end $$;
revoke all on function public.run_due_plan_routines(integer) from public,anon,authenticated;
grant execute on function public.run_due_plan_routines(integer) to service_role;

-- Audience/ownership moves revalidate new task metadata through the existing guard.
do $migration$ declare definition text;begin
 select pg_get_functiondef('private.protect_beacon_premium_scope()'::regprocedure) into definition;
 definition:=replace(definition,'i.assignee_id is not null or i.due_at is not null or i.due_on is not null','i.priority=''high'' or i.assignee_id is not null or i.due_at is not null or i.due_on is not null');
 definition:=replace(definition,E'\n return new;',E'\n if private.premium_rank(tier)<2 and exists(select 1 from public.beacon_checklist_items i where i.activity_id=new.id and i.prerequisite_id is not null) then raise exception ''PREMIUM_REQUIRED: Clear task prerequisites before moving this Beacon outside its eligible audience.'';end if;\n return new;');
 if position('Clear task prerequisites' in definition)=0 then raise exception 'Premium scope guard boundary not found.';end if;
 execute definition;
end $migration$;
