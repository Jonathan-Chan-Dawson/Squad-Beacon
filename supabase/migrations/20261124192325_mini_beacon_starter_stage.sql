-- Preserve Rewards access for profiles that existed before the Stage 0 introduction.
alter table private.beacon_reward_clicker
  add column starter_taps integer not null default 10 check(starter_taps between 0 and 10);

insert into private.beacon_reward_clicker(owner_id,week_start)
  select id, private.beacon_rewards_week(statement_timestamp()) from public.profiles
  on conflict do nothing;

alter table private.beacon_reward_clicker
  drop constraint beacon_reward_clicker_stage_check,
  alter column stage set default 0,
  alter column starter_taps set default 0,
  add constraint beacon_reward_clicker_stage_check check(stage between 0 and 8),
  add constraint beacon_reward_clicker_starter_check
    check((stage=0 and starter_taps<10) or (stage>=1 and starter_taps=10));

create or replace function private.beacon_rewards_api(viewer uuid, operation text, args jsonb)
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
      cost:=accepted*(12600/tap_rates[greatest(1,tap_state.stage)]);
      if accepted>0 then
        update private.beacon_reward_clicker set taps=taps+accepted,tokens=refreshed-accepted,checked_at=moment,
          starter_taps=least(10,tap_state.starter_taps+accepted),
          stage=case when tap_state.stage=0 and tap_state.starter_taps+accepted>=10
                     then 1 else tap_state.stage end
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
    if tap_state.stage=0 then raise exception 'Tap Mini Beacon 10 times to reach Stage 1.'; end if;
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
    'shop_unlocked',tap_state.stage>=1,
    'clicker',jsonb_build_object('stage',tap_state.stage,'starter_taps',tap_state.starter_taps,'week',week,'remaining',500-tap_state.taps,
      'taps_per_coin',tap_rates[greatest(1,tap_state.stage)],'next_price',upgrade_costs[tap_state.stage]*12600,
      'next_rate',case when tap_state.stage>0 then tap_rates[tap_state.stage+1] end,
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
