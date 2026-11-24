-- Rewards uses the existing Score awards, wallet, catalog and ownership.
alter table private.beacon_coin_ledger drop constraint beacon_coin_ledger_kind_check;
alter table private.beacon_coin_ledger drop constraint beacon_coin_ledger_check;
alter table private.beacon_coin_ledger drop constraint beacon_coin_ledger_subunits_per_xp_check;
update private.beacon_coin_ledger
set amount=amount*126,subunits_per_xp=subunits_per_xp*126;
alter table private.beacon_coin_ledger add check (
  (kind in ('xp','purchase','refund_reversal') and amount>0) or (kind='tap' and amount>=0) or
  (kind in ('unlock','upgrade','refund') and amount<0)
);
alter table private.beacon_coin_ledger add check (subunits_per_xp in (1260,1890,2520));
alter table private.beacon_coin_policy add column rewards_started_at timestamptz not null default now();
alter table private.beacon_cosmetic_catalog drop constraint beacon_cosmetic_catalog_slot_check;
alter table private.beacon_cosmetic_catalog add check (slot in
  ('skin','beam','frame','card','ring','status','community','profile_set'));
alter table private.beacon_cosmetic_catalog add column min_tier text check (min_tier in ('plus','pro'));
alter table private.beacon_cosmetic_catalog add column milestone_level integer check (milestone_level in (5,10,20));
update private.beacon_cosmetic_catalog set price=price*126;
update private.beacon_cosmetic_catalog c set price=p.coins*12600
from (values ('ember-beam',100),('prism-frame',250),('static-bloom',350),
  ('aurora',500),('celestial',1200),('legendary',3500)) p(id,coins)
where c.id=p.id;
insert into private.beacon_cosmetic_catalog(id,slot,price,min_tier,milestone_level) values
  ('starter-ring','ring',75*12600,null,null),
  ('signal-stamp','status',150*12600,null,null),
  ('lavender-signal','profile_set',500*12600,'plus',null),
  ('community-backdrop','community',650*12600,null,null),
  ('level-five-ring','ring',0,null,5),
  ('level-ten-accent','profile_set',0,null,10),
  ('level-twenty-flair','frame',0,null,20);

create table private.beacon_equipped_looks (
  target_type text not null check(target_type in ('activity','profile','squad','space','organization')),
  target_id uuid not null,
  slot text not null,
  item_id text not null references private.beacon_cosmetic_catalog(id),
  primary key(target_type,target_id,slot)
);
create table private.beacon_reward_clicker (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  stage integer not null default 1 check(stage between 1 and 8),
  week_start date not null,
  taps integer not null default 0 check(taps between 0 and 500),
  tokens numeric not null default 12 check(tokens between 0 and 12),
  checked_at timestamptz not null default clock_timestamp()
);
alter table private.beacon_equipped_looks enable row level security;
alter table private.beacon_reward_clicker enable row level security;
revoke all on private.beacon_equipped_looks,private.beacon_reward_clicker from public,anon,authenticated;

alter table private.beacon_score_awards drop constraint beacon_score_awards_kind_check;
alter table private.beacon_score_awards add check (kind in (
  'tap','legacy','attend','host','joined','friend','comment','message','reaction',
  'activity_note','status_note','note_reaction','welcome_setup','welcome_map','welcome_people','welcome_move',
  'welcome_finish','map_discovery','publish','ping_response','decision','weekly_spark'
));
alter table private.beacon_score_awards add column reward_event_at timestamptz;
create index beacon_rewards_kind_recent on private.beacon_score_awards(owner_id,kind,earned_at);
create index beacon_rewards_decision_source on private.beacon_score_awards(source,reward_event_at)
  where kind='decision';

-- Keep previous verified grant windows available when a delayed reward settles.
create table private.beacon_reward_tier_history (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  tier text not null check(tier in ('plus','pro')),
  primary key(owner_id,starts_at,tier),
  check(ends_at>starts_at)
);
alter table private.beacon_reward_tier_history enable row level security;
revoke all on private.beacon_reward_tier_history from public,anon,authenticated;
create function private.archive_beacon_reward_tier() returns trigger
language plpgsql security definer set search_path='' as $$
declare stopped timestamptz;
begin
  if tg_op='UPDATE' and (old.tier,old.verified_at) is not distinct from (new.tier,new.verified_at) then return null; end if;
  stopped:=least(old.valid_until,old.revoked_at,now());
  if tg_op='UPDATE' and new.verified_at>old.verified_at then stopped:=least(stopped,new.verified_at); end if;
  if stopped>old.verified_at and exists(select 1 from public.profiles p where p.id=old.owner_id) then
    insert into private.beacon_reward_tier_history(owner_id,starts_at,ends_at,tier)
      values(old.owner_id,old.verified_at,stopped,old.tier) on conflict do nothing;
  end if;
  return null;
end $$;
revoke all on function private.archive_beacon_reward_tier() from public,anon,authenticated;
create trigger beacon_rewards_archive_tier after update or delete on private.premium_grants
for each row execute function private.archive_beacon_reward_tier();

alter table public.plan_stops add column reward_linked_at timestamptz;
alter table public.planning_threads add column reward_linked_at timestamptz;
create index beacon_rewards_plan_link_time on public.plan_stops(reward_linked_at) where reward_linked_at is not null;
create index beacon_rewards_decision_link_time on public.planning_threads(reward_linked_at) where reward_linked_at is not null;
create function private.track_beacon_reward_link() returns trigger
language plpgsql set search_path='' as $$
declare column_name text:=tg_argv[0];
begin
  if tg_op='INSERT' then
    new.reward_linked_at:=case when to_jsonb(new)->>column_name is not null then now() end;
  elsif (to_jsonb(new)->>column_name) is distinct from (to_jsonb(old)->>column_name) then
    new.reward_linked_at:=case when to_jsonb(new)->>column_name is not null then now() end;
  else
    new.reward_linked_at:=old.reward_linked_at;
  end if;
  return new;
end $$;
revoke all on function private.track_beacon_reward_link() from public,anon,authenticated;
create trigger beacon_rewards_plan_link before insert or update on public.plan_stops
for each row execute function private.track_beacon_reward_link('activity_id');
create trigger beacon_rewards_decision_link before insert or update on public.planning_threads
for each row execute function private.track_beacon_reward_link('materialized_activity_id');

create function private.beacon_rewards_week(moment timestamptz) returns date
language sql immutable set search_path='' as $$
  select date_trunc('week',moment at time zone 'UTC')::date
$$;

create function private.beacon_reward_level(xp bigint) returns integer
language sql immutable set search_path='' as $$
  select floor((sqrt(160000::numeric+400::numeric*greatest(xp,0))-400)/200)::integer+1
$$;

create function private.beacon_reward_award(owner uuid, award_kind text, award_source text, xp integer, moment timestamptz)
returns void language sql set search_path='' as $$
  insert into private.beacon_score_awards(owner_id,kind,source,points,reward_event_at)
  values (owner,award_kind,award_source,xp,moment) on conflict do nothing
$$;

create function private.beacon_reward_spark(owner uuid, moment timestamptz)
returns void language plpgsql set search_path='' as $$
begin
  if moment >= (select rewards_started_at from private.beacon_coin_policy)
     and moment <= now() then
    perform private.beacon_reward_award(owner,'weekly_spark',private.beacon_rewards_week(moment)::text,300,moment);
  end if;
end $$;

create function private.beacon_adjust_score_award() returns trigger
language plpgsql set search_path='' as $$
declare already_awarded bigint; ended timestamptz;
begin
  if new.kind in ('attend','host') then
    select a.ends_at into ended from public.activities a where a.id=new.source::uuid;
    new.reward_event_at:=ended;
    if ended >= (select rewards_started_at from private.beacon_coin_policy)
      and not exists (
        select 1 from private.beacon_score_awards a
        where a.owner_id=new.owner_id and a.kind=new.kind
        and (new.kind='host' or not exists (
          select 1 from public.activities beacon where beacon.id::text=a.source and beacon.owner_id=new.owner_id
        ))
      )
      and (new.kind='host' or not exists(
        select 1 from public.activities a where a.id=new.source::uuid and a.owner_id=new.owner_id
      ))
    then new.points:=new.points*2; end if;
  elsif new.kind in ('comment','message','reaction','note_reaction') then
    perform pg_advisory_xact_lock(hashtextextended('beacon-rewards-xp:'||new.owner_id::text,0));
    new.reward_event_at:=case new.kind
      when 'comment' then (select c.created_at from public.comments c where c.id::text=new.source)
      when 'message' then (select m.created_at from public.messages m where m.id::text=new.source)
      else (select r.score_created_at from public.reactions r
        where r.activity_id::text||':'||r.user_id::text=new.source)
    end;
    if new.reward_event_at is null then return null; end if;
    select coalesce(sum(a.points),0) into already_awarded
      from private.beacon_score_awards a where a.owner_id=new.owner_id
      and a.kind in ('comment','message','reaction','note_reaction')
      and (coalesce(a.reward_event_at,a.earned_at) at time zone 'UTC')::date =
        (new.reward_event_at at time zone 'UTC')::date;
    new.points:=least(new.points,greatest(100-already_awarded,0));
    if new.points=0 then return null; end if;
  end if;
  return new;
end $$;
create trigger beacon_rewards_adjust_award before insert on private.beacon_score_awards
for each row execute function private.beacon_adjust_score_award();

drop trigger beacon_score_coin_conversion on private.beacon_score_awards;
create or replace function private.credit_beacon_coins() returns trigger
language plpgsql security definer set search_path='' as $$
declare rate integer; moment timestamptz:=new.reward_event_at; cutoff timestamptz;
begin
  if new.kind not in ('attend','host','friend','welcome_setup','welcome_map','welcome_people',
    'welcome_move','welcome_finish','ping_response','decision','weekly_spark') then return null; end if;
  select rewards_started_at into cutoff from private.beacon_coin_policy;
  if new.kind='friend' and moment is null then
    select min(a.ends_at) into moment
    from private.beacon_score_checkins own_check
    join private.beacon_score_checkins other_check on other_check.activity_id=own_check.activity_id
    join public.activities a on a.id=own_check.activity_id
    where own_check.user_id=new.owner_id and other_check.user_id=new.source::uuid
      and a.ends_at<=now() and a.status<>'cancelled' and a.mode in ('squad','invite');
  end if;
  if moment is null or moment>now() or moment<cutoff then return null; end if;
  select case windows.tier when 'pro' then 2520 when 'plus' then 1890 end into rate from (
    select g.tier,g.verified_at as starts_at from private.premium_grants g
      where g.owner_id=new.owner_id and g.verified_at<=moment
        and (g.valid_until is null or g.valid_until>moment) and (g.revoked_at is null or g.revoked_at>moment)
    union all
    select h.tier,h.starts_at from private.beacon_reward_tier_history h
      where h.owner_id=new.owner_id and h.starts_at<=moment and h.ends_at>moment
  ) windows order by windows.starts_at desc limit 1;
  rate:=coalesce(rate,1260);
  insert into private.beacon_coin_ledger(owner_id,kind,source,amount,subunits_per_xp)
    values (new.owner_id,'xp',new.id::text,new.points*rate,rate) on conflict do nothing;
  if new.kind in ('attend','host') then perform private.beacon_reward_spark(new.owner_id,moment); end if;
  if new.kind in ('welcome_setup','welcome_map','welcome_people','welcome_move') and (
    select count(*) from private.beacon_score_awards a where a.owner_id=new.owner_id
    and a.kind in ('welcome_setup','welcome_map','welcome_people','welcome_move')
  )=4 then perform private.beacon_reward_award(new.owner_id,'welcome_finish','first',200,now()); end if;
  return null;
end $$;
create trigger beacon_score_coin_conversion after insert on private.beacon_score_awards
for each row execute function private.credit_beacon_coins();

create or replace function private.award_published_note_score()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into private.beacon_score_awards(owner_id,kind,source,points)
    select a.owner_id,a.solo_purpose,private.beacon_rewards_week(now())::text,250
    from public.activities a where a.id=new.id and a.owner_id=auth.uid()
      and a.mode='solo' and a.status='scheduled'
      and not exists (select 1 from private.beacon_score_awards s where s.owner_id=a.owner_id
        and s.kind=a.solo_purpose and private.beacon_rewards_week(s.earned_at)=private.beacon_rewards_week(now()))
    on conflict do nothing;
  return null;
end $$;

alter function public.sync_beacon_score(uuid,uuid,bigint,bigint,boolean) rename to sync_beacon_score_before_rewards;
revoke all on function public.sync_beacon_score_before_rewards(uuid,uuid,bigint,bigint,boolean) from public,anon,authenticated;
create function public.sync_beacon_score(p_owner uuid,p_stream uuid,p_taps bigint,p_legacy bigint,p_show_badge boolean default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare highwater bigint;
begin
  if auth.uid() is distinct from p_owner or p_owner is null or p_stream is null then
    raise exception 'Sign in to view Beacon Score.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('beacon-rewards-xp:'||p_owner::text,0));
  select coalesce(max(s.credited),0) into highwater from private.beacon_score_streams s
    where s.owner_id=p_owner and s.stream_id=p_stream;
  return public.sync_beacon_score_before_rewards(p_owner,p_stream,highwater,0,p_show_badge)
    || jsonb_build_object('credited',highwater,'tap_remainder',0);
end $$;
revoke all on function public.sync_beacon_score(uuid,uuid,bigint,bigint,boolean) from public,anon;
grant execute on function public.sync_beacon_score(uuid,uuid,bigint,bigint,boolean) to authenticated;

create or replace function public.beacon_score_profile_tier(p_person uuid)
returns integer language sql stable security definer set search_path='' as $$
  select case when auth.uid() is not null and private.can_profile(p_person) and exists (
    select 1 from private.beacon_score_settings s where s.owner_id=p_person and s.show_badge
  ) then private.beacon_reward_level(coalesce((
    select sum(a.points)::bigint from private.beacon_score_awards a where a.owner_id=p_person
  ),0))-1 end
$$;
create function private.beacon_rewards_first_move(owner uuid, source_id uuid, moment timestamptz)
returns void language plpgsql set search_path='' as $$
begin
  if not exists (select 1 from private.beacon_score_awards a where a.owner_id=owner and a.kind='welcome_move') then
    perform private.beacon_reward_award(owner,'welcome_move','first',400,moment);

  elsif not exists (select 1 from private.beacon_score_awards a where a.owner_id=owner and a.kind='welcome_move' and (a.earned_at at time zone 'UTC')::date=(moment at time zone 'UTC')::date) then
    perform private.beacon_reward_award(owner,'publish','day:'||(moment at time zone 'UTC')::date,200,moment);
  end if;
end $$;

create function private.beacon_reward_publish() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); moment timestamptz:=now();
begin
  if actor is null or actor is distinct from new.owner_id then return null; end if;
  if tg_table_name='activities' then
    if not exists(select 1 from public.activities a where a.id=new.id and a.mode<>'solo' and a.status<>'cancelled')
    then return null; end if;
  elsif tg_table_name='planning_threads' then
    if not exists(select 1 from public.planning_threads t where t.id=new.id and t.kind='ping' and t.status='open')
    then return null; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('beacon-rewards-xp:'||actor::text,0));
  perform private.beacon_rewards_first_move(actor,new.id,moment);
  return null;
end $$;
create constraint trigger beacon_rewards_publish_activity after insert on public.activities
deferrable initially deferred for each row execute function private.beacon_reward_publish();
create constraint trigger beacon_rewards_publish_plan after insert on public.plans
deferrable initially deferred for each row execute function private.beacon_reward_publish();
create constraint trigger beacon_rewards_publish_ping after insert on public.planning_threads
deferrable initially deferred for each row execute function private.beacon_reward_publish();

create function private.beacon_reward_presence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.owner_id=auth.uid() and new.availability is not null then
    perform pg_advisory_xact_lock(hashtextextended('beacon-rewards-xp:'||new.owner_id::text,0));
    perform private.beacon_reward_award(new.owner_id,'welcome_setup','first',150,now());
  end if;
  return null;
end $$;
create trigger beacon_rewards_presence after insert or update of availability on private.presence_config
for each row execute function private.beacon_reward_presence();

create function private.beacon_reward_status_note() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.owner_id=auth.uid() and exists (select 1 from public.activities a
      where a.id=new.id and a.mode='solo' and a.solo_purpose='status_note' and a.status='scheduled') then
    perform pg_advisory_xact_lock(hashtextextended('beacon-rewards-xp:'||new.owner_id::text,0));
    perform private.beacon_reward_award(new.owner_id,'welcome_setup','first',150,now());
  end if;
  return null;
end $$;
create constraint trigger beacon_rewards_status_note after insert on public.activities
deferrable initially deferred for each row when (new.mode='solo')
execute function private.beacon_reward_status_note();

create function private.beacon_reward_planning_response() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); thread public.planning_threads;
  award_kind text; moment timestamptz:=now(); xp integer;
begin
  if actor is null or new.user_id is distinct from actor then return null; end if;
  select * into thread from public.planning_threads t where t.id=new.thread_id;
  if thread.owner_id is null or thread.owner_id=actor or thread.status<>'open'
     or actor=any(thread.coowner_ids) then return null; end if;
  if tg_table_name='planning_ping_responses' then
    if thread.kind<>'ping' or new.response<>'interested' then return null; end if;
    award_kind:='ping_response';
  else
    if thread.kind<>'vote' then return null; end if;
    award_kind:='decision';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('beacon-rewards-xp:'||actor::text,0));
  if (select count(*) from private.beacon_score_awards a where a.owner_id=actor and a.kind=award_kind
      and (a.reward_event_at at time zone 'UTC')::date=(moment at time zone 'UTC')::date)>=3 then
    return null;
  end if;
  xp:=case when exists (select 1 from private.beacon_score_awards a
    where a.owner_id=actor and a.kind=award_kind) then 50 else 150 end;
  perform private.beacon_reward_award(actor,award_kind,new.thread_id::text,xp,moment);
  return null;
end $$;
create trigger beacon_rewards_ping_response after insert or update on public.planning_ping_responses
for each row execute function private.beacon_reward_planning_response();
create trigger beacon_rewards_vote after insert or update on public.planning_votes
for each row execute function private.beacon_reward_planning_response();
create trigger beacon_rewards_ballot after insert or update on public.planning_approval_ballots
for each row execute function private.beacon_reward_planning_response();

create function private.beacon_rewards_checkpoint(viewer uuid, action text, entity uuid)
returns void language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('beacon-rewards-xp:'||viewer::text,0));
  if action='people' and entity is null then
    perform private.beacon_reward_award(viewer,'welcome_people','first',150,now());
  elsif action='map' and (entity is null or private.can_activity(entity)) then
    if not exists (select 1 from private.beacon_score_awards a where a.owner_id=viewer and a.kind='welcome_map') then
      perform private.beacon_reward_award(viewer,'welcome_map','first',300,now());
    elsif entity is not null and not exists (
      select 1 from private.beacon_score_awards a
      where a.owner_id=viewer and a.kind='map_discovery'
        and private.beacon_rewards_week(a.earned_at)=private.beacon_rewards_week(now())
    ) then
      perform private.beacon_reward_award(viewer,'map_discovery',entity::text,100,now());
    end if;
  else
    raise exception 'This discovery is unavailable.';
  end if;
end $$;

create function private.beacon_rewards_settle(viewer uuid) returns void
language plpgsql set search_path='' as $$
declare source_id uuid; moment timestamptz; cutoff timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('beacon-rewards-xp:'||viewer::text,0));
  if exists(select 1 from private.presence_config p where p.owner_id=viewer and p.availability is not null)
     or exists(select 1 from public.activities a where a.owner_id=viewer and a.mode='solo' and a.solo_purpose='status_note') then
    perform private.beacon_reward_award(viewer,'welcome_setup','first',150,now());
  end if;

  if not exists(select 1 from private.beacon_score_awards a where a.owner_id=viewer and a.kind='welcome_move') then
    select id into source_id from (
      select p.id from public.plans p where p.owner_id=viewer and p.status<>'cancelled'
      union all select t.id from public.planning_threads t where t.owner_id=viewer and t.kind='ping' and t.status<>'cancelled'
      union all select a.id from public.activities a where a.owner_id=viewer and a.mode<>'solo' and a.status<>'cancelled'
    ) previous limit 1;
    if source_id is not null then perform private.beacon_reward_award(viewer,'welcome_move','first',400,now()); end if;
  end if;

  select greatest(rewards_started_at,private.beacon_rewards_week(now())::timestamp at time zone 'UTC')
    into cutoff from private.beacon_coin_policy;
  select min(a.ends_at) into moment
  from public.planning_threads t join public.activities a on a.id=t.materialized_activity_id
  where t.kind='ping' and a.ends_at>=cutoff
    and a.ends_at<=now() and a.status<>'cancelled' and a.mode<>'solo'
    and exists(select 1 from private.beacon_score_checkins c where c.activity_id=a.id and c.user_id<>a.owner_id)
    and exists(select 1 from public.planning_ping_responses r
      where r.thread_id=t.id and r.user_id=viewer and r.response='interested');
  if moment is not null then perform private.beacon_reward_spark(viewer,moment); end if;

  select min(t.reward_linked_at) into moment
    from public.planning_threads t join public.activities a on a.id=t.materialized_activity_id
    where t.kind='vote' and t.reward_linked_at>=cutoff and a.status<>'cancelled' and a.mode<>'solo'
      and exists (select 1 from private.beacon_score_awards r where r.kind='decision'
        and r.source=t.id::text and r.owner_id<>t.owner_id and r.reward_event_at<=t.reward_linked_at
        and (t.owner_id=viewer or r.owner_id=viewer));
  if moment is not null then perform private.beacon_reward_spark(viewer,moment); end if;

  select min(s.reward_linked_at) into moment
    from public.plan_stops s join public.plans p on p.id=s.plan_id
    join public.activities a on a.id=s.activity_id
    where s.reward_linked_at>=cutoff and s.approval='approved' and s.state='active'
      and p.status<>'cancelled' and a.status<>'cancelled' and a.mode<>'solo'
      and exists(select 1 from public.plan_stops contribution where contribution.plan_id=p.id
        and contribution.author_id<>p.owner_id and contribution.approval='approved'
        and contribution.state='active' and contribution.created_at<=s.reward_linked_at
        and (viewer=p.owner_id or viewer=contribution.author_id or viewer=s.author_id));
  if moment is not null then perform private.beacon_reward_spark(viewer,moment); end if;
end $$;

revoke all on function private.beacon_rewards_week(timestamptz),private.beacon_reward_level(bigint),
  private.beacon_reward_award(uuid,text,text,integer,timestamptz),private.beacon_reward_spark(uuid,timestamptz),
  private.beacon_reward_publish(),private.beacon_reward_presence(),private.beacon_reward_status_note(),
  private.beacon_reward_planning_response(),private.beacon_rewards_checkpoint(uuid,text,uuid),
  private.beacon_rewards_settle(uuid),private.beacon_rewards_first_move(uuid,uuid,timestamptz),
  private.beacon_adjust_score_award() from public,anon,authenticated;

create function private.beacon_rewards_equip(viewer uuid, target_type text, target_id uuid, target_slot text, item text)
returns void language plpgsql set search_path='' as $$
declare catalog private.beacon_cosmetic_catalog; authorized boolean;
begin
  authorized:=case target_type
    when 'profile' then viewer=target_id
    when 'activity' then exists(select 1 from public.activities a where a.id=target_id and a.owner_id=viewer and a.mode<>'solo')
    when 'squad' then private.social_active('squad',target_id,viewer)
      and private.social_role('squad',target_id,viewer) in ('owner','coowner','admin')
    when 'space' then private.social_parent_can_manage('space',target_id,null)
    when 'organization' then private.social_parent_can_manage('organization',target_id,null)
    else false end;
  if not coalesce(authorized,false) then raise exception 'You cannot change this appearance.'; end if;
  if not coalesce(case target_type
    when 'profile' then target_slot in ('ring','profile','profile_card','status')
    when 'activity' then target_slot in ('skin','beam','frame','card')
    else target_slot='community' end,false) then raise exception 'This appearance slot is unavailable.'; end if;
  if item is null or item='classic' then
    delete from private.beacon_equipped_looks e
    where e.target_type=beacon_rewards_equip.target_type and e.target_id=beacon_rewards_equip.target_id and e.slot=target_slot;
    return;
  end if;
  select * into catalog from private.beacon_cosmetic_catalog c where c.id=item;
  if not found or not exists(select 1 from private.beacon_cosmetic_ownership o where o.owner_id=viewer and o.item_id=item)
     or not (catalog.slot=target_slot or (catalog.slot='profile_set' and target_slot in ('profile','profile_card','status'))) then
    raise exception 'Unlock a compatible look first.';
  end if;
  insert into private.beacon_equipped_looks as equipped(target_type,target_id,slot,item_id)
  values (target_type,target_id,target_slot,item)
  on conflict on constraint beacon_equipped_looks_pkey do update set item_id=excluded.item_id;
end $$;

create function private.beacon_rewards_profile_ok(viewer uuid) returns boolean
language sql stable set search_path='' as $$
  select coalesce(auth.uid()=viewer,false)
    and exists(select 1 from public.profiles p where p.id=viewer)
    and not exists(select 1 from private.guest_identities g where g.user_id=viewer and g.claimed_at is null)
$$;

create function private.beacon_rewards_api(viewer uuid, operation text, args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  cost bigint; available bigint; xp bigint; level_number integer; enabled boolean;
  item text:=args->>'item'; request_id text; entry private.beacon_cosmetic_catalog;
  moment timestamptz:=clock_timestamp(); week date:=private.beacon_rewards_week(moment);
  tap_state private.beacon_reward_clicker; delta integer; accepted integer; refreshed numeric;
  tap_rates constant integer[]:=array[10,9,8,7,5,3,2,1];
  upgrade_costs constant integer[]:=array[100,180,300,500,850,1400,2200];
  tier text; target uuid; target_kind text;
begin
  if not private.beacon_rewards_profile_ok(viewer) then raise exception 'Sign in to use Rewards.'; end if;
  if operation not in ('view','unlock','upgrade','tap','equip','checkpoint') or operation is null
     or jsonb_typeof(args) is distinct from 'object' then raise exception 'Unknown Rewards action.'; end if;
  if operation='view' then
    perform public.sync_beacon_score(viewer, '00000000-0000-0000-0000-000000000001'::uuid,0,0,null);
    perform private.beacon_rewards_settle(viewer);
  elsif operation='checkpoint' then
    perform private.beacon_rewards_checkpoint(viewer,args->>'action',nullif(args->>'entity','')::uuid);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('beacon-shop:'||viewer::text,0));
  select purchases_enabled into enabled from private.beacon_coin_policy;
  select coalesce(sum(a.points),0)::bigint into xp from private.beacon_score_awards a where a.owner_id=viewer;
  level_number:=private.beacon_reward_level(xp);
  tier:=private.premium_tier(viewer);
  insert into private.beacon_cosmetic_ownership(owner_id,item_id)
    select viewer,c.id from private.beacon_cosmetic_catalog c where c.milestone_level<=level_number
    on conflict do nothing;

  insert into private.beacon_reward_clicker(owner_id,week_start) values(viewer,week) on conflict do nothing;
  select * into tap_state from private.beacon_reward_clicker c where c.owner_id=viewer;
  if tap_state.week_start<week then
    update private.beacon_reward_clicker set week_start=week,taps=0,tokens=12,checked_at=moment
      where owner_id=viewer returning * into tap_state;
  end if;
  select coalesce(sum(l.amount),0)::bigint into available from private.beacon_coin_ledger l where l.owner_id=viewer;

  if operation='tap' then
    request_id:=week::text||':'||(args->>'request_id')::uuid::text;
    delta:=(args->>'taps')::integer;
    if request_id is null or delta is null or delta not between 1 and 12
      or (args->>'week')::date is distinct from week then raise exception 'Refresh Mini Beacon and try again.'; end if;
    if not exists(select 1 from private.beacon_coin_ledger l
        where l.owner_id=viewer and l.kind='tap' and l.source=request_id) then
      refreshed:=least(12,tap_state.tokens+greatest(0,extract(epoch from moment-tap_state.checked_at))*6);
      accepted:=least(delta,500-tap_state.taps,floor(refreshed)::integer);
      cost:=accepted*(12600/tap_rates[tap_state.stage]);
      if accepted>0 then
        update private.beacon_reward_clicker set taps=taps+accepted,tokens=refreshed-accepted,checked_at=moment
          where owner_id=viewer returning * into tap_state;
      end if;
      insert into private.beacon_coin_ledger(owner_id,kind,source,amount) values(viewer,'tap',request_id,cost);
      available:=available+cost;
    end if;
  elsif operation='unlock' then
    select * into entry from private.beacon_cosmetic_catalog c where c.id=item and c.available;
    if not found then raise exception 'This look is unavailable.'; end if;
    if not exists(select 1 from private.beacon_cosmetic_ownership o where o.owner_id=viewer and o.item_id=item)
        and item<>'classic' then
      if entry.milestone_level is not null then raise exception 'Reach the level to earn this look.'; end if;
      if not enabled then raise exception 'Coin unlocks are currently in preview.'; end if;
      if entry.min_tier='plus' and tier='free' or entry.min_tier='pro' and tier<>'pro' then
        raise exception 'This look requires BEACON+.';
      end if;
      cost:=entry.price;
      if cost is distinct from (args->>'expected_price')::bigint then raise exception 'The price changed. Refresh the shop.'; end if;
      if available<cost then raise exception 'You need more Coins for this look.'; end if;
      if cost>0 then
        insert into private.beacon_coin_ledger(owner_id,kind,source,amount) values(viewer,'unlock',item,-cost);
      end if;
      insert into private.beacon_cosmetic_ownership(owner_id,item_id) values(viewer,item);
      available:=available-cost;
    end if;
  elsif operation='upgrade' then
    request_id:=(args->>'stage')::integer::text;
    if (args->>'stage')::integer is distinct from tap_state.stage+1 then
      if not exists (select 1 from private.beacon_coin_ledger l where l.owner_id=viewer and l.kind='upgrade' and l.source=request_id)
      then raise exception 'Refresh Mini Beacon to see the current upgrade.'; end if;
    else
      if not enabled or tap_state.stage>=8 then raise exception 'This upgrade is unavailable.'; end if;
      cost:=upgrade_costs[tap_state.stage]*12600;
      if cost is distinct from (args->>'expected_price')::bigint then raise exception 'The price changed. Refresh the shop.'; end if;
      if available<cost then raise exception 'You need more Coins for this upgrade.'; end if;
      insert into private.beacon_coin_ledger(owner_id,kind,source,amount) values(viewer,'upgrade',request_id,-cost);
      update private.beacon_reward_clicker set stage=stage+1 where owner_id=viewer returning * into tap_state;
      available:=available-cost;
    end if;
  elsif operation='equip' then
    perform private.beacon_rewards_equip(viewer,args->>'target_type',(args->>'target_id')::uuid,args->>'slot',item);
  end if;
  target:=coalesce(nullif(args->>'target_id','')::uuid,viewer);
  target_kind:=coalesce(args->>'target_type','profile');
  if not private.beacon_reward_look_visible(target_kind,target) then target:=null; end if;

  return jsonb_build_object(
    'coin_scale',12600,'balance',available,'xp',xp,'level',level_number,'tier',tier,'purchases_enabled',enabled,
    'clicker',jsonb_build_object('stage',tap_state.stage,'week',week,'remaining',500-tap_state.taps,
      'taps_per_coin',tap_rates[tap_state.stage],'next_price',upgrade_costs[tap_state.stage]*12600,
      'next_rate',tap_rates[tap_state.stage+1],
      'charge',(select coalesce(sum(l.amount),0)::bigint%12600 from private.beacon_coin_ledger l
        where l.owner_id=viewer and l.kind='tap'),
      'reset_at',(week+7)::timestamp at time zone 'UTC'),
    'catalog',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slot',c.slot,'price',c.price,
      'min_tier',c.min_tier,'milestone_level',c.milestone_level,'owned',c.id='classic' or exists(
        select 1 from private.beacon_cosmetic_ownership o where o.owner_id=viewer and o.item_id=c.id))
      order by c.price,c.id),'[]'::jsonb) from private.beacon_cosmetic_catalog c where c.available),
    'equipped',(select coalesce(jsonb_object_agg(e.slot,e.item_id),'{}'::jsonb)
      from private.beacon_equipped_looks e where e.target_type=target_kind and e.target_id=target),
    'welcome',(select coalesce(jsonb_agg(a.kind),'[]'::jsonb) from private.beacon_score_awards a
      where a.owner_id=viewer and a.kind in ('welcome_setup','welcome_map','welcome_people','welcome_move','welcome_finish')),
    'spark_done',exists(select 1 from private.beacon_score_awards a where a.owner_id=viewer
      and a.kind='weekly_spark' and a.source=week::text),
    'firsts',(select coalesce(jsonb_object_agg(f.kind,f.points),'{}'::jsonb) from (
      select distinct on (a.kind) a.kind,a.points + case when a.kind='host' then coalesce((
        select companion.points from private.beacon_score_awards companion
        where companion.owner_id=viewer and companion.kind='attend' and companion.source=a.source
      ),0) else 0 end as points from private.beacon_score_awards a
      where a.owner_id=viewer and a.kind in ('ping_response','decision','attend','host','welcome_map','welcome_move')
        and a.reward_event_at is not null and a.points>case a.kind
          when 'ping_response' then 50 when 'decision' then 50
          when 'welcome_map' then 100 when 'welcome_move' then 200 else 500 end
      order by a.kind,a.earned_at,a.id
    ) f),
    'history',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc,l.kind,l.source),'[]'::jsonb)
      from (select kind,source,amount,created_at from private.beacon_coin_ledger l where l.owner_id=viewer and l.amount<>0
        order by l.created_at desc,l.kind,l.source limit 20) l));
end $$;

create function private.beacon_reward_look_visible(kind text, id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and case kind
    when 'activity' then private.can_activity(id)
    when 'profile' then private.can_profile(id)
    when 'squad' then private.readable_social_entity(kind,id)
    when 'space' then private.readable_social_entity(kind,id)
    when 'organization' then private.readable_social_entity(kind,id)
    else false end
$$;

create function public.beacon_rewards(p_viewer uuid,p_action text default 'view',p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.beacon_rewards_api(p_viewer,p_action,p_args)
$$;
revoke all on function private.beacon_rewards_equip(uuid,text,uuid,text,text),private.beacon_rewards_profile_ok(uuid),
  private.beacon_reward_look_visible(text,uuid) from public,anon,authenticated;
revoke all on function private.beacon_rewards_api(uuid,text,jsonb),public.beacon_rewards(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.beacon_rewards_api(uuid,text,jsonb),public.beacon_rewards(uuid,text,jsonb) to authenticated;

-- Preserve the previous RPC unit contract for older clients.
create or replace function public.beacon_shop(p_viewer uuid,p_unlock text default null,p_expected_price bigint default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  result:=public.beacon_rewards(p_viewer,case when p_unlock is null then 'view' else 'unlock' end,
    jsonb_build_object('item',p_unlock,'expected_price',p_expected_price*126));
  return result||jsonb_build_object(
    'balance',(result->>'balance')::bigint/126,
    'catalog',(select coalesce(jsonb_agg(c.value||jsonb_build_object('price',(c.value->>'price')::bigint/126)),'[]'::jsonb)
      from jsonb_array_elements(result->'catalog') c),
    'history',(select coalesce(jsonb_agg(h.value||jsonb_build_object('amount',(h.value->>'amount')::bigint/126)),'[]'::jsonb)
      from jsonb_array_elements(result->'history') h)
  );
end $$;

create function private.beacon_rewards_look_snapshot(payload jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(t.id,t.slots),'{}'::jsonb) from (
    select e.target_id::text id,jsonb_object_agg(e.slot,e.item_id) slots
    from private.beacon_equipped_looks e join (values ('activity','activities'),('profile','profiles'),
      ('squad','squads'),('organization','organizations'),('space','spaces')) k(kind,key) on k.kind=e.target_type
    where private.beacon_reward_look_visible(e.target_type,e.target_id)
      and exists(select 1 from jsonb_array_elements(coalesce(payload->k.key,'[]'::jsonb)) obj
        where obj->>'id'=e.target_id::text)
    group by e.target_id
  ) t
$$;
revoke all on function private.beacon_rewards_look_snapshot(jsonb) from public,anon,authenticated;
grant execute on function private.beacon_rewards_look_snapshot(jsonb) to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_rewards;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb;
begin
  s:=public.beacon_snapshot_before_rewards();
  return s||jsonb_build_object('equipped_looks',private.beacon_rewards_look_snapshot(s));
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
