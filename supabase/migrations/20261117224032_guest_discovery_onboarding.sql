-- Signed-out discovery is a second, explicit host opt-in. Existing public
-- publishing and all member authorization predicates retain their meaning.
create table private.beacon_guest_discovery (
  activity_id uuid primary key references private.beacon_discovery(activity_id) on delete cascade
);
alter table private.beacon_guest_discovery enable row level security;
revoke all on private.beacon_guest_discovery from public, anon, authenticated;

create function public.beacon_guest_visibility(p_activity_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.activities a where a.id=p_activity_id and a.owner_id=auth.uid()
  ) then raise exception 'Only the host can read guest visibility.'; end if;
  return jsonb_build_object(
    'published',exists(select 1 from private.beacon_discovery d where d.activity_id=p_activity_id),
    'enabled',exists(select 1 from private.beacon_guest_discovery g where g.activity_id=p_activity_id)
  );
end $$;

create function public.set_beacon_guest_visibility(p_activity_id uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.activities;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into a from public.activities where id=p_activity_id for update;
  if not found or a.owner_id<>auth.uid() then raise exception 'Only the host can change guest visibility.'; end if;
  if p_enabled is null then raise exception 'Choose whether guests can see this Beacon.'; end if;
  perform private.limit_action('public_discovery',60);
  if not p_enabled then
    delete from private.beacon_guest_discovery where activity_id=p_activity_id;
  else
    if not private.discoverable_beacon(a.id) then raise exception 'Publish an upcoming public preview first.'; end if;
    insert into private.beacon_guest_discovery(activity_id) values(p_activity_id) on conflict do nothing;
  end if;
  return jsonb_build_object('enabled',p_enabled);
end $$;

create function public.browse_guest_beacons(
  p_query text default '',p_lat numeric default null,p_lng numeric default null,p_id uuid default null
)
returns table(activity_id uuid,title text,category text,interest_tags text[],starts_at timestamptz,ends_at timestamptz,area_label text,coarse_lat numeric,coarse_lng numeric,requires_approval boolean,capacity_limit integer,capacity_policy text,accepted_seat_count integer,closed boolean,viewer_response text)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_query is null or length(p_query)>160 then raise exception 'Search is too long.'; end if;
  if (p_lat is null)<>(p_lng is null) or abs(p_lat)>90 or abs(p_lng)>180 then raise exception 'Invalid search area.'; end if;
  -- Bound candidates before aggregating. No table grants or full Activity rows
  -- are exposed, including for an exact-ID request or a signed-in continuation.
  return query with candidates as materialized (
    select a.id,a.title,a.category,a.starts_at,a.ends_at,a.approval_required,
      a.capacity_limit,a.capacity_policy,a.manual_closed,a.owner_id,a.mode,
      d.area_label,d.coarse_lat,d.coarse_lng
    from private.beacon_guest_discovery g
    join private.beacon_discovery d on d.activity_id=g.activity_id
    join public.activities a on a.id=g.activity_id
    where a.mode='squad' and a.audience<>'organization' and a.status='scheduled' and a.ends_at>now()
      and (p_id is null or a.id=p_id)
      and (auth.uid() is null or private.discoverable_beacon(a.id))
      and not exists(select 1 from regexp_split_to_table(trim(p_query),'\s+') term
        where position(lower(term) in lower(a.title||' '||a.category::text||' '||d.area_label))=0)
    order by a.manual_closed,
      case when p_lat is not null and d.coarse_lat is not null then power(d.coarse_lat-p_lat,2)+power((d.coarse_lng-p_lng)*cos(radians(p_lat)),2) else null end asc nulls last,
      (a.starts_at<=now()) desc,a.starts_at,a.id
    limit 50
  )
  select a.id,a.title,a.category::text,array[a.category::text],a.starts_at,a.ends_at,
    a.area_label,a.coarse_lat,a.coarse_lng,a.approval_required,a.capacity_limit,a.capacity_policy,
    seats.n,a.manual_closed or (a.capacity_policy='strict' and a.capacity_limit is not null and seats.n>=a.capacity_limit),
    (select case when r.status='requested' then 'requested' when r.status='going' and r.approved then 'going' else null end
      from public.rsvps r where r.activity_id=a.id and r.user_id=auth.uid())
  from candidates a cross join lateral (
    -- Same attendance rules as private.beacon_seat_count, restricted here to
    -- explicitly guest-published candidates rather than broadening that helper.
    select (1+count(distinct r.user_id))::integer n from public.rsvps r
    where r.activity_id=a.id and r.user_id<>a.owner_id and r.status='going'
      and (r.approved or (not a.approval_required and a.mode<>'invite'))
      and not exists(select 1 from public.blocks b where
        (b.blocker_id=a.owner_id and b.blocked_id=r.user_id) or (b.blocker_id=r.user_id and b.blocked_id=a.owner_id))
      and not exists(select 1 from private.activity_exclusions e where e.activity_id=a.id and e.user_id=r.user_id)
  ) seats
  order by a.manual_closed,
    case when p_lat is not null and a.coarse_lat is not null then power(a.coarse_lat-p_lat,2)+power((a.coarse_lng-p_lng)*cos(radians(p_lat)),2) else null end asc nulls last,
    (a.starts_at<=now()) desc,a.starts_at,a.id;
end $$;

revoke all on function public.beacon_guest_visibility(uuid),public.set_beacon_guest_visibility(uuid,boolean),public.browse_guest_beacons(text,numeric,numeric,uuid) from public,anon,authenticated;
grant execute on function public.beacon_guest_visibility(uuid),public.set_beacon_guest_visibility(uuid,boolean) to authenticated;
grant execute on function public.browse_guest_beacons(text,numeric,numeric,uuid) to anon,authenticated;
