-- Capacity, active beacon roles, manual arrival, and independently pausable tools.
alter table public.activities
 add column capacity_limit integer,
 add column capacity_policy text not null default 'soft' check(capacity_policy in ('soft','strict')),
 add column manual_closed boolean not null default false,
 add column enable_chat boolean not null default true,
 add column enable_checklist boolean not null default true,
 add column enable_journal boolean not null default true,
 add column enable_experiences boolean not null default true,
 add column enable_focus boolean not null default true,
 add column enable_reactions boolean not null default true,
 add column music_url text,
 add column decoration_emoji text,
 add column decoration_accent text;
alter table public.activities add constraint activities_capacity_limit_valid
 check(capacity_limit is null or capacity_limit between 2 and 500);

alter table public.activities add constraint activities_decoration_emoji_valid
 check(decoration_emoji is null or decoration_emoji in ('✨','🌿','☀️','🌊','🎵','🎮','☕','📚','🏃','🎨'));
alter table public.activities add constraint activities_decoration_accent_valid
 check(decoration_accent is null or decoration_accent in ('ocean','lime','sunset','berry','neutral'));

create function private.valid_music_url(value text) returns boolean
language sql immutable security definer set search_path='' as $$
 select value is null or (
  length(value) between 1 and 2000 and
  value ~ '^https://(open[.]spotify[.]com|music[.]youtube[.]com|youtube[.]com|www[.]youtube[.]com|youtu[.]be|music[.]apple[.]com|soundcloud[.]com|www[.]soundcloud[.]com)(/[^[:space:]]*)?([?#][^[:space:]]*)?$'
 );
$$;
alter table public.activities add constraint activities_music_url_allowed
 check(private.valid_music_url(music_url));

create table public.beacon_roles (
 activity_id uuid not null references public.activities on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 role text not null check(role in ('coowner','admin')),
 assigned_by uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),
 primary key(activity_id,user_id)
);
create index beacon_roles_activity_role on public.beacon_roles(activity_id,role,user_id);

create table public.beacon_attendance (
 activity_id uuid not null references public.activities on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 state text not null check(state in ('none','arriving','present')),
 updated_at timestamptz not null default now(),
 primary key(activity_id,user_id)
);

-- Keep an invitation independent from the attendee's current RSVP answer.
create table public.beacon_invitation_grants (
 activity_id uuid not null references public.activities on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 invited_by uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),
 primary key(activity_id,user_id)
);
insert into public.beacon_invitation_grants(activity_id,user_id,invited_by,created_at)
 select r.activity_id,r.user_id,a.owner_id,now()
 from public.rsvps r join public.activities a on a.id=r.activity_id
 where r.status='invited'
 on conflict(activity_id,user_id) do nothing;

alter table public.beacon_roles enable row level security;
alter table public.beacon_attendance enable row level security;
alter table public.beacon_invitation_grants enable row level security;
revoke all on public.beacon_roles,public.beacon_attendance,public.beacon_invitation_grants from public,anon,authenticated;
grant select on public.beacon_roles,public.beacon_attendance,public.beacon_invitation_grants to authenticated;
create policy read_beacon_roles on public.beacon_roles
 for select to authenticated using(private.can_activity(activity_id) and not private.blocked(user_id));
create policy read_beacon_attendance on public.beacon_attendance
 for select to authenticated using(private.can_activity(activity_id) and not private.blocked(user_id));

-- Replace the existing helper without changing its OID: prior RLS policies
-- keep their binding, while an explicit invite grants detail visibility only.
create or replace function private.can_activity(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.activities a where a.id=aid and not private.blocked(a.owner_id)
 and not exists(select 1 from private.activity_exclusions where activity_id=aid and user_id=auth.uid())
 and (private.audience(a.owner_id,a.audience,a.audience_id)
   or exists(select 1 from public.rsvps where activity_id=aid and user_id=auth.uid() and approved)
   or exists(select 1 from public.beacon_invitation_grants where activity_id=aid and user_id=auth.uid())));
$$;

create function private.beacon_person_visible(aid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.activities a where a.id=aid and person is not null
   and not exists(select 1 from public.blocks b where (b.blocker_id=a.owner_id and b.blocked_id=person) or (b.blocker_id=person and b.blocked_id=a.owner_id))
   and not exists(select 1 from private.activity_exclusions e where e.activity_id=a.id and e.user_id=person)
   and (
    person=a.owner_id
    or case a.audience
     when 'friends' then exists(select 1 from public.friendships f where f.status='accepted' and ((f.sender_id=a.owner_id and f.recipient_id=person) or (f.recipient_id=a.owner_id and f.sender_id=person)))
     when 'list' then exists(
      select 1 from public.friendships f join public.list_members m on m.user_id=person join public.lists l on l.id=m.list_id
      where f.status='accepted' and ((f.sender_id=a.owner_id and f.recipient_id=person) or (f.recipient_id=a.owner_id and f.sender_id=person))
       and l.id=a.audience_id and l.owner_id=a.owner_id
     )
     when 'squad' then exists(
      select 1 from public.squads s join public.squad_members member_row on member_row.squad_id=s.id
      where s.id=a.audience_id and member_row.user_id=person
       and exists(select 1 from public.squad_members owner_row where owner_row.squad_id=s.id and owner_row.user_id=a.owner_id)
       and not exists(select 1 from public.blocks b where (b.blocker_id=s.owner_id and b.blocked_id=person) or (b.blocker_id=person and b.blocked_id=s.owner_id))
     )
     else false
    end
    or exists(select 1 from public.rsvps approved_row where approved_row.activity_id=a.id and approved_row.user_id=person and approved_row.approved)
    or exists(select 1 from public.beacon_invitation_grants invite_row where invite_row.activity_id=a.id and invite_row.user_id=person)
   )
 );
$$;

create function private.beacon_approved_going(aid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.beacon_person_visible(aid,person) and exists(
  select 1 from public.activities a join public.rsvps r on r.activity_id=a.id
  where a.id=aid and r.user_id=person and r.status='going'
   and (r.approved or (not a.approval_required and a.mode<>'invite'))
 );
$$;

create function private.beacon_seat_count(aid uuid) returns integer
language sql stable security definer set search_path='' as $$
 select coalesce((
  select 1+count(distinct r.user_id)::integer
  from public.activities a left join public.rsvps r on r.activity_id=a.id and r.user_id<>a.owner_id
   and r.status='going' and (r.approved or (not a.approval_required and a.mode<>'invite'))
   and not exists(select 1 from public.blocks b where (b.blocker_id=a.owner_id and b.blocked_id=r.user_id) or (b.blocker_id=r.user_id and b.blocked_id=a.owner_id))
   and not exists(select 1 from private.activity_exclusions e where e.activity_id=a.id and e.user_id=r.user_id)
  where a.id=aid and private.can_activity(a.id) group by a.id
 ),0)::integer;
$$;

create function private.beacon_role(aid uuid,person uuid) returns text
language sql stable security definer set search_path='' as $$
 select case
  when exists(select 1 from public.activities a where a.id=aid and a.owner_id=person) then 'owner'
  when not private.beacon_approved_going(aid,person) then 'none'
  else coalesce((select role from public.beacon_roles where activity_id=aid and user_id=person),'attendee')
 end;
$$;

create function private.can_manage_beacon(aid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.activities a where a.id=aid and a.status='scheduled'
   and (a.owner_id=auth.uid() or (
    private.beacon_approved_going(a.id,auth.uid()) and exists(
     select 1 from public.beacon_roles r where r.activity_id=a.id and r.user_id=auth.uid() and r.role in ('coowner','admin')
    )
   ))
 );
$$;

create function private.can_manage_beacon_settings(aid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.activities a where a.id=aid and a.status='scheduled'
   and (a.owner_id=auth.uid() or (
    private.beacon_approved_going(a.id,auth.uid()) and exists(
     select 1 from public.beacon_roles r where r.activity_id=a.id and r.user_id=auth.uid() and r.role='coowner'
    )
   ))
 );
$$;

create function private.can_admit_beacon(aid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.can_manage_beacon(aid);
$$;

create function private.can_read_beacon_invitation(aid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.can_activity(aid) and not private.blocked(person) and
  (person=auth.uid() or private.can_manage_beacon(aid));
$$;
revoke all on function private.can_read_beacon_invitation(uuid,uuid) from public,anon;
grant execute on function private.can_read_beacon_invitation(uuid,uuid) to authenticated;
-- Invitees see only their own grants; hosts and active beacon managers may
-- see the attendee list. Other audience members cannot enumerate invites.
create policy read_beacon_invitation_grants on public.beacon_invitation_grants
 for select to authenticated using(private.can_read_beacon_invitation(activity_id,user_id));

create function private.can_assign_beacon_role(aid uuid,target uuid,role_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select target is not null and role_name is not null and role_name in ('coowner','admin') and target<>auth.uid()
  and private.can_manage_beacon_settings(aid)
  and private.beacon_approved_going(aid,target)
  and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=target) or (b.blocker_id=target and b.blocked_id=auth.uid()))
  and (private.beacon_role(aid,auth.uid())='owner' or (
   role_name='admin' and private.beacon_role(aid,auth.uid())='coowner'
   and not exists(select 1 from public.beacon_roles target_role where target_role.activity_id=aid and target_role.user_id=target and target_role.role='coowner')
  ));
$$;

create function private.can_remove_beacon_participant(aid uuid,target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select target is not null and target<>auth.uid()
  and exists(select 1 from public.rsvps where activity_id=aid and user_id=target)
  and private.can_manage_beacon(aid)
  and target<>(select owner_id from public.activities where id=aid)
  and case private.beacon_role(aid,auth.uid())
   when 'owner' then true
   when 'coowner' then not exists(select 1 from public.beacon_roles where activity_id=aid and user_id=target and role='coowner')
   when 'admin' then not exists(select 1 from public.beacon_roles where activity_id=aid and user_id=target)
   else false
  end;
$$;

create function private.assert_beacon_capacity(aid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.activities;
begin
 select * into a from public.activities where id=aid;
 if not found then raise exception 'Beacon unavailable.'; end if;
 if a.manual_closed then raise exception 'This beacon is closed to new requests.'; end if;
 if a.capacity_policy='strict' and a.capacity_limit is not null
  and private.beacon_seat_count(aid)>=a.capacity_limit then
  raise exception 'This beacon is full. Try again if a spot opens.';
 end if;
end $$;

create function private.save_beacon_controls(aid uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 a public.activities;
 new_limit integer;
 limit_numeric numeric;
 new_policy text;
 new_closed boolean;
 new_music text;
 new_emoji text;
 new_accent text;
 field_name text;
 flag_names text[]:=array['enable_chat','enable_checklist','enable_journal','enable_experiences','enable_focus','enable_reactions','manual_closed'];
begin
 if aid is null then raise exception 'Choose a beacon first.'; end if;
 select * into a from public.activities where id=aid for update;
 if not found or not private.can_manage_beacon_settings(aid) then raise exception 'Only the beacon owner or a current co-owner can change settings.'; end if;
 if a.status<>'scheduled' then raise exception 'Beacon settings are read-only after the beacon ends.'; end if;

 new_limit:=a.capacity_limit;
 if payload ? 'capacity_limit' then
  if payload->'capacity_limit'='null'::jsonb then new_limit:=null;
  elsif jsonb_typeof(payload->'capacity_limit')<>'number' then raise exception 'Choose a whole-number capacity or leave it unlimited.';
  else
   limit_numeric:=(payload->>'capacity_limit')::numeric;
   if limit_numeric<>trunc(limit_numeric) or limit_numeric<2 or limit_numeric>500 then raise exception 'Choose a capacity from 2 to 500, or leave it unlimited.'; end if;
   new_limit:=limit_numeric::integer;
  end if;
 end if;
 new_policy:=a.capacity_policy;
 if payload ? 'capacity_policy' then
  if jsonb_typeof(payload->'capacity_policy')<>'string' or payload->>'capacity_policy' not in ('soft','strict') then raise exception 'Choose a soft or strict capacity.'; end if;
  new_policy:=payload->>'capacity_policy';
 end if;
 foreach field_name in array flag_names loop
  if payload ? field_name and jsonb_typeof(payload->field_name) is distinct from 'boolean' then raise exception 'Beacon toggles must be on or off.'; end if;
 end loop;
 new_closed:=coalesce((payload->>'manual_closed')::boolean,a.manual_closed);

 new_music:=a.music_url;
 if payload ? 'music_url' then
  if payload->'music_url'='null'::jsonb then new_music:=null;
  elsif jsonb_typeof(payload->'music_url')<>'string' or not private.valid_music_url(payload->>'music_url') then raise exception 'Use a secure link from Spotify, YouTube Music, Apple Music, or SoundCloud.';
  else new_music:=payload->>'music_url'; end if;
 end if;
 new_emoji:=a.decoration_emoji;
 if payload ? 'decoration_emoji' then
  if payload->'decoration_emoji'='null'::jsonb then new_emoji:=null;
  elsif jsonb_typeof(payload->'decoration_emoji')<>'string' or payload->>'decoration_emoji' not in ('✨','🌿','☀️','🌊','🎵','🎮','☕','📚','🏃','🎨') then raise exception 'Choose an available beacon decoration.';
  else new_emoji:=payload->>'decoration_emoji'; end if;
 end if;
 new_accent:=a.decoration_accent;
 if payload ? 'decoration_accent' then
  if payload->'decoration_accent'='null'::jsonb then new_accent:=null;
  elsif jsonb_typeof(payload->'decoration_accent')<>'string' or payload->>'decoration_accent' not in ('ocean','lime','sunset','berry','neutral') then raise exception 'Choose an available beacon color.';
  else new_accent:=payload->>'decoration_accent'; end if;
 end if;

 if new_policy='strict' and new_limit is not null and private.beacon_seat_count(aid)>new_limit then
  raise exception 'Capacity cannot be lowered below current accepted Going count.';
 end if;
 update public.activities set
  capacity_limit=new_limit,
  capacity_policy=new_policy,
  manual_closed=new_closed,
  enable_chat=coalesce((payload->>'enable_chat')::boolean,a.enable_chat),
  enable_checklist=coalesce((payload->>'enable_checklist')::boolean,a.enable_checklist),
  enable_journal=coalesce((payload->>'enable_journal')::boolean,a.enable_journal),
  enable_experiences=coalesce((payload->>'enable_experiences')::boolean,a.enable_experiences),
  enable_focus=coalesce((payload->>'enable_focus')::boolean,a.enable_focus),
  enable_reactions=coalesce((payload->>'enable_reactions')::boolean,a.enable_reactions),
  music_url=new_music,
  decoration_emoji=new_emoji,
  decoration_accent=new_accent
 where id=aid;
 return jsonb_build_object('activity_id',aid,'capacity_limit',new_limit,'capacity_policy',new_policy,'manual_closed',new_closed);
end $$;

create function private.enforce_rsvp_capacity(aid uuid,requested text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.activities; existing public.rsvps; next_request boolean; already_open boolean;
begin
 if requested<>'going' then return; end if;
 select * into a from public.activities where id=aid for update;
 if not found then return; end if;
 select * into existing from public.rsvps where activity_id=aid and user_id=auth.uid();
 next_request:=(a.approval_required or a.mode='invite') and not coalesce(existing.approved,false);
 already_open:=existing.status='requested' or (
  existing.status='going' and (existing.approved or (not a.approval_required and a.mode<>'invite'))
 );
 -- Existing requests and accepted Going retries remain harmless at full/closed capacity.
 if already_open then return; end if;
 if a.manual_closed then raise exception 'This beacon is closed to new requests.'; end if;
 if a.capacity_policy='strict' and a.capacity_limit is not null
  and private.beacon_seat_count(aid)>=a.capacity_limit then
  raise exception 'This beacon is full. Try again if a spot opens.';
 end if;
 perform next_request;
end $$;

create function private.apply_beacon_control_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();
 aid uuid;
 target uuid:=nullif(payload->>'user_id','')::uuid;
 a public.activities;
 r public.rsvps;
 assigned_role text;
 next_state text;
 old_state text;
 invite_values jsonb;
 invitee jsonb;
 invite_id uuid;
 sid uuid;
 selected_count integer:=0;
 created_count integer:=0;
 was_existing boolean;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action in ('invite_activity','approve_rsvp','remove_rsvp') then aid:=nullif(payload->>'id','')::uuid;
 else aid:=coalesce(nullif(payload->>'activity_id','')::uuid,nullif(payload->>'id','')::uuid); end if;
 perform private.limit_action('all',300);

 if action='set_beacon_controls' then return private.save_beacon_controls(aid,payload); end if;
 if aid is null then raise exception 'Choose a beacon first.'; end if;
 select * into a from public.activities where id=aid for update;
 if not found then raise exception 'Beacon unavailable.'; end if;

 if action='set_beacon_attendance' then
  if target is not null and target<>uid then raise exception 'You can only update your own arrival status.'; end if;
  target:=uid;
  next_state:=payload->>'state';
  if next_state is null or next_state not in ('none','arriving','present') then raise exception 'Choose Arriving, Present, or clear your arrival status.'; end if;
  if a.status='cancelled' then raise exception 'Cancelled beacons do not accept arrival updates.'; end if;
  if a.owner_id<>uid and not private.beacon_approved_going(aid,uid) then raise exception 'Only an approved Going participant can update arrival status.'; end if;
  select state into old_state from public.beacon_attendance where activity_id=aid and user_id=uid for update;
  old_state:=coalesce(old_state,'none');
  if a.status='completed' then
   if next_state=old_state then return jsonb_build_object('activity_id',aid,'user_id',uid,'state',old_state); end if;
   raise exception 'Completed beacon arrival history is read-only.';
  end if;
  if next_state='arriving' and a.ends_at<=now() then raise exception 'Arrival updates are closed after the beacon ends.'; end if;
  if next_state='present' and (a.status<>'scheduled' or a.starts_at>now() or a.ends_at<=now()) then raise exception 'Present is available only while a scheduled beacon is active.'; end if;
  insert into public.beacon_attendance(activity_id,user_id,state) values(aid,uid,next_state)
   on conflict(activity_id,user_id) do update set state=excluded.state,updated_at=now();
  return jsonb_build_object('activity_id',aid,'user_id',uid,'state',next_state);
 end if;

 if action='assign_beacon_role' then
  assigned_role:=payload->>'role';
  if assigned_role is null or assigned_role not in ('coowner','admin') or target is null then raise exception 'Choose a co-owner or admin.'; end if;
  if not private.can_assign_beacon_role(aid,target,assigned_role) then raise exception 'Roles require an eligible Going participant and the proper manager level.'; end if;
  insert into public.beacon_roles(activity_id,user_id,role,assigned_by) values(aid,target,assigned_role,uid)
   on conflict(activity_id,user_id) do update set role=excluded.role,assigned_by=excluded.assigned_by,created_at=now();
  return jsonb_build_object('activity_id',aid,'user_id',target,'role',assigned_role);
 end if;

 if action='revoke_beacon_role' then
  if target is null or target=uid or not private.can_manage_beacon_settings(aid) then raise exception 'Only the owner or a co-owner can change beacon roles.'; end if;
  select role into assigned_role from public.beacon_roles where activity_id=aid and user_id=target for update;
  if not found then return jsonb_build_object('activity_id',aid,'user_id',target,'removed',false); end if;
  if private.beacon_role(aid,uid)<>'owner' and not (private.beacon_role(aid,uid)='coowner' and assigned_role='admin') then raise exception 'Co-owners can only manage admin roles.'; end if;
  delete from public.beacon_roles where activity_id=aid and user_id=target;
  return jsonb_build_object('activity_id',aid,'user_id',target,'removed',true);
 end if;

 if action='set_beacon_attendance' then raise exception 'Invalid arrival update.'; end if;

 if action in ('invite_activity','approve_rsvp','remove_rsvp') then
  if a.mode='solo' or a.status<>'scheduled' or not private.can_admit_beacon(aid) then raise exception 'Only an active beacon manager can manage participants.'; end if;
  if target is null or target=uid then raise exception 'Choose another participant.'; end if;
  if action='invite_activity' then
   perform private.limit_action('invitations',20);
   if not private.friends(target) or exists(select 1 from public.blocks b where (b.blocker_id=a.owner_id and b.blocked_id=target) or (b.blocker_id=target and b.blocked_id=a.owner_id)) then raise exception 'Invite an accepted friend.'; end if;
   select * into r from public.rsvps where activity_id=aid and user_id=target for update;
   if found and r.status in ('going','requested','invited') then
    return jsonb_build_object('activity_id',aid,'user_id',target,'status',r.status);
   end if;
   delete from private.activity_exclusions where activity_id=aid and user_id=target;
   insert into public.rsvps(activity_id,user_id,status,approved) values(aid,target,'invited',true)
    on conflict(activity_id,user_id) do update set status='invited',approved=true;
   insert into public.beacon_invitation_grants(activity_id,user_id,invited_by)
    values(aid,target,uid) on conflict(activity_id,user_id) do nothing;
   perform private.notify(target,uid,'You have a beacon invitation.',aid);
   return jsonb_build_object('activity_id',aid,'user_id',target,'status','invited');
  elsif action='approve_rsvp' then
   select * into r from public.rsvps where activity_id=aid and user_id=target for update;
   if not found or r.status<>'requested' then raise exception 'There is no pending request for this beacon.'; end if;
   if private.blocked(target) or exists(select 1 from public.blocks b where (b.blocker_id=a.owner_id and b.blocked_id=target) or (b.blocker_id=target and b.blocked_id=a.owner_id))
    or exists(select 1 from private.activity_exclusions e where e.activity_id=aid and e.user_id=target) then raise exception 'Attendee unavailable.'; end if;
   perform private.assert_beacon_capacity(aid);
   update public.rsvps set approved=true,status='going' where activity_id=aid and user_id=target;
   perform private.notify(target,uid,'Your beacon request was approved.',aid);
   return jsonb_build_object('activity_id',aid,'user_id',target,'status','going');
  else
   if not private.can_remove_beacon_participant(aid,target) then raise exception 'Your role cannot remove this participant.'; end if;
   delete from public.rsvps where activity_id=aid and user_id=target;
   delete from public.beacon_roles where activity_id=aid and user_id=target;
   delete from public.beacon_invitation_grants where activity_id=aid and user_id=target;
   insert into private.activity_exclusions(activity_id,user_id) values(aid,target) on conflict do nothing;
   return jsonb_build_object('activity_id',aid,'user_id',target,'removed',true);
  end if;
 end if;

 if action='create_squad_from_beacon' then
  if a.status<>'scheduled' or not private.can_manage_beacon(aid) then raise exception 'Only a current beacon manager can invite people to a squad.'; end if;
  invite_values:=coalesce(payload->'invite_user_ids','[]'::jsonb);
  if jsonb_typeof(invite_values)<>'array' or jsonb_array_length(invite_values)>50 then raise exception 'Choose up to 50 beacon participants.'; end if;
  if exists(select 1 from jsonb_array_elements(invite_values) e where jsonb_typeof(e)<>'string') then raise exception 'Choose valid beacon participants.'; end if;
  if (select count(*) from jsonb_array_elements_text(invite_values))<>(select count(distinct x) from jsonb_array_elements_text(invite_values) x) then raise exception 'Choose each participant once.'; end if;
  sid:=nullif(payload->>'squad_id','')::uuid;
  if sid is null then
   if a.owner_id<>uid then raise exception 'Only the beacon owner can create a squad from it.'; end if;
   if char_length(trim(coalesce(payload->>'name',''))) not between 1 and 60 or char_length(coalesce(payload->>'description',''))>500 then raise exception 'Give the squad a name and keep its description under 500 characters.'; end if;
   insert into public.squads(owner_id,name,description) values(uid,trim(payload->>'name'),coalesce(payload->>'description','')) returning id into sid;
   insert into public.squad_members(squad_id,user_id,role) values(sid,uid,'owner');
  else
   if not private.admin(sid) then raise exception 'Only a squad owner or admin can invite people to that squad.'; end if;
  end if;
  for invitee in select value from jsonb_array_elements(invite_values) loop
   invite_id:=(invitee#>>'{}')::uuid;
   if invite_id=uid then continue; end if;
   if not private.friends(invite_id) or not private.beacon_approved_going(aid,invite_id) then raise exception 'Only selected accepted friends who are Going can be invited from this beacon.'; end if;
   if exists(select 1 from public.squad_members where squad_id=sid and user_id=invite_id) then continue; end if;
   was_existing:=exists(select 1 from public.squad_invites where squad_id=sid and recipient_id=invite_id);
   insert into public.squad_invites(squad_id,sender_id,recipient_id) values(sid,uid,invite_id) on conflict(squad_id,recipient_id) do nothing;
   if not was_existing then
    created_count:=created_count+1;
    perform private.notify(invite_id,uid,'You have a squad invitation.',null);
   end if;
  end loop;
  return jsonb_build_object('squad_id',sid,'invites_created',created_count);
 end if;

 raise exception 'Unknown beacon control action.';
end $$;

create function private.preflight_beacon_join(aid uuid,requested text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.activities; existing public.rsvps; already_accepted boolean; already_requested boolean;
begin
 if requested<>'going' then return; end if;
 select * into a from public.activities where id=aid for update;
 if not found then return; end if;
 -- Match the established RSVP eligibility checks before exposing capacity state.
 if not private.can_activity(aid) or a.mode='solo' or a.status<>'scheduled' or a.ends_at<=now() or a.owner_id=auth.uid() then
  raise exception 'This activity is not open for joining.';
 end if;
 select * into existing from public.rsvps where activity_id=aid and user_id=auth.uid();
 already_accepted:=existing.status='going' and (existing.approved or (not a.approval_required and a.mode<>'invite'));
 already_requested:=existing.status='requested';
 if already_accepted or already_requested then return; end if;
 if a.manual_closed then raise exception 'This beacon is closed to new requests.'; end if;
 if a.capacity_policy='strict' and a.capacity_limit is not null
  and private.beacon_seat_count(aid)>=a.capacity_limit then raise exception 'This beacon is full. Try again if a spot opens.'; end if;
end $$;

create function private.beacon_module_enabled(aid uuid,module_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((
  select case module_name
   when 'chat' then a.enable_chat
   when 'checklist' then a.enable_checklist
   when 'journal' then a.enable_journal
   when 'experiences' then a.enable_experiences
   when 'focus' then a.enable_focus
   when 'reactions' then a.enable_reactions
   else false end
  from public.activities a where a.id=aid
 ),false);
$$;

revoke all on function private.valid_music_url(text) from public,anon,authenticated;
revoke all on function private.beacon_person_visible(uuid,uuid) from public,anon,authenticated;
revoke all on function private.beacon_approved_going(uuid,uuid) from public,anon,authenticated;
revoke all on function private.beacon_seat_count(uuid) from public,anon,authenticated;
grant execute on function private.beacon_seat_count(uuid) to authenticated;
revoke all on function private.beacon_role(uuid,uuid) from public,anon,authenticated;
revoke all on function private.can_manage_beacon(uuid) from public,anon,authenticated;
revoke all on function private.can_manage_beacon_settings(uuid) from public,anon,authenticated;
revoke all on function private.can_admit_beacon(uuid) from public,anon,authenticated;
revoke all on function private.can_assign_beacon_role(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.can_remove_beacon_participant(uuid,uuid) from public,anon,authenticated;
revoke all on function private.assert_beacon_capacity(uuid) from public,anon,authenticated;
revoke all on function private.save_beacon_controls(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.enforce_rsvp_capacity(uuid,text) from public,anon,authenticated;
revoke all on function private.apply_beacon_control_action(text,jsonb) from public,anon,authenticated;
revoke all on function private.preflight_beacon_join(uuid,text) from public,anon,authenticated;
revoke all on function private.beacon_module_enabled(uuid,text) from public,anon,authenticated;

-- Extend the existing action chain without duplicating any earlier domain branch.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_controls_legacy;
revoke all on function public.beacon_action_controls_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_controls_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_controls_legacy.request_id');
 execute definition;
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();
 previous jsonb;
 result jsonb;
 aid uuid;
 locked_activity uuid;
 module_name text;
 has_control_fields boolean;
 preserve_invitation boolean:=false;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action in ('rsvp','comment','react','activity_status','edit_activity','invite_activity','approve_rsvp','remove_rsvp') then
  aid:=nullif(payload->>'id','')::uuid;
  if nullif(payload->>'id','') is not null and nullif(payload->>'activity_id','') is not null
   and nullif(payload->>'id','')::uuid<>nullif(payload->>'activity_id','')::uuid then
   raise exception 'Choose one beacon instead of sending conflicting IDs.';
  end if;
 elsif action='send_message' then aid:=nullif(payload->>'activity_id','')::uuid;
 elsif action in ('add_checklist_item','add_beacon_note') then aid:=nullif(payload->>'activity_id','')::uuid;
 else aid:=coalesce(nullif(payload->>'activity_id','')::uuid,nullif(payload->>'id','')::uuid); end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select q.result into previous from private.requests q where q.user_id=uid and q.request_id=beacon_action.request_id;
 if found then return previous; end if;

 if action in ('set_beacon_controls','set_beacon_attendance','assign_beacon_role','revoke_beacon_role','create_squad_from_beacon') then
  result:=private.apply_beacon_control_action(action,payload);
  result:=result||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;

 if action in ('invite_activity','approve_rsvp','remove_rsvp') then
  result:=private.apply_beacon_control_action(action,payload);
  result:=result||jsonb_build_object('event',action,'activity_id',aid);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;

 if action='rsvp' and payload->>'status'='going' then
  perform private.preflight_beacon_join(aid,'going');
 end if;

 if action='rsvp' and payload->>'status'='withdraw' then
  -- Serialize Out against host removal so a revoked invitation is never restored.
  select a.id into locked_activity from public.activities a where a.id=aid for update;
  if locked_activity is not null then
   select exists(select 1 from public.beacon_invitation_grants g where g.activity_id=aid and g.user_id=uid)
    into preserve_invitation;
  end if;
 end if;

 if action in ('send_message','comment','react','add_checklist_item','toggle_checklist_item','delete_checklist_item','add_beacon_note','edit_beacon_note','delete_beacon_note') then
  if action='send_message' and aid is not null then module_name:='chat';
  elsif action='comment' then module_name:='experiences';
  elsif action='react' then module_name:='reactions';
  elsif action in ('add_checklist_item','toggle_checklist_item','delete_checklist_item') then module_name:='checklist';
  else module_name:='journal';
  end if;

  if action in ('toggle_checklist_item','delete_checklist_item') then
   select i.activity_id into aid from public.beacon_checklist_items i where i.id=nullif(payload->>'id','')::uuid;
  elsif action in ('edit_beacon_note','delete_beacon_note') then
   select n.activity_id into aid from public.beacon_notes n where n.id=nullif(payload->>'id','')::uuid;
  end if;
  if aid is not null then select a.id into locked_activity from public.activities a where a.id=aid for update; end if;
  if locked_activity is not null and not private.beacon_module_enabled(locked_activity,module_name) then
   raise exception 'This beacon tool is paused by its host.';
  end if;
 end if;

 result:=public.beacon_action_controls_legacy(action,payload,beacon_action.request_id);
 if action='rsvp' and payload->>'status'='withdraw' and preserve_invitation and exists(
  select 1 from public.beacon_invitation_grants g where g.activity_id=aid and g.user_id=uid
 ) then
  insert into public.rsvps(activity_id,user_id,status,approved) values(aid,uid,'invited',true)
   on conflict(activity_id,user_id) do update set status='invited',approved=true;
 end if;
 if action='block' then
  -- Revoke only grants between the two blocked accounts. A peer-block must not
  -- revoke either person's independent invitation from a third-party host.
  delete from public.beacon_invitation_grants g
   using public.activities a
   where a.id=g.activity_id and
    ((a.owner_id=uid and g.user_id=nullif(payload->>'id','')::uuid) or
     (a.owner_id=nullif(payload->>'id','')::uuid and g.user_id=uid));
 end if;
 if action='create_activity' then
  has_control_fields:=payload ?| array['capacity_limit','capacity_policy','manual_closed','enable_chat','enable_checklist','enable_journal','enable_experiences','enable_focus','enable_reactions','music_url','decoration_emoji','decoration_accent'];
  if has_control_fields then
   perform private.save_beacon_controls((result->>'activity_id')::uuid,payload);
  end if;
 end if;
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create or replace function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb;
begin
 foreach t in array array['favorites','templates','plan_templates','plans','messages','profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks','beacon_checklist_items','beacon_notes','library_folders','library_folder_items','planning_threads','planning_ping_responses','planning_proposals','planning_votes','beacon_roles','beacon_attendance','beacon_invitation_grants'] loop
  if t='activities' then
   execute format('select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object(''viewer_can_access'',private.can_chat(x.id),''accepted_seat_count'',private.beacon_seat_count(x.id))),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  end if;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('is_moderator',private.is_moderator());
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
