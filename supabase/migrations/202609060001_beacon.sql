-- All application writes go through beacon_action; table reads are protected by RLS.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create type public.audience_kind as enum ('private','friends','list','squad');
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
 name text not null check (length(name) between 1 and 80), bio text not null default '' check(length(bio)<=500),
 interests text[] not null default '{}', featured_activity_id uuid, hide_featured boolean not null default false,
 timezone text not null default 'America/Chicago', quiet_start int not null default 22 check(quiet_start between 0 and 23),
 quiet_end int not null default 8 check(quiet_end between 0 and 23)
);
create table private.accounts (id uuid primary key references public.profiles on delete cascade, birth_date date not null, moderator boolean not null default false);
create table public.blocks (blocker_id uuid references public.profiles on delete cascade, blocked_id uuid references public.profiles on delete cascade, primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id));
create table public.friendships (id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles on delete cascade, recipient_id uuid not null references public.profiles on delete cascade, status text not null default 'pending' check(status in ('pending','accepted')), check(sender_id<>recipient_id));
create unique index friendship_pair on public.friendships (least(sender_id,recipient_id),greatest(sender_id,recipient_id));
create table public.lists (id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,name text not null check(length(name) between 1 and 50),unique(owner_id,name));
create table public.list_members (list_id uuid references public.lists on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(list_id,user_id));
create table public.squads (id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,name text not null check(length(name) between 1 and 60),description text not null default '' check(length(description)<=500));
create table public.squad_members (squad_id uuid references public.squads on delete cascade,user_id uuid references public.profiles on delete cascade,role text not null default 'member' check(role in ('owner','admin','member')),primary key(squad_id,user_id));
create table public.squad_invites (id uuid primary key default gen_random_uuid(),squad_id uuid not null references public.squads on delete cascade,sender_id uuid not null references public.profiles on delete cascade,recipient_id uuid not null references public.profiles on delete cascade,unique(squad_id,recipient_id));
create table public.goals (id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,title text not null check(length(title) between 1 and 120),description text not null default '' check(length(description)<=2000),target_date date,progress int not null default 0 check(progress between 0 and 100),audience public.audience_kind not null default 'private',audience_id uuid,check((audience in ('list','squad'))=(audience_id is not null)));
create table public.milestones (id uuid primary key default gen_random_uuid(),goal_id uuid not null references public.goals on delete cascade,title text not null check(length(title) between 1 and 150),done boolean not null default false);
create table public.habits (id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,title text not null check(length(title) between 1 and 120),goal_id uuid references public.goals on delete set null,schedule text not null check(schedule in ('days','weekly')),weekdays int[] not null default '{}',weekly_target int not null default 3 check(weekly_target between 1 and 7),timezone text not null,reminder_hour int check(reminder_hour between 0 and 23),audience public.audience_kind not null default 'private',audience_id uuid,check((audience in ('list','squad'))=(audience_id is not null)),check(weekdays <@ array[0,1,2,3,4,5,6]),check(schedule='weekly' or cardinality(weekdays)>0));
create table public.checkins (id uuid primary key default gen_random_uuid(),habit_id uuid not null references public.habits on delete cascade,owner_id uuid not null references public.profiles on delete cascade,local_date date not null,unique(habit_id,local_date));
create table public.activities (id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,title text not null check(length(title) between 1 and 120),category text not null check(category in ('Fitness','Study','Gaming','Creative','Social','Other')),mode text not null check(mode in ('solo','squad','invite')),starts_at timestamptz not null,ends_at timestamptz not null,timezone text not null,approval_required boolean not null default false,status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),goal_id uuid references public.goals on delete set null,habit_id uuid references public.habits on delete set null,audience public.audience_kind not null default 'private',audience_id uuid,check(ends_at>starts_at),check((audience in ('list','squad'))=(audience_id is not null)));
create table public.places (activity_id uuid primary key references public.activities on delete cascade,label text not null default '' check(length(label)<=200),latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),online_url text check(online_url is null or (online_url ~ '^https://' and length(online_url)<=2000)),check((latitude is null)=(longitude is null)));
create table public.rsvps (activity_id uuid references public.activities on delete cascade,user_id uuid references public.profiles on delete cascade,status text not null check(status in ('interested','going','requested','invited')),approved boolean not null default false,primary key(activity_id,user_id));
create table private.activity_exclusions (activity_id uuid references public.activities on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(activity_id,user_id));
create table public.comments (id uuid primary key default gen_random_uuid(),activity_id uuid not null references public.activities on delete cascade,author_id uuid not null references public.profiles on delete cascade,body text not null check(length(body) between 1 and 2000),created_at timestamptz not null default now());
create table public.reactions (activity_id uuid references public.activities on delete cascade,user_id uuid references public.profiles on delete cascade,emoji text not null default '🙌' check(emoji='🙌'),primary key(activity_id,user_id));
create table public.locations (id uuid primary key default gen_random_uuid(),owner_id uuid not null unique references public.profiles on delete cascade,expires_at timestamptz not null,latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),updated_at timestamptz,check((latitude is null)=(longitude is null)));
create table private.location_recipients (session_id uuid references public.locations on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(session_id,user_id));
create table public.notices (id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles on delete cascade,actor_id uuid references public.profiles on delete cascade,body text not null,activity_id uuid references public.activities on delete cascade,created_at timestamptz not null default now(),read_at timestamptz);
create table public.reports (id uuid primary key default gen_random_uuid(),reporter_id uuid references public.profiles on delete set null,subject_id uuid,reason text not null check(length(reason) between 5 and 2000),created_at timestamptz not null default now(),resolved boolean not null default false);
create table private.action_limits (user_id uuid references public.profiles on delete cascade,bucket timestamptz not null,kind text not null,count int not null,primary key(user_id,bucket,kind));
create table private.requests (user_id uuid references public.profiles on delete cascade,request_id uuid not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id));
create table public.push_tokens (token text primary key,user_id uuid not null references public.profiles on delete cascade);
create table private.push_queue (id uuid primary key default gen_random_uuid(),notice_id uuid not null references public.notices on delete cascade,token text not null,attempts int not null default 0,available_at timestamptz not null default now(),lease_until timestamptz,ticket_id text,receipt_checked boolean not null default false,done boolean not null default false,unique(notice_id,token));
create table private.reminder_log (key text primary key,created_at timestamptz not null default now());

create function private.blocked(other uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=other) or (blocked_id=auth.uid() and blocker_id=other));
$$;
create function private.friends(other uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not private.blocked(other) and exists(select 1 from public.friendships where status='accepted' and ((sender_id=auth.uid() and recipient_id=other) or (recipient_id=auth.uid() and sender_id=other)));
$$;
create function private.member(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.squad_members m join public.squads s on s.id=m.squad_id where m.squad_id=sid and m.user_id=auth.uid() and not private.blocked(s.owner_id));
$$;
create function private.admin(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member(sid) and exists(select 1 from public.squad_members where squad_id=sid and user_id=auth.uid() and role in ('owner','admin'));
$$;
create function private.audience(owner uuid,kind public.audience_kind,aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (owner=auth.uid() or (not private.blocked(owner) and
 case kind when 'friends' then private.friends(owner)
 when 'list' then private.friends(owner) and exists(select 1 from public.list_members m join public.lists l on l.id=m.list_id where l.id=aid and l.owner_id=owner and m.user_id=auth.uid())
 when 'squad' then private.member(aid) and exists(select 1 from public.squad_members where squad_id=aid and user_id=owner)
 else false end));
$$;
create function private.can_activity(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.activities a where a.id=aid and not private.blocked(a.owner_id)
 and not exists(select 1 from private.activity_exclusions where activity_id=aid and user_id=auth.uid())
 and (private.audience(a.owner_id,a.audience,a.audience_id) or exists(select 1 from public.rsvps where activity_id=aid and user_id=auth.uid() and approved)));
$$;
create function private.can_place(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_activity(aid) and exists(select 1 from public.activities a where a.id=aid and (a.owner_id=auth.uid() or (a.mode<>'invite' and not a.approval_required) or exists(select 1 from public.rsvps where activity_id=aid and user_id=auth.uid() and approved)));
$$;
create function private.can_profile(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select pid=auth.uid() or (not private.blocked(pid) and (private.friends(pid)
 or exists(select 1 from public.friendships where recipient_id=auth.uid() and sender_id=pid)
 or exists(select 1 from public.squad_members m where m.user_id=pid and private.member(m.squad_id))
 or exists(select 1 from public.activities a where a.owner_id=pid and private.can_activity(a.id))));
$$;
create function private.is_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.accounts where id=auth.uid() and moderator);
$$;
create function private.can_location(lid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.locations l where l.id=lid and l.expires_at>now() and not private.blocked(l.owner_id) and
 (l.owner_id=auth.uid() or (l.updated_at>now()-interval '5 minutes' and private.friends(l.owner_id) and exists(select 1 from private.location_recipients where session_id=lid and user_id=auth.uid()))));
$$;

do $$ declare t text; begin
 foreach t in array array['profiles','blocks','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','push_tokens'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy read_profile on public.profiles for select to authenticated using(private.can_profile(id));
create policy read_blocks on public.blocks for select to authenticated using(blocker_id=auth.uid());
create policy read_friendships on public.friendships for select to authenticated using((sender_id=auth.uid() or recipient_id=auth.uid()) and not private.blocked(case when sender_id=auth.uid() then recipient_id else sender_id end));
create policy read_lists on public.lists for select to authenticated using(owner_id=auth.uid());
create policy read_list_members on public.list_members for select to authenticated using(exists(select 1 from public.lists where id=list_id and owner_id=auth.uid()));
create policy read_squads on public.squads for select to authenticated using(private.member(id) or (not private.blocked(owner_id) and exists(select 1 from public.squad_invites where squad_id=id and recipient_id=auth.uid())));
create policy read_squad_members on public.squad_members for select to authenticated using(private.member(squad_id) and not private.blocked(user_id));
create policy read_squad_invites on public.squad_invites for select to authenticated using((recipient_id=auth.uid() or private.admin(squad_id)) and not private.blocked(sender_id));
create policy read_goals on public.goals for select to authenticated using(private.audience(owner_id,audience,audience_id));
create policy read_milestones on public.milestones for select to authenticated using(exists(select 1 from public.goals where id=goal_id));
create policy read_habits on public.habits for select to authenticated using(private.audience(owner_id,audience,audience_id));
create policy read_checkins on public.checkins for select to authenticated using(exists(select 1 from public.habits where id=habit_id));
create policy read_activities on public.activities for select to authenticated using(private.can_activity(id));
create policy read_places on public.places for select to authenticated using(private.can_place(activity_id));
create policy read_rsvps on public.rsvps for select to authenticated using(private.can_activity(activity_id) and not private.blocked(user_id));
create policy read_comments on public.comments for select to authenticated using(private.can_activity(activity_id) and not private.blocked(author_id));
create policy read_reactions on public.reactions for select to authenticated using(private.can_activity(activity_id) and not private.blocked(user_id));
create policy read_locations on public.locations for select to authenticated using(private.can_location(id));
create policy read_notices on public.notices for select to authenticated using(recipient_id=auth.uid() and (actor_id is null or not private.blocked(actor_id)) and (activity_id is null or private.can_activity(activity_id)));
create policy read_reports on public.reports for select to authenticated using(private.is_moderator());
create policy read_tokens on public.push_tokens for select to authenticated using(user_id=auth.uid());

create function private.limit_action(kind text,maximum int) returns void language plpgsql security definer set search_path='' as $$
declare hits int; begin
 insert into private.action_limits values(auth.uid(),date_trunc('hour',now()),kind,1)
 on conflict on constraint action_limits_pkey do update set count=private.action_limits.count+1 returning count into hits;
 if hits>maximum then raise exception 'Too many requests. Please try again later.'; end if;
end $$;
create function private.validate_audience(kind public.audience_kind,aid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if kind='list' and not exists(select 1 from public.lists where id=aid and owner_id=auth.uid()) then raise exception 'Choose one of your friend lists.'; end if;
 if kind='squad' and not private.member(aid) then raise exception 'Choose a squad you belong to.'; end if;
 if (kind in ('list','squad'))<>(aid is not null) then raise exception 'Invalid audience.'; end if;
end $$;
create function private.notify(recipient uuid,actor uuid,message text,aid uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare nid uuid;
begin
 if recipient=actor or exists(select 1 from public.blocks where (blocker_id=recipient and blocked_id=actor) or (blocker_id=actor and blocked_id=recipient)) then return; end if;
 insert into public.notices(recipient_id,actor_id,body,activity_id) values(recipient,actor,message,aid) returning id into nid;
 insert into private.push_queue(notice_id,token) select nid,token from public.push_tokens where user_id=recipient;
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid:=nullif(payload->>'id','')::uuid; target uuid:=nullif(payload->>'user_id','')::uuid;
 item uuid; aid uuid:=nullif(payload->>'audience_id','')::uuid; kind public.audience_kind:=coalesce(payload->>'audience','private')::public.audience_kind;
 a public.activities; h public.habits; s public.squads; r public.rsvps; result jsonb:='{}'; previous jsonb;
 expiration timestamptz; recipient uuid; dob date; timezone_name text;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select q.result into previous from private.requests q where q.user_id=uid and q.request_id=beacon_action.request_id;
 if found then return previous; end if;
 if action='onboard' then
  if exists(select 1 from public.profiles where id=uid) then return '{}'; end if;
  if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Verify your email first.'; end if;
  dob:=(payload->>'birth_date')::date;
  if dob is null or dob>current_date-interval '16 years' or dob<current_date-interval '120 years' then raise exception 'Squad Beacon is for ages 16 and older.'; end if;
  timezone_name:=coalesce(payload->>'timezone','America/Chicago');
  if not exists(select 1 from pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone.'; end if;
  insert into public.profiles(id,username,name,timezone) values(uid,lower(trim(payload->>'username')),trim(payload->>'name'),timezone_name);
  insert into private.accounts(id,birth_date) values(uid,dob);
  insert into public.lists(owner_id,name) values(uid,'Close Friends');
 else
  if not exists(select 1 from public.profiles where id=uid) then raise exception 'Finish your profile first.'; end if;
  perform private.limit_action('all',300);
  case action
  when 'save_profile' then
   timezone_name:=payload->>'timezone';
   if not exists(select 1 from pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone.'; end if;
   if nullif(payload->>'featured_activity_id','') is not null and not exists(select 1 from public.activities where id=(payload->>'featured_activity_id')::uuid and owner_id=uid) then raise exception 'Choose your own activity.'; end if;
   update public.profiles set name=trim(payload->>'name'),bio=coalesce(payload->>'bio',''),interests=array(select jsonb_array_elements_text(coalesce(payload->'interests','[]'))),timezone=timezone_name,hide_featured=coalesce((payload->>'hide_featured')::boolean,false),featured_activity_id=nullif(payload->>'featured_activity_id','')::uuid,quiet_start=(payload->>'quiet_start')::int,quiet_end=(payload->>'quiet_end')::int where id=uid;
  when 'friend_request' then
   perform private.limit_action('invitations',20);
   select id into target from public.profiles where username=lower(trim(payload->>'username'));
   if target is not null and target<>uid and not private.blocked(target) then
    insert into public.friendships(sender_id,recipient_id) values(uid,target) on conflict do nothing;
    perform private.notify(target,uid,'You have a friend request.');
   end if;
   -- Generic success also counts unknown usernames toward the invitation rate limit.
   result:=jsonb_build_object('message','If that account can receive requests, your invitation is on its way.');
  when 'accept_friend' then
   update public.friendships set status='accepted' where id=rid and recipient_id=uid and not private.blocked(sender_id);
   if not found then raise exception 'Request no longer available.'; end if;
  when 'remove_friend' then
   delete from public.friendships where (sender_id=uid and recipient_id=target) or (recipient_id=uid and sender_id=target);
   delete from private.location_recipients where user_id=target and session_id in(select id from public.locations where owner_id=uid);
   delete from private.location_recipients where user_id=uid and session_id in(select id from public.locations where owner_id=target);
   delete from public.list_members where (user_id=target and list_id in(select id from public.lists where owner_id=uid)) or (user_id=uid and list_id in(select id from public.lists where owner_id=target));
  when 'create_list' then insert into public.lists(owner_id,name) values(uid,trim(payload->>'name'));
  when 'list_member' then
   if not exists(select 1 from public.lists where id=rid and owner_id=uid) or not private.friends(target) then raise exception 'Choose your own list and an accepted friend.'; end if;
   delete from public.list_members where list_id=rid and user_id=target;
   if (payload->>'add')::boolean then insert into public.list_members values(rid,target); end if;
  when 'create_squad' then
   insert into public.squads(owner_id,name,description) values(uid,trim(payload->>'name'),coalesce(payload->>'description','')) returning id into item;
   insert into public.squad_members values(item,uid,'owner');
  when 'invite_squad' then
   perform private.limit_action('invitations',20);
   if not private.admin(rid) or not private.friends(target) then raise exception 'Only admins can invite accepted friends.'; end if;
   insert into public.squad_invites(squad_id,sender_id,recipient_id) values(rid,uid,target) on conflict do nothing;
   perform private.notify(target,uid,'You have a squad invitation.');
  when 'accept_squad' then
   select squad_id into item from public.squad_invites where id=rid and recipient_id=uid and not private.blocked(sender_id);
   if item is null then raise exception 'Invitation no longer available.'; end if;
   if exists(select 1 from public.squads where id=item and private.blocked(owner_id)) then raise exception 'Invitation no longer available.'; end if;
   insert into public.squad_members values(item,uid,'member') on conflict do nothing;
   delete from public.squad_invites where id=rid;
  when 'remove_member','promote_member' then
   select * into s from public.squads where id=rid;
   if s.owner_id is null or target=s.owner_id or not (s.owner_id=uid or (action='remove_member' and (target=uid or (private.admin(rid) and exists(select 1 from public.squad_members where squad_id=rid and user_id=target and role='member'))))) then raise exception 'You cannot change this member.'; end if;
   if action='remove_member' then
    delete from public.squad_members where squad_id=rid and user_id=target;
    delete from public.rsvps where user_id=target and activity_id in(select id from public.activities where audience='squad' and audience_id=rid);
   else update public.squad_members set role='admin' where squad_id=rid and user_id=target; end if;
  when 'save_goal' then
   perform private.validate_audience(kind,aid);
   if rid is null then insert into public.goals(owner_id,title,description,target_date,audience,audience_id) values(uid,trim(payload->>'title'),coalesce(payload->>'description',''),nullif(payload->>'target_date','')::date,kind,aid);
   else update public.goals set title=trim(payload->>'title'),description=coalesce(payload->>'description',''),target_date=nullif(payload->>'target_date','')::date,progress=coalesce((payload->>'progress')::int,0),audience=kind,audience_id=aid where id=rid and owner_id=uid; if not found then raise exception 'Goal unavailable.'; end if; end if;
  when 'milestone' then
   if not exists(select 1 from public.goals where id=rid and owner_id=uid) then raise exception 'Goal unavailable.'; end if;
   if nullif(payload->>'milestone_id','') is null then insert into public.milestones(goal_id,title) values(rid,trim(payload->>'title'));
   else update public.milestones set done=not done where id=(payload->>'milestone_id')::uuid and goal_id=rid; end if;
  when 'save_habit' then
   perform private.validate_audience(kind,aid);
   if nullif(payload->>'goal_id','') is not null and not exists(select 1 from public.goals where id=(payload->>'goal_id')::uuid and owner_id=uid) then raise exception 'Choose your own goal.'; end if;
   timezone_name:=payload->>'timezone';
   if not exists(select 1 from pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone.'; end if;
   insert into public.habits(owner_id,title,goal_id,schedule,weekdays,weekly_target,timezone,reminder_hour,audience,audience_id) values(uid,trim(payload->>'title'),nullif(payload->>'goal_id','')::uuid,payload->>'schedule',array(select jsonb_array_elements_text(payload->'weekdays')::int),(payload->>'weekly_target')::int,timezone_name,nullif(payload->>'reminder_hour','')::int,kind,aid);
  when 'checkin' then
   select * into h from public.habits where id=rid and owner_id=uid;
   if h.id is null then raise exception 'Habit unavailable.'; end if;
   insert into public.checkins(habit_id,owner_id,local_date) values(rid,uid,(now() at time zone h.timezone)::date) on conflict do nothing;
  when 'create_activity' then
   perform private.validate_audience(kind,aid);
   timezone_name:=payload->>'timezone';
   if not exists(select 1 from pg_timezone_names where name=timezone_name) then raise exception 'Invalid timezone.'; end if;
   if nullif(payload->>'goal_id','') is not null and not exists(select 1 from public.goals where id=(payload->>'goal_id')::uuid and owner_id=uid) then raise exception 'Choose your own goal.'; end if;
   if nullif(payload->>'habit_id','') is not null and not exists(select 1 from public.habits where id=(payload->>'habit_id')::uuid and owner_id=uid) then raise exception 'Choose your own habit.'; end if;
   insert into public.activities(owner_id,title,category,mode,starts_at,ends_at,timezone,approval_required,goal_id,habit_id,audience,audience_id) values(uid,trim(payload->>'title'),payload->>'category',payload->>'mode',(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,timezone_name,coalesce((payload->>'approval_required')::boolean,false),nullif(payload->>'goal_id','')::uuid,nullif(payload->>'habit_id','')::uuid,kind,aid) returning id into item;
   insert into public.places values(item,coalesce(payload->>'label',''),nullif(payload->>'latitude','')::double precision,nullif(payload->>'longitude','')::double precision,nullif(payload->>'online_url',''));
   result:=jsonb_build_object('id',item);
  when 'rsvp' then
   select * into a from public.activities where id=rid for update;
   if not private.can_activity(rid) or a.mode='solo' or a.status<>'scheduled' or a.ends_at<=now() or a.owner_id=uid then raise exception 'This activity is not open for joining.'; end if;
   select * into r from public.rsvps where activity_id=rid and user_id=uid;
   if payload->>'status'='withdraw' then delete from public.rsvps where activity_id=rid and user_id=uid;
   elsif payload->>'status' in ('interested','going') then
    insert into public.rsvps values(rid,uid,case when payload->>'status'='going' and (a.approval_required or a.mode='invite') and not coalesce(r.approved,false) then 'requested' else payload->>'status' end,coalesce(r.approved,false))
    on conflict(activity_id,user_id) do update set status=excluded.status;
    perform private.notify(a.owner_id,uid,'An activity has a new RSVP.',rid);
   else raise exception 'Invalid RSVP.'; end if;
  when 'invite_activity','approve_rsvp','remove_rsvp' then
   select * into a from public.activities where id=rid for update;
   if a.owner_id is distinct from uid or a.mode='solo' or a.status<>'scheduled' then raise exception 'Only the host can manage this activity.'; end if;
   if target=uid then raise exception 'Choose an attendee.'; end if;
   if action='invite_activity' then
    perform private.limit_action('invitations',20);
    if not private.friends(target) then raise exception 'Invite an accepted friend.'; end if;
    delete from private.activity_exclusions where activity_id=rid and user_id=target;
    insert into public.rsvps values(rid,target,'invited',true) on conflict(activity_id,user_id) do update set approved=true;
    perform private.notify(target,uid,'You have an activity invitation.',rid);
   elsif action='approve_rsvp' then
    if private.blocked(target) then raise exception 'Attendee unavailable.'; end if;
    update public.rsvps set approved=true,status='going' where activity_id=rid and user_id=target and status='requested';
    perform private.notify(target,uid,'Your activity request was approved.',rid);
   else
    delete from public.rsvps where activity_id=rid and user_id=target;
    insert into private.activity_exclusions values(rid,target) on conflict do nothing;
   end if;
  when 'activity_status','edit_activity' then
   select * into a from public.activities where id=rid for update;
   if a.owner_id is distinct from uid then raise exception 'Only the host can update this activity.'; end if;
   if action='activity_status' then
    if payload->>'status' not in ('completed','cancelled') then raise exception 'Invalid status.'; end if;
    update public.activities set status=payload->>'status' where id=rid;
   else update public.activities set title=trim(payload->>'title'),starts_at=(payload->>'starts_at')::timestamptz,ends_at=(payload->>'ends_at')::timestamptz where id=rid; end if;
   for recipient in select user_id from public.rsvps where activity_id=rid loop perform private.notify(recipient,uid,'An activity you joined was updated.',rid); end loop;
  when 'comment','react' then
   if not private.can_activity(rid) then raise exception 'Activity unavailable.'; end if;
   perform private.limit_action('comments',60);
   if action='comment' then
    insert into public.comments(activity_id,author_id,body) values(rid,uid,trim(payload->>'body'));
    for recipient in select owner_id from public.activities where id=rid union select user_id from public.rsvps where activity_id=rid loop perform private.notify(recipient,uid,'There is a new activity comment.',rid); end loop;
   else insert into public.reactions values(rid,uid,'🙌') on conflict do nothing; end if;
  when 'start_location' then
   if jsonb_array_length(coalesce(payload->'recipients','[]')) not between 1 and 50 then raise exception 'Select 1 to 50 accepted friends.'; end if;
   expiration:=(payload->>'expires_at')::timestamptz;
   if expiration is null or expiration<=now() or expiration>now()+interval '4 hours' then raise exception 'Choose a sharing duration up to four hours.'; end if;
   for recipient in select jsonb_array_elements_text(payload->'recipients')::uuid loop if not private.friends(recipient) then raise exception 'Location can only be shared with accepted friends.'; end if; end loop;
   delete from public.locations where owner_id=uid;
   insert into public.locations(owner_id,expires_at) values(uid,expiration) returning id into item;
   insert into private.location_recipients select distinct item,value::uuid from jsonb_array_elements_text(payload->'recipients');
   result:=jsonb_build_object('id',item,'expires_at',expiration);
  when 'update_location' then
   update public.locations set latitude=(payload->>'latitude')::double precision,longitude=(payload->>'longitude')::double precision,updated_at=now() where id=rid and owner_id=uid and expires_at>now();
   if not found then raise exception 'Location session expired.'; end if;
  when 'stop_location' then delete from public.locations where owner_id=uid;
  when 'block' then
   if rid=uid or not exists(select 1 from public.profiles where id=rid) then raise exception 'Invalid account.'; end if;
   insert into public.blocks values(uid,rid) on conflict do nothing;
   delete from public.friendships where (sender_id=uid and recipient_id=rid) or (recipient_id=uid and sender_id=rid);
   delete from private.location_recipients where (user_id=rid and session_id in(select id from public.locations where owner_id=uid)) or (user_id=uid and session_id in(select id from public.locations where owner_id=rid));
   delete from public.rsvps where (user_id=rid and activity_id in(select id from public.activities where owner_id=uid)) or (user_id=uid and activity_id in(select id from public.activities where owner_id=rid));
   delete from public.notices where (recipient_id=uid and actor_id=rid) or (recipient_id=rid and actor_id=uid);
  when 'report' then
   perform private.limit_action('reports',10);
   insert into public.reports(reporter_id,subject_id,reason) values(uid,rid,trim(payload->>'reason'));
  when 'moderate_remove_activity' then
   if not private.is_moderator() then raise exception 'Moderator access required.'; end if;
   delete from public.activities where id=rid;
   if not found then raise exception 'No activity matches this report. Account reports require operator review.'; end if;
  when 'resolve_report' then
   if not private.is_moderator() then raise exception 'Moderator access required.'; end if;
   update public.reports set resolved=true where id=rid;
  when 'read_notices' then update public.notices set read_at=now() where recipient_id=uid and read_at is null;
  when 'register_push' then
   if coalesce(payload->>'token','') !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Invalid push token.'; end if;
   insert into public.push_tokens values(payload->>'token',uid) on conflict(token) do update set user_id=uid;
  when 'unregister_push' then delete from public.push_tokens where user_id=uid and token=payload->>'token';
  else raise exception 'Unknown action.';
  end case;
 end if;
 result:=result||jsonb_build_object('event',action,'activity_id',case when action='create_activity' then item when action in ('rsvp','comment','react','activity_status') then rid else null end,'squad_id',case when action='create_squad' then item when action in ('invite_squad','remove_member','promote_member') then rid when action='create_activity' and kind='squad' then aid else null end);
 insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
-- Restrict SECURITY DEFINER helpers to functions used by policies; mutation helpers are never client-callable.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.blocked(uuid),private.friends(uuid),private.member(uuid),private.admin(uuid),private.audience(uuid,public.audience_kind,uuid),private.can_activity(uuid),private.can_place(uuid),private.can_profile(uuid),private.is_moderator(),private.can_location(uuid) to authenticated;

-- Invoker context applies RLS to every table. The client replaces its entire snapshot.
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb;
begin
 foreach t in array array['profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('is_moderator',private.is_moderator());
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

create index activities_owner on public.activities(owner_id);
create index activities_audience on public.activities(audience,audience_id);
create index rsvps_user on public.rsvps(user_id);
create index members_user on public.squad_members(user_id);
create index checkins_habit on public.checkins(habit_id,local_date);
create index comments_activity on public.comments(activity_id);
create index notices_recipient on public.notices(recipient_id,created_at);
create index locations_expiry on public.locations(expires_at);
create index queue_ready on private.push_queue(available_at) where not done;

-- Private avatar objects use user-id/filename; signed URLs are intentionally not used.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,262144,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='avatars' and private.can_profile((storage.foldername(name))[1]::uuid));
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- Publish only generic inbox changes. Clients re-fetch authorized snapshots instead of trusting payloads.
alter publication supabase_realtime add table public.notices;
