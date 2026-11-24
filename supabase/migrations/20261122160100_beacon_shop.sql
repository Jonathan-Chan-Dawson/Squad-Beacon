create table private.beacon_coin_policy (
  singleton boolean primary key default true check (singleton),
  cutover timestamptz not null default now(),
  purchases_enabled boolean not null default false
);
insert into private.beacon_coin_policy default values;

create table private.beacon_cosmetic_catalog (
  id text primary key,
  slot text not null check (slot in ('skin','beam','frame','card')),
  price bigint not null check (price >= 0),
  available boolean not null default true
);
insert into private.beacon_cosmetic_catalog(id,slot,price) values
  ('classic','skin',0),('ember-beam','beam',1000),('prism-frame','frame',2000),
  ('static-bloom','card',3000),('aurora','skin',6000),('celestial','skin',10000),
  ('legendary','skin',17500);

create table private.beacon_coin_ledger (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('xp','unlock')),
  source text not null,
  amount bigint not null check ((kind='xp' and amount>0) or (kind='unlock' and amount<0)),
  subunits_per_xp integer check (subunits_per_xp in (10,15,20)),
  created_at timestamptz not null default now(),
  primary key(owner_id,kind,source)
);
create table private.beacon_cosmetic_ownership (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references private.beacon_cosmetic_catalog(id),
  primary key(owner_id,item_id)
);

alter table private.beacon_coin_policy enable row level security;
alter table private.beacon_cosmetic_catalog enable row level security;
alter table private.beacon_coin_ledger enable row level security;
alter table private.beacon_cosmetic_ownership enable row level security;
revoke all on private.beacon_coin_policy,private.beacon_cosmetic_catalog,private.beacon_coin_ledger,
  private.beacon_cosmetic_ownership from public,anon,authenticated;

create function private.credit_beacon_coins() returns trigger
language plpgsql security definer set search_path='' as $$
declare rate integer;
begin
  if not exists (
    select 1 from public.activities a cross join private.beacon_coin_policy p
    where a.id::text=new.source and a.ends_at>=p.cutover and a.ends_at<=now()
  ) then return null; end if;
  rate := case private.premium_tier(new.owner_id) when 'pro' then 20 when 'plus' then 15 else 10 end;
  insert into private.beacon_coin_ledger(owner_id,kind,source,amount,subunits_per_xp)
  values(new.owner_id,'xp',new.id::text,new.points*rate,rate)
  on conflict do nothing;
  return null;
end $$;
revoke all on function private.credit_beacon_coins() from public,anon,authenticated;
create trigger beacon_score_coin_conversion after insert on private.beacon_score_awards
for each row when (new.kind in ('attend','host')) execute function private.credit_beacon_coins();

create function public.beacon_shop(p_viewer uuid, p_unlock text default null, p_expected_price bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare viewer uuid := auth.uid(); cost bigint; balance bigint; enabled boolean;
begin
  if viewer is null or viewer is distinct from p_viewer then raise exception 'Sign in to view your Beacon Coins.'; end if;
  select purchases_enabled into enabled from private.beacon_coin_policy;
  if p_unlock is not null then
    perform pg_advisory_xact_lock(hashtextextended('beacon-shop:'||viewer::text,0));
    select price into cost from private.beacon_cosmetic_catalog where id=p_unlock and available;
    if not found then raise exception 'This look is unavailable.'; end if;
    if cost>0 and not exists(select 1 from private.beacon_cosmetic_ownership where owner_id=viewer and item_id=p_unlock) then
      if not enabled then raise exception 'Coin unlocks are currently in preview.'; end if;
      if cost is distinct from p_expected_price then raise exception 'The price changed. Refresh the shop before unlocking.'; end if;
      select coalesce(sum(amount),0) into balance from private.beacon_coin_ledger where owner_id=viewer;
      if balance<cost then raise exception 'You need more Beacon Coins for this look.'; end if;
      insert into private.beacon_coin_ledger(owner_id,kind,source,amount) values(viewer,'unlock',p_unlock,-cost);
      insert into private.beacon_cosmetic_ownership(owner_id,item_id) values(viewer,p_unlock);
    end if;
  end if;
  return jsonb_build_object(
    'balance',(select coalesce(sum(amount),0) from private.beacon_coin_ledger where owner_id=viewer),
    'purchases_enabled',enabled,
    'catalog',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slot',c.slot,'price',c.price,
      'owned',c.price=0 or exists(select 1 from private.beacon_cosmetic_ownership o where o.owner_id=viewer and o.item_id=c.id))
      order by c.price,c.id),'[]'::jsonb) from private.beacon_cosmetic_catalog c where c.available),
    'history',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc,l.kind,l.source),'[]'::jsonb)
      from (select kind,source,amount,created_at from private.beacon_coin_ledger where owner_id=viewer
        order by created_at desc,kind,source limit 20) l)
  );
end $$;
revoke all on function public.beacon_shop(uuid,text,bigint) from public,anon;
grant execute on function public.beacon_shop(uuid,text,bigint) to authenticated;
