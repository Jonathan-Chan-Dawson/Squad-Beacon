-- Living Plans: itinerary links are independent of published activity schedules.
alter table public.plans alter column start_date drop not null;
alter table public.plans drop constraint plans_status_check;
alter table public.plans add constraint plans_status_check check(status in ('draft','scheduled','cancelled'));
alter table public.plans add column coowner_ids uuid[] not null default '{}',
 add column open_collaboration boolean not null default false,
 add column revision integer not null default 0,
 add column routine_source boolean not null default false;
alter table public.plan_templates add column stops jsonb;

create table public.plan_stops (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.plans on delete cascade,
 author_id uuid not null references public.profiles on delete cascade,
 position integer not null check(position>=0),
 title text not null default '' check(length(title)<=120),
 details text not null default '' check(length(details)<=2000),
 proposed_at timestamptz,
 activity_id uuid references public.activities on delete set null,
 thread_id uuid references public.planning_threads on delete set null,
 approval text not null default 'approved' check(approval in ('approved','pending','dismissed')),
 state text not null default 'active' check(state in ('active','skipped')),
 created_at timestamptz not null default now()
);
create index plan_stops_order on public.plan_stops(plan_id,position,id);
create unique index plan_stops_activity on public.plan_stops(plan_id,activity_id) where activity_id is not null;
create unique index plan_stops_thread on public.plan_stops(plan_id,thread_id) where thread_id is not null;

create function private.can_read_living_plan(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.plans p where p.id=pid and
 ((p.squad_id is null and p.owner_id=auth.uid()) or (p.squad_id is not null and private.member(p.squad_id) and not private.blocked(p.owner_id))))
$$;
create function private.can_edit_living_plan(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_read_living_plan(pid) and exists(select 1 from public.plans where id=pid and (owner_id=auth.uid() or auth.uid()=any(coowner_ids)))
$$;
create function private.can_review_plan(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_edit_living_plan(pid) or (private.can_read_living_plan(pid) and exists(select 1 from public.plans where id=pid and private.admin(squad_id)))
$$;
revoke all on function private.can_read_living_plan(uuid),private.can_edit_living_plan(uuid),private.can_review_plan(uuid) from public,anon;
grant execute on function private.can_read_living_plan(uuid),private.can_edit_living_plan(uuid),private.can_review_plan(uuid) to authenticated;
alter table public.plan_stops enable row level security;
revoke all on public.plan_stops from public,anon,authenticated;
grant select on public.plan_stops to authenticated;
create policy read_plan_stops on public.plan_stops for select to authenticated using(private.can_read_living_plan(plan_id) and not private.blocked(author_id) and (approval<>'dismissed' or author_id=auth.uid() or private.can_review_plan(plan_id)));

insert into public.plan_stops(plan_id,author_id,position,activity_id)
 select plan_id,owner_id,plan_step_index,id from public.activities where plan_id is not null;
create function private.backfill_plan_stop() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.plan_id is not null then
  insert into public.plan_stops(plan_id,author_id,position,activity_id)
  values(new.plan_id,new.owner_id,coalesce((select max(position)+1 from public.plan_stops where plan_id=new.plan_id),0),new.id)
  on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.backfill_plan_stop() from public,anon,authenticated;
create trigger living_plan_activity after insert on public.activities for each row execute function private.backfill_plan_stop();

create function private.plan_reference_allowed(pid uuid,aid uuid,tid uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare p public.plans; a public.activities; t public.planning_threads; begin
 if not private.can_read_living_plan(pid) then return false; end if;
 select * into p from public.plans where id=pid;
 if aid is not null then
  select * into a from public.activities where id=aid;
  if not found or not private.can_activity(aid) or private.blocked(a.owner_id) then return false; end if;
  if p.squad_id is not null and (a.audience<>'squad' or a.audience_id is distinct from p.squad_id) then return false; end if;
 end if;
 if tid is not null then
  select * into t from public.planning_threads where id=tid;
  if not found or not private.can_read_planning_thread(tid) then return false; end if;
  if p.squad_id is not null and (t.audience<>'squad' or t.audience_id is distinct from p.squad_id) then return false; end if;
 end if;
 return true;
end $$;
revoke all on function private.plan_reference_allowed(uuid,uuid,uuid) from public,anon,authenticated;

create function private.apply_living_plan_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.plans; s public.plan_stops; pid uuid:=nullif(payload->>'plan_id','')::uuid;
 aid uuid:=nullif(payload->>'activity_id','')::uuid; tid uuid:=nullif(payload->>'thread_id','')::uuid;
 sid uuid:=nullif(payload->>'stop_id','')::uuid; item uuid; pos integer; other uuid; val jsonb; template public.plan_templates;
begin
 if action='create_living_plan' then
  if nullif(payload->>'squad_id','') is not null and not private.member((payload->>'squad_id')::uuid) then raise exception 'Join this Squad first.'; end if;
  if not exists(select 1 from pg_timezone_names where name=payload->>'timezone') then raise exception 'Choose a valid timezone.'; end if;
  insert into public.plans(owner_id,squad_id,title,description,timezone,start_date,status)
  values(uid,nullif(payload->>'squad_id','')::uuid,btrim(payload->>'title'),coalesce(payload->>'description',''),payload->>'timezone',nullif(payload->>'start_date','')::date,'draft') returning * into p;
  if nullif(btrim(p.title),'') is null then raise exception 'Give your Plan a name.'; end if;
  val:=coalesce(payload->'stops','[]'::jsonb);
  if payload ? 'template_id' then
   select * into template from public.plan_templates where id=(payload->>'template_id')::uuid and
    ((squad_id is null and owner_id=uid) or (squad_id=p.squad_id and private.member(squad_id) and not private.blocked(owner_id)));
   if not found then raise exception 'Template unavailable.'; end if;
   val:=coalesce(template.stops,(select jsonb_agg(jsonb_build_object('title',v->>'title','details',v->>'description')) from jsonb_array_elements(template.steps) v),'[]'::jsonb);
  end if;
  if jsonb_typeof(val)<>'array' or jsonb_array_length(val)>30 then raise exception 'Use up to 30 stops.'; end if;
  insert into public.plan_stops(plan_id,author_id,position,title,details)
  select p.id,uid,(ordinality-1)::integer,btrim(value->>'title'),coalesce(value->>'details','') from jsonb_array_elements(val) with ordinality;
  return jsonb_build_object('id',p.id,'plan_id',p.id);
 end if;
 select * into p from public.plans where id=pid for update;
 if not found or not private.can_read_living_plan(pid) then raise exception 'Plan unavailable.'; end if;
 if p.status='cancelled' then raise exception 'This Plan is cancelled.'; end if;
 if payload ? 'revision' and (payload->>'revision')::integer<>p.revision then raise exception 'This Plan changed. Refresh before saving.'; end if;
 if action='add_plan_stop' then
  if aid is null and tid is null and coalesce(length(btrim(payload->>'title')),0) not between 1 and 120 then raise exception 'Give this idea a title.'; end if;
  if (aid is not null or tid is not null) and not private.can_edit_living_plan(pid) then raise exception 'Suggest an idea for an organizer to review.'; end if;
  if not private.plan_reference_allowed(pid,aid,tid) then raise exception 'This activity is not compatible with the Plan audience.'; end if;
  if (select count(*) from public.plan_stops where plan_id=pid and approval<>'dismissed')>=30 then raise exception 'Use up to 30 stops.'; end if;
  if nullif(payload->>'after_stop_id','') is not null and not exists(select 1 from public.plan_stops where id=(payload->>'after_stop_id')::uuid and plan_id=pid) then raise exception 'The insertion stop changed. Choose where to add this activity again.'; end if;
  pos:=coalesce((select position+1 from public.plan_stops where id=nullif(payload->>'after_stop_id','')::uuid and plan_id=pid),(payload->>'position')::integer,(select coalesce(max(position)+1,0) from public.plan_stops where plan_id=pid));
  update public.plan_stops set position=position+1 where plan_id=pid and position>=pos;
  insert into public.plan_stops(plan_id,author_id,position,title,details,proposed_at,activity_id,thread_id,approval)
  values(pid,uid,pos,case when aid is not null or tid is not null then '' else btrim(payload->>'title') end,case when aid is not null or tid is not null then '' else coalesce(payload->>'details','') end,
   nullif(payload->>'proposed_at','')::timestamptz,aid,tid,case when private.can_edit_living_plan(pid) or (p.open_collaboration and aid is null and tid is null) then 'approved' else 'pending' end) returning id into item;
 elsif action='update_living_plan' then
  if not private.can_edit_living_plan(pid) then raise exception 'Only Plan organizers can edit this Plan.'; end if;
  if payload ? 'coowner_ids' or payload ? 'open_collaboration' or payload ? 'cancel' then
   if p.owner_id<>uid then raise exception 'Only the owner can change Plan access or cancel the Plan.'; end if;
  end if;
  if payload ? 'coowner_ids' and (jsonb_typeof(payload->'coowner_ids')<>'array' or jsonb_array_length(payload->'coowner_ids')>10 or exists(
   select 1 from jsonb_array_elements_text(payload->'coowner_ids') v where p.squad_id is null or not exists(select 1 from public.squad_members m where m.squad_id=p.squad_id and m.user_id=v::uuid) or exists(select 1 from public.blocks b where (b.blocker_id=uid and b.blocked_id=v::uuid) or (b.blocked_id=uid and b.blocker_id=v::uuid)))) then raise exception 'Choose authorized Squad members as co-owners.'; end if;
  update public.plans set title=case when payload ? 'title' then btrim(payload->>'title') else title end,
   description=coalesce(payload->>'description',description),start_date=case when payload ? 'start_date' then nullif(payload->>'start_date','')::date else start_date end,
   coowner_ids=case when payload ? 'coowner_ids' then array(select jsonb_array_elements_text(payload->'coowner_ids')::uuid) else coowner_ids end,
   open_collaboration=coalesce((payload->>'open_collaboration')::boolean,open_collaboration),status=case when coalesce((payload->>'cancel')::boolean,false) then 'cancelled' else status end where id=pid;
 elsif action='save_living_plan_template' then
  if not private.can_edit_living_plan(pid) then raise exception 'Only organizers can save this template.'; end if;
  insert into public.plan_templates(owner_id,title,description,timezone,steps,stops)
  values(uid,p.title,p.description,p.timezone,'[]'::jsonb,coalesce((select jsonb_agg(jsonb_build_object('title',case when stop_row.activity_id is not null then a.title when stop_row.thread_id is not null then t.title else stop_row.title end,'details',case when stop_row.activity_id is null and stop_row.thread_id is null then stop_row.details else '' end) order by stop_row.position)
   from public.plan_stops stop_row left join public.activities a on a.id=stop_row.activity_id left join public.planning_threads t on t.id=stop_row.thread_id
   where stop_row.plan_id=pid and stop_row.approval='approved' and stop_row.state='active' and (stop_row.activity_id is null or private.can_activity(stop_row.activity_id)) and (stop_row.thread_id is null or private.can_read_planning_thread(stop_row.thread_id))),'[]'::jsonb)) returning id into item;
 else
  select * into s from public.plan_stops where id=sid and plan_id=pid;
  if not found then raise exception 'Stop unavailable.'; end if;
  if action='review_plan_stop' then
   if not private.can_review_plan(pid) then raise exception 'Only organizers can review suggestions.'; end if;
   if payload->>'approval' not in ('approved','dismissed') or s.approval<>'pending' then raise exception 'Suggestion already reviewed.'; end if;
   update public.plan_stops set approval=payload->>'approval' where id=sid;
  else
   if not private.can_edit_living_plan(pid) then raise exception 'Only Plan organizers can edit stops.'; end if;
   if action='edit_plan_stop' then
    if s.activity_id is not null or s.thread_id is not null then raise exception 'Edit this activity through its own controls.'; end if;
    if coalesce(length(btrim(payload->>'title')),0) not between 1 and 120 then raise exception 'Give this idea a title.'; end if;
    update public.plan_stops set title=btrim(payload->>'title'),details=coalesce(payload->>'details',''),proposed_at=nullif(payload->>'proposed_at','')::timestamptz,state=coalesce(payload->>'state',state) where id=sid;
   elsif action='link_plan_stop' then
    if s.activity_id is not null or s.thread_id is not null then raise exception 'This stop is already linked.'; end if;
    if (aid is null and tid is null) or not private.plan_reference_allowed(pid,aid,tid) then raise exception 'This activity is not compatible with the Plan audience.'; end if;
    update public.plan_stops set activity_id=aid,thread_id=tid,title='',details='',proposed_at=null,approval='approved' where id=sid;
   elsif action='remove_plan_stop' then delete from public.plan_stops where id=sid;
   elsif action='move_plan_stop' then
    pos:=greatest(0,(payload->>'position')::integer);
    if pos<s.position then update public.plan_stops set position=position+1 where plan_id=pid and position>=pos and position<s.position;
    else update public.plan_stops set position=position-1 where plan_id=pid and position>s.position and position<=pos; end if;
    update public.plan_stops set position=pos where id=sid;
   else raise exception 'Unknown Plan action.'; end if;
  end if;
  item:=sid;
 end if;
 update public.plans set revision=revision+1 where id=pid;
 return jsonb_build_object('id',coalesce(item,pid),'plan_id',pid);
end $$;
revoke all on function private.apply_living_plan_action(text,jsonb) from public,anon,authenticated;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_living_plans;
create function private.living_plan_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; uid uuid:=auth.uid(); begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 if action in ('create_living_plan','update_living_plan','add_plan_stop','edit_plan_stop','link_plan_stop','remove_plan_stop','move_plan_stop','review_plan_stop','save_living_plan_template') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into result from private.requests r where r.user_id=uid and r.request_id=living_plan_action.request_id;
  if found then return result; end if;
  result:=private.apply_living_plan_action(action,payload);
  insert into private.requests(user_id,request_id,result) values(uid,request_id,result); return result;
 end if;
 if action in ('create_activity','create_activity_with_invitees') and nullif(payload->>'return_plan_id','') is not null then
  perform 1 from public.plans where id=(payload->>'return_plan_id')::uuid for update;
  if not private.can_edit_living_plan((payload->>'return_plan_id')::uuid) then raise exception 'Only organizers can add confirmed activities.'; end if;
  result:=public.beacon_action_before_living_plans(action,payload,request_id);
  if not exists(select 1 from public.plan_stops where plan_id=(payload->>'return_plan_id')::uuid and activity_id=(result->>'id')::uuid) then
   perform private.apply_living_plan_action(case when nullif(payload->>'plan_stop_id','') is null then 'add_plan_stop' else 'link_plan_stop' end,
    jsonb_build_object('plan_id',payload->>'return_plan_id','stop_id',payload->>'plan_stop_id','activity_id',result->>'id','position',payload->>'stop_position','after_stop_id',payload->>'stop_after_id'));
  end if;
  return result;
 end if;
 return public.beacon_action_before_living_plans(action,payload,request_id);
end $$;
revoke all on function public.beacon_action_before_living_plans(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.living_plan_action(text,jsonb,uuid) from public,anon;
grant execute on function private.living_plan_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$ select private.living_plan_action(action,payload,request_id); $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_living_plans;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$ declare result jsonb; begin
 result:=public.beacon_snapshot_before_living_plans();
 return result||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}'::jsonb)||'{"living_plans":true}'::jsonb,
 'plan_stops',coalesce((select jsonb_agg(s) from public.plan_stops s),'[]'::jsonb));
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
do $$ declare tab text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach tab in array array['plans','plan_stops','plan_templates'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tab) then
    execute format('alter publication supabase_realtime add table public.%I',tab);
   end if;
  end loop;
 end if;
end $$;
