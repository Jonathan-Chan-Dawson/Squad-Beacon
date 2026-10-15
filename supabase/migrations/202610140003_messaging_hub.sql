-- Private read positions; no recipient-facing read receipts.
create table public.dm_message_reads (
 user_id uuid not null references public.profiles(id) on delete cascade,
 peer_id uuid not null references public.profiles(id) on delete cascade,
 last_read_at timestamptz not null,
 last_read_message_id uuid not null,
 primary key(user_id,peer_id), check(user_id<>peer_id)
);
alter table public.dm_message_reads enable row level security;
revoke all on public.dm_message_reads from public,anon,authenticated;
grant select on public.dm_message_reads to authenticated;
create policy read_own_dm_position on public.dm_message_reads for select to authenticated
 using(user_id=auth.uid() and private.friends(peer_id));
alter table public.group_message_reads add column last_read_message_id uuid;

-- Existing history starts read; only subsequent incoming messages create badges.
insert into public.dm_message_reads(user_id,peer_id,last_read_at,last_read_message_id)
select distinct on (pairs.viewer,pairs.peer) pairs.viewer,pairs.peer,m.created_at,m.id
from public.friendships f
cross join lateral (values (f.sender_id,f.recipient_id),(f.recipient_id,f.sender_id)) pairs(viewer,peer)
join public.messages m on m.activity_id is null and
 ((m.author_id=pairs.viewer and m.recipient_id=pairs.peer) or (m.author_id=pairs.peer and m.recipient_id=pairs.viewer))
where f.status='accepted' and not exists(select 1 from public.blocks b where
 (b.blocker_id=pairs.viewer and b.blocked_id=pairs.peer) or (b.blocker_id=pairs.peer and b.blocked_id=pairs.viewer))
order by pairs.viewer,pairs.peer,m.created_at desc,m.id desc;

alter function public.beacon_snapshot() rename to beacon_snapshot_messaging_legacy;
create function public.beacon_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 select public.beacon_snapshot_messaging_legacy() || jsonb_build_object('dm_message_reads',
  (select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.dm_message_reads r));
$$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_messaging_legacy;
revoke all on function public.beacon_action_messaging_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$ declare definition text; begin
 select pg_get_functiondef('public.beacon_action_messaging_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 execute replace(definition,'beacon_action.request_id','beacon_action_messaging_legacy.request_id');
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid; peer uuid; boundary uuid; scope_name text; scope_id_value uuid;
 read_time timestamptz; list_name text; prior jsonb; result jsonb; source record; used boolean;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 -- Serialize owner writes, including changes that introduce list audience references.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if action not in ('create_list','rename_list','delete_list','mark_dm_chat_read')
  and not (action='mark_group_chat_read' and payload ? 'message_id') then
  result:=public.beacon_action_messaging_legacy(action,payload,beacon_action.request_id);
  if action='mark_group_chat_read' then
   update public.group_message_reads set last_read_message_id=null where user_id=uid
    and scope=payload->>'scope' and scope_id=case when payload->>'scope'='squad' then nullif(payload->>'squad_id','')::uuid else nullif(payload->>'organization_id','')::uuid end
    and last_read_at=(result->>'read_at')::timestamptz;
  end if;
  return result;
 end if;
 select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
 if found then return prior; end if;
 perform private.limit_action('all',300);
 if action in ('rename_list','delete_list') then rid:=nullif(payload->>'id','')::uuid; end if;
 if action in ('create_list','rename_list','delete_list') then
  if action<>'create_list' then
   perform 1 from public.lists where id=rid and owner_id=uid for update;
   if not found then raise exception 'Choose your own private list.'; end if;
  end if;
  if action='delete_list' then
   -- Audience IDs are polymorphic; inspect every audience-bearing public table.
   for source in select c.table_name from information_schema.columns c
    where c.table_schema='public' and c.column_name='audience_id' and exists(
     select 1 from information_schema.columns a where a.table_schema=c.table_schema and a.table_name=c.table_name and a.column_name='audience') loop
    execute format('select exists(select 1 from public.%I where audience::text=''list'' and audience_id=$1)',source.table_name) into used using rid;
    if used then raise exception 'This list is still used for sharing. Remove its audience references before deleting it.'; end if;
   end loop;
   if exists(select 1 from private.profile_visibility_lists where list_id=rid) then
    raise exception 'This list is still used for profile sharing. Remove its audience references before deleting it.';
   end if;
   delete from public.lists where id=rid;
  else
   list_name:=btrim(coalesce(payload->>'name',''));
   if jsonb_typeof(payload->'name') is distinct from 'string' or char_length(list_name) not between 1 and 50 then raise exception 'Enter a list name of 1–50 characters.'; end if;
   if exists(select 1 from public.lists where owner_id=uid and name=list_name and id is distinct from rid) then
    raise exception 'You already have a list with that name.';
   end if;
   if action='create_list' then
    insert into public.lists(owner_id,name) values(uid,list_name) returning id into rid;
   else update public.lists set name=list_name where id=rid; end if;
  end if;
  result:=jsonb_build_object('id',rid,'event',action);
 elsif action='mark_dm_chat_read' then
  peer:=nullif(payload->>'peer_id','')::uuid;
  boundary:=nullif(payload->>'message_id','')::uuid;
  if peer is null or not private.friends(peer) then raise exception 'This conversation is unavailable.'; end if;
  select created_at into read_time from public.messages where id=boundary and activity_id is null
   and ((author_id=uid and recipient_id=peer) or (author_id=peer and recipient_id=uid));
  if not found then raise exception 'Choose a message from this conversation.'; end if;
  insert into public.dm_message_reads(user_id,peer_id,last_read_at,last_read_message_id) values(uid,peer,read_time,boundary)
   on conflict(user_id,peer_id) do update set last_read_at=excluded.last_read_at,last_read_message_id=excluded.last_read_message_id
   where (excluded.last_read_at,excluded.last_read_message_id)>(public.dm_message_reads.last_read_at,public.dm_message_reads.last_read_message_id);
  result:=jsonb_build_object('event',action,'peer_id',peer,'message_id',boundary,'read_at',read_time);
 else
  scope_name:=payload->>'scope';
  scope_id_value:=case when scope_name='squad' then nullif(payload->>'squad_id','')::uuid when scope_name='organization' then nullif(payload->>'organization_id','')::uuid end;
  boundary:=nullif(payload->>'message_id','')::uuid;
  if scope_id_value is null or not private.organization_chat_visible(scope_name,scope_id_value,uid) then raise exception 'That group chat is unavailable to you.'; end if;
  select created_at into read_time from public.group_messages where id=boundary and scope=scope_name and scope_id=scope_id_value and not private.blocked(author_id) and private.can_minimal_profile(author_id);
  if not found then raise exception 'Choose a message from this group.'; end if;
  insert into public.group_message_reads(scope,scope_id,organization_id,squad_id,user_id,last_read_at,last_read_message_id)
  values(scope_name,scope_id_value,case when scope_name='organization' then scope_id_value end,case when scope_name='squad' then scope_id_value end,uid,read_time,boundary)
   on conflict(scope,scope_id,user_id) do update set last_read_at=excluded.last_read_at,last_read_message_id=excluded.last_read_message_id
   where excluded.last_read_at>public.group_message_reads.last_read_at or
    (excluded.last_read_at=public.group_message_reads.last_read_at and public.group_message_reads.last_read_message_id is not null and excluded.last_read_message_id>public.group_message_reads.last_read_message_id);
  result:=jsonb_build_object('event',action,'scope',scope_name,'read_at',read_time,'message_id',boundary);
 end if;
 insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
