-- Expand the existing Beacon checklist/notes, and add private per-user
-- collection organization without replacing the shared source records.

alter table public.activities
 add column enable_comments boolean not null default true,
 add column enable_scoreboard boolean not null default false,
 add column enable_music boolean not null default false,
 add column checklist_edit_policy text not null default 'participants'
  check(checklist_edit_policy in ('participants','managers'));

-- The previous experiences switch guarded comments. Preserve that setting for
-- existing Beacons while giving new Beacons a distinct comments default.
update public.activities set enable_comments=enable_experiences;
update public.activities set enable_music=(music_url is not null);
alter table public.activities
 alter column enable_chat set default true,
 alter column enable_checklist set default false,
 alter column enable_journal set default false,
 alter column enable_experiences set default false,
 alter column enable_focus set default false,
 alter column enable_reactions set default true;

alter table public.templates add column module_defaults jsonb;
alter table public.templates add constraint templates_module_defaults_object
 check(module_defaults is null or jsonb_typeof(module_defaults)='object');

create table public.beacon_checklist_sections (
 id uuid primary key default gen_random_uuid(),
 activity_id uuid not null references public.activities(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 80),
 position integer not null default 0 check(position between 0 and 29),
 created_at timestamptz not null default now(),
 unique(id,activity_id),
 constraint beacon_checklist_sections_position_key unique(activity_id,position) deferrable initially immediate
);
create index beacon_checklist_sections_order
 on public.beacon_checklist_sections(activity_id,position,id);

alter table public.beacon_checklist_items
 add column section_id uuid,
 add column assignee_id uuid references public.profiles(id) on delete set null,
 add column updated_at timestamptz not null default now(),
 add constraint beacon_checklist_items_section_activity
  foreign key(section_id) references public.beacon_checklist_sections(id) on delete set null;

alter table public.beacon_notes
 add column section_heading text not null default '' check(char_length(section_heading)<=100),
 add column visibility text not null default 'shared'
  check(visibility in ('private','shared'));
alter table public.beacon_notes alter column visibility set default 'private';
alter table public.beacon_notes alter column activity_id drop not null;
alter table public.beacon_notes drop constraint if exists beacon_notes_activity_id_fkey;
alter table public.beacon_notes add constraint beacon_notes_activity_id_fkey
 foreign key(activity_id) references public.activities(id) on delete set null;
alter table public.library_folders add column parent_id uuid
 references public.library_folders(id) on delete set null;
create index library_folders_parent on public.library_folders(owner_id,kind,parent_id);

create table public.library_saved_checklists (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 source_activity_id uuid references public.activities(id) on delete set null,
 title text not null check(char_length(trim(title)) between 1 and 120),
 sections jsonb not null default '[]'::jsonb check(jsonb_typeof(sections)='array'),
 items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array'),
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,owner_id)
);
create unique index library_saved_checklists_source
 on public.library_saved_checklists(owner_id,source_activity_id)
 where source_activity_id is not null;
create index library_saved_checklists_owner
 on public.library_saved_checklists(owner_id,updated_at desc,id);

-- Polymorphic resource IDs are validated in SECURITY DEFINER actions. The
-- owner/kind folder FK prevents cross-owner or cross-library assignments.
create table public.library_resource_folders (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('journal','checklist')),
 resource_id uuid not null,
 folder_id uuid not null,
 updated_at timestamptz not null default now(),
 primary key(owner_id,kind,resource_id),
 foreign key(folder_id,owner_id,kind)
  references public.library_folders(id,owner_id,kind) on delete cascade
);
create index library_resource_folders_folder
 on public.library_resource_folders(owner_id,kind,folder_id,resource_id);

create table public.beacon_favorites (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 activity_id uuid not null references public.activities(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(owner_id,activity_id)
);

alter table public.beacon_checklist_sections enable row level security;
alter table public.library_saved_checklists enable row level security;
alter table public.library_resource_folders enable row level security;
alter table public.beacon_favorites enable row level security;
revoke all on public.beacon_checklist_sections,public.library_saved_checklists,
 public.library_resource_folders,public.beacon_favorites from public,anon,authenticated;
grant select on public.beacon_checklist_sections,public.library_saved_checklists,
 public.library_resource_folders,public.beacon_favorites to authenticated;
create policy read_beacon_checklist_sections on public.beacon_checklist_sections
 for select to authenticated using(private.can_chat(activity_id));
create policy read_own_saved_checklists on public.library_saved_checklists
 for select to authenticated using(owner_id=auth.uid());
create policy read_own_library_resource_folders on public.library_resource_folders
 for select to authenticated using(owner_id=auth.uid());
create policy read_own_beacon_favorites on public.beacon_favorites
 for select to authenticated using(owner_id=auth.uid());

drop policy if exists read_beacon_notes on public.beacon_notes;
create policy read_beacon_notes on public.beacon_notes for select to authenticated
 using(
  author_id=auth.uid()
  or (visibility='shared' and activity_id is not null
      and private.can_chat(activity_id) and not private.blocked(author_id))
 );

create function private.can_edit_beacon_checklist(aid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.activities a where a.id=aid and a.status='scheduled'
   and a.enable_checklist and private.can_chat(a.id)
   and (a.owner_id=auth.uid()
    or (a.checklist_edit_policy='participants' and private.beacon_approved_going(a.id,auth.uid()))
    or (a.checklist_edit_policy='managers' and private.can_manage_beacon(a.id)))
 );
$$;

-- Migration 005 routed comments through its historical "experiences" flag.
-- Keep that action chain intact, but make the flag correspond to comments now;
-- Beacon Memories use enable_experiences directly in their own policies/RPC.
create or replace function private.beacon_module_enabled(aid uuid,module_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((
  select case module_name
   when 'chat' then a.enable_chat
   when 'checklist' then a.enable_checklist
   when 'journal' then a.enable_journal
   when 'experiences' then a.enable_comments
   when 'focus' then a.enable_focus
   when 'reactions' then a.enable_reactions
   else false end
  from public.activities a where a.id=aid
 ),false);
$$;

create function private.valid_module_defaults(value jsonb) returns boolean
language sql immutable set search_path='' as $$
 select value is null or value='null'::jsonb or (
  jsonb_typeof(value)='object' and
  (not (value ? 'enable_chat') or jsonb_typeof(value->'enable_chat')='boolean') and
  (not (value ? 'enable_checklist') or jsonb_typeof(value->'enable_checklist')='boolean') and
  (not (value ? 'enable_journal') or jsonb_typeof(value->'enable_journal')='boolean') and
  (not (value ? 'enable_experiences') or jsonb_typeof(value->'enable_experiences')='boolean') and
  (not (value ? 'enable_focus') or jsonb_typeof(value->'enable_focus')='boolean') and
  (not (value ? 'enable_scoreboard') or jsonb_typeof(value->'enable_scoreboard')='boolean') and
  (not (value ? 'enable_comments') or jsonb_typeof(value->'enable_comments')='boolean') and
  (not (value ? 'enable_music') or jsonb_typeof(value->'enable_music')='boolean')
 );
$$;

create function private.apply_module_collection_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();
 aid uuid:=nullif(payload->>'activity_id','')::uuid;
 rid uuid:=nullif(payload->>'id','')::uuid;
 list_id uuid:=nullif(payload->>'saved_checklist_id','')::uuid;
 folder_id uuid:=nullif(payload->>'folder_id','')::uuid;
 v_kind text:=payload->>'kind';
 v_title text;
 heading text;
 v_body text;
 vis text;
 expected integer;
 target_assignee uuid;
 item public.beacon_checklist_items;
 section public.beacon_checklist_sections;
 note public.beacon_notes;
 activity public.activities;
 saved public.library_saved_checklists;
 row_id uuid;
 item_count integer;
 section_count integer;
 next_revision integer;
 json_sections jsonb;
 json_items jsonb;
 section_obj jsonb;
 item_obj jsonb;
 mapping jsonb:='{}'::jsonb;
 old_section_id uuid;
 new_section_id uuid;
 new_item_id uuid;
 assigned uuid;
 result jsonb;
 note_found boolean:=false;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform private.limit_action('all',300);

 if action='save_beacon' then
  aid:=coalesce(aid,nullif(payload->>'id','')::uuid);
  if jsonb_typeof(payload->'saved') is distinct from 'boolean' or aid is null then raise exception 'Choose a Beacon to save.'; end if;
  if (payload->>'saved')::boolean then
   if not private.can_activity(aid) then raise exception 'Beacon unavailable.'; end if;
   insert into public.beacon_favorites(owner_id,activity_id) values(uid,aid) on conflict do nothing;
  else delete from public.beacon_favorites where owner_id=uid and activity_id=aid; end if;
  return jsonb_build_object('activity_id',aid,'saved',(payload->>'saved')::boolean);
 end if;

 if action='set_checklist_edit_policy' then
  if aid is null or payload->>'policy' not in ('participants','managers') then
   raise exception 'Choose who can edit this checklist.';
  end if;
  select * into activity from public.activities where id=aid for update;
  if not found or activity.status<>'scheduled' or not private.can_manage_beacon(aid) then
   raise exception 'Only a current Beacon manager can change checklist permissions.';
  end if;
  update public.activities set checklist_edit_policy=payload->>'policy' where id=aid;
  return jsonb_build_object('activity_id',aid,'policy',payload->>'policy');
 end if;

 if action='set_beacon_note_visibility' or action in ('add_beacon_note','save_beacon_note','create_journal_entry','edit_beacon_note','delete_beacon_note') then
  if action='delete_beacon_note' then
   if rid is null then raise exception 'Note unavailable.'; end if;
   select * into note from public.beacon_notes where id=rid for update;
   if not found then raise exception 'Note unavailable.'; end if;
   if note.author_id=uid then
    if note.activity_id is not null and not exists(
      select 1 from public.activities a where a.id=note.activity_id
       and a.status<>'cancelled' and a.enable_journal
       and private.can_chat(a.id) and private.can_activity(a.id)
    ) then
     raise exception 'This Beacon Journal is read-only or unavailable.';
    end if;
   else
    if note.visibility<>'shared' or note.activity_id is null or not exists(
      select 1 from public.activities a where a.id=note.activity_id and a.owner_id=uid
       and not private.blocked(note.author_id)
    ) then raise exception 'Only the note author or Beacon host can delete a shared note.'; end if;
   end if;
   delete from public.library_resource_folders where resource_id=rid and kind='journal';
   delete from public.beacon_notes where id=rid;
   return jsonb_build_object('id',rid);
  end if;

  if rid is not null then
   select * into note from public.beacon_notes where id=rid for update;
   note_found:=found;
   if note_found and note.author_id<>uid then raise exception 'Only your own note can be changed.'; end if;
   if not note_found and action in ('edit_beacon_note','set_beacon_note_visibility') then raise exception 'Only your own note can be changed.'; end if;
  end if;
  if action='set_beacon_note_visibility' then
   vis:=payload->>'visibility';
   if rid is null or vis not in ('private','shared') then raise exception 'Choose private or shared.'; end if;
   if note.activity_id is null then
    if vis<>'private' then raise exception 'Standalone Journal entries stay private.'; end if;
   else
    select * into activity from public.activities where id=note.activity_id for update;
    if not found or activity.status='cancelled' or not activity.enable_journal or not private.can_chat(activity.id) then
     raise exception 'Join this Beacon before sharing its note.';
    end if;
   end if;
   expected:=nullif(payload->>'expected_revision','')::integer;
   if expected is null then raise exception 'Refresh the note before changing its sharing setting.'; end if;
   if note.revision=expected+1 and note.visibility=vis then
    return jsonb_build_object('id',rid,'visibility',vis,'revision',note.revision);
   end if;
   if note.revision<>expected then raise exception 'This note changed. Refresh before changing its sharing setting.'; end if;
   update public.beacon_notes set visibility=vis,revision=revision+1,updated_at=now() where id=rid;
   return jsonb_build_object('id',rid,'visibility',vis,'revision',note.revision+1);
  end if;

  if action='edit_beacon_note' and rid is null then raise exception 'Note unavailable.'; end if;
  if action='create_journal_entry' then aid:=null;
  elsif payload ? 'activity_id' and payload->'activity_id'<>'null'::jsonb then
   aid:=nullif(payload->>'activity_id','')::uuid;
  elsif action='edit_beacon_note' and rid is not null then aid:=note.activity_id;
  end if;
  if aid is not null then
   select * into activity from public.activities where id=aid for update;
   if not found or activity.status='cancelled' or not activity.enable_journal or not private.can_chat(aid) then
    raise exception 'Join this Beacon before writing its note.';
   end if;
  end if;
  v_body:=trim(coalesce(payload->>'body',''));
  v_title:=trim(coalesce(payload->>'section_heading',case when note_found then note.section_heading else '' end));
  vis:=coalesce(payload->>'visibility',case when note_found then note.visibility else 'private' end);
  if length(v_body)<1 or length(v_body)>1000 then raise exception 'Write a note of 1 to 1000 characters.'; end if;
  if length(v_title)>100 or vis not in ('private','shared') then raise exception 'Choose a valid note heading and sharing setting.'; end if;
  if aid is null and vis<>'private' then raise exception 'Standalone Journal entries stay private.'; end if;
  if note_found then
   if note.activity_id is distinct from aid then raise exception 'Note unavailable.'; end if;
   if action in ('save_beacon_note','add_beacon_note')
      and note.body=v_body and note.section_heading=v_title and note.visibility=vis then
    return jsonb_build_object('id',rid,'activity_id',aid,'revision',note.revision,'visibility',vis);
   end if;
   expected:=nullif(payload->>'expected_revision','')::integer;
   if expected is null then raise exception 'Refresh the note before editing it.'; end if;
   if note.revision=expected+1 and note.body=v_body and note.section_heading=v_title and note.visibility=vis then
    return jsonb_build_object('id',rid,'activity_id',aid,'revision',note.revision,'visibility',vis);
   end if;
   if note.revision<>expected then
    raise exception 'This note changed. Your draft is still here; refresh and resolve before saving.';
   end if;
   update public.beacon_notes set body=v_body,section_heading=v_title,visibility=vis,
    revision=revision+1,updated_at=now() where id=rid;
   return jsonb_build_object('id',rid,'activity_id',aid,'revision',note.revision+1,'visibility',vis);
  end if;
  if aid is not null and
     (select count(*) from public.beacon_notes where activity_id=aid)>=50 then
   raise exception 'This Beacon already has 50 Journal entries.';
  end if;
  if rid is null then rid:=gen_random_uuid(); end if;
  insert into public.beacon_notes(id,activity_id,author_id,section_heading,body,visibility)
   values(rid,aid,uid,v_title,v_body,vis);
  return jsonb_build_object('id',rid,'activity_id',aid,'revision',0,'visibility',vis);
 end if;

 if action='ensure_saved_checklist_copy' then
  if aid is null then raise exception 'Choose a Beacon checklist.'; end if;
  select * into activity from public.activities where id=aid for update;
  if not found or not private.can_chat(aid) then raise exception 'This Beacon checklist is unavailable.'; end if;
  select * into saved from public.library_saved_checklists where owner_id=uid and source_activity_id=aid for update;
  if found then return jsonb_build_object('id',saved.id,'source_activity_id',aid,'created',false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'position',s.position) order by s.position,s.id),'[]'::jsonb)
   into json_sections from public.beacon_checklist_sections s where s.activity_id=aid;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'text',i.text,'completed',i.completed,'section_id',i.section_id,
      'assignee_id',case when i.assignee_id is not null and private.blocked(i.assignee_id) then null else i.assignee_id end)
      order by i.created_at,i.id),'[]'::jsonb)
   into json_items from public.beacon_checklist_items i
   where i.activity_id=aid and not private.blocked(i.author_id);
  insert into public.library_saved_checklists(owner_id,source_activity_id,title,sections,items)
   values(uid,aid,left(activity.title,120),json_sections,json_items) returning * into saved;
  return jsonb_build_object('id',saved.id,'source_activity_id',aid,'created',true);
 end if;

 if action='save_library_checklist' then
  rid:=coalesce(rid,gen_random_uuid());
  v_title:=trim(coalesce(payload->>'title',''));
  json_sections:=coalesce(payload->'sections','[]'::jsonb);
  json_items:=coalesce(payload->'items','[]'::jsonb);
  if length(v_title)<1 or length(v_title)>120 or jsonb_typeof(json_sections) is distinct from 'array'
     or jsonb_typeof(json_items) is distinct from 'array' or octet_length(payload::text)>50000 then
   raise exception 'Checklists need a title and a compact saved list.';
  end if;
  if jsonb_array_length(json_sections)>30 or jsonb_array_length(json_items)>50 then
   raise exception 'Checklists can have up to 30 sections and 50 items.';
  end if;
  json_sections:='[]'::jsonb;
  json_items:=coalesce(payload->'items','[]'::jsonb);
  -- Re-read the raw sections after clearing the normalized destination.
  section_count:=0;
  for section_obj in select value from jsonb_array_elements(coalesce(payload->'sections','[]'::jsonb)) loop
   declare section_id uuid; section_position integer; section_title text;
   begin
    section_id:=nullif(section_obj->>'id','')::uuid;
    section_position:=nullif(section_obj->>'position','')::integer;
    section_title:=trim(coalesce(section_obj->>'title',''));
    if jsonb_typeof(section_obj) is distinct from 'object' or section_id is null
       or section_position is null or section_position not between 0 and 29
       or length(section_title) not between 1 and 80
       or exists(select 1 from jsonb_array_elements(json_sections) x where x.value->>'id'=section_id::text or x.value->>'position'=section_position::text) then
     raise exception 'Choose valid, uniquely identified checklist sections.';
    end if;
    json_sections:=json_sections||jsonb_build_array(jsonb_build_object('id',section_id,'title',section_title,'position',section_position));
    section_count:=section_count+1;
   end;
  end loop;
  json_items:=coalesce(payload->'items','[]'::jsonb);
  section_obj:=coalesce(payload->'sections','[]'::jsonb);
  -- Keep only supported item fields and validate IDs/section references.
  json_items:='[]'::jsonb;
  item_count:=0;
  for item_obj in select value from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) loop
   declare item_id uuid; item_text text; item_section uuid; item_assignee uuid; item_completed boolean;
   begin
    item_id:=nullif(item_obj->>'id','')::uuid;
    item_text:=trim(coalesce(item_obj->>'text',''));
    item_section:=nullif(item_obj->>'section_id','')::uuid;
    item_assignee:=nullif(item_obj->>'assignee_id','')::uuid;
    item_completed:=(item_obj->>'completed')::boolean;
    if jsonb_typeof(item_obj) is distinct from 'object' or item_id is null
       or length(item_text) not between 1 and 160
       or jsonb_typeof(item_obj->'completed') is distinct from 'boolean'
       or (item_section is not null and not exists(select 1 from jsonb_array_elements(json_sections) x where x.value->>'id'=item_section::text))
       or exists(select 1 from jsonb_array_elements(json_items) x where x.value->>'id'=item_id::text) then
     raise exception 'Choose valid checklist items and section assignments.';
    end if;
    json_items:=json_items||jsonb_build_array(jsonb_build_object('id',item_id,'text',item_text,'completed',item_completed,'section_id',item_section,'assignee_id',item_assignee));
    item_count:=item_count+1;
   end;
  end loop;
  select * into saved from public.library_saved_checklists where id=rid and owner_id=uid for update;
  if found then
   expected:=nullif(payload->>'expected_revision','')::integer;
   if expected is null then raise exception 'Refresh your saved List before editing it.'; end if;
   if saved.revision=expected+1 and saved.title=v_title and saved.sections=json_sections and saved.items=json_items then
    return jsonb_build_object('id',rid,'revision',saved.revision);
   end if;
   if saved.revision<>expected then raise exception 'This List changed elsewhere. Refresh before saving.'; end if;
   update public.library_saved_checklists set title=v_title,sections=json_sections,items=json_items,
    revision=revision+1,updated_at=now() where id=rid;
  else
   if payload ? 'expected_revision' then raise exception 'This saved List is unavailable.'; end if;
   insert into public.library_saved_checklists(id,owner_id,title,sections,items)
    values(rid,uid,v_title,json_sections,json_items);
  end if;
  return jsonb_build_object('id',rid,'revision',coalesce(expected,0)+case when expected is null then 0 else 1 end);
 end if;

 if action='delete_saved_checklist' then
  if rid is null or not exists(select 1 from public.library_saved_checklists where id=rid and owner_id=uid) then raise exception 'Saved List unavailable.'; end if;
  delete from public.library_resource_folders where owner_id=uid and kind='checklist' and resource_id=rid;
  delete from public.library_saved_checklists where id=rid and owner_id=uid;
  return jsonb_build_object('id',rid);
 end if;

 if action='move_library_resource' then
  if v_kind not in ('journal','checklist') or rid is null then raise exception 'Choose a private Library resource.'; end if;
  if v_kind='journal' then
   select * into note from public.beacon_notes where id=rid and author_id=uid;
   if not found then raise exception 'This Journal entry is unavailable.'; end if;
   if note.visibility='shared' and note.activity_id is not null and not private.can_chat(note.activity_id) then raise exception 'This shared entry is unavailable.'; end if;
  else
   if not exists(select 1 from public.library_saved_checklists where id=rid and owner_id=uid) then raise exception 'This saved List is unavailable.'; end if;
  end if;
  if folder_id is null then
   delete from public.library_resource_folders r where r.owner_id=uid and r.kind=v_kind and r.resource_id=rid;
  else
   if not exists(select 1 from public.library_folders f where f.id=folder_id and f.owner_id=uid and f.kind=v_kind) then raise exception 'Choose one of your folders in this Library.'; end if;
   insert into public.library_resource_folders(owner_id,kind,resource_id,folder_id)
    values(uid,v_kind,rid,folder_id)
    on conflict(owner_id,kind,resource_id) do update set folder_id=excluded.folder_id,updated_at=now()
    where public.library_resource_folders.folder_id<>excluded.folder_id;
  end if;
  return jsonb_build_object('kind',v_kind,'resource_id',rid,'folder_id',folder_id);
 end if;

 if action='add_checklist_section' then
  if aid is null then raise exception 'Choose a Beacon first.'; end if;
  select * into activity from public.activities where id=aid for update;
  if not found or not private.can_edit_beacon_checklist(aid) then raise exception 'You cannot edit this checklist.'; end if;
  v_title:=trim(coalesce(payload->>'title',''));
  if length(v_title)<1 or length(v_title)>80 then raise exception 'Section titles must be 1 to 80 characters.'; end if;
  if rid is not null then
   select * into section from public.beacon_checklist_sections where id=rid;
   if found then
    if section.activity_id=aid and section.title=v_title then return jsonb_build_object('id',rid,'activity_id',aid); end if;
    raise exception 'This section ID is already in use.';
   end if;
  end if;
  select count(*) into section_count from public.beacon_checklist_sections where activity_id=aid;
  if section_count>=30 then raise exception 'A checklist can have up to 30 sections.'; end if;
  rid:=coalesce(rid,gen_random_uuid());
  insert into public.beacon_checklist_sections(id,activity_id,title,position)
   values(rid,aid,v_title,section_count);
  return jsonb_build_object('id',rid,'activity_id',aid);
 end if;

 if action in ('edit_checklist_section','delete_checklist_section') then
  if rid is null then raise exception 'Choose a checklist section.'; end if;
  select * into section from public.beacon_checklist_sections where id=rid;
  if not found then raise exception 'This checklist section is unavailable.'; end if;
  aid:=section.activity_id;
  select * into activity from public.activities where id=aid for update;
  if not private.can_edit_beacon_checklist(aid) then raise exception 'You cannot edit this checklist.'; end if;
  if action='delete_checklist_section' then
   select section.position into section_count from public.beacon_checklist_sections section where section.id=rid;
   update public.beacon_checklist_items set section_id=null,updated_at=now() where section_id=rid;
   delete from public.beacon_checklist_sections where id=rid;
   set constraints beacon_checklist_sections_position_key deferred;
   update public.beacon_checklist_sections section set position=section.position-1
    where section.activity_id=aid and section.position>section_count;
   return jsonb_build_object('id',rid,'activity_id',aid);
  end if;
  v_title:=trim(coalesce(payload->>'title',section.title));
  if length(v_title)<1 or length(v_title)>80 then raise exception 'Section titles must be 1 to 80 characters.'; end if;
  update public.beacon_checklist_sections set title=v_title where id=rid;
  return jsonb_build_object('id',rid,'activity_id',aid);
 end if;

 if action='add_checklist_item' then
  if aid is null then raise exception 'Choose a Beacon first.'; end if;
  select * into activity from public.activities where id=aid for update;
  if not found or not private.can_edit_beacon_checklist(aid) then raise exception 'You cannot edit this checklist.'; end if;
  v_body:=trim(coalesce(payload->>'text',''));
  if length(v_body)<1 or length(v_body)>160 then raise exception 'Checklist items must be 1 to 160 characters.'; end if;
  old_section_id:=nullif(payload->>'section_id','')::uuid;
  assigned:=nullif(payload->>'assignee_id','')::uuid;
  if old_section_id is not null and not exists(select 1 from public.beacon_checklist_sections where id=old_section_id and activity_id=aid) then raise exception 'Choose a section from this checklist.'; end if;
  if assigned is not null and not private.can_activity(aid)
     then raise exception 'Beacon unavailable.'; end if;
  if assigned is not null and not private.beacon_approved_going(aid,assigned) and assigned<>activity.owner_id then raise exception 'Assign items to an accepted Beacon participant.'; end if;
  if rid is not null then
   select * into item from public.beacon_checklist_items where id=rid;
   if found then
    if item.activity_id=aid and item.author_id=uid and item.text=v_body and item.section_id is not distinct from old_section_id and item.assignee_id is not distinct from assigned then return jsonb_build_object('id',rid,'activity_id',aid); end if;
    raise exception 'This item ID is already in use.';
   end if;
  end if;
  select count(*) into item_count from public.beacon_checklist_items where activity_id=aid;
  if item_count>=50 then raise exception 'This Beacon already has 50 checklist items.'; end if;
  rid:=coalesce(rid,gen_random_uuid());
  insert into public.beacon_checklist_items(id,activity_id,author_id,text,section_id,assignee_id)
   values(rid,aid,uid,v_body,old_section_id,assigned);
  return jsonb_build_object('id',rid,'activity_id',aid);
 end if;

 if action in ('toggle_checklist_item','edit_checklist_item','delete_checklist_item') then
  if rid is null then raise exception 'Choose a checklist item.'; end if;
  select * into item from public.beacon_checklist_items where id=rid for update;
  if not found then raise exception 'This checklist item is unavailable.'; end if;
  aid:=item.activity_id;
  select * into activity from public.activities where id=aid for update;
  if not private.can_edit_beacon_checklist(aid) then raise exception 'You cannot edit this checklist.'; end if;
  if private.blocked(item.author_id) then raise exception 'This checklist item is unavailable.'; end if;
  if action='delete_checklist_item' then
   delete from public.beacon_checklist_items where id=rid;
   return jsonb_build_object('id',rid,'activity_id',aid);
  elsif action='toggle_checklist_item' then
   if jsonb_typeof(payload->'completed') is distinct from 'boolean' then raise exception 'Choose whether the item is complete.'; end if;
   update public.beacon_checklist_items set completed=(payload->>'completed')::boolean,updated_at=now() where id=rid;
   return jsonb_build_object('id',rid,'activity_id',aid,'completed',(payload->>'completed')::boolean);
  end if;
  v_body:=trim(coalesce(payload->>'text',''));
  old_section_id:=case when payload ? 'section_id' then nullif(payload->>'section_id','')::uuid else item.section_id end;
  assigned:=case when payload ? 'assignee_id' then nullif(payload->>'assignee_id','')::uuid else item.assignee_id end;
  if length(v_body)<1 or length(v_body)>160 then raise exception 'Checklist items must be 1 to 160 characters.'; end if;
  if old_section_id is not null and not exists(select 1 from public.beacon_checklist_sections where id=old_section_id and activity_id=aid) then raise exception 'Choose a section from this checklist.'; end if;
  if assigned is not null and not private.can_activity(aid)
     then raise exception 'Beacon unavailable.'; end if;
  if assigned is not null and not private.beacon_approved_going(aid,assigned) and assigned<>activity.owner_id then raise exception 'Assign items to an accepted Beacon participant.'; end if;
  update public.beacon_checklist_items set text=v_body,section_id=old_section_id,assignee_id=assigned,updated_at=now() where id=rid;
  return jsonb_build_object('id',rid,'activity_id',aid);
 end if;

 if action='apply_saved_checklist_to_beacon' then
  aid:=nullif(payload->>'activity_id','')::uuid;
  list_id:=nullif(payload->>'saved_checklist_id','')::uuid;
  if aid is null or list_id is null then raise exception 'Choose a saved List and Beacon.'; end if;
  select * into activity from public.activities where id=aid for update;
  select * into saved from public.library_saved_checklists where id=list_id and owner_id=uid;
  if saved.id is null or activity.id is null or activity.owner_id<>uid or activity.status<>'scheduled' then raise exception 'Only a host can reuse their own List on a scheduled Beacon.'; end if;
  if exists(select 1 from public.beacon_checklist_items where activity_id=aid)
     or exists(select 1 from public.beacon_checklist_sections where activity_id=aid) then
   raise exception 'This Beacon already has a checklist. Clear it before applying a saved List.';
  end if;
  perform private.copy_saved_checklist_to_beacon(list_id,aid,uid);
  return jsonb_build_object('activity_id',aid,'saved_checklist_id',list_id);
 end if;

 raise exception 'Unknown Beacon collection action.';
end $$;

create function private.copy_saved_checklist_to_beacon(list_id uuid,aid uuid,uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare saved public.library_saved_checklists; section_obj jsonb; item_obj jsonb; mapping jsonb:='{}'::jsonb; old_id uuid; new_id uuid; section_id uuid; assignee uuid; activity public.activities;
begin
 select * into saved from public.library_saved_checklists where id=list_id and owner_id=uid;
 select * into activity from public.activities where id=aid;
 if activity.id is null or saved.id is null or activity.owner_id<>uid or activity.status<>'scheduled' then raise exception 'Saved List unavailable.'; end if;
 if jsonb_array_length(saved.items)>50 or jsonb_array_length(saved.sections)>30 then raise exception 'This saved List exceeds Beacon limits.'; end if;
 update public.activities set enable_checklist=true where id=aid;
 for section_obj in select value from jsonb_array_elements(saved.sections) loop
  old_id:=nullif(section_obj->>'id','')::uuid;
  new_id:=gen_random_uuid();
  insert into public.beacon_checklist_sections(id,activity_id,title,position)
   values(new_id,aid,left(trim(section_obj->>'title'),80),greatest(0,least(29,coalesce((section_obj->>'position')::integer,0))));
  mapping:=mapping||jsonb_build_object(old_id::text,new_id::text);
 end loop;
 for item_obj in select value from jsonb_array_elements(saved.items) loop
  section_id:=null;
  old_id:=nullif(item_obj->>'section_id','')::uuid;
  if old_id is not null then section_id:=nullif(mapping->>old_id::text,'')::uuid; end if;
  assignee:=nullif(item_obj->>'assignee_id','')::uuid;
  if assignee is not null and not private.beacon_approved_going(aid,assignee) then assignee:=null; end if;
  insert into public.beacon_checklist_items(activity_id,author_id,text,completed,section_id,assignee_id)
   values(aid,uid,left(trim(item_obj->>'text'),160),false,section_id,assignee);
 end loop;
end $$;
revoke all on function private.copy_saved_checklist_to_beacon(uuid,uuid,uuid) from public,anon,authenticated;

create function private.save_extended_beacon_controls(aid uuid,payload jsonb,is_create boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare name text; field_names text[]:=array['enable_comments','enable_scoreboard','enable_music']; policy text;
begin
 if aid is null then raise exception 'Choose a Beacon first.'; end if;
 if not is_create and not private.can_manage_beacon_settings(aid) then raise exception 'Only the Beacon owner or a current co-owner can change settings.'; end if;
 if is_create and not exists(select 1 from public.activities where id=aid and owner_id=auth.uid()) then raise exception 'Beacon unavailable.'; end if;
 if not is_create and exists(select 1 from public.activities where id=aid and status<>'scheduled') then raise exception 'Beacon settings are read-only after the Beacon ends.'; end if;
 foreach name in array field_names loop
  if payload ? name and jsonb_typeof(payload->name) is distinct from 'boolean' then raise exception 'Beacon toggles must be on or off.'; end if;
 end loop;
 policy:=coalesce(payload->>'checklist_edit_policy','participants');
 if payload ? 'checklist_edit_policy' and policy not in ('participants','managers') then raise exception 'Choose who can edit the checklist.'; end if;
 update public.activities set
  enable_comments=coalesce((payload->>'enable_comments')::boolean,enable_comments),
  enable_scoreboard=coalesce((payload->>'enable_scoreboard')::boolean,enable_scoreboard),
  enable_music=coalesce((payload->>'enable_music')::boolean,enable_music),
  checklist_edit_policy=case when payload ? 'checklist_edit_policy' then policy else checklist_edit_policy end
 where id=aid;
end $$;

create function private.set_library_folder_parent(p_folder_id uuid,p_owner_id uuid,p_kind text,p_parent_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare parent public.library_folders; depth_count integer; cycle_found boolean;
begin
 if p_parent_id is null then update public.library_folders f set parent_id=null,updated_at=now() where f.id=p_folder_id and f.owner_id=p_owner_id and f.kind=p_kind; return; end if;
 select * into parent from public.library_folders f where f.id=p_parent_id and f.owner_id=p_owner_id and f.kind=p_kind;
 if not found or p_folder_id=p_parent_id then raise exception 'Choose a parent folder in this private library.'; end if;
 with recursive chain(id,parent_id,depth) as (
  select f.id,f.parent_id,1 from public.library_folders f where f.id=p_parent_id
  union all select f.id,f.parent_id,c.depth+1 from public.library_folders f join chain c on f.id=c.parent_id where c.depth<7
 ) select coalesce(max(depth),0),coalesce(bool_or(id=p_folder_id),false) into depth_count,cycle_found from chain;
 if cycle_found or depth_count>=5 then raise exception 'Folders can nest only five levels deep and cannot contain themselves.'; end if;
 update public.library_folders f set parent_id=p_parent_id,updated_at=now() where f.id=p_folder_id and f.owner_id=p_owner_id and f.kind=p_kind;
 if not found then raise exception 'Folder unavailable.'; end if;
end $$;

revoke all on function private.can_edit_beacon_checklist(uuid),private.valid_module_defaults(jsonb),
 private.beacon_module_enabled(uuid,text),
 private.apply_module_collection_action(text,jsonb),private.save_extended_beacon_controls(uuid,jsonb,boolean),
 private.set_library_folder_parent(uuid,uuid,text,uuid) from public,anon,authenticated;

-- Append one wrapper layer; legacy request caching/actions remain authoritative.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_module_collections_legacy;
revoke all on function public.beacon_action_module_collections_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_module_collections_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_module_collections_legacy.request_id');
 execute definition;
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); v_request_id uuid:=request_id; previous jsonb; cycle_found boolean; result jsonb; forward_payload jsonb:=payload; aid uuid; rid uuid; v_parent_id uuid; v_kind text; list_id uuid; v_module_defaults jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action='save_template' then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select q.result into previous from private.requests q where q.user_id=uid and q.request_id=v_request_id;
  if found then return previous; end if;
  perform private.limit_action('all',300);
  v_module_defaults:=payload->'module_defaults';
  if v_module_defaults='null'::jsonb then v_module_defaults:=null; end if;
  if v_module_defaults is not null and not private.valid_module_defaults(v_module_defaults) then raise exception 'Choose valid template module preferences.'; end if;
  rid:=nullif(payload->>'id','')::uuid;
  if rid is null then
   insert into public.templates(owner_id,name,title,description,category,minutes,label,target_count,approval_required,module_defaults)
   values(uid,trim(coalesce(payload->>'name','')),trim(coalesce(payload->>'title','')),coalesce(payload->>'description',''),payload->>'category',(payload->>'minutes')::int,coalesce(payload->>'label',''),nullif(payload->>'target_count','')::int,coalesce((payload->>'approval_required')::boolean,false),v_module_defaults)
   returning id into rid;
  else
   update public.templates t set name=trim(coalesce(payload->>'name','')),title=trim(coalesce(payload->>'title','')),description=coalesce(payload->>'description',''),category=payload->>'category',minutes=(payload->>'minutes')::int,label=coalesce(payload->>'label',''),target_count=nullif(payload->>'target_count','')::int,approval_required=coalesce((payload->>'approval_required')::boolean,false),module_defaults=case when payload ? 'module_defaults' then v_module_defaults else t.module_defaults end
   where t.id=rid and t.owner_id=uid;
   if not found then raise exception 'Template unavailable.'; end if;
  end if;
  result:=jsonb_build_object('id',rid,'event','save_template');
  insert into private.requests(user_id,request_id,result) values(uid,v_request_id,result);
  return result;
 end if;
 if action in ('save_beacon','set_checklist_edit_policy','ensure_saved_checklist_copy','save_library_checklist','delete_saved_checklist','move_library_resource',
   'add_checklist_section','edit_checklist_section','delete_checklist_section','add_checklist_item','edit_checklist_item',
   'toggle_checklist_item','delete_checklist_item','add_beacon_note','save_beacon_note','create_journal_entry','edit_beacon_note',
   'set_beacon_note_visibility','delete_beacon_note','apply_saved_checklist_to_beacon') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select q.result into previous from private.requests q where q.user_id=uid and q.request_id=v_request_id;
  if found then return previous; end if;
  result:=private.apply_module_collection_action(action,payload)||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,v_request_id,result);
  return result;
 end if;

 if action in ('create_library_folder','rename_library_folder','delete_library_folder','move_library_item','move_library_resource') then
  v_kind:=payload->>'kind';
  if v_kind in ('journal','checklist') then
   perform pg_advisory_xact_lock(hashtextextended(uid::text||':library:'||v_kind,0));
  end if;
 end if;
 if action in ('create_library_folder','rename_library_folder') and payload ? 'parent_id' then
  v_parent_id:=nullif(payload->>'parent_id','')::uuid;
  rid:=nullif(payload->>'id','')::uuid;
  v_kind:=payload->>'kind';
  if v_kind not in ('journal','checklist') then raise exception 'Choose Journals or Checklists for this folder.'; end if;
  if v_parent_id is not null and not exists(select 1 from public.library_folders f where f.id=v_parent_id and f.owner_id=uid and f.kind=v_kind) then raise exception 'Choose a parent folder in this private library.'; end if;
  if action='rename_library_folder' and rid is not null then
   with recursive descendants(id,depth) as (select f.id,1 from public.library_folders f where f.parent_id=rid union all select f.id,d.depth+1 from public.library_folders f join descendants d on f.parent_id=d.id where d.depth<7)
   select exists(select 1 from descendants where id=v_parent_id) into cycle_found;
   if cycle_found then raise exception 'Folders cannot contain themselves.'; end if;
  end if;
 end if;
 if action='comment' then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select q.result into previous from private.requests q where q.user_id=uid and q.request_id=v_request_id;
  if found then return previous; end if;
  aid:=nullif(payload->>'id','')::uuid;
  if exists(select 1 from public.activities where id=aid and not enable_comments) then raise exception 'Comments are paused for this Beacon.'; end if;
  return public.beacon_action_module_collections_legacy(action,payload,v_request_id);
 end if;

 result:=public.beacon_action_module_collections_legacy(action,forward_payload,v_request_id);

 if action='set_beacon_controls' then
  aid:=coalesce(nullif(payload->>'activity_id','')::uuid,nullif(payload->>'id','')::uuid);
  perform private.save_extended_beacon_controls(aid,payload,false);
 elsif action='create_activity' then
  aid:=coalesce(nullif(result->>'activity_id','')::uuid,nullif(result->>'id','')::uuid);
  perform private.save_extended_beacon_controls(aid,payload,true);
  list_id:=nullif(payload->>'saved_checklist_id','')::uuid;
  if list_id is not null then perform private.copy_saved_checklist_to_beacon(list_id,aid,uid); end if;
 elsif action in ('create_library_folder','rename_library_folder') and payload ? 'parent_id' then
  rid:=coalesce(nullif(result->>'id','')::uuid,nullif(payload->>'id','')::uuid);
  if rid is not null then perform private.set_library_folder_parent(rid,uid,v_kind,v_parent_id); end if;
 end if;
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create or replace function public.beacon_snapshot() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb; profile_data jsonb;
begin
 profile_data:=private.profile_snapshot_data();
 foreach t in array array['favorites','beacon_favorites','templates','plan_templates','plans','messages','profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks','beacon_checklist_sections','beacon_checklist_items','beacon_notes','library_folders','library_folder_items','library_saved_checklists','library_resource_folders','planning_threads','planning_ping_responses','planning_proposals','planning_votes','beacon_roles','beacon_attendance','beacon_invitation_grants'] loop
  if t='profiles' then rows:=profile_data->'profiles';
  elsif t='activities' then
   execute format('select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object(''viewer_can_access'',private.can_chat(x.id),''accepted_seat_count'',private.beacon_seat_count(x.id))),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  else execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  end if;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('profile_visibility_grants',profile_data->'profile_visibility_grants','is_moderator',private.is_moderator());
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
