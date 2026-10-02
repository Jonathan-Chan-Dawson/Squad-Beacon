-- Small collaborative checklist and append-only beacon notes.
create table public.beacon_checklist_items (
 id uuid primary key default gen_random_uuid(),
 activity_id uuid not null references public.activities on delete cascade,
 author_id uuid not null references public.profiles on delete cascade,
 text text not null check(length(trim(text)) between 1 and 160),
 completed boolean not null default false,
 created_at timestamptz not null default now()
);
create index beacon_checklist_activity_created
 on public.beacon_checklist_items(activity_id,created_at,id);

create table public.beacon_notes (
 id uuid primary key default gen_random_uuid(),
 activity_id uuid not null references public.activities on delete cascade,
 author_id uuid not null references public.profiles on delete cascade,
 body text not null check(length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index beacon_notes_activity_created
 on public.beacon_notes(activity_id,created_at,id);

alter table public.beacon_checklist_items enable row level security;
alter table public.beacon_notes enable row level security;
revoke all on public.beacon_checklist_items,public.beacon_notes from public,anon,authenticated;
grant select on public.beacon_checklist_items,public.beacon_notes to authenticated;
create policy read_beacon_checklist_items on public.beacon_checklist_items
 for select to authenticated using(private.can_chat(activity_id) and not private.blocked(author_id));
create policy read_beacon_notes on public.beacon_notes
 for select to authenticated using(private.can_chat(activity_id) and not private.blocked(author_id));

create function private.apply_beacon_module_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=auth.uid();
 v_activity_id uuid:=nullif(payload->>'activity_id','')::uuid;
 v_id uuid:=nullif(payload->>'id','')::uuid;
 v_new_id uuid;
 v_activity public.activities;
 v_checklist public.beacon_checklist_items;
 v_note public.beacon_notes;
 v_value text;
 v_completed boolean;
 v_count integer;
 v_is_note boolean;
 v_result jsonb;
begin
 if v_uid is null then raise exception 'Sign in to continue.'; end if;
 if not exists(select 1 from public.profiles where id=v_uid) then raise exception 'Finish your profile first.'; end if;
 perform private.limit_action('all',300);

 if action in ('add_checklist_item','add_beacon_note') then
  v_is_note:=action='add_beacon_note';
  if v_activity_id is null then raise exception 'Choose a beacon first.'; end if;
  select * into v_activity from public.activities where id=v_activity_id for update;
  if not found or not private.can_chat(v_activity_id) then raise exception 'Join this beacon before using its tools.'; end if;
  if v_activity.status='cancelled' then raise exception 'Cancelled beacons no longer accept updates.'; end if;
  if not v_is_note and v_activity.status<>'scheduled' then raise exception 'The checklist is closed for this beacon.'; end if;
  v_value:=trim(coalesce(payload->>(case when v_is_note then 'body' else 'text' end),''));
  if length(v_value)=0 or length(v_value)>(case when v_is_note then 1000 else 160 end) then
   if v_is_note then raise exception 'Write a note of 1 to 1000 characters.';
   else raise exception 'Checklist items must be 1 to 160 characters.'; end if;
  end if;
  if v_id is not null then
   if v_is_note then
    select * into v_note from public.beacon_notes where id=v_id;
    if found then
     if v_note.activity_id=v_activity_id and v_note.author_id=v_uid and v_note.body=v_value then
      return jsonb_build_object('id',v_note.id,'activity_id',v_activity_id);
     end if;
     raise exception 'This item ID is already in use.';
    end if;
   else
    select * into v_checklist from public.beacon_checklist_items where id=v_id;
    if found then
     if v_checklist.activity_id=v_activity_id and v_checklist.author_id=v_uid and v_checklist.text=v_value then
      return jsonb_build_object('id',v_checklist.id,'activity_id',v_activity_id);
     end if;
     raise exception 'This item ID is already in use.';
    end if;
   end if;
  end if;
  if v_is_note then
   select count(*) into v_count from public.beacon_notes where activity_id=v_activity_id;
   if v_count>=50 then raise exception 'This beacon already has 50 notes.'; end if;
   insert into public.beacon_notes(id,activity_id,author_id,body)
    values(coalesce(v_id,gen_random_uuid()),v_activity_id,v_uid,v_value) returning id into v_new_id;
  else
   select count(*) into v_count from public.beacon_checklist_items where activity_id=v_activity_id;
   if v_count>=50 then raise exception 'This beacon already has 50 checklist items.'; end if;
   insert into public.beacon_checklist_items(id,activity_id,author_id,text)
    values(coalesce(v_id,gen_random_uuid()),v_activity_id,v_uid,v_value) returning id into v_new_id;
  end if;
  return jsonb_build_object('id',v_new_id,'activity_id',v_activity_id);
 end if;

 if action='toggle_checklist_item' then
  if v_id is null or jsonb_typeof(payload->'completed') is distinct from 'boolean' then raise exception 'Choose a checklist item and completion state.'; end if;
  select * into v_checklist from public.beacon_checklist_items where id=v_id;
  if not found then raise exception 'This checklist item is unavailable.'; end if;
  v_activity_id:=v_checklist.activity_id;
 elsif action='delete_checklist_item' then
  if v_id is null then raise exception 'This checklist item is unavailable.'; end if;
  select * into v_checklist from public.beacon_checklist_items where id=v_id;
  if not found then raise exception 'This checklist item is unavailable.'; end if;
  v_activity_id:=v_checklist.activity_id;
 elsif action='delete_beacon_note' then
  if v_id is null then raise exception 'This note is unavailable.'; end if;
  select * into v_note from public.beacon_notes where id=v_id;
  if not found then raise exception 'This note is unavailable.'; end if;
  v_activity_id:=v_note.activity_id;
 else
  raise exception 'Unknown beacon module action.';
 end if;

 select * into v_activity from public.activities where id=v_activity_id for update;
 if not found or not private.can_chat(v_activity_id) then raise exception 'Join this beacon before using its tools.'; end if;
 if v_activity.status='cancelled' then raise exception 'Cancelled beacons no longer accept updates.'; end if;
 if action in ('toggle_checklist_item','delete_checklist_item') and v_activity.status<>'scheduled' then raise exception 'The checklist is closed for this beacon.'; end if;

 if action='toggle_checklist_item' then
  select * into v_checklist from public.beacon_checklist_items where id=v_id for update;
  if not found or private.blocked(v_checklist.author_id) then raise exception 'This checklist item is unavailable.'; end if;
  v_completed:=(payload->>'completed')::boolean;
  update public.beacon_checklist_items set completed=v_completed where id=v_id;
  v_result:=jsonb_build_object('id',v_id,'activity_id',v_activity_id,'completed',v_completed);
 elsif action='delete_checklist_item' then
  select * into v_checklist from public.beacon_checklist_items where id=v_id for update;
  if not found or private.blocked(v_checklist.author_id) then raise exception 'This checklist item is unavailable.'; end if;
  if v_uid<>v_activity.owner_id and v_uid<>v_checklist.author_id then raise exception 'Only the item author or beacon host can delete it.'; end if;
  delete from public.beacon_checklist_items where id=v_id;
  v_result:=jsonb_build_object('id',v_id,'activity_id',v_activity_id);
 else
  select * into v_note from public.beacon_notes where id=v_id for update;
  if not found or private.blocked(v_note.author_id) then raise exception 'This note is unavailable.'; end if;
  if v_uid<>v_activity.owner_id and v_uid<>v_note.author_id then raise exception 'Only the note author or beacon host can delete it.'; end if;
  delete from public.beacon_notes where id=v_id;
  v_result:=jsonb_build_object('id',v_id,'activity_id',v_activity_id);
 end if;
 return v_result;
end $$;
revoke all on function private.apply_beacon_module_action(text,jsonb) from public,anon,authenticated;

-- Preserve the established write API and route only the new actions here.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_modules_legacy;
revoke all on function public.beacon_action_modules_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_modules_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_modules_legacy.request_id');
 execute definition;
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); previous jsonb; result jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select q.result into previous from private.requests q where q.user_id=uid and q.request_id=beacon_action.request_id;
 if found then return previous; end if;
 if action in ('add_checklist_item','toggle_checklist_item','delete_checklist_item','add_beacon_note','delete_beacon_note') then
  result:=private.apply_beacon_module_action(action,payload);
  result:=result||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 result:=public.beacon_action_modules_legacy(action,payload,beacon_action.request_id);
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create or replace function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb;
begin
 foreach t in array array['favorites','templates','plan_templates','plans','messages','profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks','beacon_checklist_items','beacon_notes'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('is_moderator',private.is_moderator());
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
