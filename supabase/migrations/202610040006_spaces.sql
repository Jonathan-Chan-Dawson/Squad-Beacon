-- Spaces are independent membership hubs. Linked Squads keep their own access
-- rules: the link never grants a Space member Squad membership or content access.
create table public.spaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 60),
 description text not null default '' check(char_length(description)<=500),
 created_at timestamptz not null default now()
);
create index spaces_owner on public.spaces(owner_id,created_at desc);

create table public.space_members (
 space_id uuid not null references public.spaces(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check(role in ('owner','admin','member')),
 status text not null default 'invited' check(status in ('invited','active')),
 invited_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(space_id,user_id)
);
create index space_members_user on public.space_members(user_id,status,space_id);
create index space_members_role on public.space_members(space_id,status,role);

create table public.space_squads (
 space_id uuid not null references public.spaces(id) on delete cascade,
 squad_id uuid not null references public.squads(id) on delete cascade,
 added_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(space_id,squad_id)
);
create index space_squads_squad on public.space_squads(squad_id,space_id);

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_squads enable row level security;
revoke all on public.spaces,public.space_members,public.space_squads from public,anon,authenticated;
grant select on public.spaces,public.space_members,public.space_squads to authenticated;

create function private.space_role_rank(role_name text) returns integer
language sql immutable set search_path='' as $$
 select case role_name when 'owner' then 3 when 'admin' then 2 when 'member' then 1 else 0 end;
$$;

create function private.space_role(sid uuid,person_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case
  when s.owner_id=person_id and exists(select 1 from public.space_members m
   where m.space_id=s.id and m.user_id=person_id and m.role='owner' and m.status='active') then 'owner'
  else (select m.role from public.space_members m where m.space_id=s.id and m.user_id=person_id
   and m.user_id<>s.owner_id and m.role in ('admin','member') and m.status='active')
 end
 from public.spaces s where s.id=sid;
$$;

create function private.space_active(sid uuid,person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select person_id is not null and private.space_role(sid,person_id) is not null
  and not exists(select 1 from public.blocks b join public.spaces s on s.id=sid
   where (b.blocker_id=person_id and b.blocked_id=s.owner_id)
    or (b.blocker_id=s.owner_id and b.blocked_id=person_id));
$$;

create function private.space_invited(sid uuid,person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select person_id is not null and exists(select 1 from public.space_members m
  join public.spaces s on s.id=m.space_id where m.space_id=sid and m.user_id=person_id
   and m.status='invited' and person_id<>s.owner_id and not exists(
    select 1 from public.blocks b where (b.blocker_id=person_id and b.blocked_id=s.owner_id)
     or (b.blocker_id=s.owner_id and b.blocked_id=person_id)));
$$;

create function private.can_read_space(sid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.space_active(sid,auth.uid()) or private.space_invited(sid,auth.uid());
$$;

create function private.can_read_space_member(sid uuid,member_id uuid,member_status text)
returns boolean language sql stable security definer set search_path='' as $$
 select (private.space_active(sid,auth.uid()) and not private.blocked(member_id) and (
   (member_status='active' and private.space_active(sid,member_id))
   or (member_status='invited'
    and private.space_role_rank(private.space_role(sid,auth.uid()))>=2
    and private.space_invited(sid,member_id))
  )) or (member_id=auth.uid() and member_status='invited' and private.space_invited(sid,auth.uid()));
$$;

create function private.can_read_space_squad(sid uuid,squad_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.space_active(sid,auth.uid()) and private.member(squad_id);
$$;

create function private.space_can_manage_member(sid uuid,actor_id uuid,target_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select actor_id is not null and target_id is not null and target_id<>actor_id
  and target_id<>(select s.owner_id from public.spaces s where s.id=sid)
  and private.space_role_rank(private.space_role(sid,actor_id)) > private.space_role_rank(coalesce(
   (select m.role from public.space_members m where m.space_id=sid and m.user_id=target_id),
   'owner'));
$$;

create policy read_spaces on public.spaces for select to authenticated using(private.can_read_space(id));
create policy read_space_members on public.space_members for select to authenticated using(
 private.can_read_space_member(space_id,user_id,status)
);
create policy read_space_squads on public.space_squads for select to authenticated using(
 private.can_read_space_squad(space_id,squad_id)
);
revoke all on function private.can_read_space(uuid),
 private.can_read_space_member(uuid,uuid,text),private.can_read_space_squad(uuid,uuid) from public,anon;
grant execute on function private.can_read_space(uuid),
 private.can_read_space_member(uuid,uuid,text),private.can_read_space_squad(uuid,uuid) to authenticated;

-- Active members of the same Space are profile context, subject to each
-- profile's existing public/friends/custom visibility and block settings.
do $space_profile_context_patch$
declare definition text; original_definition text;
begin
 select pg_get_functiondef('private.profile_legacy_context(uuid)'::regprocedure) into definition;
 original_definition:=definition;
 definition:=replace(definition,
  $old$or exists(select 1 from public.activities a where a.owner_id=pid and private.can_activity(a.id))$old$,
  $new$or exists(select 1 from public.spaces s
   where private.space_active(s.id,auth.uid()) and private.space_active(s.id,pid))
  or exists(select 1 from public.activities a where a.owner_id=pid and private.can_activity(a.id))$new$);
 if definition=original_definition then
  raise exception 'Could not add Space membership to the profile context.';
 end if;
 execute definition;
end $space_profile_context_patch$;

create function private.apply_space_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); sid uuid:=nullif(payload->>'space_id','')::uuid;
 target_id uuid:=nullif(payload->>'user_id','')::uuid;
 squad_id uuid:=nullif(payload->>'squad_id','')::uuid;
 desired_role text; actor_role text; target_role text; body_text text; name_text text;
 result jsonb:='{}'; space_row public.spaces; member_row public.space_members;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if not exists(select 1 from public.profiles where id=uid) then raise exception 'Finish your profile first.'; end if;

 if action='create_space' then
  name_text:=trim(coalesce(payload->>'name',''));
  body_text:=coalesce(payload->>'description','');
  if char_length(name_text) not between 2 and 60 or char_length(body_text)>500 then
   raise exception 'Check the Space name and description.';
  end if;
  insert into public.spaces(owner_id,name,description) values(uid,name_text,body_text) returning id into sid;
  insert into public.space_members(space_id,user_id,role,status,invited_by)
   values(sid,uid,'owner','active',null);
  return jsonb_build_object('id',sid,'space_id',sid);
 end if;

 select * into space_row from public.spaces where id=sid for update;
 if not found then raise exception 'Space unavailable.'; end if;
 if private.blocked(space_row.owner_id) then raise exception 'That Space is unavailable to you.'; end if;
 actor_role:=private.space_role(sid,uid);

 if action='respond_space_invite' then
  if target_id is not null and target_id<>uid then raise exception 'Only the invited person can respond.'; end if;
  select * into member_row from public.space_members where space_id=sid and user_id=uid and status='invited' for update;
  if not found or uid=space_row.owner_id then raise exception 'That Space invitation is no longer available.'; end if;
  if coalesce((payload->>'accept')::boolean,false) then
   update public.space_members set status='active' where space_id=sid and user_id=uid;
   return jsonb_build_object('space_id',sid,'status','active');
  end if;
  delete from public.space_members where space_id=sid and user_id=uid;
  return jsonb_build_object('space_id',sid,'status','declined');
 end if;

 if actor_role is null then raise exception 'That Space is unavailable to you.'; end if;

 if action='update_space' then
  if actor_role not in ('owner','admin') then raise exception 'Only Space owners and admins can edit Space details.'; end if;
  name_text:=trim(coalesce(payload->>'name',''));
  body_text:=coalesce(payload->>'description','');
  if char_length(name_text) not between 2 and 60 or char_length(body_text)>500 then
   raise exception 'Check the Space name and description.';
  end if;
  update public.spaces set name=name_text,description=body_text where id=sid;
  return jsonb_build_object('space_id',sid,'updated',true);
 end if;

 if action='invite_space_member' then
  if actor_role not in ('owner','admin') then raise exception 'Only Space owners and admins can invite members.'; end if;
  target_id:=coalesce(target_id,nullif(payload->>'target_user_id','')::uuid);
  desired_role:=coalesce(nullif(payload->>'role',''),'member');
  if desired_role not in ('admin','member') or (desired_role='admin' and actor_role<>'owner') then
   raise exception 'Your Space role cannot issue that invitation.';
  end if;
  if target_id is null or target_id=uid or target_id=space_row.owner_id
   or not exists(select 1 from public.profiles where id=target_id)
   or private.blocked(target_id) or not private.friends(target_id)
   or exists(select 1 from public.blocks b where
    (b.blocker_id=space_row.owner_id and b.blocked_id=target_id)
     or (b.blocker_id=target_id and b.blocked_id=space_row.owner_id)) then
   raise exception 'Choose a valid, unblocked friend to invite.';
  end if;
  select * into member_row from public.space_members where space_id=sid and user_id=target_id for update;
  if found and member_row.status='active' then raise exception 'That person is already in this Space.'; end if;
  if found and private.space_role_rank(actor_role)<=private.space_role_rank(member_row.role) then
   raise exception 'Your Space role cannot replace that invitation.';
  end if;
  insert into public.space_members(space_id,user_id,role,status,invited_by)
   values(sid,target_id,desired_role,'invited',uid)
   on conflict(space_id,user_id) do update set role=excluded.role,status='invited',invited_by=uid,created_at=now();
  perform private.notify(target_id,uid,'Invited you to '||space_row.name,null);
  return jsonb_build_object('space_id',sid,'user_id',target_id,'status','invited','role',desired_role);
 end if;

 if action='set_space_member_role' then
  if actor_role<>'owner' then raise exception 'Only the Space owner can change member roles.'; end if;
  target_id:=coalesce(target_id,nullif(payload->>'target_user_id','')::uuid);
  desired_role:=payload->>'role';
  if target_id is null or target_id=uid or target_id=space_row.owner_id or desired_role not in ('admin','member') then
   raise exception 'Choose a valid Space member and role.';
  end if;
  update public.space_members set role=desired_role where space_id=sid and user_id=target_id;
  if not found then raise exception 'That Space member is unavailable.'; end if;
  return jsonb_build_object('space_id',sid,'user_id',target_id,'role',desired_role);
 end if;

 if action='remove_space_member' then
  target_id:=coalesce(target_id,nullif(payload->>'target_user_id','')::uuid);
  if target_id is null or not private.space_can_manage_member(sid,uid,target_id) then
   raise exception 'Your Space role cannot remove this member.';
  end if;
  delete from public.space_members where space_id=sid and user_id=target_id;
  if not found then raise exception 'That Space member is unavailable.'; end if;
  return jsonb_build_object('space_id',sid,'user_id',target_id,'removed',true);
 end if;

 if action='leave_space' then
  if uid=space_row.owner_id then raise exception 'The Space owner cannot leave.'; end if;
  delete from public.space_members where space_id=sid and user_id=uid and status='active';
  if not found then raise exception 'You are not an active Space member.'; end if;
  return jsonb_build_object('space_id',sid,'left',true);
 end if;

 if action in ('attach_space_squad','detach_space_squad') then
  if actor_role not in ('owner','admin') then raise exception 'Only Space owners and admins can manage linked Squads.'; end if;
  squad_id:=coalesce(squad_id,nullif(payload->>'squad_id','')::uuid);
  if squad_id is null or not exists(select 1 from public.squads where id=squad_id) then
   raise exception 'Choose an available Squad.';
  end if;
  if action='attach_space_squad' then
   if not private.admin(squad_id) then raise exception 'You need to own or administer that Squad to link it.'; end if;
   insert into public.space_squads(space_id,squad_id,added_by) values(sid,squad_id,uid)
    on conflict on constraint space_squads_pkey do nothing;
   return jsonb_build_object('space_id',sid,'squad_id',squad_id,'attached',true);
  end if;
  delete from public.space_squads where space_id=sid and squad_id=squad_id;
  if not found then raise exception 'That Squad is not linked to this Space.'; end if;
  return jsonb_build_object('space_id',sid,'squad_id',squad_id,'attached',false);
 end if;

 raise exception 'Unsupported Space action.';
end $$;

revoke all on function private.space_role_rank(text),private.space_role(uuid,uuid),
 private.space_active(uuid,uuid),private.space_invited(uuid,uuid),
 private.space_can_manage_member(uuid,uuid,uuid),private.apply_space_action(text,jsonb)
 from public,anon,authenticated;

-- Extend the existing action dispatcher without changing any prior action.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_spaces_legacy;
revoke all on function public.beacon_action_spaces_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $space_action_parameter_repair$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_spaces_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_spaces_legacy.request_id');
 definition:=replace(definition,'beacon_action_plan_routines_legacy.request_id','beacon_action_spaces_legacy.request_id');
 definition:=replace(definition,'beacon_action_organizations_legacy.request_id','beacon_action_spaces_legacy.request_id');
 execute definition;
end $space_action_parameter_repair$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prior jsonb; result jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action in ('create_space','update_space','invite_space_member','respond_space_invite',
  'set_space_member_role','remove_space_member','leave_space','attach_space_squad','detach_space_squad') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
  if found then return prior; end if;
  perform private.limit_action('all',300);
  result:=private.apply_space_action(action,payload)||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 return public.beacon_action_spaces_legacy(action,payload,beacon_action.request_id);
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

-- Add all three Space projections. RLS makes each projection member-scoped.
do $space_snapshot_patch$
declare definition text; original_definition text; old_list text; new_list text;
begin
 select pg_get_functiondef('public.beacon_snapshot()'::regprocedure) into definition;
 original_definition:=definition;
 old_list:='''plan_members'',''plan_routines'']';
 new_list:='''plan_members'',''plan_routines'',''spaces'',''space_members'',''space_squads'']';
 if position(old_list in definition)=0 then
  old_list:='''group_messages'',''group_message_reads'']';
  new_list:='''group_messages'',''group_message_reads'',''spaces'',''space_members'',''space_squads'']';
 end if;
 definition:=replace(definition,old_list,new_list);
 if definition=original_definition or position('space_squads' in definition)=0 then
  raise exception 'Could not add Spaces to the Beacon snapshot.';
 end if;
 execute definition;
end $space_snapshot_patch$;
