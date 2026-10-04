-- Optional Beacon Memories and a lightweight team scoreboard.
-- Media bytes stay in a private bucket; snapshots contain paths, never URLs.
alter table public.activities
 add column scoreboard_max_team_size integer
 check(scoreboard_max_team_size between 1 and 24);

create table public.beacon_teams (
 id uuid primary key default gen_random_uuid(),
 activity_id uuid not null references public.activities(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 36),
 score integer not null default 0 check(score between 0 and 9999),
 created_at timestamptz not null default now(),
 unique(id,activity_id)
);
create unique index beacon_teams_activity_name
 on public.beacon_teams(activity_id,lower(name));
create index beacon_teams_activity_created
 on public.beacon_teams(activity_id,created_at,id);

create table public.beacon_team_members (
 activity_id uuid not null,
 team_id uuid not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(team_id,user_id),
 unique(activity_id,user_id),
 foreign key(team_id,activity_id)
  references public.beacon_teams(id,activity_id) on delete cascade
);
create index beacon_team_members_activity_team
 on public.beacon_team_members(activity_id,team_id,joined_at,user_id);

create table public.beacon_memories (
 id uuid primary key default gen_random_uuid(),
 activity_id uuid not null references public.activities(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 object_path text not null unique,
 media_type text not null check(media_type in ('image','video')),
 duration_seconds integer,
 caption text not null default '' check(char_length(caption)<=500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(
  (media_type='image' and duration_seconds is null) or
  (media_type='video' and duration_seconds between 1 and 30)
 ),
 check(object_path=activity_id::text||'/'||author_id::text||'/'||split_part(object_path,'/',3))
);
create index beacon_memories_activity_created
 on public.beacon_memories(activity_id,created_at desc,id);

alter table public.beacon_teams enable row level security;
alter table public.beacon_team_members enable row level security;
alter table public.beacon_memories enable row level security;
revoke all on public.beacon_teams,public.beacon_team_members,public.beacon_memories
 from public,anon,authenticated;
grant select on public.beacon_teams,public.beacon_team_members,public.beacon_memories
 to authenticated;

create function private.beacon_team_member_visible(aid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.can_profile(person)
  and not private.blocked(person)
  and exists(select 1 from public.activities a where a.id=aid and a.enable_scoreboard
   and private.can_activity(a.id) and private.can_chat(a.id)
   and (person=a.owner_id or private.beacon_approved_going(a.id,person)));
$$;
revoke all on function private.beacon_team_member_visible(uuid,uuid) from public,anon;
grant execute on function private.beacon_team_member_visible(uuid,uuid) to authenticated;

create policy read_beacon_teams on public.beacon_teams for select to authenticated
 using(exists(
  select 1 from public.activities a
  where a.id=activity_id and a.enable_scoreboard
   and private.can_activity(a.id) and private.can_chat(a.id)
 ));
create policy read_beacon_team_members on public.beacon_team_members for select to authenticated
 using(private.beacon_team_member_visible(activity_id,user_id));
create policy read_beacon_memories on public.beacon_memories for select to authenticated
 using(exists(
  select 1 from public.activities a
  where a.id=activity_id and a.enable_experiences
   and private.can_activity(a.id) and private.can_chat(a.id)
 ) and private.can_profile(author_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('beacon-memories','beacon-memories',false,25165824,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
 on conflict(id) do update set
  public=false,file_size_limit=25165824,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'];

create policy beacon_memory_upload on storage.objects for insert to authenticated
 with check(
  bucket_id='beacon-memories' and
  (storage.foldername(name))[2]=auth.uid()::text and
  exists(
   select 1 from public.activities a
   where a.id=(storage.foldername(name))[1]::uuid
    and a.enable_experiences and a.status<>'cancelled'
    and private.can_activity(a.id) and private.can_chat(a.id)
  )
 );
create policy beacon_memory_private_read on storage.objects for select to authenticated
 using(
  bucket_id='beacon-memories' and exists(
   select 1 from public.beacon_memories m
   join public.activities a on a.id=m.activity_id
   where m.object_path=name and a.enable_experiences
    and private.can_activity(a.id) and private.can_chat(a.id)
    and private.can_profile(m.author_id)
  )
 );
-- Owners can inspect/remove their own pending or orphaned upload by exact path;
-- attendee reads still require the current Beacon + profile policy above.
create policy beacon_memory_owner_object_read on storage.objects for select to authenticated
 using(
  bucket_id='beacon-memories' and (storage.foldername(name))[2]=auth.uid()::text
 );
create policy beacon_memory_owner_cleanup on storage.objects for delete to authenticated
 using(
  bucket_id='beacon-memories' and (storage.foldername(name))[2]=auth.uid()::text
 );

-- A definer-backed count keeps private/blocked identities out of the snapshot,
-- while preserving real capacity regardless of which rows this viewer can see.
create function private.beacon_team_eligible_count(tid uuid) returns integer
language plpgsql stable security definer set search_path='' as $$
declare aid uuid; result integer;
begin
 if auth.uid() is null then return 0; end if;
 select t.activity_id into aid from public.beacon_teams t where t.id=tid;
 if aid is null or not private.can_activity(aid) or not private.can_chat(aid)
  or not exists(select 1 from public.activities a where a.id=aid and a.enable_scoreboard) then
  return 0;
 end if;
 select count(*)::integer into result
 from public.beacon_team_members m join public.activities a on a.id=m.activity_id
 where m.team_id=tid and (m.user_id=a.owner_id or private.beacon_approved_going(a.id,m.user_id));
 return coalesce(result,0);
end $$;
revoke all on function private.beacon_team_eligible_count(uuid) from public,anon;
grant execute on function private.beacon_team_eligible_count(uuid) to authenticated;

create function private.apply_beacon_media_team_action(action text,payload jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();
 aid uuid:=nullif(payload->>'activity_id','')::uuid;
 tid uuid:=nullif(payload->>'team_id','')::uuid;
 mid uuid:=nullif(payload->>'id','')::uuid;
 activity public.activities;
 team public.beacon_teams;
 memory public.beacon_memories;
 team_name text;
 max_size integer;
 member_count integer;
 delta integer;
 mime_type text;
 file_size bigint;
 duration integer;
 v_caption text;
 v_object_path text;
 v_media_type text;
 new_id uuid;
begin
 if uid is null then raise exception 'Sign in to use Beacon tools.'; end if;

 if action='save_beacon_scoreboard' then
  aid:=nullif(payload->>'activity_id','')::uuid;
  select * into activity from public.activities where id=aid for update;
  if not found or activity.status<>'scheduled' or not private.can_manage_beacon(aid) then
   raise exception 'Only a current Beacon manager can change the scoreboard.';
  end if;
  max_size:=nullif(payload->>'max_team_size','')::integer;
  if max_size is not null and max_size not between 1 and 24 then
   raise exception 'Choose a team size from 1 to 24, or leave it unlimited.';
  end if;
  if max_size is not null and exists(
   select 1 from public.beacon_teams t
   where t.activity_id=aid and
    (select count(*) from public.beacon_team_members m
      where m.team_id=t.id
       and (m.user_id=activity.owner_id or private.beacon_approved_going(aid,m.user_id)))>max_size
  ) then raise exception 'A team currently exceeds that size. Remove members first.'; end if;
  update public.activities set
   enable_scoreboard=coalesce((payload->>'enabled')::boolean,enable_scoreboard),
   scoreboard_max_team_size=max_size
  where id=aid;
  return jsonb_build_object('activity_id',aid);
 end if;

 if action in ('create_beacon_team','rename_beacon_team','remove_beacon_team') then
  if action='create_beacon_team' then aid:=nullif(payload->>'activity_id','')::uuid;
  else select t.activity_id into aid from public.beacon_teams t where t.id=tid; end if;
  select * into activity from public.activities where id=aid for update;
  if not found or not activity.enable_scoreboard or activity.status<>'scheduled'
   or not private.can_manage_beacon(aid) then
   raise exception 'Only a current Beacon manager can manage teams.';
  end if;
  if action='create_beacon_team' then
   team_name:=trim(coalesce(payload->>'name',''));
   if char_length(team_name) not between 1 and 36 then raise exception 'Team names must be 1 to 36 characters.'; end if;
   if (select count(*) from public.beacon_teams where activity_id=aid)>=8 then
    raise exception 'A Beacon can have up to 8 teams.';
   end if;
   new_id:=coalesce(mid,gen_random_uuid());
   select * into team from public.beacon_teams where id=new_id;
   if found then
    if team.activity_id=aid and team.name=team_name then
     return jsonb_build_object('id',new_id,'activity_id',aid);
    end if;
    raise exception 'That team id is already in use.';
   end if;
   insert into public.beacon_teams(id,activity_id,name) values(new_id,aid,team_name);
   return jsonb_build_object('id',new_id,'activity_id',aid);
  elsif action='rename_beacon_team' then
   team_name:=trim(coalesce(payload->>'name',''));
   if char_length(team_name) not between 1 and 36 then raise exception 'Team names must be 1 to 36 characters.'; end if;
   update public.beacon_teams set name=team_name where id=tid and activity_id=aid;
   return jsonb_build_object('id',tid,'activity_id',aid);
  else
   delete from public.beacon_teams where id=tid and activity_id=aid;
   return jsonb_build_object('id',tid,'activity_id',aid);
  end if;
 end if;

 if action in ('join_beacon_team','leave_beacon_team') then
  select t.activity_id into aid from public.beacon_teams t where t.id=tid;
  select * into activity from public.activities where id=aid for update;
  if not found then raise exception 'That team is unavailable.'; end if;
  select * into team from public.beacon_teams where id=tid for update;
  if action='leave_beacon_team' then
   delete from public.beacon_team_members where team_id=tid and user_id=uid;
   return jsonb_build_object('team_id',tid,'activity_id',aid);
  end if;
  if not activity.enable_scoreboard or activity.status<>'scheduled'
   or not private.can_activity(aid) or not private.can_chat(aid) then
   raise exception 'Join this Beacon before joining a team.';
  end if;
  delete from public.beacon_team_members stale
   where stale.activity_id=aid and stale.user_id=uid
    and ((uid<>activity.owner_id and not private.beacon_approved_going(aid,uid))
     or exists(select 1 from public.blocks b where
      (b.blocker_id=activity.owner_id and b.blocked_id=uid) or
      (b.blocker_id=uid and b.blocked_id=activity.owner_id)));
  if exists(select 1 from public.beacon_team_members where activity_id=aid and user_id=uid) then
   raise exception 'Leave your current team before joining another.';
  end if;
  if activity.scoreboard_max_team_size is not null then
   select count(*) into member_count from public.beacon_team_members m
    where m.team_id=tid
     and (m.user_id=activity.owner_id or private.beacon_approved_going(aid,m.user_id));
   if member_count>=activity.scoreboard_max_team_size then raise exception 'This team is full.'; end if;
  end if;
  insert into public.beacon_team_members(activity_id,team_id,user_id)
   values(aid,tid,uid);
  return jsonb_build_object('team_id',tid,'activity_id',aid);
 end if;

 if action='adjust_beacon_team_score' then
  select t.activity_id into aid from public.beacon_teams t where t.id=tid;
  select * into activity from public.activities where id=aid for update;
  if not found or not activity.enable_scoreboard or activity.status<>'scheduled'
   or not private.can_manage_beacon(aid) then
   raise exception 'Only a current Beacon manager can change the score.';
  end if;
  delta:=nullif(payload->>'delta','')::integer;
  if delta is null or delta not in (-1,1) then raise exception 'Adjust scores one point at a time.'; end if;
  update public.beacon_teams set score=greatest(0,least(9999,score+delta))
   where id=tid and activity_id=aid;
  return jsonb_build_object('team_id',tid,'activity_id',aid);
 end if;

 if action='create_beacon_memory' then
  aid:=nullif(payload->>'activity_id','')::uuid;
  v_object_path:=coalesce(payload->>'object_path','');
  v_media_type:=payload->>'media_type';
  duration:=nullif(payload->>'duration_seconds','')::integer;
  v_caption:=trim(coalesce(payload->>'caption',''));
  new_id:=coalesce(mid,gen_random_uuid());
  select * into activity from public.activities where id=aid for update;
  if not found or not activity.enable_experiences or activity.status='cancelled'
   or not private.can_activity(aid) or not private.can_chat(aid) then
   raise exception 'You cannot add a memory to this Beacon.';
  end if;
  if char_length(v_caption)>500 then raise exception 'Captions must be 500 characters or less.'; end if;
  if v_object_path not like (aid::text||'/'||uid::text||'/%')
   or v_object_path !~ ('^'||aid::text||'/'||uid::text||'/[0-9a-fA-F-]{36}[.](jpg|png|webp|mp4|mov)$') then
   raise exception 'Upload this media to the current Beacon first.';
  end if;
  if v_media_type is null or v_media_type not in ('image','video')
   or (v_media_type='image' and duration is not null)
   or (v_media_type='video' and (duration is null or duration not between 1 and 30)) then
   raise exception 'Choose a photo or a video up to 30 seconds.';
  end if;
  select lower(coalesce(o.metadata->>'mimetype','')),
   case when coalesce(o.metadata->>'size','') ~ '^\d+$' then (o.metadata->>'size')::bigint else 0 end
   into mime_type,file_size
  from storage.objects o where o.bucket_id='beacon-memories' and o.name=v_object_path;
  if not found or file_size<=0 then raise exception 'Upload the media before saving it.'; end if;
  if (v_media_type='image' and (mime_type not in ('image/jpeg','image/png','image/webp') or file_size>8388608))
   or (v_media_type='video' and (mime_type not in ('video/mp4','video/quicktime') or file_size>25165824)) then
   raise exception 'This file type or size is not supported.';
  end if;
  select * into memory from public.beacon_memories where id=new_id;
  if found then
   if memory.author_id=uid and memory.activity_id=aid and memory.object_path=v_object_path
    and memory.media_type=v_media_type and memory.duration_seconds is not distinct from duration
    and memory.caption=v_caption then
    return jsonb_build_object('id',new_id,'activity_id',aid);
   end if;
   raise exception 'That memory id is already in use.';
  end if;
  if (select count(*) from public.beacon_memories where activity_id=aid)>=50 then
   raise exception 'A Beacon can have up to 50 memories.';
  end if;
  insert into public.beacon_memories(id,activity_id,author_id,object_path,media_type,duration_seconds,caption)
   values(new_id,aid,uid,v_object_path,v_media_type,duration,v_caption);
  return jsonb_build_object('id',new_id,'activity_id',aid);
 end if;

 if action in ('update_beacon_memory','delete_beacon_memory') then
  select * into memory from public.beacon_memories where id=mid for update;
  if not found then
   aid:=nullif(payload->>'activity_id','')::uuid;
   v_object_path:=coalesce(payload->>'object_path','');
   if action='delete_beacon_memory' and aid is not null
    and v_object_path like (aid::text||'/'||uid::text||'/%')
    and v_object_path ~ ('^'||aid::text||'/'||uid::text||'/[0-9a-fA-F-]{36}[.](jpg|png|webp|mp4|mov)$') then
    return jsonb_build_object('id',mid,'activity_id',aid,'object_path',v_object_path);
   end if;
   raise exception 'Only the creator can change this Beacon memory.';
  end if;
  if memory.author_id<>uid then raise exception 'Only the creator can change this Beacon memory.'; end if;
  if not exists(select 1 from public.activities a where a.id=memory.activity_id
   and a.enable_experiences and a.status<>'cancelled'
   and private.can_activity(a.id) and private.can_chat(a.id)) then
   raise exception 'That Beacon memory is unavailable.';
  end if;
  if action='delete_beacon_memory' then
   delete from public.beacon_memories where id=mid;
   return jsonb_build_object('id',mid,'activity_id',memory.activity_id,'object_path',memory.object_path);
  end if;
  v_caption:=trim(coalesce(payload->>'caption',''));
  if char_length(v_caption)>500 then raise exception 'Captions must be 500 characters or less.'; end if;
  update public.beacon_memories set caption=v_caption,updated_at=now() where id=mid;
  return jsonb_build_object('id',mid,'activity_id',memory.activity_id);
 end if;

 raise exception 'Unsupported Beacon media or team action.';
end $$;
revoke all on function private.apply_beacon_media_team_action(text,jsonb) from public,anon,authenticated;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_media_teams_legacy;
revoke all on function public.beacon_action_media_teams_legacy(text,jsonb,uuid) from public,anon,authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
 returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); v_request_id uuid:=request_id; previous jsonb; result jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action in ('save_beacon_scoreboard','create_beacon_team','rename_beacon_team','remove_beacon_team',
  'join_beacon_team','leave_beacon_team','adjust_beacon_team_score','create_beacon_memory',
  'update_beacon_memory','delete_beacon_memory') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select q.result into previous from private.requests q
   where q.user_id=uid and q.request_id=v_request_id;
  if found then return previous; end if;
  perform private.limit_action('all',300);
  result:=private.apply_beacon_media_team_action(action,payload)||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result)
   values(uid,v_request_id,result);
  return result;
 end if;
 return public.beacon_action_media_teams_legacy(action,payload,v_request_id);
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

do $snapshot_patch$
declare definition text; original_definition text;
begin
 select pg_get_functiondef('public.beacon_snapshot()'::regprocedure) into definition;
 original_definition:=definition;
 if position('''beacon_teams''' in definition)=0 then
  definition:=replace(definition,
   $old$'beacon_invitation_grants']$old$,
   $new$'beacon_invitation_grants','beacon_teams','beacon_team_members','beacon_memories']$new$);
 end if;
 if position('elsif t=''beacon_teams'' then' in definition)=0 then
  definition:=replace(definition,
   $old$  elsif t='activities' then$old$,
  $new$  elsif t='beacon_teams' then
   execute 'select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object(''member_count'',private.beacon_team_eligible_count(x.id))),''[]''::jsonb) from (select * from public.beacon_teams) x' into rows;
  elsif t='activities' then$new$);
 end if;
 if definition=original_definition then
  raise exception 'Could not extend the Beacon snapshot with media and team tables.';
 end if;
 execute definition;
end $snapshot_patch$;

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='beacon_teams') then
   alter publication supabase_realtime add table public.beacon_teams;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='beacon_team_members') then
   alter publication supabase_realtime add table public.beacon_team_members;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='beacon_memories') then
   alter publication supabase_realtime add table public.beacon_memories;
  end if;
 end if;
end $$;
