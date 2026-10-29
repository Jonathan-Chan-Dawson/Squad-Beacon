-- Phase 5.1. Guest IDs are verified auth.users IDs, never invented profiles.
create table private.guest_identities (
 user_id uuid primary key references auth.users on delete cascade,
 name text not null check(char_length(name) between 1 and 80), birth_date date not null,
 created_at timestamptz not null default now(), claimed_by uuid references public.profiles on delete set null, claimed_at timestamptz
);
create table private.guest_shares (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles on delete cascade,
 kind text not null check(kind='beacon'), target_id uuid not null,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 access text not null check(access in ('preview','participate')), expires_at timestamptz, revoked_at timestamptz,
 preview_title text not null check(char_length(preview_title) between 1 and 120),
 preview_description text not null default '' check(char_length(preview_description)<=500),
 area_label text not null default '' check(char_length(area_label)<=160),
 stop_ids uuid[] not null default '{}', created_at timestamptz not null default now()
);
create unique index guest_active_share on private.guest_shares(kind,target_id) where revoked_at is null;
create table private.guest_response_access (
 share_id uuid not null references private.guest_shares on delete cascade,
 user_id uuid not null references auth.users on delete cascade, primary key(share_id,user_id)
);
create table private.guest_exclusions (
 kind text not null, target_id uuid not null, user_id uuid not null references auth.users on delete cascade,
 primary key(kind,target_id,user_id)
);
create table private.guest_requests (
 user_id uuid not null references auth.users on delete cascade, request_id uuid not null,
 fingerprint jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(user_id,request_id)
);
create table private.guest_rate_limits (
 key text not null, bucket timestamptz not null, count integer not null, primary key(key,bucket)
);
create index guest_rate_limits_bucket on private.guest_rate_limits(bucket);
revoke all on private.guest_identities,private.guest_shares,private.guest_response_access,private.guest_exclusions,private.guest_requests,private.guest_rate_limits from public,anon,authenticated;
alter table private.guest_identities enable row level security;
alter table private.guest_shares enable row level security;
alter table private.guest_response_access enable row level security;
alter table private.guest_exclusions enable row level security;
alter table private.guest_requests enable row level security;
alter table private.guest_rate_limits enable row level security;
-- Approved local schema change: preserve the canonical RSVP key and all member IDs.
alter table public.rsvps drop constraint rsvps_user_id_fkey;
alter table public.rsvps add constraint rsvps_user_id_fkey foreign key(user_id) references auth.users on delete cascade;
-- Preserve the previous profile-deletion cascade as well as Auth deletion.
create function private.remove_member_guest_participation() returns trigger language plpgsql security definer set search_path='' as $$ begin
 delete from public.rsvps where user_id=old.id; return old;
end $$;
revoke all on function private.remove_member_guest_participation() from public,anon,authenticated;
create trigger remove_member_guest_participation before delete on public.profiles for each row execute function private.remove_member_guest_participation();

-- Approved guest attendance must not grant full member Beacon/tool/chat access.
-- Keep this helper's OID so every existing RLS caller retains its binding.
do $$ declare definition text; source text; begin
 select pg_get_functiondef(oid),prosrc into definition,source from pg_proc where oid='private.can_activity(uuid)'::regprocedure;
 if source !~* '^\s*select\s+exists' then raise exception 'Review changed Beacon access helper before guest rollout.'; end if;
 execute replace(definition,source,regexp_replace(source,'^\s*select\s+','select exists(select 1 from public.profiles where id=auth.uid()) and ','i'));
end $$;

create function private.guest_limit(k text, ceiling integer) returns void language plpgsql security definer set search_path='' as $$
declare n integer; begin
 insert into private.guest_rate_limits values(k,date_trunc('hour',now()),1)
 on conflict(key,bucket) do update set count=private.guest_rate_limits.count+1 returning count into n;
 if n>ceiling then raise exception 'Too many requests. Try again later.'; end if;
end $$;
create function public.guest_auth_limit(rate_key text, command text) returns void language plpgsql security definer set search_path='' as $$ begin
 if rate_key !~ '^[a-f0-9]{64}$' or command not in ('send-code','verify') then raise exception 'Invalid rate request.'; end if;
 perform private.guest_limit('auth:'||rate_key,case when command='send-code' then 10 else 30 end);
 delete from private.guest_rate_limits where bucket<now()-interval '2 days';
end $$;
-- actor is obtained by the server from Auth getUser(); these RPCs are service-only.
create function public.guest_identity(actor uuid, display_name text, birth date) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verify your email first.'; end if;
 if birth is null or birth>current_date-interval '16 years' or birth<current_date-interval '120 years' then raise exception 'Squad Beacon is for ages 16 and older.'; end if;
 if char_length(trim(coalesce(display_name,''))) not between 1 and 80 then raise exception 'Enter your name.'; end if;
 insert into private.guest_identities(user_id,name,birth_date) values(actor,trim(display_name),birth) on conflict(user_id) do nothing;
 return jsonb_build_object('verified',true);
end $$;
create function private.guest_share_valid(s private.guest_shares) returns boolean language sql stable security definer set search_path='' as $$
 select s.id is not null and s.revoked_at is null and (s.expires_at is null or s.expires_at>now())
 and exists(select 1 from public.activities a where a.id=s.target_id and a.mode<>'solo' and a.owner_id=s.owner_id);
$$;
create function private.guest_actor_allowed(s private.guest_shares, person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select person is null or not (
 exists(select 1 from private.guest_exclusions where kind=s.kind and target_id=s.target_id and user_id=person)
 or exists(select 1 from public.blocks where (blocker_id=s.owner_id and blocked_id=person) or (blocked_id=s.owner_id and blocker_id=person))
 or (s.kind='beacon' and exists(select 1 from private.activity_exclusions where activity_id=s.target_id and user_id=person)));
$$;
create function public.guest_share_manage(actor uuid, command text, kind text, target uuid, settings jsonb default '{}', new_hash text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.activities; s private.guest_shares; begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if not exists(select 1 from public.profiles where id=actor) then raise exception 'Finish your member profile first.'; end if;
 if kind<>'beacon' then raise exception 'This item does not support guest sharing.'; end if;
 select * into a from public.activities where id=target for update;
 if a.id is null or a.mode='solo' or not ((a.owner_id=actor and command in ('read','revoke')) or private.can_manage_beacon(target)) then raise exception 'Only authorized organizers may share this Beacon.'; end if;
 select * into s from private.guest_shares g where g.kind=guest_share_manage.kind and g.target_id=target and g.revoked_at is null;
 if command='revoke' then update private.guest_shares set revoked_at=now() where id=s.id; return jsonb_build_object('enabled',false); end if;
 if command='read' then return jsonb_build_object('enabled',s.id is not null,'access',s.access,'expires_at',s.expires_at,'preview_title',s.preview_title,'preview_description',s.preview_description,'area_label',s.area_label); end if;
 if command not in ('enable','regenerate') then raise exception 'Unknown sharing action.'; end if;
 perform private.guest_limit('share:'||actor::text,60);
 if new_hash is null or new_hash !~ '^[a-f0-9]{64}$' then raise exception 'Generate a secure invitation.'; end if;
 if coalesce(settings->>'access','') not in ('preview','participate') then raise exception 'Choose guest access.'; end if;
 if settings->>'expires_at' is not null and ((settings->>'expires_at')::timestamptz<=now() or not isfinite((settings->>'expires_at')::timestamptz)) then raise exception 'Choose a future expiry.'; end if;
 update private.guest_shares set revoked_at=now() where id=s.id;
 insert into private.guest_shares(owner_id,kind,target_id,token_hash,access,expires_at,preview_title,preview_description,area_label)
 values(a.owner_id,kind,target,new_hash,settings->>'access',(settings->>'expires_at')::timestamptz,
 coalesce(nullif(trim(settings->>'preview_title'),''),a.title),coalesce(settings->>'preview_description',''),coalesce(settings->>'area_label','')) returning * into s;
 return jsonb_build_object('enabled',true,'access',s.access,'expires_at',s.expires_at);
end $$;
create function public.guest_preview(link_hash text, actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.guest_shares; a public.activities; r public.rsvps; n integer; begin
 select * into s from private.guest_shares where token_hash=link_hash;
 if not private.guest_share_valid(s) or not private.guest_actor_allowed(s,actor) then return jsonb_build_object('state','unavailable'); end if;
 select * into a from public.activities where id=s.target_id;
 select * into r from public.rsvps where activity_id=a.id and user_id=actor;
 perform set_config('request.jwt.claim.sub',a.owner_id::text,true);
 n:=private.beacon_seat_count(a.id);
 return jsonb_build_object('state',case when a.status='cancelled' then 'cancelled' when a.ends_at<=now() then 'ended' when a.manual_closed then 'closed' when a.capacity_policy='strict' and n>=a.capacity_limit then 'full' else 'open' end,
 'kind','beacon','title',s.preview_title,'description',s.preview_description,'area_label',s.area_label,
 'starts_at',a.starts_at,'ends_at',a.ends_at,'timezone',a.timezone,'status',a.status,
 'access',s.access,'verified',actor is not null and exists(select 1 from private.guest_identities where user_id=actor and claimed_at is null),
 'response',r.status,'approved',r.approved,'approval_required',a.approval_required or a.mode='invite',
 'calendar_id',a.id,'app_path','/activity/'||a.id::text,'seat_count',n,'capacity_limit',a.capacity_limit);
end $$;
create function public.guest_respond(link_hash text, actor uuid, command text, payload jsonb, request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.guest_shares; a public.activities; r public.rsvps; next_status text; result jsonb; fp jsonb; previous private.guest_requests; begin
 if not exists(select 1 from private.guest_identities where user_id=actor and claimed_at is null) or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verify your email first.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select * into s from private.guest_shares where token_hash=link_hash;
 if not private.guest_share_valid(s) or s.access<>'participate' or not private.guest_actor_allowed(s,actor) then raise exception 'Guest participation is unavailable.'; end if;
 -- Same lock order as host sharing/removal and member capacity: activity,
 -- then share. Recheck permission after waiting so removal cannot be undone
 -- by an already-started response, and regeneration cannot deadlock admission.
 select * into a from public.activities where id=s.target_id for update;
 select * into s from private.guest_shares where token_hash=link_hash for share;
 if not private.guest_share_valid(s) or s.access<>'participate' or not private.guest_actor_allowed(s,actor) then raise exception 'Guest participation is unavailable.'; end if;
 fp:=jsonb_build_object('share',s.id,'command',command,'payload',payload);
 select * into previous from private.guest_requests where user_id=actor and request_id=request;
 if found then if previous.fingerprint<>fp then raise exception 'This request was already used.'; end if; return previous.result; end if;
 perform private.guest_limit('respond:'||actor::text,120);
 if command<>'rsvp' or coalesce(payload->>'status','') not in ('going','interested','declined') then raise exception 'Choose a supported response.'; end if;
 if a.owner_id=actor or a.status<>'scheduled' or a.ends_at<=now() then raise exception 'Responses are closed.'; end if;
 select * into r from public.rsvps where activity_id=a.id and user_id=actor;
 next_status:=payload->>'status';
 if next_status='going' then
  if r.status is distinct from 'requested' and not coalesce(r.status='going' and (r.approved or (not a.approval_required and a.mode<>'invite')),false) then
   perform set_config('request.jwt.claim.sub',a.owner_id::text,true); perform private.assert_beacon_capacity(a.id);
  end if;
  if (a.approval_required or a.mode='invite') and not coalesce(r.approved,false) then next_status:='requested'; end if;
 elsif a.manual_closed and r.user_id is null then raise exception 'Responses are closed.'; end if;
 insert into private.guest_response_access(share_id,user_id) values(s.id,actor) on conflict do nothing;
 insert into public.rsvps(activity_id,user_id,status,approved) values(a.id,actor,next_status,coalesce(r.approved,false))
 on conflict(activity_id,user_id) do update set status=excluded.status;
 result:=jsonb_build_object('response',next_status,'approved',coalesce(r.approved,false));
 insert into private.guest_requests values(actor,request,fp,result,now()); return result;
end $$;
create function public.guest_attendance(actor uuid, target uuid, participant uuid default null, command text default 'read') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.activities; begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select * into a from public.activities where id=target for update;
 if not exists(select 1 from public.profiles where id=actor) or not ((a.owner_id=actor and command='read') or private.can_manage_beacon(target)) then raise exception 'Organizer access required.'; end if;
 if command not in ('read','approve','remove') then raise exception 'Unknown attendance action.'; end if;
 if command<>'read' then
  if not exists(select 1 from public.rsvps r join private.guest_identities g on g.user_id=r.user_id where r.activity_id=target and r.user_id=participant and g.claimed_at is null) then raise exception 'Guest response unavailable.'; end if;
  if command='approve' then
   if not private.can_admit_beacon(target) then raise exception 'Admission permission required.'; end if;
   if not exists(select 1 from public.rsvps where activity_id=target and user_id=participant and status='requested') then raise exception 'No pending request.'; end if;
   if a.status<>'scheduled' or a.ends_at<=now() then raise exception 'Responses are closed.'; end if;
   perform private.assert_beacon_capacity(target);
   update public.rsvps set status='going',approved=true where activity_id=target and user_id=participant;
  else
   if not private.can_remove_beacon_participant(target,participant) then raise exception 'Removal permission required.'; end if;
   insert into private.guest_exclusions values('beacon',target,participant) on conflict do nothing;
   delete from public.rsvps where activity_id=target and user_id=participant;
  end if;
 end if;
 return jsonb_build_object('guests',coalesce((select jsonb_agg(jsonb_build_object('id',g.user_id,'name',g.name,'response',r.status,'approved',r.approved)) from public.rsvps r join private.guest_identities g on g.user_id=r.user_id where r.activity_id=target and g.claimed_at is null),'[]'::jsonb));
end $$;
do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('guest_auth_limit','guest_identity','guest_share_manage','guest_preview','guest_respond','guest_attendance') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
revoke all on function private.guest_limit(text,integer),private.guest_share_valid(private.guest_shares),private.guest_actor_allowed(private.guest_shares,uuid) from public,anon,authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_guest_sharing;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; begin
 result:=public.beacon_snapshot_before_guest_sharing();
 return result||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}'::jsonb)||'{"guest_sharing":true}'::jsonb);
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
