-- Explicit public cards are separate from private activities and their exact places.
create table private.beacon_discovery (
  activity_id uuid primary key references public.activities on delete cascade,
  area_label text not null check (length(trim(area_label)) between 1 and 120),
  coarse_lat numeric,
  coarse_lng numeric,
  check ((coarse_lat is null) = (coarse_lng is null)),
  check (coarse_lat between -90 and 90 and coarse_lng between -180 and 180)
);
revoke all on private.beacon_discovery from public, anon, authenticated;

create function private.discoverable_beacon(aid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from private.beacon_discovery d join public.activities a on a.id=d.activity_id
    where a.id=aid and a.status='scheduled' and a.ends_at>now()
      and a.mode='squad' and a.audience<>'organization'
      and not private.blocked(a.owner_id)
      and not exists(select 1 from private.activity_exclusions e where e.activity_id=aid and e.user_id=auth.uid())
  );
$$;
revoke all on function private.discoverable_beacon(uuid) from public, anon, authenticated;

-- The canonical counter previously returned zero for an unjoined viewer.
-- Permit counting opted-in summaries too, so strict capacity stays correct
-- before a public join; no meeting details or attendee rows are exposed.
do $$
declare definition text;
begin
  definition:=pg_get_functiondef('private.beacon_seat_count(uuid)'::regprocedure);
  if position('private.can_activity(a.id)' in definition)=0 then raise exception 'Beacon capacity policy changed; review discovery counting.'; end if;
  execute replace(definition,'private.can_activity(a.id)','(private.can_activity(a.id) or private.discoverable_beacon(a.id))');
end $$;

create function public.public_beacon_search(p_query text default '', p_lat numeric default null, p_lng numeric default null)
returns table(activity_id uuid,title text,category text,interest_tags text[],starts_at timestamptz,ends_at timestamptz,area_label text,coarse_lat numeric,coarse_lng numeric,requires_approval boolean,capacity_limit integer,capacity_policy text,accepted_seat_count integer,closed boolean,viewer_response text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to discover Beacons.'; end if;
  if p_query is null or length(p_query)>160 then raise exception 'Search is too long.'; end if;
  if (p_lat is null)<>(p_lng is null) or abs(p_lat)>90 or abs(p_lng)>180 then raise exception 'Invalid search area.'; end if;
  return query select a.id,a.title,a.category::text,array[a.category::text],a.starts_at,a.ends_at,d.area_label,d.coarse_lat,d.coarse_lng,a.approval_required,a.capacity_limit,a.capacity_policy,private.beacon_seat_count(a.id)::integer,
    a.manual_closed or (a.capacity_policy='strict' and a.capacity_limit is not null and private.beacon_seat_count(a.id)>=a.capacity_limit),
    (select case when r.status='requested' then 'requested' when r.status='going' and r.approved then 'going' else null end from public.rsvps r where r.activity_id=a.id and r.user_id=auth.uid())
  from private.beacon_discovery d join public.activities a on a.id=d.activity_id
  where private.discoverable_beacon(a.id)
    and not exists(select 1 from regexp_split_to_table(trim(p_query),'\s+') term where position(lower(term) in lower(a.title || ' ' || a.category::text || ' ' || d.area_label))=0)
  order by a.manual_closed asc,
    case when p_lat is not null and d.coarse_lat is not null then power(d.coarse_lat-p_lat,2)+power((d.coarse_lng-p_lng)*cos(radians(p_lat)),2) else null end asc nulls last,
    (a.starts_at<=now()) desc,a.starts_at,a.id
  limit 50;
end $$;

create function public.set_beacon_discovery(p_activity_id uuid,p_enabled boolean,p_area_label text default '',p_lat numeric default null,p_lng numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.activities;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into a from public.activities where id=p_activity_id for update;
  if not found or a.owner_id<>auth.uid() then raise exception 'Only the host can publish discovery.'; end if;
  perform private.limit_action('public_discovery',60);
  if p_enabled is null then raise exception 'Choose whether to publish.'; end if;
  if not p_enabled then delete from private.beacon_discovery where activity_id=p_activity_id; return jsonb_build_object('published',false); end if;
  if a.mode<>'squad' or a.audience='organization' or a.status<>'scheduled' or a.ends_at<=now() then raise exception 'Only upcoming group Beacons outside an organization audience can be published.'; end if;
  if p_area_label is null or length(trim(p_area_label)) not between 1 and 120 then raise exception 'Add a city or general area.'; end if;
  if (p_lat is null)<>(p_lng is null) or abs(p_lat)>90 or abs(p_lng)>180 then raise exception 'Choose valid area coordinates.'; end if;
  insert into private.beacon_discovery values(p_activity_id,trim(p_area_label),round(p_lat,2),round(p_lng,2))
  on conflict(activity_id) do update set area_label=excluded.area_label,coarse_lat=excluded.coarse_lat,coarse_lng=excluded.coarse_lng;
  return jsonb_build_object('published',true);
end $$;

create function public.join_public_beacon(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.activities; r public.rsvps; next_status text;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into a from public.activities where id=p_activity_id for update;
  if not found or not private.discoverable_beacon(p_activity_id) then raise exception 'Public Beacon unavailable.'; end if;
  select * into r from public.rsvps where activity_id=p_activity_id and user_id=auth.uid();
  if a.owner_id=auth.uid() then return jsonb_build_object('status','going'); end if;
  if r.status='requested' or (r.status='going' and r.approved) then return jsonb_build_object('status',r.status); end if;
  perform private.limit_action('public_join',60);
  perform private.assert_beacon_capacity(p_activity_id);
  next_status:=case when a.approval_required and not coalesce(r.approved,false) then 'requested' else 'going' end;
  insert into public.rsvps(activity_id,user_id,status,approved) values(p_activity_id,auth.uid(),next_status,next_status='going')
  on conflict(activity_id,user_id) do update set status=excluded.status,approved=excluded.approved;
  perform private.notify(a.owner_id,auth.uid(),case when next_status='requested' then 'Someone requested to join your public Beacon.' else 'Someone joined your public Beacon.' end,p_activity_id);
  return jsonb_build_object('status',next_status);
end $$;

revoke all on function public.public_beacon_search(text,numeric,numeric), public.set_beacon_discovery(uuid,boolean,text,numeric,numeric), public.join_public_beacon(uuid) from public,anon;
grant execute on function public.public_beacon_search(text,numeric,numeric), public.set_beacon_discovery(uuid,boolean,text,numeric,numeric), public.join_public_beacon(uuid) to authenticated;
