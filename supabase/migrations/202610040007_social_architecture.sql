-- Shared social policies: legacy private/invite/admin defaults are preserved.
alter table public.organizations
 add column discoverability text not null default 'private' check(discoverability in ('public','community','private')),
 add column join_mode text not null default 'invite' check(join_mode in ('open','request','invite')),
 add column invite_policy text not null default 'admins' check(invite_policy in ('admins','elders','members')),
 add column archived_at timestamptz;
alter table public.spaces
 add column space_type text not null default 'other' check(space_type in ('club','academic','sports','residence','interest','local_community','professional','other')),
 add column discoverability text not null default 'private' check(discoverability in ('public','community','private')),
 add column join_mode text not null default 'invite' check(join_mode in ('open','request','invite')),
 add column invite_policy text not null default 'admins' check(invite_policy in ('admins','elders','members')),
 add column archived_at timestamptz;
alter table public.squads
 add column discoverability text not null default 'private' check(discoverability in ('public','community','private')),
 add column join_mode text not null default 'invite' check(join_mode in ('open','request','invite')),
 add column invite_policy text not null default 'admins' check(invite_policy in ('admins','elders','members')),
 add column archived_at timestamptz;

alter table public.organization_members drop constraint if exists organization_members_status_check;
alter table public.organization_members add constraint organization_members_status_check check(status in ('invited','requested','active'));
alter table public.space_members drop constraint if exists space_members_status_check;
alter table public.space_members add constraint space_members_status_check check(status in ('invited','requested','active'));
alter table public.space_members drop constraint if exists space_members_role_check;
alter table public.space_members add constraint space_members_role_check check(role in ('owner','coowner','admin','elder','member'));
alter table public.squad_members drop constraint if exists squad_members_role_check;
alter table public.squad_members add constraint squad_members_role_check check(role in ('owner','coowner','admin','elder','member'));

create table public.organization_spaces (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 space_id uuid not null references public.spaces(id) on delete cascade,
 added_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(organization_id,space_id)
);
create index organization_spaces_space on public.organization_spaces(space_id,organization_id);

create table public.space_bans (
 space_id uuid not null references public.spaces(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 banned_by uuid references public.profiles(id) on delete set null,
 reason text not null default '' check(char_length(reason)<=200),
 former_role text not null check(former_role in ('coowner','admin','elder','member')),
 created_at timestamptz not null default now(),
 primary key(space_id,user_id)
);
create table public.squad_bans (
 squad_id uuid not null references public.squads(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 banned_by uuid references public.profiles(id) on delete set null,
 reason text not null default '' check(char_length(reason)<=200),
 former_role text not null check(former_role in ('coowner','admin','elder','member')),
 created_at timestamptz not null default now(),
 primary key(squad_id,user_id)
);
create table public.squad_join_requests (
 squad_id uuid not null references public.squads(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(squad_id,user_id)
);
create table public.activity_social_links (
 activity_id uuid primary key references public.activities(id) on delete cascade,
 entity_type text not null check(entity_type in ('squad','space','organization')),
 entity_id uuid not null,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create index activity_social_links_entity on public.activity_social_links(entity_type,entity_id);

alter table public.organization_spaces enable row level security;
alter table public.space_bans enable row level security;
alter table public.squad_bans enable row level security;
alter table public.squad_join_requests enable row level security;
alter table public.activity_social_links enable row level security;
revoke all on public.organization_spaces,public.space_bans,public.squad_bans,
 public.squad_join_requests,public.activity_social_links from public,anon,authenticated;
grant select on public.organization_spaces,public.space_bans,public.squad_bans,
 public.squad_join_requests,public.activity_social_links to authenticated;

create or replace function private.admin(sid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.member(sid) and exists(select 1 from public.squad_members where squad_id=sid
  and user_id=auth.uid() and role in ('owner','coowner','admin'));
$$;
create or replace function private.space_role_rank(role_name text) returns integer
language sql immutable set search_path='' as $$
 select case role_name when 'owner' then 5 when 'coowner' then 4 when 'admin' then 3
  when 'elder' then 2 when 'member' then 1 else 0 end;
$$;
create or replace function private.space_role(sid uuid,person_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when s.owner_id=person_id and exists(select 1 from public.space_members m
   where m.space_id=s.id and m.user_id=person_id and m.role='owner' and m.status='active') then 'owner'
  else (select m.role from public.space_members m where m.space_id=s.id and m.user_id=person_id
   and m.user_id<>s.owner_id and m.role in ('coowner','admin','elder','member') and m.status='active'
   and not exists(select 1 from public.space_bans b where b.space_id=s.id and b.user_id=person_id)) end
 from public.spaces s where s.id=sid;
$$;
create or replace function private.space_active(sid uuid,person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select person_id is not null and exists(select 1 from public.spaces s where s.id=sid and s.archived_at is null
  and private.space_role(sid,person_id) is not null and not exists(select 1 from public.space_bans b where b.space_id=sid and b.user_id=person_id)
  and not exists(select 1 from public.blocks b where (b.blocker_id=person_id and b.blocked_id=s.owner_id)
   or (b.blocker_id=s.owner_id and b.blocked_id=person_id)));
$$;
create or replace function private.space_invited(sid uuid,person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select person_id is not null and exists(select 1 from public.space_members m join public.spaces s on s.id=m.space_id
  where m.space_id=sid and m.user_id=person_id and m.status='invited' and s.archived_at is null
   and not exists(select 1 from public.space_bans b where b.space_id=sid and b.user_id=person_id)
   and not exists(select 1 from public.blocks b where (b.blocker_id=person_id and b.blocked_id=s.owner_id)
    or (b.blocker_id=s.owner_id and b.blocked_id=person_id)));
$$;
create or replace function private.space_can_manage_member(sid uuid,actor_id uuid,target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select actor_id is not null and target_id is not null and target_id<>actor_id
  and target_id<>(select s.owner_id from public.spaces s where s.id=sid)
  and private.space_active(sid,actor_id)
  and private.space_role_rank(private.space_role(sid,actor_id))>=3
  and private.space_role_rank(private.space_role(sid,actor_id)) > private.space_role_rank(coalesce(
   (select m.role from public.space_members m where m.space_id=sid and m.user_id=target_id),'owner'));
$$;
create or replace function private.organization_can_manage_member(org_id uuid,actor_id uuid,target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select actor_id is not null and target_id is not null and target_id<>actor_id
  and target_id<>(select o.owner_id from public.organizations o where o.id=org_id)
  and private.organization_role_rank(private.organization_role(org_id,actor_id))>=3
  and private.organization_role_rank(private.organization_role(org_id,actor_id)) > private.organization_role_rank(coalesce(
   (select m.role from public.organization_members m where m.organization_id=org_id and m.user_id=target_id),
   (select b.former_role from public.organization_bans b where b.organization_id=org_id and b.user_id=target_id),'owner'));
$$;
create or replace function private.can_read_organization_member(org_id uuid,member_id uuid,member_status text,person_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations o where o.id=org_id and o.archived_at is null and (
  (private.organization_active(o.id,person_id) and not private.blocked(member_id))
  or (member_id=person_id and member_status in ('invited','requested') and not private.blocked(o.owner_id)
   and not exists(select 1 from public.organization_bans b where b.organization_id=o.id and b.user_id=person_id))
  or (member_status='invited' and private.organization_role_rank(private.organization_role(o.id,person_id))>=3 and not private.blocked(member_id))
  or (member_status='requested' and private.organization_role_rank(private.organization_role(o.id,person_id))>=3 and not private.blocked(member_id))
 ));
$$;
create or replace function private.can_read_space_member(sid uuid,member_id uuid,member_status text)
returns boolean language sql stable security definer set search_path='' as $$
 select (private.space_active(sid,auth.uid()) and not private.blocked(member_id) and (
   (member_status='active' and private.space_active(sid,member_id))
   or (member_status in ('invited','requested') and private.space_role_rank(private.space_role(sid,auth.uid()))>=3
    and (member_status<>'invited' or private.space_invited(sid,member_id)))
  )) or (member_id=auth.uid() and member_status='invited' and private.space_invited(sid,auth.uid()))
   or (member_id=auth.uid() and member_status='requested' and not exists(select 1 from public.space_bans b where b.space_id=sid and b.user_id=auth.uid())
    and not private.blocked((select s.owner_id from public.spaces s where s.id=sid)));
$$;

create function private.social_user_blocked(first_id uuid,second_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.blocks b where (b.blocker_id=first_id and b.blocked_id=second_id)
  or (b.blocker_id=second_id and b.blocked_id=first_id));
$$;
create function private.social_role(kind text,eid uuid,person uuid) returns text
language sql stable security definer set search_path='' as $$
 select case kind
  when 'organization' then private.organization_role(eid,person)
  when 'space' then private.space_role(eid,person)
  when 'squad' then (select m.role from public.squad_members m join public.squads s on s.id=m.squad_id
    where m.squad_id=eid and m.user_id=person and not exists(select 1 from public.squad_bans b where b.squad_id=eid and b.user_id=person)
     and s.archived_at is null)
  else null end;
$$;
create function private.social_active(kind text,eid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select person is not null and case kind
  when 'organization' then exists(select 1 from public.organizations o where o.id=eid and o.archived_at is null
   and not exists(select 1 from public.organization_bans b where b.organization_id=eid and b.user_id=person)
   and not private.social_user_blocked(o.owner_id,person) and private.organization_role(eid,person) is not null)
  when 'space' then private.space_active(eid,person)
  when 'squad' then exists(select 1 from public.squads s where s.id=eid and s.archived_at is null
   and not exists(select 1 from public.squad_bans b where b.squad_id=eid and b.user_id=person)
   and not private.social_user_blocked(s.owner_id,person)
   and exists(select 1 from public.squad_members m where m.squad_id=eid and m.user_id=person))
  else false end;
$$;
create function private.social_parent_eligible(kind text,eid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case kind
  when 'space' then exists(select 1 from public.organization_spaces l join public.organizations o on o.id=l.organization_id
   where l.space_id=eid and o.archived_at is null and private.social_active('organization',o.id,person))
  when 'squad' then
   exists(select 1 from public.space_squads l join public.spaces s on s.id=l.space_id
    where l.squad_id=eid and s.archived_at is null and private.social_active('space',s.id,person))
   or exists(select 1 from public.organization_squads l join public.organizations o on o.id=l.organization_id
    where l.squad_id=eid and o.archived_at is null and private.social_active('organization',o.id,person))
   or exists(select 1 from public.space_squads sl join public.spaces s on s.id=sl.space_id
    join public.organization_spaces ol on ol.space_id=s.id join public.organizations o on o.id=ol.organization_id
    where sl.squad_id=eid and s.archived_at is null and o.archived_at is null
     and private.social_active('space',s.id,person) and private.social_active('organization',o.id,person))
  else false end;
$$;
create function private.social_entity_visible(kind text,eid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case kind
  when 'organization' then exists(select 1 from public.organizations e where e.id=eid and e.archived_at is null
   and not exists(select 1 from public.organization_bans b where b.organization_id=eid and b.user_id=person)
   and not private.social_user_blocked(e.owner_id,person)
   and (e.owner_id=person or exists(select 1 from public.organization_members m where m.organization_id=eid and m.user_id=person and m.status in ('active','invited','requested'))
    or e.discoverability='public' or (e.discoverability='community' and private.social_parent_eligible(kind,eid,person))))
  when 'space' then exists(select 1 from public.spaces e where e.id=eid and e.archived_at is null
   and not exists(select 1 from public.space_bans b where b.space_id=eid and b.user_id=person)
   and not private.social_user_blocked(e.owner_id,person)
   and (private.social_active(kind,eid,person) or private.space_invited(eid,person)
    or exists(select 1 from public.space_members m where m.space_id=eid and m.user_id=person and m.status='requested')
    or e.discoverability='public' or (e.discoverability='community' and private.social_parent_eligible(kind,eid,person))))
  when 'squad' then exists(select 1 from public.squads e where e.id=eid and e.archived_at is null
   and not exists(select 1 from public.squad_bans b where b.squad_id=eid and b.user_id=person)
   and not private.social_user_blocked(e.owner_id,person)
   and (private.social_active(kind,eid,person) or exists(select 1 from public.squad_invites i where i.squad_id=eid and i.recipient_id=person)
    or exists(select 1 from public.squad_join_requests r where r.squad_id=eid and r.user_id=person)
    or e.discoverability='public' or (e.discoverability='community' and private.social_parent_eligible(kind,eid,person))))
  else false end;
$$;
create function private.social_invite_allowed(kind text,eid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.social_active(kind,eid,person) and coalesce(private.organization_role_rank(private.social_role(kind,eid,person)),0)>=case
  when kind='organization' and (select invite_policy from public.organizations where id=eid)='members' then 1
  when kind='organization' and (select invite_policy from public.organizations where id=eid)='elders' then 2
  when kind='space' and (select invite_policy from public.spaces where id=eid)='members' then 1
  when kind='space' and (select invite_policy from public.spaces where id=eid)='elders' then 2
  when kind='squad' and (select invite_policy from public.squads where id=eid)='members' then 1
  when kind='squad' and (select invite_policy from public.squads where id=eid)='elders' then 2
  else 3 end;
$$;
create function private.social_parent_can_manage(parent_type text,parent_id uuid,space_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case parent_type
  when 'organization' then private.social_active('organization',parent_id,auth.uid())
   and private.organization_role_rank(private.social_role('organization',parent_id,auth.uid()))>=3
  when 'space' then private.social_active('space',parent_id,auth.uid())
   and private.space_role_rank(private.social_role('space',parent_id,auth.uid()))>=3
  else false end;
$$;

-- Keep the general predicates private; policies receive viewer-bound wrappers
-- so authenticated callers cannot probe an arbitrary person's membership.
create function private.readable_social_entity(kind text,eid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.social_entity_visible(kind,eid,auth.uid());
$$;
create function private.readable_social_ban(kind text,eid uuid,target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.social_active(kind,eid,auth.uid()) and not private.social_user_blocked(target,auth.uid());
$$;
create function private.readable_squad_join_request(eid uuid,target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select target=auth.uid() or (private.social_active('squad',eid,auth.uid())
  and private.organization_role_rank(private.social_role('squad',eid,auth.uid()))>=3);
$$;

create policy read_organization_spaces on public.organization_spaces for select to authenticated
 using(private.readable_social_entity('organization',organization_id)
  and private.readable_social_entity('space',space_id));
create policy read_social_bans on public.space_bans for select to authenticated
 using(private.readable_social_ban('space',space_id,user_id));
create policy read_squad_bans on public.squad_bans for select to authenticated
 using(private.readable_social_ban('squad',squad_id,user_id));
create policy read_squad_join_requests on public.squad_join_requests for select to authenticated
 using(private.readable_squad_join_request(squad_id,user_id));
create policy read_activity_social_links on public.activity_social_links for select to authenticated
 using(private.can_activity(activity_id) and private.readable_social_entity(entity_type,entity_id));

create function public.social_directory_search(
 p_query text, p_entity_type text default 'all', p_page_size integer default 20, p_page_offset integer default 0,
 p_parent_type text default null, p_parent_id uuid default null
) returns table(entity_type text,entity_id uuid,name text,description text,discoverability text,
 join_mode text,member_count integer,child_count integer,membership_status text,action text,
 parent_type text,parent_id uuid,parent_name text)
language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); q text:=trim(coalesce(p_query,'')); limit_n integer:=least(50,greatest(1,coalesce(p_page_size,20)));
 offset_n integer:=least(5000,greatest(0,coalesce(p_page_offset,0))); prefix text;
begin
 if uid is null then raise exception 'Sign in to browse communities.'; end if;
 if char_length(q)=1 or char_length(q)>80 then raise exception 'Search with 2 to 80 characters, or browse with an empty search.'; end if;
 if p_entity_type not in ('all','squad','space','organization') then raise exception 'Choose a valid community type.'; end if;
 if (p_parent_type is null)<>(p_parent_id is null) or p_parent_type not in ('space','organization') and p_parent_type is not null then
  raise exception 'Choose a valid community context.';
 end if;
 if p_parent_id is not null and not private.social_entity_visible(p_parent_type,p_parent_id,uid) then
  raise exception 'That community context is unavailable.';
 end if;
 prefix:=lower(q);
 return query
 with candidates as (
  select 'organization'::text et,o.id eid,o.name nm,o.description ds,o.discoverability dv,o.join_mode jm,
   private.organization_member_count(o.id) mc,
   (select count(distinct child_key)::integer from (
     select 'space:'||l.space_id::text child_key from public.organization_spaces l where l.organization_id=o.id and private.social_entity_visible('space',l.space_id,uid)
     union all select 'squad:'||l.squad_id::text from public.organization_squads l where l.organization_id=o.id and private.social_entity_visible('squad',l.squad_id,uid)
     union all select 'squad:'||sl.squad_id::text from public.organization_spaces ol join public.space_squads sl on sl.space_id=ol.space_id
      where ol.organization_id=o.id and private.social_entity_visible('space',ol.space_id,uid) and private.social_entity_visible('squad',sl.squad_id,uid)
   ) children) cc,
   case when private.social_active('organization',o.id,uid) then 'active'
    when exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=uid and m.status='invited') then 'invited'
    when exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=uid and m.status='requested') then 'requested' else null end ms,
   null::text pt,null::uuid pi,null::text pn
  from public.organizations o where private.social_entity_visible('organization',o.id,uid)
   and p_parent_type is null and (p_entity_type in ('all','organization')) and (q='' or o.name ilike '%'||q||'%' or o.description ilike '%'||q||'%')
  union all
  select 'space',s.id,s.name,s.description,s.discoverability,s.join_mode,
   (select count(*)::integer from public.space_members m where m.space_id=s.id and m.status='active')::integer,
   (select count(distinct l.squad_id)::integer from public.space_squads l where l.space_id=s.id and private.social_entity_visible('squad',l.squad_id,uid)),
   case when private.social_active('space',s.id,uid) then 'active'
    when exists(select 1 from public.space_members m where m.space_id=s.id and m.user_id=uid and m.status='invited') then 'invited'
    when exists(select 1 from public.space_members m where m.space_id=s.id and m.user_id=uid and m.status='requested') then 'requested' else null end,
   p.parent_type,p.parent_id,p.parent_name
  from public.spaces s
  left join lateral (select 'organization'::text parent_type,o.id parent_id,o.name parent_name
   from public.organization_spaces l join public.organizations o on o.id=l.organization_id
   where l.space_id=s.id and private.social_entity_visible('organization',o.id,uid)
   order by o.name,o.id limit 1) p on true
  where private.social_entity_visible('space',s.id,uid) and p_entity_type in ('all','space')
   and (q='' or s.name ilike '%'||q||'%' or s.description ilike '%'||q||'%')
   and (p_parent_type is null or (p_parent_type='organization' and exists(select 1 from public.organization_spaces l where l.organization_id=p_parent_id and l.space_id=s.id)))
  union all
  select 'squad',s.id,s.name,s.description,s.discoverability,s.join_mode,
   (select count(*)::integer from public.squad_members m where m.squad_id=s.id)::integer,
   0::integer,
   case when private.social_active('squad',s.id,uid) then 'active'
    when exists(select 1 from public.squad_invites i where i.squad_id=s.id and i.recipient_id=uid) then 'invited'
    when exists(select 1 from public.squad_join_requests r where r.squad_id=s.id and r.user_id=uid) then 'requested' else null end,
   p.parent_type,p.parent_id,p.parent_name
  from public.squads s
  left join lateral (select link.parent_type,link.parent_id,link.parent_name from (
    select 'space'::text parent_type,sp.id parent_id,sp.name parent_name,0 priority
     from public.space_squads l join public.spaces sp on sp.id=l.space_id
     where l.squad_id=s.id and private.social_entity_visible('space',sp.id,uid)
    union all
    select 'organization',o.id,o.name,1 from public.organization_squads l join public.organizations o on o.id=l.organization_id
     where l.squad_id=s.id and private.social_entity_visible('organization',o.id,uid)
    union all
    select 'organization',o.id,o.name,2 from public.space_squads sl join public.organization_spaces ol on ol.space_id=sl.space_id
     join public.spaces sp on sp.id=sl.space_id join public.organizations o on o.id=ol.organization_id
     where sl.squad_id=s.id and private.social_entity_visible('space',sp.id,uid) and private.social_entity_visible('organization',o.id,uid)
   ) link order by link.priority,link.parent_name,link.parent_id limit 1) p on true
  where private.social_entity_visible('squad',s.id,uid) and p_entity_type in ('all','squad')
   and (q='' or s.name ilike '%'||q||'%' or s.description ilike '%'||q||'%')
   and (p_parent_type is null or (p_parent_type='space' and exists(select 1 from public.space_squads l where l.space_id=p_parent_id and l.squad_id=s.id))
    or (p_parent_type='organization' and (exists(select 1 from public.organization_squads l where l.organization_id=p_parent_id and l.squad_id=s.id)
     or exists(select 1 from public.organization_spaces ol join public.space_squads sl on sl.space_id=ol.space_id join public.spaces sp on sp.id=ol.space_id
      where ol.organization_id=p_parent_id and sl.squad_id=s.id and private.social_entity_visible('space',sp.id,uid)))))
 )
 select c.et,c.eid,c.nm,c.ds,c.dv,c.jm,c.mc,c.cc,c.ms,
  case when c.ms='active' then 'joined' when c.ms='invited' then 'invited' when c.ms='requested' then 'requested'
   when c.jm='open' then 'join' when c.jm='request' then 'request' else 'invite_required' end,
  c.pt,c.pi,c.pn
 from candidates c order by case when prefix<>'' and lower(c.nm) like prefix||'%' then 0 else 1 end,c.nm,c.et,c.eid
 limit limit_n offset offset_n;
end $$;
revoke all on function public.social_directory_search(text,text,integer,integer,text,uuid) from public,anon;
grant execute on function public.social_directory_search(text,text,integer,integer,text,uuid) to authenticated;

create function private.apply_social_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); kind text; eid uuid; target uuid; entity_owner uuid; role_name text; desired_role text;
 status_name text; mode_name text; visibility text; parent_eligible boolean; entity_name text;
 old_target_role text; old_target_status text;
 now_at timestamptz:=now(); result jsonb:='{}'; row_count integer; source public.squads; new_space uuid;
 selected uuid[]; expected_count integer; copied_count integer:=0; skipped_count integer:=0; link_id uuid;
 activity_key uuid; association_type text; association_id uuid; invitation public.squad_invites;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if not exists(select 1 from public.profiles where id=uid) then raise exception 'Finish your profile first.'; end if;

 if action='set_social_policy' then
  kind:=payload->>'entity_type'; eid:=nullif(payload->>'entity_id','')::uuid;
  visibility:=payload->>'discoverability'; mode_name:=payload->>'join_mode'; role_name:=payload->>'invite_policy';
  if kind not in ('squad','space','organization') or visibility not in ('public','community','private')
   or mode_name not in ('open','request','invite') or role_name not in ('admins','elders','members') then raise exception 'Choose valid social settings.'; end if;
  if not private.social_active(kind,eid,uid) or private.organization_role_rank(private.social_role(kind,eid,uid))<3 then raise exception 'Only active community admins can change social settings.'; end if;
  if kind='organization' then update public.organizations set discoverability=visibility,join_mode=mode_name,invite_policy=role_name where id=eid;
  elsif kind='space' then update public.spaces set discoverability=visibility,join_mode=mode_name,invite_policy=role_name where id=eid;
  else update public.squads set discoverability=visibility,join_mode=mode_name,invite_policy=role_name where id=eid; end if;
  return jsonb_build_object('entity_type',kind,'entity_id',eid,'discoverability',visibility,'join_mode',mode_name,'invite_policy',role_name);
 end if;

 if action='set_squad_member_role' then
  eid:=nullif(payload->>'squad_id','')::uuid; target:=nullif(payload->>'user_id','')::uuid; desired_role:=payload->>'role';
  role_name:=private.social_role('squad',eid,uid);
  select m.role into status_name from public.squad_members m where m.squad_id=eid and m.user_id=target for update;
  if not private.social_active('squad',eid,uid) or private.organization_role_rank(role_name)<3
   or target is null or target=uid or target=(select s.owner_id from public.squads s where s.id=eid)
   or status_name is null or desired_role not in ('coowner','admin','elder','member')
   or private.organization_role_rank(role_name)<=private.organization_role_rank(status_name)
   or private.organization_role_rank(role_name)<=private.organization_role_rank(desired_role) then raise exception 'Your role cannot change this Squad member.'; end if;
  update public.squad_members set role=desired_role where squad_id=eid and user_id=target;
  if not found then raise exception 'That Squad member is unavailable.'; end if;
  return jsonb_build_object('squad_id',eid,'user_id',target,'role',desired_role);
 end if;
 if action='set_space_member_role' then
  eid:=nullif(payload->>'space_id','')::uuid; target:=nullif(payload->>'user_id','')::uuid; desired_role:=payload->>'role';
  role_name:=private.social_role('space',eid,uid);
  select m.role into status_name from public.space_members m where m.space_id=eid and m.user_id=target for update;
  if not private.social_active('space',eid,uid) or private.space_role_rank(role_name)<3
   or target is null or target=uid or target=(select s.owner_id from public.spaces s where s.id=eid)
   or status_name is null or desired_role not in ('coowner','admin','elder','member')
   or private.space_role_rank(role_name)<=private.space_role_rank(status_name)
   or private.space_role_rank(role_name)<=private.space_role_rank(desired_role) then raise exception 'Your role cannot change this Space member.'; end if;
  update public.space_members set role=desired_role where space_id=eid and user_id=target;
  if not found then raise exception 'That Space member is unavailable.'; end if;
  return jsonb_build_object('space_id',eid,'user_id',target,'role',desired_role);
 end if;

 if action='create_space_from_squads' then
  entity_name:=trim(coalesce(payload->>'name',''));
  if char_length(entity_name) not between 2 and 60 or char_length(coalesce(payload->>'description',''))>500 then raise exception 'Check the Space name and description.'; end if;
  select array_agg(v::uuid) into selected from jsonb_array_elements_text(coalesce(payload->'squad_ids','[]'::jsonb)) as t(v);
  if coalesce(cardinality(selected),0) not between 1 and 20 or cardinality(selected)<>(select count(distinct x)::integer from unnest(selected) as t(x)) then raise exception 'Choose 1 to 20 different Squads.'; end if;
  if exists(select 1 from unnest(selected) x where not private.social_active('squad',x,uid)
    or private.organization_role_rank(private.social_role('squad',x,uid))<3) then raise exception 'You need active admin access to every Squad.'; end if;
  visibility:=coalesce(payload->>'discoverability','private'); mode_name:=coalesce(payload->>'join_mode','invite'); role_name:=coalesce(payload->>'invite_policy','admins');
  if visibility not in ('public','community','private') or mode_name not in ('open','request','invite') or role_name not in ('admins','elders','members') then raise exception 'Choose valid Space social settings.'; end if;
  insert into public.spaces(owner_id,name,description,space_type,discoverability,join_mode,invite_policy)
   values(uid,entity_name,coalesce(payload->>'description',''),coalesce(payload->>'space_type','other'),visibility,mode_name,role_name) returning id into new_space;
  insert into public.space_members(space_id,user_id,role,status) values(new_space,uid,'owner','active');
  insert into public.space_squads(space_id,squad_id,added_by) select new_space,x,uid from unnest(selected) x;
  return jsonb_build_object('id',new_space,'space_id',new_space,'linked_squad_count',cardinality(selected));
 end if;

 if action='organize_squad_into_space' then
  eid:=nullif(payload->>'squad_id','')::uuid;
  select * into source from public.squads where id=eid for update;
  if not found or source.owner_id<>uid or not private.social_active('squad',eid,uid) then raise exception 'Only the current Squad owner can organize it into a Space.'; end if;
  entity_name:=trim(coalesce(payload->>'name',''));
  if char_length(entity_name) not between 2 and 60 or char_length(coalesce(payload->>'description',''))>500 then raise exception 'Check the Space name and description.'; end if;
  if coalesce((payload->>'copy_members')::boolean,false) and not coalesce((payload->>'confirm_member_copy')::boolean,false) then raise exception 'Confirm that current Squad members will become Space members.'; end if;
  select count(*)::integer into expected_count from public.squad_members m
   where m.squad_id=eid and m.user_id<>uid and not private.social_user_blocked(uid,m.user_id)
    and not exists(select 1 from public.squad_bans b where b.squad_id=eid and b.user_id=m.user_id);
  if coalesce((payload->>'copy_members')::boolean,false) and payload ? 'expected_member_count'
   and expected_count<>coalesce((payload->>'expected_member_count')::integer,-1) then
   raise exception 'The eligible Squad roster changed. Review the current members and confirm again.';
  end if;
  visibility:=coalesce(payload->>'discoverability','private'); mode_name:=coalesce(payload->>'join_mode','invite'); role_name:=coalesce(payload->>'invite_policy','admins');
  if visibility not in ('public','community','private') or mode_name not in ('open','request','invite') or role_name not in ('admins','elders','members') then raise exception 'Choose valid Space social settings.'; end if;
  insert into public.spaces(owner_id,name,description,space_type,discoverability,join_mode,invite_policy)
   values(uid,entity_name,coalesce(payload->>'description',''),coalesce(payload->>'space_type','other'),visibility,mode_name,role_name) returning id into new_space;
  insert into public.space_members(space_id,user_id,role,status) values(new_space,uid,'owner','active');
  insert into public.space_squads(space_id,squad_id,added_by) values(new_space,eid,uid);
  if coalesce((payload->>'copy_members')::boolean,false) then
   insert into public.space_members(space_id,user_id,role,status,invited_by)
    select new_space,m.user_id,case when m.role in ('coowner','admin','elder') then m.role else 'member' end,'active',uid
    from public.squad_members m where m.squad_id=eid and m.user_id<>uid
     and not private.social_user_blocked(uid,m.user_id)
     and not exists(select 1 from public.squad_bans b where b.squad_id=eid and b.user_id=m.user_id);
   get diagnostics copied_count=row_count;
   if copied_count<>expected_count then raise exception 'The eligible Squad roster changed. Review the current members and confirm again.'; end if;
   skipped_count:=greatest(0,(select count(*)::integer from public.squad_members m where m.squad_id=eid and m.user_id<>uid)-copied_count);
  end if;
  if coalesce((payload->>'rename_general')::boolean,false) then update public.squads set name='General' where id=eid; end if;
  return jsonb_build_object('id',new_space,'space_id',new_space,'source_squad_id',eid,'copied_member_count',copied_count,'skipped_member_count',skipped_count);
 end if;

 if action in ('join_squad','request_squad_join','cancel_squad_join_request','approve_squad_join_request','deny_squad_join_request') then kind:='squad';
 elsif action in ('join_space','request_space_join','cancel_space_join_request','approve_space_join_request','deny_space_join_request') then kind:='space';
 elsif action in ('join_organization','request_organization_join','cancel_organization_join_request','approve_organization_join_request','deny_organization_join_request') then kind:='organization'; end if;
 if kind is not null then
  eid:=case when kind='organization' then nullif(payload->>'organization_id','')::uuid
   when kind='squad' then coalesce(nullif(payload->>'squad_id','')::uuid,nullif(payload->>'id','')::uuid)
   else nullif(payload->>'space_id','')::uuid end;
  target:=coalesce(nullif(payload->>'user_id','')::uuid,uid);
  if kind='organization' then select o.owner_id,o.discoverability,o.join_mode,o.name into entity_owner,visibility,mode_name,entity_name from public.organizations o where o.id=eid for update;
  elsif kind='space' then select s.owner_id,s.discoverability,s.join_mode,s.name into entity_owner,visibility,mode_name,entity_name from public.spaces s where s.id=eid for update;
  else select s.owner_id,s.discoverability,s.join_mode,s.name into entity_owner,visibility,mode_name,entity_name from public.squads s where s.id=eid for update; end if;
  if not found then raise exception 'That community is unavailable.'; end if;
  if action like 'cancel_%' then
   if target<>uid then raise exception 'Only you can cancel your own join request.'; end if;
   if kind='organization' then delete from public.organization_members where organization_id=eid and user_id=uid and status='requested';
   elsif kind='space' then delete from public.space_members where space_id=eid and user_id=uid and status='requested';
   else delete from public.squad_join_requests where squad_id=eid and user_id=uid; end if;
   return jsonb_build_object('entity_id',eid,'cancelled',true);
  end if;
  if action like 'approve_%' or action like 'deny_%' then
   if not private.social_active(kind,eid,uid) or private.organization_role_rank(private.social_role(kind,eid,uid))<3 then raise exception 'Only community admins can review join requests.'; end if;
   if kind='organization' then select status into status_name from public.organization_members where organization_id=eid and user_id=target for update;
   elsif kind='space' then select status into status_name from public.space_members where space_id=eid and user_id=target for update;
   else select 'requested' into status_name from public.squad_join_requests where squad_id=eid and user_id=target for update; end if;
   if status_name is distinct from 'requested' then
    if action like 'approve_%' and private.social_active(kind,eid,target) then return jsonb_build_object('entity_id',eid,'user_id',target,'status','active','already_processed',true); end if;
    return jsonb_build_object('entity_id',eid,'user_id',target,'already_processed',true);
   end if;
   if action like 'deny_%' then
    if kind='organization' then delete from public.organization_members where organization_id=eid and user_id=target and status='requested';
    elsif kind='space' then delete from public.space_members where space_id=eid and user_id=target and status='requested';
    else delete from public.squad_join_requests where squad_id=eid and user_id=target; end if;
    return jsonb_build_object('entity_id',eid,'user_id',target,'denied',true);
   end if;
   if private.social_user_blocked(entity_owner,target) or (kind='organization' and exists(select 1 from public.organization_bans where organization_id=eid and user_id=target))
    or (kind='space' and exists(select 1 from public.space_bans where space_id=eid and user_id=target))
    or (kind='squad' and exists(select 1 from public.squad_bans where squad_id=eid and user_id=target))
    or (visibility='community' and not private.social_parent_eligible(kind,eid,target)) then raise exception 'That person is no longer eligible to join this community.'; end if;
   if kind='organization' then update public.organization_members set status='active' where organization_id=eid and user_id=target and status='requested';
   elsif kind='space' then update public.space_members set status='active' where space_id=eid and user_id=target and status='requested';
   else delete from public.squad_join_requests where squad_id=eid and user_id=target;
    insert into public.squad_members(squad_id,user_id,role) values(eid,target,'member') on conflict(squad_id,user_id) do nothing; end if;
   return jsonb_build_object('entity_id',eid,'user_id',target,'status','active');
  end if;
  if target<>uid then raise exception 'You can only join as yourself.'; end if;
  if not private.social_entity_visible(kind,eid,uid) then raise exception 'That community is unavailable to you.'; end if;
  if private.social_active(kind,eid,uid) then return jsonb_build_object('entity_id',eid,'status','active','already_member',true); end if;
  if visibility='community' and not private.social_parent_eligible(kind,eid,uid) then raise exception 'Join the visible parent community before joining this community.'; end if;
  if visibility not in ('public','community') then raise exception 'That community is not open to you.'; end if;
  if action like 'join_%' and mode_name<>'open' then raise exception 'This community requires a request or invitation.'; end if;
  if action like 'request_%' and mode_name<>'request' then raise exception 'This community is not accepting join requests.'; end if;
  if kind='organization' then
   insert into public.organization_members(organization_id,user_id,role,status,invited_by) values(eid,uid,'member',case when action like 'join_%' then 'active' else 'requested' end,null)
    on conflict(organization_id,user_id) do update set role='member',status=excluded.status,invited_by=null,created_at=now_at;
  elsif kind='space' then
   insert into public.space_members(space_id,user_id,role,status,invited_by) values(eid,uid,'member',case when action like 'join_%' then 'active' else 'requested' end,null)
    on conflict(space_id,user_id) do update set role='member',status=excluded.status,invited_by=null,created_at=now_at;
  elsif action like 'join_%' then
   insert into public.squad_members(squad_id,user_id,role) values(eid,uid,'member') on conflict(squad_id,user_id) do nothing;
  else insert into public.squad_join_requests(squad_id,user_id) values(eid,uid) on conflict(squad_id,user_id) do nothing; end if;
  return jsonb_build_object('entity_id',eid,'status',case when action like 'join_%' then 'active' else 'requested' end);
 end if;

 if action in ('ban_squad_member','unban_squad_member','ban_space_member','unban_space_member') then
  kind:=case when action in ('ban_squad_member','unban_squad_member') then 'squad' else 'space' end;
  eid:=nullif(payload->>(kind||'_id'),'')::uuid; target:=nullif(payload->>'user_id','')::uuid;
  if not private.social_active(kind,eid,uid) or private.organization_role_rank(private.social_role(kind,eid,uid))<3 then raise exception 'Only community admins can manage bans.'; end if;
  if target is null or target=uid or target=(case when kind='squad' then (select owner_id from public.squads where id=eid) else (select owner_id from public.spaces where id=eid) end) then raise exception 'Choose a valid member.'; end if;
  if action like 'unban_%' then
   if kind='squad' then
    if not exists(select 1 from public.squad_bans b where b.squad_id=eid and b.user_id=target and private.organization_role_rank(private.social_role(kind,eid,uid))>private.organization_role_rank(b.former_role)) then raise exception 'Your role cannot remove that ban.'; end if;
    delete from public.squad_bans where squad_id=eid and user_id=target;
   else
    if not exists(select 1 from public.space_bans b where b.space_id=eid and b.user_id=target and private.space_role_rank(private.social_role(kind,eid,uid))>private.space_role_rank(b.former_role)) then raise exception 'Your role cannot remove that ban.'; end if;
    delete from public.space_bans where space_id=eid and user_id=target;
   end if;
   return jsonb_build_object('entity_id',eid,'user_id',target,'unbanned',true);
  end if;
  if char_length(coalesce(payload->>'reason',''))>200 then raise exception 'Ban reasons must be 200 characters or less.'; end if;
  if kind='squad' then
   select role into role_name from public.squad_members where squad_id=eid and user_id=target for update;
   if role_name is null or private.organization_role_rank(private.social_role(kind,eid,uid))<=private.organization_role_rank(role_name) then raise exception 'Your role cannot ban that member.'; end if;
   delete from public.squad_members where squad_id=eid and user_id=target;
   delete from public.squad_join_requests where squad_id=eid and user_id=target;
   delete from public.squad_invites where squad_id=eid and recipient_id=target;
   insert into public.squad_bans(squad_id,user_id,banned_by,reason,former_role) values(eid,target,uid,coalesce(payload->>'reason',''),role_name)
    on conflict(squad_id,user_id) do update set banned_by=uid,reason=excluded.reason,former_role=excluded.former_role,created_at=now_at;
  else
   select role into role_name from public.space_members where space_id=eid and user_id=target and status='active' for update;
   if role_name is null or private.space_role_rank(private.social_role(kind,eid,uid))<=private.space_role_rank(role_name) then raise exception 'Your role cannot ban that member.'; end if;
   delete from public.space_members where space_id=eid and user_id=target;
   insert into public.space_bans(space_id,user_id,banned_by,reason,former_role) values(eid,target,uid,coalesce(payload->>'reason',''),role_name)
    on conflict(space_id,user_id) do update set banned_by=uid,reason=excluded.reason,former_role=excluded.former_role,created_at=now_at;
  end if;
  return jsonb_build_object('entity_id',eid,'user_id',target,'banned',true);
 end if;

 if action in ('invite_squad','invite_space_member','invite_organization_member') then
  kind:=case when action='invite_squad' then 'squad' when action='invite_space_member' then 'space' else 'organization' end;
  eid:=case when kind='organization' then nullif(payload->>'organization_id','')::uuid
   when kind='squad' then coalesce(nullif(payload->>'squad_id','')::uuid,nullif(payload->>'id','')::uuid)
   else nullif(payload->>'space_id','')::uuid end;
  target:=coalesce(nullif(payload->>'user_id','')::uuid,nullif(payload->>'target_user_id','')::uuid);
  if target is null or target=uid or not private.social_active(kind,eid,uid) or not private.social_invite_allowed(kind,eid,uid)
   or private.social_user_blocked(target,uid)
   then raise exception 'Your community role cannot invite that person.'; end if;
  if kind='organization' then select o.owner_id into entity_owner from public.organizations o where o.id=eid;
  elsif kind='space' then select s.owner_id into entity_owner from public.spaces s where s.id=eid;
  else select s.owner_id into entity_owner from public.squads s where s.id=eid; end if;
  if entity_owner is null or target=entity_owner or private.social_user_blocked(entity_owner,target) then raise exception 'Choose a valid, unblocked friend to invite.'; end if;
  if exists(select 1 from public.organization_bans b where kind='organization' and b.organization_id=eid and b.user_id=target)
   or exists(select 1 from public.space_bans b where kind='space' and b.space_id=eid and b.user_id=target)
   or exists(select 1 from public.squad_bans b where kind='squad' and b.squad_id=eid and b.user_id=target) then raise exception 'That person is banned from this community.'; end if;
  if kind='organization' then
   desired_role:=coalesce(payload->>'role','member');
   if desired_role not in ('coowner','admin','elder','member') or (private.organization_role_rank(private.social_role(kind,eid,uid))<=private.organization_role_rank(desired_role)
    and not (desired_role='member' and private.social_role(kind,eid,uid)='member' and (select invite_policy from public.organizations where id=eid)='members')) then raise exception 'Your role cannot invite that rank.'; end if;
   if exists(select 1 from public.organization_members m where m.organization_id=eid and m.user_id=target and m.status='active') then raise exception 'That person is already a member.'; end if;
   select m.role,m.status into old_target_role,old_target_status from public.organization_members m where m.organization_id=eid and m.user_id=target for update;
   if old_target_status='requested' then raise exception 'That person already requested membership.'; end if;
   if old_target_status='invited' and private.organization_role_rank(private.social_role(kind,eid,uid))<=private.organization_role_rank(old_target_role) then raise exception 'Your role cannot replace that pending invitation.'; end if;
   insert into public.organization_members(organization_id,user_id,role,status,invited_by) values(eid,target,desired_role,'invited',uid)
    on conflict(organization_id,user_id) do update set role=excluded.role,status='invited',invited_by=uid,created_at=now_at;
  elsif kind='space' then
   if not private.friends(target) then raise exception 'Choose an eligible friend to invite to this Space.'; end if;
   desired_role:=coalesce(payload->>'role','member');
   if desired_role not in ('coowner','admin','elder','member') or (private.space_role_rank(private.social_role(kind,eid,uid))<=private.space_role_rank(desired_role)
    and not (desired_role='member' and private.social_role(kind,eid,uid)='member' and (select invite_policy from public.spaces where id=eid)='members')) then raise exception 'Your role cannot invite that rank.'; end if;
   if exists(select 1 from public.space_members m where m.space_id=eid and m.user_id=target and m.status='active') then raise exception 'That person is already a member.'; end if;
   select m.role,m.status into old_target_role,old_target_status from public.space_members m where m.space_id=eid and m.user_id=target for update;
   if old_target_status='requested' then raise exception 'That person already requested membership.'; end if;
   if old_target_status='invited' and private.space_role_rank(private.social_role(kind,eid,uid))<=private.space_role_rank(old_target_role) then raise exception 'Your role cannot replace that pending invitation.'; end if;
   insert into public.space_members(space_id,user_id,role,status,invited_by) values(eid,target,desired_role,'invited',uid)
    on conflict(space_id,user_id) do update set role=excluded.role,status='invited',invited_by=uid,created_at=now_at;
  else
   if not private.friends(target) or exists(select 1 from public.squad_members m where m.squad_id=eid and m.user_id=target) then raise exception 'Choose an accepted friend who is not already in this Squad.'; end if;
   insert into public.squad_invites(squad_id,sender_id,recipient_id) values(eid,uid,target) on conflict(squad_id,recipient_id) do update set sender_id=uid;
  end if;
  return jsonb_build_object('entity_id',eid,'user_id',target,'status','invited');
 end if;

 if action in ('respond_organization_invite','respond_space_invite','accept_squad') then
  target:=uid;
  if action<>'accept_squad' and nullif(payload->>'user_id','') is not null and nullif(payload->>'user_id','')::uuid<>uid then raise exception 'Only the invited person can respond.'; end if;
  if action='respond_organization_invite' then
   eid:=nullif(payload->>'organization_id','')::uuid;
   if exists(select 1 from public.organization_bans b where b.organization_id=eid and b.user_id=uid) then raise exception 'That invitation is unavailable.'; end if;
   if not exists(select 1 from public.organization_members m where m.organization_id=eid and m.user_id=uid and m.status='invited') then raise exception 'That invitation is unavailable.'; end if;
   if (select archived_at from public.organizations where id=eid) is not null or private.social_user_blocked(uid,(select owner_id from public.organizations where id=eid)) then raise exception 'That invitation is unavailable.'; end if;
   if coalesce((payload->>'accept')::boolean,false) then update public.organization_members set status='active' where organization_id=eid and user_id=uid; else delete from public.organization_members where organization_id=eid and user_id=uid; end if;
   return jsonb_build_object('organization_id',eid,'status',case when coalesce((payload->>'accept')::boolean,false) then 'active' else 'declined' end);
  elsif action='respond_space_invite' then
   eid:=nullif(payload->>'space_id','')::uuid;
   if exists(select 1 from public.space_bans b where b.space_id=eid and b.user_id=uid) or not exists(select 1 from public.space_members where space_id=eid and user_id=uid and status='invited')
    or (select archived_at from public.spaces where id=eid) is not null or private.social_user_blocked(uid,(select owner_id from public.spaces where id=eid)) then raise exception 'That invitation is unavailable.'; end if;
   if coalesce((payload->>'accept')::boolean,false) then update public.space_members set status='active' where space_id=eid and user_id=uid; else delete from public.space_members where space_id=eid and user_id=uid; end if;
   return jsonb_build_object('space_id',eid,'status',case when coalesce((payload->>'accept')::boolean,false) then 'active' else 'declined' end);
  else
   select * into invitation from public.squad_invites where id=nullif(payload->>'id','')::uuid and recipient_id=uid for update;
   if not found then raise exception 'That Squad invitation is unavailable.'; end if;
   eid:=invitation.squad_id;
   if not exists(select 1 from public.squad_bans b where b.squad_id=eid and b.user_id=uid) and private.social_invite_allowed('squad',eid,invitation.sender_id)
    and not private.social_user_blocked(uid,invitation.sender_id)
    and not private.social_user_blocked(uid,(select owner_id from public.squads where id=eid))
    and (select archived_at from public.squads where id=eid) is null
    and (coalesce((select discoverability from public.squads where id=eid),'private')<>'community' or private.social_parent_eligible('squad',eid,uid)) then
    insert into public.squad_members(squad_id,user_id,role) values(eid,uid,'member') on conflict(squad_id,user_id) do nothing;
    delete from public.squad_invites where id=invitation.id;
    return jsonb_build_object('squad_id',eid,'status','active');
   end if;
   raise exception 'That Squad invitation is no longer available.';
  end if;
 end if;

 if action in ('attach_organization_space','detach_organization_space') then
  eid:=nullif(payload->>'organization_id','')::uuid;
  link_id:=nullif(payload->>'space_id','')::uuid;
  if not private.social_parent_can_manage('organization',eid,null) or not private.social_parent_can_manage('space',link_id,null)
   or private.social_user_blocked((select owner_id from public.organizations where id=eid),uid)
   or private.social_user_blocked((select owner_id from public.spaces where id=link_id),uid)
   or exists(select 1 from public.organization_bans where organization_id=eid and user_id=uid)
   or exists(select 1 from public.space_bans where space_id=link_id and user_id=uid) then raise exception 'You need active admin authority in both communities to link them.'; end if;
  if action='attach_organization_space' then
   insert into public.organization_spaces(organization_id,space_id,added_by) values(eid,link_id,uid) on conflict do nothing;
  else delete from public.organization_spaces where organization_id=eid and space_id=link_id;
   if not found then raise exception 'That Space is not linked to this organization.'; end if;
  end if;
  return jsonb_build_object('organization_id',eid,'space_id',link_id,'attached',action='attach_organization_space');
 end if;

 if action in ('set_social_association','clear_social_association') then
  activity_key:=nullif(payload->>'activity_id','')::uuid;
  if not exists(select 1 from public.activities a where a.id=activity_key and a.owner_id=uid) then raise exception 'Only the Beacon host can change its community association.'; end if;
  if action='clear_social_association' then delete from public.activity_social_links l where l.activity_id=activity_key and l.created_by=uid; return jsonb_build_object('activity_id',activity_key,'associated',false); end if;
  association_type:=payload->>'entity_type'; association_id:=nullif(payload->>'entity_id','')::uuid;
  if association_type not in ('squad','space','organization') or not private.social_active(association_type,association_id,uid)
   or private.social_user_blocked(uid,(case association_type when 'organization' then (select owner_id from public.organizations where id=association_id) when 'space' then (select owner_id from public.spaces where id=association_id) else (select owner_id from public.squads where id=association_id) end)) then
   raise exception 'You need current membership in an available community to associate this Beacon.';
  end if;
  insert into public.activity_social_links(activity_id,entity_type,entity_id,created_by) values(activity_key,association_type,association_id,uid)
   on conflict(activity_id) do update set entity_type=excluded.entity_type,entity_id=excluded.entity_id,created_by=uid,created_at=now_at;
  return jsonb_build_object('activity_id',activity_key,'entity_type',association_type,'entity_id',association_id,'associated',true);
 end if;

 raise exception 'Unsupported social action.';
end $$;
revoke all on function private.social_user_blocked(uuid,uuid),private.social_role(text,uuid,uuid),private.social_active(text,uuid,uuid),
 private.social_parent_eligible(text,uuid,uuid),private.social_entity_visible(text,uuid,uuid),private.social_invite_allowed(text,uuid,uuid),
 private.social_parent_can_manage(text,uuid,uuid),private.apply_social_action(text,jsonb) from public,anon,authenticated;
-- These narrow, read-only predicates are evaluated by policies on the new
-- projections. Mutation helpers above remain private to the dispatcher.
revoke all on function private.readable_social_entity(text,uuid),private.readable_social_ban(text,uuid,uuid),
 private.readable_squad_join_request(uuid,uuid) from public,anon,authenticated;
grant execute on function private.readable_social_entity(text,uuid),private.readable_social_ban(text,uuid,uuid),
 private.readable_squad_join_request(uuid,uuid) to authenticated;

-- The organizer rank is intentionally separate from moderation/admin powers.
create or replace function private.plan_routine_can_manage(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.plans p where p.id=pid and
  (p.owner_id=auth.uid() or (p.squad_id is not null and private.social_active('squad',p.squad_id,auth.uid()) and not private.blocked(p.owner_id)
   and private.organization_role_rank(private.social_role('squad',p.squad_id,auth.uid()))>=2)))
$$;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_social_legacy;
revoke all on function public.beacon_action_social_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $social_action_parameter_repair$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_social_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_social_legacy.request_id');
 definition:=replace(definition,'beacon_action_spaces_legacy.request_id','beacon_action_social_legacy.request_id');
 definition:=replace(definition,'beacon_action_organizations_legacy.request_id','beacon_action_social_legacy.request_id');
 definition:=replace(definition,'beacon_action_plan_routines_legacy.request_id','beacon_action_social_legacy.request_id');
 execute definition;
end $social_action_parameter_repair$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb; prior jsonb; social_type text; social_id uuid; created_activity_id uuid;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action in ('join_squad','request_squad_join','cancel_squad_join_request','approve_squad_join_request','deny_squad_join_request',
  'join_space','request_space_join','cancel_space_join_request','approve_space_join_request','deny_space_join_request',
  'join_organization','request_organization_join','cancel_organization_join_request','approve_organization_join_request','deny_organization_join_request',
  'invite_squad','invite_space_member','invite_organization_member','respond_space_invite','respond_organization_invite','accept_squad',
  'ban_squad_member','unban_squad_member','ban_space_member','unban_space_member','set_social_policy','set_squad_member_role','set_space_member_role',
  'create_space_from_squads','organize_squad_into_space','attach_organization_space','detach_organization_space','set_social_association','clear_social_association') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
  if found then return prior; end if;
  perform private.limit_action('all',300);
  if action in ('invite_squad','invite_space_member','invite_organization_member') then perform private.limit_action('invitations',20); end if;
  result:=private.apply_social_action(action,payload)||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 if action in ('create_space','create_organization','create_squad') then
  select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
  if found then return prior-'_social_meta'; end if;
  if coalesce(payload->>'discoverability','private') not in ('public','community','private')
   or coalesce(payload->>'join_mode','invite') not in ('open','request','invite')
   or coalesce(payload->>'invite_policy','admins') not in ('admins','elders','members') then raise exception 'Choose valid community policies.'; end if;
  result:=public.beacon_action_social_legacy(action,payload,beacon_action.request_id);
  if result ? '_social_meta' then return result-'_social_meta'; end if;
  social_id:=coalesce(nullif(result->>'space_id','')::uuid,nullif(result->>'organization_id','')::uuid,nullif(result->>'squad_id','')::uuid);
  if action='create_space' then update public.spaces set discoverability=coalesce(payload->>'discoverability','private'),join_mode=coalesce(payload->>'join_mode','invite'),invite_policy=coalesce(payload->>'invite_policy','admins'),space_type=coalesce(payload->>'space_type','other') where id=social_id;
  elsif action='create_organization' then update public.organizations set discoverability=coalesce(payload->>'discoverability','private'),join_mode=coalesce(payload->>'join_mode','invite'),invite_policy=coalesce(payload->>'invite_policy','admins') where id=social_id;
  else update public.squads set discoverability=coalesce(payload->>'discoverability','private'),join_mode=coalesce(payload->>'join_mode','invite'),invite_policy=coalesce(payload->>'invite_policy','admins') where id=social_id; end if;
  update private.requests as pr set result=pr.result||jsonb_build_object('_social_meta',true) where pr.user_id=uid and pr.request_id=beacon_action.request_id;
  return result;
 end if;
 if action='create_activity' then
  select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
  if found then return prior-'_social_meta'; end if;
  result:=public.beacon_action_social_legacy(action,payload,beacon_action.request_id);
  if result ? '_social_meta' then return result-'_social_meta'; end if;
  social_type:=payload->>'social_entity_type'; social_id:=nullif(payload->>'social_entity_id','')::uuid;
  if social_type is not null or social_id is not null then
   if social_type not in ('squad','space','organization') or social_id is null or not private.social_active(social_type,social_id,uid) then raise exception 'Join the selected community before associating this Beacon.'; end if;
   created_activity_id:=nullif(result->>'id','')::uuid;
   insert into public.activity_social_links(activity_id,entity_type,entity_id,created_by)
    values(created_activity_id,social_type,social_id,uid) on conflict do nothing;
  end if;
  update private.requests as pr set result=pr.result||jsonb_build_object('_social_meta',true) where pr.user_id=uid and pr.request_id=beacon_action.request_id;
  return result;
 end if;
 return public.beacon_action_social_legacy(action,payload,beacon_action.request_id);
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

-- Snapshot stays membership-gated; these arrays are filtered independently by RLS.
do $social_snapshot_patch$
declare definition text; old_list text; new_list text;
begin
 select pg_get_functiondef('public.beacon_snapshot()'::regprocedure) into definition;
 old_list:='''space_squads'']';
 new_list:='''space_squads'',''organization_spaces'',''space_bans'',''squad_bans'',''squad_join_requests'',''activity_social_links'']';
 if position(old_list in definition)=0 then raise exception 'Could not add Social architecture projections to the snapshot.'; end if;
 definition:=replace(definition,old_list,new_list);
 execute definition;
end $social_snapshot_patch$;
