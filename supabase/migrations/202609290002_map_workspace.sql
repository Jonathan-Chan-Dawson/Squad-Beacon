-- Four-tab workspace: personal templates, participant chat, and profile details.
alter table public.activities add column available boolean not null default false;
create table public.favorites (owner_id uuid not null references public.profiles on delete cascade, kind text not null check(kind in ('friend','squad')), target_id uuid not null, primary key(owner_id,kind,target_id));
alter table public.favorites enable row level security;
revoke all on public.favorites from public,anon,authenticated;
grant select on public.favorites to authenticated;
create policy own_favorites on public.favorites for select to authenticated using(owner_id=auth.uid());
alter table public.activities add column description text not null default '' check(length(description)<=2000);
alter table public.profiles
 add column home text not null default '' check(length(home)<=120),
 add column birthday_note text not null default '' check(length(birthday_note)<=80),
 add column aspirations text not null default '' check(length(aspirations)<=500),
 add column personality text not null default '' check(length(personality)<=80),
 add column quote text not null default '' check(length(quote)<=300),
 add column default_audience text not null default 'friends' check(default_audience in ('friends','private'));
create table public.templates (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles on delete cascade,
 name text not null check(length(name) between 1 and 80), title text not null check(length(title) between 1 and 120),
 description text not null default '' check(length(description)<=2000), category text not null check(category in ('Fitness','Study','Gaming','Creative','Social','Other')),
 minutes int not null check(minutes between 5 and 1440), label text not null default '' check(length(label)<=160),
 target_count int check(target_count between 2 and 100), approval_required boolean not null default false
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles on delete cascade,
 activity_id uuid references public.activities on delete cascade, recipient_id uuid references public.profiles on delete cascade,
 body text not null check(length(body) between 1 and 2000), created_at timestamptz not null default now(),
 check((activity_id is null)<>(recipient_id is null)), check(recipient_id is distinct from author_id)
);
create index messages_activity_time on public.messages(activity_id,created_at);
create index messages_recipient_time on public.messages(recipient_id,created_at);
create index templates_owner on public.templates(owner_id);
create function private.can_chat(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_activity(aid) and exists(select 1 from public.activities a where a.id=aid and
 (a.owner_id=auth.uid() or exists(select 1 from public.rsvps r where r.activity_id=aid and r.user_id=auth.uid() and r.status='going' and (not a.approval_required and a.mode<>'invite' or r.approved))));
$$;
revoke all on function private.can_chat(uuid) from public,anon;
grant execute on function private.can_chat(uuid) to authenticated;
alter table public.templates enable row level security;
alter table public.messages enable row level security;
revoke all on public.templates,public.messages from public,anon,authenticated;
grant select on public.templates,public.messages to authenticated;
create policy own_templates on public.templates for select to authenticated using(owner_id=auth.uid());
create policy participant_messages on public.messages for select to authenticated using(
 not private.blocked(author_id) and ((activity_id is not null and private.can_chat(activity_id)) or
 (activity_id is null and ((author_id=auth.uid() and private.friends(recipient_id)) or (recipient_id=auth.uid() and private.friends(author_id)))))
);

create or replace function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
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
   update public.profiles set home=coalesce(payload->>'home',''),birthday_note=coalesce(payload->>'birthday_note',''),aspirations=coalesce(payload->>'aspirations',''),personality=coalesce(payload->>'personality',''),quote=coalesce(payload->>'quote',''),default_audience=coalesce(payload->>'default_audience','friends') where id=uid;
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
   update public.activities set available=coalesce((payload->>'available')::boolean,false),description=coalesce(payload->>'description','') where id=item;
   update public.activities set target_count=nullif(payload->>'target_count','')::int where id=item;
   result:=jsonb_build_object('id',item);
  when 'favorite' then
   if payload->>'kind' not in ('friend','squad') then raise exception 'Choose a friend or squad.'; end if;
   if coalesce((payload->>'add')::boolean,false) then
    if payload->>'kind'='friend' and not private.friends(rid) then raise exception 'Choose an accepted friend.'; end if;
    if payload->>'kind'='squad' and not exists(select 1 from public.squad_members where squad_id=rid and user_id=uid) then raise exception 'Choose your squad.'; end if;
    insert into public.favorites values(uid,payload->>'kind',rid) on conflict do nothing;
   else delete from public.favorites where owner_id=uid and kind=payload->>'kind' and target_id=rid; end if;
  when 'save_template' then
   if rid is not null and not exists(select 1 from public.templates where id=rid and owner_id=uid) then raise exception 'Template unavailable.'; end if;
   insert into public.templates(id,owner_id,name,title,description,category,minutes,label,target_count,approval_required)
   values(coalesce(rid,gen_random_uuid()),uid,trim(payload->>'name'),trim(payload->>'title'),coalesce(payload->>'description',''),payload->>'category',(payload->>'minutes')::int,coalesce(payload->>'label',''),nullif(payload->>'target_count','')::int,coalesce((payload->>'approval_required')::boolean,false))
   on conflict(id) do update set name=excluded.name,title=excluded.title,description=excluded.description,category=excluded.category,minutes=excluded.minutes,label=excluded.label,target_count=excluded.target_count,approval_required=excluded.approval_required;
  when 'delete_template' then
   delete from public.templates where id=rid and owner_id=uid;
  when 'send_message' then
   perform private.limit_action('messages',60);
   item:=nullif(payload->>'activity_id','')::uuid;
   target:=nullif(payload->>'recipient_id','')::uuid;
   if (item is null)=(target is null) then raise exception 'Choose a beacon or a friend.'; end if;
   if item is not null and not private.can_chat(item) then raise exception 'Join this beacon before entering its chat.'; end if;
   if target is not null and not private.friends(target) then raise exception 'Connect as friends to message.'; end if;
   insert into public.messages(author_id,activity_id,recipient_id,body) values(uid,item,target,trim(payload->>'body'));
   if target is not null then perform private.notify(target,uid,'You have a new message.'); end if;
  when 'open_status' then
   select * into a from public.activities where id=rid for update;
   if a.id is null or a.owner_id<>uid or a.mode<>'solo' or a.status<>'scheduled' or a.ends_at<=now() then raise exception 'This status cannot be opened.'; end if;
   update public.activities set mode='squad',approval_required=false where id=rid;
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

create or replace function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb;
begin
 foreach t in array array['favorites','templates','messages','profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('is_moderator',private.is_moderator());
end $$;
