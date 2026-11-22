create table private.beacon_score_settings (
  owner_id uuid primary key references public.profiles on delete cascade,
  show_badge boolean not null default false,
  tap_remainder integer not null default 0 check (tap_remainder between 0 and 7)
);
create table private.beacon_score_streams (
  owner_id uuid not null references public.profiles on delete cascade,
  stream_id uuid not null,
  credited bigint not null check (credited >= 0),
  primary key (owner_id, stream_id)
);
create table private.beacon_score_awards (
  id bigint generated always as identity,
  owner_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('tap','legacy','attend','host','joined','friend','comment','message','reaction')),
  source text not null,
  points bigint not null check (points > 0),
  earned_at timestamptz not null default now(),
  primary key (owner_id, kind, source)
);
create index beacon_score_awards_recent on private.beacon_score_awards(owner_id, earned_at desc, id desc);
create table private.beacon_score_launch (
  singleton boolean primary key default true check (singleton),
  launched_at timestamptz not null default now()
);
insert into private.beacon_score_launch default values;
alter table private.beacon_score_settings enable row level security;
alter table private.beacon_score_streams enable row level security;
alter table private.beacon_score_awards enable row level security;
alter table private.beacon_score_launch enable row level security;
revoke all on private.beacon_score_settings, private.beacon_score_streams,
  private.beacon_score_awards, private.beacon_score_launch from public, anon, authenticated;

-- Both existing arrival paths represent a check-in. A Going RSVP by itself does not.
create view private.beacon_score_checkins as
  select activity_id, user_id, updated_at as checked_at
  from public.beacon_attendance where state='present'
  union all
  select activity_id, user_id, checked_in_at
  from private.beacon_attendee_details where checked_in_at is not null;
revoke all on private.beacon_score_checkins from public, anon, authenticated;
create index beacon_score_present_viewer on public.beacon_attendance(user_id, activity_id)
  where state='present';
create index beacon_score_checkin_viewer on private.beacon_attendee_details(user_id, activity_id)
  where checked_in_at is not null;
-- Existing reactions stay undated so enabling score does not award old activity.
alter table public.reactions add column score_created_at timestamptz;
alter table public.reactions alter column score_created_at set default now();
create index beacon_score_comments_activity on public.comments(activity_id,created_at);

-- Each device submits a cumulative total. The stream ID plus its high-water
-- mark makes duplicate, delayed and reordered batches safe without a daily cap.
create function public.sync_beacon_score(
  p_owner uuid, p_stream uuid, p_taps bigint, p_legacy bigint, p_show_badge boolean default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  viewer uuid := auth.uid();
  previous bigint;
  credited bigint;
  launch timestamptz;
  total bigint;
  badge boolean;
  history jsonb;
  remaining bigint;
  tap_points bigint := 0;
  earned bigint;
  rate integer;
  boundary bigint;
  rate_breaks constant bigint[] := array[20,75,250,1000,5000,18000,50000];
  attend_points constant integer := 500;
  host_points constant integer := 500;
  joined_points constant integer := 100;
  friend_points constant integer := 2000;
  comment_points constant integer := 20;
  message_points constant integer := 2;
  reaction_points constant integer := 20;
begin
  if viewer is null or p_owner is distinct from viewer or not exists (
    select 1 from public.profiles where id=viewer
  ) then raise exception 'Sign in to view Beacon Score.'; end if;
  if p_stream is null or p_taps is null or p_taps not between 0 and 9007199254740991
    or p_legacy is null or p_legacy not between 0 and 9007199254740991
  then raise exception 'Invalid tap progress.'; end if;

  insert into private.beacon_score_settings(owner_id) values (viewer) on conflict do nothing;
  select s.show_badge,s.tap_remainder into badge,remaining from private.beacon_score_settings s
    where s.owner_id=viewer for update;
  if p_show_badge is not null then
    update private.beacon_score_settings set show_badge=p_show_badge where owner_id=viewer;
    badge := p_show_badge;
  end if;
  select launched_at into launch from private.beacon_score_launch;
  if p_legacy > 0 then
    insert into private.beacon_score_awards(owner_id,kind,source,points)
      values (viewer,'legacy','initial',p_legacy) on conflict do nothing;
  end if;
  select s.credited into previous from private.beacon_score_streams s
    where s.owner_id=viewer and s.stream_id=p_stream;
  previous := coalesce(previous,0);
  credited := greatest(previous,p_taps);
  if credited > previous then
    insert into private.beacon_score_streams values (viewer,p_stream,credited)
      on conflict (owner_id,stream_id) do update set credited=excluded.credited;
  end if;

  with attended as materialized (
    select distinct a.id, a.owner_id
    from private.beacon_score_checkins c join public.activities a on a.id=c.activity_id
    where c.user_id=viewer and c.checked_at>=launch
      and a.ends_at>=launch and a.ends_at<=now() and a.status<>'cancelled'
      and a.mode in ('squad','invite')
  ), hosted as materialized (
    select a.id from public.activities a
    where a.owner_id=viewer and a.ends_at>=launch and a.ends_at<=now()
      and a.status<>'cancelled' and a.mode in ('squad','invite')
      and exists (select 1 from private.beacon_score_checkins c
        where c.activity_id=a.id and c.user_id<>viewer and c.checked_at>=launch)
  ), friends as (
    select case when f.sender_id=viewer then f.recipient_id else f.sender_id end as other
    from public.friendships f where f.status='accepted'
      and (f.sender_id=viewer or f.recipient_id=viewer)
  )
  insert into private.beacon_score_awards(owner_id,kind,source,points)
    select viewer,'attend',id::text,attend_points from attended where owner_id<>viewer
    union all
    select viewer,'attend',id::text,attend_points from hosted
    union all
    select viewer,'host',id::text,host_points from hosted
    union all
    select viewer,'joined',a.id::text||':'||r.user_id::text,joined_points
      from public.activities a join public.rsvps r on r.activity_id=a.id
      where a.owner_id=viewer and a.ends_at>=launch and a.ends_at<=now()
        and a.status<>'cancelled' and a.mode in ('squad','invite') and r.user_id<>viewer
        and r.status='going' and private.beacon_approved_going(a.id,r.user_id)
    union all
    select viewer,'friend',f.other::text,friend_points from friends f
      where not private.blocked(f.other)
        and exists (select 1 from attended a join private.beacon_score_checkins c
          on c.activity_id=a.id where c.user_id=f.other and c.checked_at>=launch)
    union all
    select viewer,'comment',c.id::text,comment_points
      from public.comments c join public.activities a on a.id=c.activity_id
      where a.owner_id=viewer and c.author_id<>viewer and c.created_at>=launch
        and a.mode in ('squad','invite') and a.status<>'cancelled' and not private.blocked(c.author_id)
    union all
    select viewer,'message',m.id::text,message_points
      from public.messages m join public.activities a on a.id=m.activity_id
      where a.owner_id=viewer and m.author_id<>viewer and m.created_at>=launch
        and a.mode in ('squad','invite') and a.status<>'cancelled' and not private.blocked(m.author_id)
    union all
    select viewer,'reaction',r.activity_id::text||':'||r.user_id::text,reaction_points
      from public.reactions r join public.activities a on a.id=r.activity_id
      where a.owner_id=viewer and r.user_id<>viewer and r.score_created_at>=launch
        and a.mode in ('squad','invite') and a.status<>'cancelled' and not private.blocked(r.user_id)
    on conflict do nothing;

  select coalesce(sum(a.points),0)::bigint into total
    from private.beacon_score_awards a where a.owner_id=viewer;
  remaining := remaining + credited - previous;
  loop
    select min(cutoff),count(*)::integer+1 into boundary,rate
      from unnest(rate_breaks) cutoff where cutoff>total+tap_points;
    earned := remaining/rate;
    if boundary is not null then earned := least(earned,boundary-total-tap_points); end if;
    exit when earned=0;
    tap_points := tap_points+earned;
    remaining := remaining-earned*rate;
  end loop;
  update private.beacon_score_settings set tap_remainder=remaining where owner_id=viewer;
  if tap_points>0 then
    insert into private.beacon_score_awards as a(owner_id,kind,source,points)
      values (viewer,'tap',to_char(now() at time zone 'UTC','YYYY-MM-DD'),tap_points)
      on conflict (owner_id,kind,source) do update
      set points=a.points+excluded.points, earned_at=now();
  end if;
  total := total + tap_points;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.earned_at desc,r.id desc),'[]'::jsonb) into history
    from (select a.id,a.kind,a.points,a.earned_at from private.beacon_score_awards a
      where a.owner_id=viewer order by a.earned_at desc,a.id desc limit 30) r;
  return jsonb_build_object('total',total,'credited',credited,'tap_remainder',remaining,'show_badge',badge,'history',history,
    'rewards',jsonb_build_object('attend',attend_points,'host',host_points,'joined',joined_points,
      'friend',friend_points,'comment',comment_points,'message',message_points,'reaction',reaction_points));
end $$;

create function public.beacon_score_profile_tier(p_person uuid)
returns integer language sql stable security definer set search_path='' as $$
  select case when auth.uid() is not null and private.can_profile(p_person) and exists (
    select 1 from private.beacon_score_settings s where s.owner_id=p_person and s.show_badge
  ) then (
    select (count(*)-1)::integer
    from unnest(array[0,5,10,20,35,50,75,100,150,250,400,650,1000,2000,3500,5000,8000,
      12000,18000,25000,35000,50000,70000,90000,120000,160000,210000,270000,340000,
      420000,520000,640000,750000,850000,925000,975000,1000000,1150000,1300000,1500000,
      1700000,1950000,2200000,2500000,2850000,3250000,3650000,4100000,4550000,5000000]) milestone
    where milestone <= (select coalesce(sum(points),0) from private.beacon_score_awards where owner_id=p_person)
  ) end;
$$;
revoke all on function public.sync_beacon_score(uuid,uuid,bigint,bigint,boolean),
  public.beacon_score_profile_tier(uuid) from public,anon,authenticated;
grant execute on function public.sync_beacon_score(uuid,uuid,bigint,bigint,boolean),
  public.beacon_score_profile_tier(uuid) to authenticated;
