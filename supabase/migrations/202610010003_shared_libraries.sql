-- Keep the existing per-beacon notes and checklist as the single shared source.
-- Library folders only organize a user's view of authorized beacon resources.
alter table public.beacon_notes
 add column revision integer not null default 0 check(revision >= 0),
 add column updated_at timestamptz;
update public.beacon_notes set updated_at=created_at;
alter table public.beacon_notes alter column updated_at set default now(),alter column updated_at set not null;

create table public.library_folders (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('journal','checklist')),
 name text not null check(char_length(trim(name)) between 1 and 40),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,owner_id,kind)
);
create unique index library_folders_owner_kind_name
 on public.library_folders(owner_id,kind,lower(name));
create index library_folders_owner_kind
 on public.library_folders(owner_id,kind,created_at,id);

create table public.library_folder_items (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('journal','checklist')),
 activity_id uuid not null references public.activities(id) on delete cascade,
 folder_id uuid not null,
 updated_at timestamptz not null default now(),
 primary key(owner_id,kind,activity_id),
 foreign key(folder_id,owner_id,kind)
  references public.library_folders(id,owner_id,kind) on delete cascade
);
create index library_folder_items_folder
 on public.library_folder_items(owner_id,kind,folder_id,activity_id);

alter table public.library_folders enable row level security;
alter table public.library_folder_items enable row level security;
revoke all on public.library_folders,public.library_folder_items from public,anon,authenticated;
grant select on public.library_folders,public.library_folder_items to authenticated;
create policy read_own_library_folders on public.library_folders
 for select to authenticated using(owner_id=auth.uid());
create policy read_own_library_folder_items on public.library_folder_items
 for select to authenticated using(owner_id=auth.uid() and private.can_chat(activity_id));

create function private.apply_library_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=auth.uid();
 v_id uuid:=nullif(payload->>'id','')::uuid;
 v_activity_id uuid:=nullif(payload->>'activity_id','')::uuid;
 v_folder_id uuid:=nullif(payload->>'folder_id','')::uuid;
 v_kind text:=payload->>'kind';
 v_name text;
 v_body text;
 v_expected integer;
 v_activity public.activities;
 v_note public.beacon_notes;
 v_folder public.library_folders;
 v_count integer;
 v_result jsonb;
begin
 if v_uid is null then raise exception 'Sign in to continue.'; end if;
 if not exists(select 1 from public.profiles where id=v_uid) then raise exception 'Finish your profile first.'; end if;
 perform private.limit_action('all',300);

 if action='edit_beacon_note' then
  if v_id is null or jsonb_typeof(payload->'expected_revision') is distinct from 'number'
   or coalesce(payload->>'expected_revision','') !~ '^(0|[1-9][0-9]*)$' then
   raise exception 'Refresh the note before editing it.';
  end if;
  v_expected:=(payload->>'expected_revision')::integer;
  v_body:=trim(coalesce(payload->>'body',''));
  if length(v_body)=0 or length(v_body)>1000 then raise exception 'Write a note of 1 to 1000 characters.'; end if;
  select * into v_note from public.beacon_notes where id=v_id;
  if not found then raise exception 'This shared note is unavailable.'; end if;
  select * into v_activity from public.activities where id=v_note.activity_id for update;
  if not found or not private.can_chat(v_note.activity_id) or private.blocked(v_note.author_id) then
   raise exception 'This shared note is unavailable.';
  end if;
  if v_activity.status='cancelled' then raise exception 'Cancelled beacons no longer accept updates.'; end if;
  if v_note.author_id<>v_uid then raise exception 'Only the note author can edit this shared note.'; end if;
  select * into v_note from public.beacon_notes where id=v_id for update;
  if not found then raise exception 'This shared note is unavailable.'; end if;
  if v_note.revision<>v_expected then
   if v_note.revision=v_expected+1 and v_note.body=v_body then
    return jsonb_build_object('id',v_note.id,'activity_id',v_note.activity_id,'revision',v_note.revision,'updated_at',v_note.updated_at);
   end if;
   raise exception 'This note changed. Your draft is still here; refresh and resolve before saving.';
  end if;
  update public.beacon_notes set body=v_body,revision=revision+1,updated_at=now()
   where id=v_id returning * into v_note;
  return jsonb_build_object('id',v_note.id,'activity_id',v_note.activity_id,'revision',v_note.revision,'updated_at',v_note.updated_at);
 end if;

 if action in ('create_library_folder','rename_library_folder') then
  v_kind:=coalesce(v_kind,'');
  if v_kind not in ('journal','checklist') then raise exception 'Choose Journals or Checklists for this folder.'; end if;
  v_name:=trim(coalesce(payload->>'name',''));
  if length(v_name)=0 or length(v_name)>40 then raise exception 'Folder names must be 1 to 40 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||v_kind,0));
  if action='create_library_folder' then
   if v_id is not null then
    select * into v_folder from public.library_folders where id=v_id;
    if found then
     if v_folder.owner_id=v_uid and v_folder.kind=v_kind and v_folder.name=v_name then
      return jsonb_build_object('id',v_folder.id,'kind',v_folder.kind,'name',v_folder.name);
     end if;
     raise exception 'This folder ID is already in use.';
    end if;
   end if;
   select * into v_folder from public.library_folders where owner_id=v_uid and kind=v_kind and lower(name)=lower(v_name);
   if found then
    if v_id is null then return jsonb_build_object('id',v_folder.id,'kind',v_folder.kind,'name',v_folder.name); end if;
    raise exception 'You already have a folder with that name.';
   end if;
   select count(*) into v_count from public.library_folders where owner_id=v_uid and kind=v_kind;
   if v_count>=30 then raise exception 'You can create up to 30 folders in each library.'; end if;
   insert into public.library_folders(id,owner_id,kind,name) values(coalesce(v_id,gen_random_uuid()),v_uid,v_kind,v_name) returning * into v_folder;
  else
   if v_id is null then raise exception 'That private folder is unavailable.'; end if;
   select * into v_folder from public.library_folders where id=v_id and owner_id=v_uid and kind=v_kind for update;
   if not found then raise exception 'That private folder is unavailable.'; end if;
   if v_folder.name=v_name then
    return jsonb_build_object('id',v_folder.id,'kind',v_folder.kind,'name',v_folder.name);
   end if;
   if exists(select 1 from public.library_folders where owner_id=v_uid and kind=v_kind and id<>v_id and lower(name)=lower(v_name)) then
    raise exception 'You already have a folder with that name.';
   end if;
   update public.library_folders set name=v_name,updated_at=now() where id=v_id returning * into v_folder;
  end if;
  return jsonb_build_object('id',v_folder.id,'kind',v_folder.kind,'name',v_folder.name);
 end if;

 if action='delete_library_folder' then
  if v_id is null then raise exception 'That private folder is unavailable.'; end if;
  delete from public.library_folders where id=v_id and owner_id=v_uid;
  if not found then raise exception 'That private folder is unavailable.'; end if;
  return jsonb_build_object('id',v_id);
 end if;

 if action='move_library_item' then
  v_kind:=coalesce(v_kind,'');
  if v_kind not in ('journal','checklist') or v_activity_id is null then raise exception 'Choose a shared beacon library first.'; end if;
  select * into v_activity from public.activities where id=v_activity_id for update;
  if not found or not private.can_chat(v_activity_id) then raise exception 'This shared beacon library is unavailable.'; end if;
  if v_folder_id is null then
   delete from public.library_folder_items where owner_id=v_uid and kind=v_kind and activity_id=v_activity_id;
  else
   perform 1 from public.library_folders where id=v_folder_id and owner_id=v_uid and kind=v_kind for update;
   if not found then raise exception 'Choose one of your folders in this library.'; end if;
   insert into public.library_folder_items(owner_id,kind,activity_id,folder_id)
    values(v_uid,v_kind,v_activity_id,v_folder_id)
    on conflict(owner_id,kind,activity_id) do update set folder_id=excluded.folder_id,updated_at=now()
    where public.library_folder_items.folder_id<>excluded.folder_id;
  end if;
  return jsonb_build_object('activity_id',v_activity_id,'kind',v_kind,'folder_id',v_folder_id);
 end if;

 raise exception 'Unknown library action.';
end $$;
revoke all on function private.apply_library_action(text,jsonb) from public,anon,authenticated;

-- Route only library actions here and keep every existing action on its current path.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_library_legacy;
revoke all on function public.beacon_action_library_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_library_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_library_legacy.request_id');
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
 if action in ('edit_beacon_note','create_library_folder','rename_library_folder','delete_library_folder','move_library_item') then
  result:=private.apply_library_action(action,payload);
  result:=result||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 return public.beacon_action_library_legacy(action,payload,beacon_action.request_id);
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create or replace function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb;
begin
 foreach t in array array['favorites','templates','plan_templates','plans','messages','profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks','beacon_checklist_items','beacon_notes','library_folders','library_folder_items'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('is_moderator',private.is_moderator());
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
