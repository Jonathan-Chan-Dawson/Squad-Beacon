-- Organizations are membership collections. Attaching a Squad never changes
-- its own roster or grants organization members access to its private content.
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 60),
 description text not null default '' check(char_length(description)<=500),
 created_at timestamptz not null default now()
);
create index organizations_owner on public.organizations(owner_id,created_at desc);

create table public.organization_members (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check(role in ('coowner','admin','elder','member')),
 status text not null default 'invited' check(status in ('invited','active')),
 invited_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
create index organization_members_user on public.organization_members(user_id,status,organization_id);
create index organization_members_role on public.organization_members(organization_id,status,role);

create table public.organization_bans (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 banned_by uuid references public.profiles(id) on delete set null,
 reason text not null default '' check(char_length(reason)<=200),
 former_role text not null check(former_role in ('coowner','admin','elder','member')),
 created_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);

create table public.organization_squads (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 squad_id uuid not null references public.squads(id) on delete cascade,
 added_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(organization_id,squad_id)
);
create index organization_squads_squad on public.organization_squads(squad_id,organization_id);

create table public.group_messages (
 id uuid primary key default gen_random_uuid(),
 scope text not null check(scope in ('squad','organization')),
 scope_id uuid not null,
 organization_id uuid references public.organizations(id) on delete cascade,
 squad_id uuid references public.squads(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 check((scope='organization' and organization_id=scope_id and squad_id is null)
    or (scope='squad' and squad_id=scope_id and organization_id is null))
);
create index group_messages_scope_created on public.group_messages(scope,scope_id,created_at desc,id desc);

create table public.group_message_reads (
 scope text not null check(scope in ('squad','organization')),
 scope_id uuid not null,
 organization_id uuid references public.organizations(id) on delete cascade,
 squad_id uuid references public.squads(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 last_read_at timestamptz not null default now(),
 primary key(scope,scope_id,user_id),
 check((scope='organization' and organization_id=scope_id and squad_id is null)
    or (scope='squad' and squad_id=scope_id and organization_id is null))
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_bans enable row level security;
alter table public.organization_squads enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_message_reads enable row level security;
revoke all on public.organizations,public.organization_members,public.organization_bans,
 public.organization_squads,public.group_messages,public.group_message_reads
 from public,anon,authenticated;
grant select on public.organizations,public.organization_members,public.organization_bans,
 public.organization_squads,public.group_messages,public.group_message_reads to authenticated;

create function private.organization_role_rank(role_name text) returns integer
language sql immutable set search_path='' as $$
 select case role_name when 'owner' then 5 when 'coowner' then 4 when 'admin' then 3
  when 'elder' then 2 when 'member' then 1 else 0 end;
$$;

create function private.organization_role(org_id uuid,person_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case
  when o.owner_id=person_id then 'owner'
  else (select m.role from public.organization_members m
   where m.organization_id=o.id and m.user_id=person_id and m.status='active'
    and not exists(select 1 from public.organization_bans b where b.organization_id=o.id and b.user_id=person_id))
 end
 from public.organizations o where o.id=org_id;
$$;

create function private.organization_active(org_id uuid,person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select person_id is not null and private.organization_role(org_id,person_id) is not null;
$$;

create function private.organization_member_count(org_id uuid) returns integer
language sql stable security definer set search_path='' as $$
 select coalesce((select 1+count(*)::integer from public.organization_members m
  join public.organizations o on o.id=m.organization_id
  where m.organization_id=org_id and m.status='active' and m.user_id<>o.owner_id),0);
$$;

create function private.organization_chat_visible(chat_scope text,chat_id uuid,person_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case chat_scope
  when 'organization' then private.organization_active(chat_id,person_id)
   and not private.blocked((select o.owner_id from public.organizations o where o.id=chat_id))
  when 'squad' then exists(select 1 from public.squad_members m join public.squads s on s.id=m.squad_id
   where m.squad_id=chat_id and m.user_id=person_id and not private.blocked(s.owner_id))
  else false end;
$$;

create function private.organization_can_manage_member(org_id uuid,actor_id uuid,target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select actor_id is not null and target_id is not null and target_id<>actor_id
  and target_id<>(select o.owner_id from public.organizations o where o.id=org_id)
  and private.organization_role_rank(private.organization_role(org_id,actor_id)) >
   private.organization_role_rank(coalesce(
    (select m.role from public.organization_members m where m.organization_id=org_id and m.user_id=target_id),
    (select b.former_role from public.organization_bans b where b.organization_id=org_id and b.user_id=target_id),
    'owner'));
$$;

create function private.organization_private_audience(org_id uuid,person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.organization_active(org_id,person_id)
  and private.organization_active(org_id,auth.uid())
  and not private.blocked(person_id)
  and not private.blocked((select o.owner_id from public.organizations o where o.id=org_id));
$$;

create function private.can_read_organization(org_id uuid,person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations o where o.id=org_id
  and not private.blocked(o.owner_id) and (
   private.organization_active(o.id,person_id)
   or (exists(select 1 from public.organization_members m where m.organization_id=o.id
    and m.user_id=person_id and m.status='invited')
    and not exists(select 1 from public.organization_bans b where b.organization_id=o.id and b.user_id=person_id))
  ));
$$;

create function private.can_read_organization_member(org_id uuid,member_id uuid,member_status text,person_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations o where o.id=org_id and (
  (private.organization_active(o.id,person_id) and not private.blocked(member_id))
  or (member_id=person_id and member_status='invited' and not private.blocked(o.owner_id)
   and not exists(select 1 from public.organization_bans b where b.organization_id=o.id and b.user_id=person_id))
  or (member_status='invited' and private.organization_role_rank(private.organization_role(o.id,person_id))>=3
   and not private.blocked(member_id))
 ));
$$;

create function private.can_read_organization_ban(org_id uuid,target_id uuid,person_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.organization_role_rank(private.organization_role(org_id,person_id))>=3
  and not private.blocked(target_id);
$$;

create function private.can_read_organization_squad(org_id uuid,sid uuid,person_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.organization_active(org_id,person_id) and private.member(sid)
  and not private.blocked((select s.owner_id from public.squads s where s.id=sid));
$$;

create or replace function private.audience(owner uuid,kind public.audience_kind,aid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (owner=auth.uid() or (not private.blocked(owner) and
 case kind
  when 'friends' then private.friends(owner)
  when 'list' then private.friends(owner) and exists(select 1 from public.list_members m join public.lists l on l.id=m.list_id where l.id=aid and l.owner_id=owner and m.user_id=auth.uid())
  when 'squad' then private.member(aid) and exists(select 1 from public.squad_members where squad_id=aid and user_id=owner)
  when 'organization' then private.organization_active(aid,owner) and private.organization_active(aid,auth.uid())
    and not private.blocked((select o.owner_id from public.organizations o where o.id=aid))
  else false
 end));
$$;

create or replace function private.validate_audience(kind public.audience_kind,aid uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if kind='list' and not exists(select 1 from public.lists where id=aid and owner_id=auth.uid()) then raise exception 'Choose one of your friend lists.'; end if;
 if kind='squad' and not private.member(aid) then raise exception 'Choose a squad you belong to.'; end if;
 if kind='organization' and not private.organization_active(aid,auth.uid()) then raise exception 'Choose an organization you currently belong to.'; end if;
 if (kind in ('list','squad','organization'))<>(aid is not null) then raise exception 'Invalid audience.'; end if;
end $$;

-- Full profile mode remains authoritative; this adds an organization member as
-- a connected identity for public profiles and as minimal identity for chat.
create or replace function private.profile_legacy_context(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select pid=auth.uid() or (not private.blocked(pid) and (
  private.friends(pid)
  or exists(select 1 from public.friendships where recipient_id=auth.uid() and sender_id=pid)
  or exists(select 1 from public.squad_members m where m.user_id=pid and private.member(m.squad_id))
  or exists(select 1 from public.organizations o
   where private.organization_active(o.id,auth.uid()) and private.organization_active(o.id,pid))
  or exists(select 1 from public.activities a where a.owner_id=pid and private.can_activity(a.id))
 ));
$$;

create table private.profile_visibility_organizations (
 owner_id uuid not null references public.profiles(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 primary key(owner_id,organization_id)
);
revoke all on private.profile_visibility_organizations from public,anon,authenticated;

-- Recreate custom context now that its backing organization grant table exists.
create or replace function private.profile_custom_context(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select
  exists(select 1 from private.profile_visibility_people g where g.owner_id=pid and g.person_id=auth.uid())
  or exists(select 1 from private.profile_visibility_squads g
   join public.squad_members owner_member on owner_member.squad_id=g.squad_id and owner_member.user_id=pid
   join public.squad_members viewer_member on viewer_member.squad_id=g.squad_id and viewer_member.user_id=auth.uid()
   where g.owner_id=pid and private.member(g.squad_id))
  or exists(select 1 from private.profile_visibility_lists g
   join public.lists l on l.id=g.list_id and l.owner_id=pid
   join public.list_members m on m.list_id=l.id and m.user_id=auth.uid()
   where g.owner_id=pid)
  or exists(select 1 from private.profile_visibility_organizations g
   where g.owner_id=pid and private.organization_active(g.organization_id,pid)
    and private.organization_active(g.organization_id,auth.uid()));
$$;

do $profile_snapshot_patch$
declare definition text; original_definition text;
begin
 select pg_get_functiondef('private.profile_snapshot_data()'::regprocedure) into definition;
 original_definition:=definition;
 definition:=replace(definition,
  $old$select owner_id,'list'::text kind,list_id target_id from private.profile_visibility_lists where owner_id=uid
 ) g;$old$,
  $new$select owner_id,'list'::text kind,list_id target_id from private.profile_visibility_lists where owner_id=uid
  union all
  select owner_id,'organization'::text kind,organization_id target_id from private.profile_visibility_organizations where owner_id=uid
 ) g;$new$);
 if definition=original_definition then raise exception 'Could not extend profile snapshot with organization grants.'; end if;
 execute definition;
end $profile_snapshot_patch$;

create or replace function private.save_profile_privacy(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); mode text:=payload->>'profile_visibility';
 people jsonb:=coalesce(payload->'person_ids','[]'::jsonb);
 squads jsonb:=coalesce(payload->'squad_ids','[]'::jsonb);
 lists jsonb:=coalesce(payload->'list_ids','[]'::jsonb);
 organizations jsonb:=coalesce(payload->'organization_ids','[]'::jsonb);
begin
 if uid is null then raise exception 'Sign in to update profile privacy.'; end if;
 if mode not in ('public','friends','custom') then raise exception 'Choose a valid profile audience.'; end if;
 if jsonb_typeof(people) is distinct from 'array' or jsonb_typeof(squads) is distinct from 'array'
  or jsonb_typeof(lists) is distinct from 'array' or jsonb_typeof(organizations) is distinct from 'array' then
  raise exception 'Choose valid people, squads, lists, and organizations.';
 end if;
 if jsonb_array_length(people)>200 or jsonb_array_length(squads)>50 or jsonb_array_length(lists)>100
  or jsonb_array_length(organizations)>50 then raise exception 'Your custom profile audience is too large.'; end if;
 if exists(select 1 from jsonb_array_elements(people) x where jsonb_typeof(x.value)<>'string')
  or exists(select 1 from jsonb_array_elements(squads) x where jsonb_typeof(x.value)<>'string')
  or exists(select 1 from jsonb_array_elements(lists) x where jsonb_typeof(x.value)<>'string')
  or exists(select 1 from jsonb_array_elements(organizations) x where jsonb_typeof(x.value)<>'string') then
  raise exception 'Choose valid profile audience entries.';
 end if;
 if (select count(*) from jsonb_array_elements_text(people))<>(select count(distinct x.value) from jsonb_array_elements_text(people) x(value))
  or (select count(*) from jsonb_array_elements_text(squads))<>(select count(distinct x.value) from jsonb_array_elements_text(squads) x(value))
  or (select count(*) from jsonb_array_elements_text(lists))<>(select count(distinct x.value) from jsonb_array_elements_text(lists) x(value))
  or (select count(*) from jsonb_array_elements_text(organizations))<>(select count(distinct x.value) from jsonb_array_elements_text(organizations) x(value)) then
  raise exception 'Choose each audience entry once.';
 end if;
 if mode<>'custom' and (jsonb_array_length(people)>0 or jsonb_array_length(squads)>0
  or jsonb_array_length(lists)>0 or jsonb_array_length(organizations)>0) then
  raise exception 'Custom audience selections are only used in Custom mode.';
 end if;
 if exists(select 1 from jsonb_array_elements_text(people) x(value)
  where x.value::uuid=uid or not exists(select 1 from public.profiles p where p.id=x.value::uuid) or private.blocked(x.value::uuid)) then
  raise exception 'Choose valid, unblocked people.';
 end if;
 if exists(select 1 from jsonb_array_elements_text(squads) x(value)
  where not exists(select 1 from public.squad_members m where m.squad_id=x.value::uuid and m.user_id=uid)) then
  raise exception 'Choose squads you currently belong to.';
 end if;
 if exists(select 1 from jsonb_array_elements_text(lists) x(value)
  where not exists(select 1 from public.lists l where l.id=x.value::uuid and l.owner_id=uid)) then
  raise exception 'Choose your own private friend lists.';
 end if;
 if exists(select 1 from jsonb_array_elements_text(organizations) x(value)
  where not private.organization_active(x.value::uuid,uid)) then
  raise exception 'Choose organizations you currently belong to.';
 end if;
 update public.profiles set profile_visibility=mode where id=uid;
 if not found then raise exception 'Finish your profile first.'; end if;
 delete from private.profile_visibility_people where owner_id=uid;
 delete from private.profile_visibility_squads where owner_id=uid;
 delete from private.profile_visibility_lists where owner_id=uid;
 delete from private.profile_visibility_organizations where owner_id=uid;
 if mode='custom' then
  insert into private.profile_visibility_people(owner_id,person_id) select uid,x.value::uuid from jsonb_array_elements_text(people) x(value);
  insert into private.profile_visibility_squads(owner_id,squad_id) select uid,x.value::uuid from jsonb_array_elements_text(squads) x(value);
  insert into private.profile_visibility_lists(owner_id,list_id) select uid,x.value::uuid from jsonb_array_elements_text(lists) x(value);
  insert into private.profile_visibility_organizations(owner_id,organization_id) select uid,x.value::uuid from jsonb_array_elements_text(organizations) x(value);
 end if;
 return jsonb_build_object('profile_visibility',mode,'saved',true);
end $$;

-- The organization audience must remain membership-based even if a previously
-- approved RSVP exists. Removing a member immediately revokes all org Beacon reads.
do $audience_constraints$
declare target regclass; constraint_row record;
begin
 foreach target in array array['public.goals'::regclass,'public.habits'::regclass,
  'public.activities'::regclass,'public.planning_threads'::regclass] loop
  for constraint_row in select c.conname from pg_constraint c
   where c.conrelid=target and c.contype='c' and pg_get_constraintdef(c.oid) ilike '%audience_id%' loop
   execute format('alter table %s drop constraint %I',target,constraint_row.conname);
  end loop;
 end loop;
end $audience_constraints$;
alter table public.goals add constraint goals_audience_reference_check
 check((audience in ('list','squad','organization'))=(audience_id is not null));
alter table public.habits add constraint habits_audience_reference_check
 check((audience in ('list','squad','organization'))=(audience_id is not null));
alter table public.activities add constraint activities_audience_reference_check
 check((audience in ('list','squad','organization'))=(audience_id is not null));
alter table public.planning_threads add constraint planning_threads_audience_reference_check
 check((audience in ('list','squad','organization'))=(audience_id is not null));

create or replace function private.planning_eligible(owner_id uuid,candidate_id uuid,kind public.audience_kind,aid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select candidate_id is not null and owner_id is not null and (
  candidate_id=owner_id or (
   not exists(select 1 from public.blocks b where (b.blocker_id=owner_id and b.blocked_id=candidate_id) or (b.blocker_id=candidate_id and b.blocked_id=owner_id))
   and case kind
    when 'friends' then exists(select 1 from public.friendships f where f.status='accepted' and ((f.sender_id=owner_id and f.recipient_id=candidate_id) or (f.sender_id=candidate_id and f.recipient_id=owner_id)))
    when 'list' then exists(select 1 from public.lists l join public.list_members m on m.list_id=l.id where l.id=aid and l.owner_id=owner_id and m.user_id=candidate_id)
      and exists(select 1 from public.friendships f where f.status='accepted' and ((f.sender_id=owner_id and f.recipient_id=candidate_id) or (f.sender_id=candidate_id and f.recipient_id=owner_id)))
    when 'squad' then exists(select 1 from public.squad_members member join public.squads s on s.id=member.squad_id where member.squad_id=aid and member.user_id=candidate_id and not exists(select 1 from public.blocks b where (b.blocker_id=s.owner_id and b.blocked_id=candidate_id) or (b.blocker_id=candidate_id and b.blocked_id=s.owner_id)))
      and exists(select 1 from public.squad_members host where host.squad_id=aid and host.user_id=owner_id)
    when 'organization' then private.organization_active(aid,candidate_id) and private.organization_active(aid,owner_id)
    else false
   end
  )
 );
$$;

create or replace function private.can_activity(aid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.activities a where a.id=aid and not private.blocked(a.owner_id)
  and not exists(select 1 from private.activity_exclusions e where e.activity_id=aid and e.user_id=auth.uid())
  and (private.audience(a.owner_id,a.audience,a.audience_id)
   or (a.audience<>'organization' and exists(select 1 from public.rsvps r where r.activity_id=aid and r.user_id=auth.uid() and r.approved))));
$$;

create policy read_organizations on public.organizations for select to authenticated using(
 private.can_read_organization(id,auth.uid())
);
create policy read_organization_members on public.organization_members for select to authenticated using(
 private.can_read_organization_member(organization_id,user_id,status,auth.uid())
);
create policy read_organization_bans on public.organization_bans for select to authenticated using(
 private.can_read_organization_ban(organization_id,user_id,auth.uid())
);
create policy read_organization_squads on public.organization_squads for select to authenticated using(
 private.can_read_organization_squad(organization_id,squad_id,auth.uid())
);
create policy read_group_messages on public.group_messages for select to authenticated using(
 private.organization_chat_visible(scope,scope_id,auth.uid()) and not private.blocked(author_id)
  and private.can_minimal_profile(author_id)
);
create policy read_group_message_reads on public.group_message_reads for select to authenticated using(
 user_id=auth.uid() and private.organization_chat_visible(scope,scope_id,auth.uid())
);

grant execute on function private.organization_role_rank(text),private.organization_role(uuid,uuid),
 private.organization_active(uuid,uuid),private.organization_chat_visible(text,uuid,uuid),
 private.organization_member_count(uuid),private.can_read_organization(uuid,uuid),
 private.can_read_organization_member(uuid,uuid,text,uuid),private.can_read_organization_ban(uuid,uuid,uuid),
 private.can_read_organization_squad(uuid,uuid,uuid) to authenticated;
create function private.apply_organization_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); org_id uuid:=nullif(payload->>'organization_id','')::uuid;
 target_id uuid:=nullif(payload->>'user_id','')::uuid; squad_id uuid:=nullif(payload->>'squad_id','')::uuid;
 desired_role text; actor_role text; target_role text; reason_text text; body_text text;
 chat_scope text; chat_id uuid; result jsonb:='{}'; message_id uuid; read_time timestamptz;
 org public.organizations;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if not exists(select 1 from public.profiles where id=uid) then raise exception 'Finish your profile first.'; end if;

 if action='create_organization' then
  body_text:=trim(coalesce(payload->>'name',''));
  if char_length(body_text) not between 2 and 60 then raise exception 'Organization names must be 2 to 60 characters.'; end if;
  reason_text:=coalesce(payload->>'description','');
  if char_length(reason_text)>500 then raise exception 'Descriptions must be 500 characters or less.'; end if;
  insert into public.organizations(owner_id,name,description) values(uid,body_text,reason_text) returning id into org_id;
  return jsonb_build_object('id',org_id,'organization_id',org_id);
 end if;

 if action in ('send_group_message','mark_group_chat_read') then
  chat_scope:=payload->>'scope';
  if chat_scope='organization' then chat_id:=nullif(payload->>'organization_id','')::uuid;
  elsif chat_scope='squad' then chat_id:=nullif(payload->>'squad_id','')::uuid;
  else raise exception 'Choose an organization or squad chat.'; end if;
  if chat_id is null or not private.organization_chat_visible(chat_scope,chat_id,uid) then
   raise exception 'That group chat is unavailable to you.';
  end if;
  if action='send_group_message' then
   body_text:=trim(coalesce(payload->>'body',''));
   if char_length(body_text) not between 1 and 2000 then raise exception 'Messages must be 1 to 2000 characters.'; end if;
   perform private.limit_action('group_message',100);
   insert into public.group_messages(scope,scope_id,organization_id,squad_id,author_id,body)
   values(chat_scope,chat_id,case when chat_scope='organization' then chat_id end,
    case when chat_scope='squad' then chat_id end,uid,body_text) returning id into message_id;
   return jsonb_build_object('id',message_id,'scope',chat_scope,
    'organization_id',case when chat_scope='organization' then chat_id end,
    'squad_id',case when chat_scope='squad' then chat_id end,'created_at',now());
  end if;
  read_time:=now();
  insert into public.group_message_reads(scope,scope_id,organization_id,squad_id,user_id,last_read_at)
  values(chat_scope,chat_id,case when chat_scope='organization' then chat_id end,
   case when chat_scope='squad' then chat_id end,uid,read_time)
  on conflict(scope,scope_id,user_id) do update set last_read_at=greatest(public.group_message_reads.last_read_at,excluded.last_read_at);
  return jsonb_build_object('scope',chat_scope,
   'organization_id',case when chat_scope='organization' then chat_id end,
   'squad_id',case when chat_scope='squad' then chat_id end,'read_at',read_time);
 end if;

 if action in ('update_organization','invite_organization_member','respond_organization_invite',
  'set_organization_member_role','remove_organization_member','ban_organization_member',
  'unban_organization_member','leave_organization','attach_organization_squad','detach_organization_squad') then
  select * into org from public.organizations where id=org_id for update;
  if not found then raise exception 'Organization unavailable.'; end if;
  actor_role:=private.organization_role(org_id,uid);
  if actor_role is not null and private.blocked(org.owner_id) then actor_role:=null; end if;
 end if;

 if action='update_organization' then
  if private.organization_role_rank(actor_role)<3 then raise exception 'Only organization owners and admins can edit organization details.'; end if;
  body_text:=trim(coalesce(payload->>'name',''));
  reason_text:=coalesce(payload->>'description','');
  if char_length(body_text) not between 2 and 60 or char_length(reason_text)>500 then raise exception 'Check the organization name and description.'; end if;
  update public.organizations set name=body_text,description=reason_text where id=org_id;
  return jsonb_build_object('organization_id',org_id,'updated',true);
 end if;

 if action='invite_organization_member' then
  target_id:=coalesce(target_id,nullif(payload->>'target_user_id','')::uuid);
  desired_role:=coalesce(payload->>'role','member');
  if target_id is null or target_id=uid or target_id=org.owner_id
   or not exists(select 1 from public.profiles where id=target_id)
   or private.blocked(target_id) then raise exception 'Choose a valid, unblocked person to invite.'; end if;
  if desired_role not in ('coowner','admin','elder','member')
   or private.organization_role_rank(actor_role)<=private.organization_role_rank(desired_role) then
   raise exception 'Your organization role cannot invite that rank.';
  end if;
  if exists(select 1 from public.organization_bans b where b.organization_id=org_id and b.user_id=target_id) then
   raise exception 'That person is banned from this organization.';
  end if;
  if exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=target_id and m.status='active') then
   raise exception 'That person is already in this organization.';
  end if;
  if exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=target_id
   and m.status='invited' and private.organization_role_rank(actor_role)<=private.organization_role_rank(m.role)) then
   raise exception 'Your organization role cannot replace that invitation.';
  end if;
  insert into public.organization_members(organization_id,user_id,role,status,invited_by)
   values(org_id,target_id,desired_role,'invited',uid)
   on conflict(organization_id,user_id) do update set role=excluded.role,status='invited',invited_by=uid,created_at=now();
  perform private.notify(target_id,uid,'Invited you to '||org.name,null);
  return jsonb_build_object('organization_id',org_id,'user_id',target_id,'status','invited','role',desired_role);
 end if;

 if action='respond_organization_invite' then
  if target_id is not null and target_id<>uid then raise exception 'Only the invited person can respond.'; end if;
  if not exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=uid and m.status='invited') then
   raise exception 'That organization invitation is no longer available.';
  end if;
  if private.blocked(org.owner_id) then raise exception 'That organization invitation is no longer available.'; end if;
  if exists(select 1 from public.organization_bans b where b.organization_id=org_id and b.user_id=uid) then raise exception 'That person is banned from this organization.'; end if;
  if coalesce((payload->>'accept')::boolean,false) then
   update public.organization_members set status='active' where organization_id=org_id and user_id=uid;
   return jsonb_build_object('organization_id',org_id,'status','active');
  end if;
  delete from public.organization_members where organization_id=org_id and user_id=uid;
  return jsonb_build_object('organization_id',org_id,'status','declined');
 end if;

 if action in ('set_organization_member_role','remove_organization_member','ban_organization_member') then
  if target_id is null or target_id=org.owner_id or target_id=uid
   or not private.organization_can_manage_member(org_id,uid,target_id) then
   raise exception 'Your organization role cannot change this member.';
  end if;
  select m.role into target_role from public.organization_members m
   where m.organization_id=org_id and m.user_id=target_id;
  if target_role is null then
   select b.former_role into target_role from public.organization_bans b where b.organization_id=org_id and b.user_id=target_id;
  end if;
  if action='set_organization_member_role' then
   desired_role:=payload->>'role';
   if desired_role not in ('coowner','admin','elder','member')
    or private.organization_role_rank(actor_role)<=private.organization_role_rank(desired_role) then
    raise exception 'Your organization role cannot assign that rank.';
   end if;
   update public.organization_members set role=desired_role
    where organization_id=org_id and user_id=target_id;
   if not found then raise exception 'That organization member is unavailable.'; end if;
   return jsonb_build_object('organization_id',org_id,'user_id',target_id,'role',desired_role);
  end if;
  if action='remove_organization_member' then
   delete from public.organization_members where organization_id=org_id and user_id=target_id;
   return jsonb_build_object('organization_id',org_id,'user_id',target_id,'removed',true);
  end if;
  reason_text:=trim(coalesce(payload->>'reason',''));
  if char_length(reason_text)>200 then raise exception 'Ban reasons must be 200 characters or less.'; end if;
  if target_role is null then raise exception 'That organization member is unavailable.'; end if;
  delete from public.organization_members where organization_id=org_id and user_id=target_id;
  insert into public.organization_bans(organization_id,user_id,banned_by,reason,former_role)
   values(org_id,target_id,uid,reason_text,target_role)
   on conflict(organization_id,user_id) do update set banned_by=uid,reason=excluded.reason,former_role=excluded.former_role,created_at=now();
  return jsonb_build_object('organization_id',org_id,'user_id',target_id,'banned',true);
 end if;

 if action='unban_organization_member' then
  if target_id is null or private.organization_role_rank(actor_role)<3
   or not private.organization_can_manage_member(org_id,uid,target_id) then
   raise exception 'Your organization role cannot unban this person.';
  end if;
  delete from public.organization_bans where organization_id=org_id and user_id=target_id;
  if not found then raise exception 'That organization ban is unavailable.'; end if;
  return jsonb_build_object('organization_id',org_id,'user_id',target_id,'unbanned',true);
 end if;

 if action='leave_organization' then
  if uid=org.owner_id then raise exception 'The organization owner cannot leave.'; end if;
  delete from public.organization_members where organization_id=org_id and user_id=uid and status='active';
  if not found then raise exception 'You are not an active organization member.'; end if;
  return jsonb_build_object('organization_id',org_id,'left',true);
 end if;

 if action in ('attach_organization_squad','detach_organization_squad') then
  if private.organization_role_rank(actor_role)<2 then raise exception 'An elder or organization leader can manage linked squads.'; end if;
  if not exists(select 1 from public.squads s where s.id=squad_id) or not private.admin(squad_id) then
   raise exception 'You need to own or administer that squad to link it.';
  end if;
  if action='attach_organization_squad' then
   insert into public.organization_squads(organization_id,squad_id,added_by) values(org_id,squad_id,uid)
    on conflict on constraint organization_squads_pkey do nothing;
   return jsonb_build_object('organization_id',org_id,'squad_id',squad_id,'attached',true);
  end if;
  delete from public.organization_squads where organization_id=org_id and squad_id=squad_id;
  if not found then raise exception 'That Squad is not linked to this organization.'; end if;
  return jsonb_build_object('organization_id',org_id,'squad_id',squad_id,'attached',false);
 end if;

 raise exception 'Unsupported organization or group-chat action.';
end $$;
revoke all on function private.organization_can_manage_member(uuid,uuid,uuid),
 private.organization_private_audience(uuid,uuid),private.apply_organization_action(text,jsonb)
 from public,anon,authenticated;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_organizations_legacy;
revoke all on function public.beacon_action_organizations_legacy(text,jsonb,uuid) from public,anon,authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prior jsonb; result jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action in ('create_organization','update_organization','invite_organization_member','respond_organization_invite',
  'set_organization_member_role','remove_organization_member','ban_organization_member','unban_organization_member',
  'leave_organization','attach_organization_squad','detach_organization_squad','send_group_message','mark_group_chat_read') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
  if found then return prior; end if;
  perform private.limit_action('all',300);
  result:=private.apply_organization_action(action,payload)||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 return public.beacon_action_organizations_legacy(action,payload,beacon_action.request_id);
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

do $snapshot_patch$
declare definition text; original_definition text;
begin
 select pg_get_functiondef('public.beacon_snapshot()'::regprocedure) into definition;
 original_definition:=definition;
 definition:=replace(definition,
  $old$'beacon_team_members','beacon_memories']$old$,
  $new$'beacon_team_members','beacon_memories','organizations','organization_members','organization_bans','organization_squads','group_messages','group_message_reads']$new$);
 if definition=original_definition then raise exception 'Could not add organization data to the Beacon snapshot.'; end if;
 if position('elsif t=''organizations'' then' in definition)=0 then
  definition:=replace(definition,
   $old$  elsif t='beacon_teams' then$old$,
   $new$  elsif t='organizations' then
   execute 'select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object(''member_count'',private.organization_member_count(x.id))),''[]''::jsonb) from (select * from public.organizations) x' into rows;
  elsif t='beacon_teams' then$new$);
 end if;
 if definition=original_definition then raise exception 'Could not extend the Beacon snapshot with organizations.'; end if;
 execute definition;
end $snapshot_patch$;

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_messages') then
  alter publication supabase_realtime add table public.group_messages;
 end if;
end $$;
