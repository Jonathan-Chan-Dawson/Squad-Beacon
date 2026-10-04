-- Full profile details have their own audience. The default preserves the
-- existing authenticated profile-discovery predicate; it is not anonymous.
alter table public.profiles
 add column profile_visibility text not null default 'public'
 check(profile_visibility in ('public','friends','custom'));

create table private.profile_visibility_people(
 owner_id uuid not null references public.profiles(id) on delete cascade,
 person_id uuid not null references public.profiles(id) on delete cascade,
 primary key(owner_id,person_id),
 check(owner_id<>person_id)
);
create table private.profile_visibility_squads(
 owner_id uuid not null references public.profiles(id) on delete cascade,
 squad_id uuid not null references public.squads(id) on delete cascade,
 primary key(owner_id,squad_id)
);
create table private.profile_visibility_lists(
 owner_id uuid not null references public.profiles(id) on delete cascade,
 list_id uuid not null references public.lists(id) on delete cascade,
 primary key(owner_id,list_id)
);
revoke all on private.profile_visibility_people,private.profile_visibility_squads,private.profile_visibility_lists from public,anon,authenticated;

-- Keep the original discovery relationship rule as a separate minimal-identity
-- predicate. Full profile access is narrower and mode-dependent below.
create function private.profile_legacy_context(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select pid=auth.uid() or (not private.blocked(pid) and (
  private.friends(pid)
  or exists(select 1 from public.friendships where recipient_id=auth.uid() and sender_id=pid)
  or exists(select 1 from public.squad_members m where m.user_id=pid and private.member(m.squad_id))
  or exists(select 1 from public.activities a where a.owner_id=pid and private.can_activity(a.id))
 ));
$$;

create function private.profile_custom_context(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select
  exists(select 1 from private.profile_visibility_people g where g.owner_id=pid and g.person_id=auth.uid())
  or exists(
   select 1 from private.profile_visibility_squads g
   join public.squad_members owner_member on owner_member.squad_id=g.squad_id and owner_member.user_id=pid
   join public.squad_members viewer_member on viewer_member.squad_id=g.squad_id and viewer_member.user_id=auth.uid()
   where g.owner_id=pid and private.member(g.squad_id)
  )
  or exists(
   select 1 from private.profile_visibility_lists g
   join public.lists l on l.id=g.list_id and l.owner_id=pid
   join public.list_members m on m.list_id=l.id and m.user_id=auth.uid()
   where g.owner_id=pid
  );
$$;

create or replace function private.can_profile(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.profiles p
  where p.id=pid and (
   pid=auth.uid() or (not private.blocked(pid) and case p.profile_visibility
    when 'public' then private.profile_legacy_context(pid)
    when 'friends' then private.friends(pid)
    when 'custom' then private.profile_custom_context(pid)
    else false
   end)
  )
 );
$$;

create function private.can_minimal_profile(pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select pid=auth.uid() or (not private.blocked(pid) and (
  private.profile_legacy_context(pid)
  or private.profile_custom_context(pid)
  or private.can_profile(pid)
  or exists(
   select 1 from public.activities a
   where private.can_chat(a.id) and (
    (a.owner_id=pid and (
      exists(select 1 from public.rsvps r where r.activity_id=a.id and r.user_id=auth.uid() and r.status='invited')
      or exists(select 1 from public.beacon_invitation_grants g where g.activity_id=a.id and g.user_id=auth.uid())
    ))
    or (
     exists(select 1 from public.rsvps attendee where attendee.activity_id=a.id and attendee.user_id=pid and attendee.status='going' and (attendee.approved or (not a.approval_required and a.mode<>'invite')))
     and private.beacon_person_visible(a.id,pid)
    )
   )
  )
  or exists(
   select 1 from public.activities a join public.rsvps invitee on invitee.activity_id=a.id
   where a.owner_id=pid and private.can_activity(a.id) and invitee.user_id=auth.uid() and invitee.status='invited'
  )
  or exists(
   select 1 from public.activities a join public.beacon_invitation_grants g on g.activity_id=a.id
   where a.owner_id=pid and private.can_activity(a.id) and g.user_id=auth.uid()
  )
 ));
$$;

-- Replace the existing location gate at the same OID. A temporary recipient
-- grant remains mandatory, and the full-profile audience can only narrow it.
create or replace function private.can_location(lid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.locations l
  where l.id=lid and l.expires_at>now() and not private.blocked(l.owner_id)
   and (l.owner_id=auth.uid() or (
    l.updated_at>now()-interval '5 minutes'
    and private.friends(l.owner_id)
    and private.can_profile(l.owner_id)
    and exists(select 1 from private.location_recipients r where r.session_id=lid and r.user_id=auth.uid())
   ))
 );
$$;

drop policy if exists read_profile on public.profiles;
create policy read_profile on public.profiles for select to authenticated using(private.can_minimal_profile(id));

-- Row policies cannot mask selected columns. Direct table access is restricted
-- to the identity needed for already-authorized interactions; the snapshot
-- projection below is the only way to receive full profile fields.
revoke all on table public.profiles from public,anon,authenticated;
grant select(id,username,name) on table public.profiles to authenticated;

create function private.profile_snapshot_data() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare people jsonb; grants jsonb; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sign in to view profiles.'; end if;
 select coalesce(jsonb_agg(
  case
   when p.id=uid then to_jsonb(p)||jsonb_build_object('viewer_can_view_full_profile',true)
   when private.can_profile(p.id) then
    (to_jsonb(p)-array['default_audience','timezone','quiet_start','quiet_end','profile_visibility','onboarding_survey_status','featured_activity_id','hide_featured'])
    ||jsonb_build_object(
      'viewer_can_view_full_profile',true,
      'viewer_featured_activity_id',case
       when not p.hide_featured and p.featured_activity_id is not null and exists(
        select 1 from public.activities a where a.id=p.featured_activity_id and a.owner_id=p.id and private.can_activity(a.id)
       ) then p.featured_activity_id else null end
    )
   else jsonb_build_object('id',p.id,'username',p.username,'name',p.name,'viewer_can_view_full_profile',false)
  end order by p.name,p.id
 ),'[]'::jsonb) into people
 from public.profiles p
 where private.can_profile(p.id) or private.can_minimal_profile(p.id);

 select coalesce(jsonb_agg(jsonb_build_object('owner_id',g.owner_id,'kind',g.kind,'target_id',g.target_id) order by g.kind,g.target_id),'[]'::jsonb)
 into grants from (
  select owner_id,'person'::text kind,person_id target_id from private.profile_visibility_people where owner_id=uid
  union all
  select owner_id,'squad'::text kind,squad_id target_id from private.profile_visibility_squads where owner_id=uid
  union all
  select owner_id,'list'::text kind,list_id target_id from private.profile_visibility_lists where owner_id=uid
 ) g;
 return jsonb_build_object('profiles',people,'profile_visibility_grants',grants);
end $$;

create function private.save_profile_privacy(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); mode text:=payload->>'profile_visibility';
 people jsonb:=coalesce(payload->'person_ids','[]'::jsonb);
 squads jsonb:=coalesce(payload->'squad_ids','[]'::jsonb);
 lists jsonb:=coalesce(payload->'list_ids','[]'::jsonb);
begin
 if uid is null then raise exception 'Sign in to update profile privacy.'; end if;
 if mode not in ('public','friends','custom') then raise exception 'Choose a valid profile audience.'; end if;
 if jsonb_typeof(people) is distinct from 'array' or jsonb_typeof(squads) is distinct from 'array' or jsonb_typeof(lists) is distinct from 'array' then
  raise exception 'Choose valid people, squads, and lists.';
 end if;
 if jsonb_array_length(people)>200 or jsonb_array_length(squads)>50 or jsonb_array_length(lists)>100 then raise exception 'Your custom profile audience is too large.'; end if;
 if exists(select 1 from jsonb_array_elements(people) x where jsonb_typeof(x.value)<>'string')
  or exists(select 1 from jsonb_array_elements(squads) x where jsonb_typeof(x.value)<>'string')
  or exists(select 1 from jsonb_array_elements(lists) x where jsonb_typeof(x.value)<>'string') then
  raise exception 'Choose valid people, squads, and lists.';
 end if;
 if (select count(*) from jsonb_array_elements_text(people))<>(select count(distinct x.value) from jsonb_array_elements_text(people) x(value))
  or (select count(*) from jsonb_array_elements_text(squads))<>(select count(distinct x.value) from jsonb_array_elements_text(squads) x(value))
  or (select count(*) from jsonb_array_elements_text(lists))<>(select count(distinct x.value) from jsonb_array_elements_text(lists) x(value)) then
  raise exception 'Choose each audience member once.';
 end if;
 if mode<>'custom' and (jsonb_array_length(people)>0 or jsonb_array_length(squads)>0 or jsonb_array_length(lists)>0) then
  raise exception 'Custom audience selections are only used in Custom mode.';
 end if;
 if exists(
  select 1 from jsonb_array_elements_text(people) x(value)
  where x.value::uuid=uid or not exists(select 1 from public.profiles p where p.id=x.value::uuid) or private.blocked(x.value::uuid)
 ) then raise exception 'Choose valid, unblocked people.'; end if;
 if exists(
  select 1 from jsonb_array_elements_text(squads) x(value)
  where not exists(select 1 from public.squad_members m where m.squad_id=x.value::uuid and m.user_id=uid)
 ) then raise exception 'Choose squads you currently belong to.'; end if;
 if exists(
  select 1 from jsonb_array_elements_text(lists) x(value)
  where not exists(select 1 from public.lists l where l.id=x.value::uuid and l.owner_id=uid)
 ) then raise exception 'Choose your own private friend lists.'; end if;

 update public.profiles set profile_visibility=mode where id=uid;
 if not found then raise exception 'Finish your profile first.'; end if;
 delete from private.profile_visibility_people where owner_id=uid;
 delete from private.profile_visibility_squads where owner_id=uid;
 delete from private.profile_visibility_lists where owner_id=uid;
 if mode='custom' then
  insert into private.profile_visibility_people(owner_id,person_id) select uid,x.value::uuid from jsonb_array_elements_text(people) x(value);
  insert into private.profile_visibility_squads(owner_id,squad_id) select uid,x.value::uuid from jsonb_array_elements_text(squads) x(value);
  insert into private.profile_visibility_lists(owner_id,list_id) select uid,x.value::uuid from jsonb_array_elements_text(lists) x(value);
 end if;
 return jsonb_build_object('profile_visibility',mode,'saved',true);
end $$;
revoke all on function private.profile_legacy_context(uuid),private.profile_custom_context(uuid),private.can_minimal_profile(uuid),private.profile_snapshot_data(),private.save_profile_privacy(jsonb) from public,anon,authenticated;
grant execute on function private.can_minimal_profile(uuid),private.profile_snapshot_data() to authenticated;

-- Add the new privacy write action without copying or changing any prior action.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_profile_privacy_legacy;
revoke all on function public.beacon_action_profile_privacy_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_profile_privacy_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_profile_privacy_legacy.request_id');
 execute definition;
end $$;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); previous jsonb; result jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action='save_profile_privacy' then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select q.result into previous from private.requests q where q.user_id=uid and q.request_id=beacon_action.request_id;
  if found then return previous; end if;
  result:=private.save_profile_privacy(payload);
  result:=result||jsonb_build_object('event',action);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 return public.beacon_action_profile_privacy_legacy(action,payload,beacon_action.request_id);
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create or replace function public.beacon_snapshot() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb; profile_data jsonb;
begin
 profile_data:=private.profile_snapshot_data();
 foreach t in array array['favorites','templates','plan_templates','plans','messages','profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks','beacon_checklist_items','beacon_notes','library_folders','library_folder_items','planning_threads','planning_ping_responses','planning_proposals','planning_votes','beacon_roles','beacon_attendance','beacon_invitation_grants'] loop
  if t='profiles' then
   rows:=profile_data->'profiles';
  elsif t='activities' then
   execute format('select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object(''viewer_can_access'',private.can_chat(x.id),''accepted_seat_count'',private.beacon_seat_count(x.id))),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  end if;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('profile_visibility_grants',profile_data->'profile_visibility_grants','is_moderator',private.is_moderator());
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
