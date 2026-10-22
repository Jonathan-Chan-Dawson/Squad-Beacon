-- Community context can make an opted-in Beacon easier to find without
-- changing its audience or returning any private activity details.

create function private.beacon_community_contexts(
  p_entity_type text,
  p_entity_id uuid,
  p_person uuid
) returns table(entity_type text, entity_id uuid)
language sql stable security definer set search_path='' as $$
  with contexts(entity_type,entity_id) as (
    -- Organization children.
    select 'space'::text, l.space_id
    from public.organization_spaces l
    where p_entity_type='organization' and l.organization_id=p_entity_id
      and private.social_entity_visible('space',l.space_id,p_person)
    union all
    select 'squad'::text, l.squad_id
    from public.organization_squads l
    where p_entity_type='organization' and l.organization_id=p_entity_id
      and private.social_entity_visible('squad',l.squad_id,p_person)
    union all
    -- An organization can reach Squads through a Space only when that
    -- intermediate Space is visible to this viewer.
    select 'squad'::text, sl.squad_id
    from public.organization_spaces ol
    join public.space_squads sl on sl.space_id=ol.space_id
    where p_entity_type='organization' and ol.organization_id=p_entity_id
      and private.social_entity_visible('space',ol.space_id,p_person)
      and private.social_entity_visible('squad',sl.squad_id,p_person)
    union all
    -- Space parents and children.
    select 'organization'::text, l.organization_id
    from public.organization_spaces l
    where p_entity_type='space' and l.space_id=p_entity_id
      and private.social_entity_visible('organization',l.organization_id,p_person)
    union all
    select 'squad'::text, l.squad_id
    from public.space_squads l
    where p_entity_type='space' and l.space_id=p_entity_id
      and private.social_entity_visible('squad',l.squad_id,p_person)
    union all
    -- Squad parents, including an Organization through a visible Space.
    select 'space'::text, l.space_id
    from public.space_squads l
    where p_entity_type='squad' and l.squad_id=p_entity_id
      and private.social_entity_visible('space',l.space_id,p_person)
    union all
    select 'organization'::text, l.organization_id
    from public.organization_squads l
    where p_entity_type='squad' and l.squad_id=p_entity_id
      and private.social_entity_visible('organization',l.organization_id,p_person)
    union all
    select 'organization'::text, ol.organization_id
    from public.space_squads sl
    join public.organization_spaces ol on ol.space_id=sl.space_id
    where p_entity_type='squad' and sl.squad_id=p_entity_id
      and private.social_entity_visible('space',sl.space_id,p_person)
      and private.social_entity_visible('organization',ol.organization_id,p_person)
  )
  select distinct c.entity_type,c.entity_id
  from contexts c
  where p_person is not null and p_entity_id is not null
    and (c.entity_type,c.entity_id)<>(p_entity_type,p_entity_id)
$$;

revoke all on function private.beacon_community_contexts(text,uuid,uuid)
  from public,anon,authenticated;

create function private.beacon_community_candidates(p_activity_id uuid)
returns table(activity_id uuid,entity_type text,entity_id uuid,relationship text,priority integer)
language sql stable security definer set search_path='' as $$
  with eligible_activity as (
    select a.id,a.owner_id,a.audience::text audience,a.audience_id
    from public.activities a
    where a.id=p_activity_id and auth.uid() is not null
      and (private.can_activity(a.id) or private.discoverable_beacon(a.id))
  ), seeds(entity_type,entity_id,priority) as (
    -- Explicit associations stay valid only while both the host and the
    -- association creator remain active members of that community.
    select l.entity_type,l.entity_id,0
    from eligible_activity a
    join public.activity_social_links l on l.activity_id=a.id
    where l.created_by is not null
      and private.social_active(l.entity_type,l.entity_id,a.owner_id)
      and private.social_active(l.entity_type,l.entity_id,l.created_by)
      and private.social_entity_visible(l.entity_type,l.entity_id,auth.uid())
    union all
    -- Community audiences are candidates only for viewers authorized to read
    -- the underlying Beacon.
    select a.audience,a.audience_id,1
    from eligible_activity a
    where private.can_activity(a.id)
      and a.audience in ('squad','organization')
      and a.audience_id is not null
      and private.social_entity_visible(a.audience,a.audience_id,auth.uid())
  ), candidates(entity_type,entity_id,priority) as (
    select s.entity_type,s.entity_id,s.priority from seeds s
    union all
    select context.entity_type,context.entity_id,2
    from seeds s
    cross join lateral private.beacon_community_contexts(s.entity_type,s.entity_id,auth.uid()) context
  )
  select p_activity_id,c.entity_type,c.entity_id,'associated'::text,min(c.priority)::integer
  from candidates c
  group by c.entity_type,c.entity_id
$$;

revoke all on function private.beacon_community_candidates(uuid)
  from public,anon,authenticated;

create function public.beacon_community_summaries(p_activity_ids uuid[])
returns table(activity_id uuid,relationship text,priority integer,summary jsonb)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Sign in to continue.'; end if;
  if coalesce(cardinality(p_activity_ids),0)>50 then
    raise exception 'Request at most 50 Beacons at a time.';
  end if;

  return query
  with requested(activity_id) as (
    select distinct requested_id
    from unnest(p_activity_ids) as ids(requested_id)
    where requested_id is not null
  ), candidates as (
    select c.activity_id,c.entity_type,c.entity_id,c.relationship,c.priority
    from requested r
    cross join lateral private.beacon_community_candidates(r.activity_id) c
  )
  select c.activity_id,c.relationship,c.priority,to_jsonb(summary_row)
  from candidates c
  cross join lateral public.community_profile_summary(c.entity_type,c.entity_id) summary_row
  order by c.activity_id,c.priority,c.entity_type,c.entity_id;
end $$;

create function public.community_public_beacons(
  p_entity_type text,
  p_entity_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
) returns table(
  activity_id uuid,title text,category text,interest_tags text[],starts_at timestamptz,ends_at timestamptz,
  area_label text,coarse_lat numeric,coarse_lng numeric,requires_approval boolean,capacity_limit integer,
  capacity_policy text,accepted_seat_count integer,closed boolean,viewer_response text
)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Sign in to discover Beacons.'; end if;
  if p_entity_type is null or p_entity_type not in ('squad','space','organization') or p_entity_id is null then
    raise exception 'Choose a valid community.';
  end if;
  if p_limit is null or p_limit<1 or p_limit>50 or p_offset is null or p_offset<0 or p_offset>5000 then
    raise exception 'Choose a page size from 1 to 50 and an offset from 0 to 5000.';
  end if;
  if not private.social_entity_visible(p_entity_type,p_entity_id,uid) then return; end if;

  return query
  with contexts(entity_type,entity_id) as (
    select p_entity_type,p_entity_id
    union
    select c.entity_type,c.entity_id
    from private.beacon_community_contexts(p_entity_type,p_entity_id,uid) c
  ), seed_activities(activity_id) as (
    select a.id
    from public.activities a
    join contexts c on a.audience_id=c.entity_id and a.audience::text=c.entity_type
    where private.can_activity(a.id)
    union
    select l.activity_id
    from public.activity_social_links l
    join contexts c on c.entity_type=l.entity_type and c.entity_id=l.entity_id
  ), matching(activity_id) as (
    select distinct a.id
    from seed_activities seed
    join public.activities a on a.id=seed.activity_id
    cross join lateral private.beacon_community_candidates(a.id) candidate
    where candidate.entity_type=p_entity_type and candidate.entity_id=p_entity_id
      and private.discoverable_beacon(a.id)
      and private.social_entity_visible(p_entity_type,p_entity_id,uid)
  )
  select a.id,a.title,a.category::text,array[a.category::text],a.starts_at,a.ends_at,
    d.area_label,d.coarse_lat,d.coarse_lng,a.approval_required,a.capacity_limit,a.capacity_policy,
    private.beacon_seat_count(a.id)::integer,
    a.manual_closed or (a.capacity_policy='strict' and a.capacity_limit is not null
      and private.beacon_seat_count(a.id)>=a.capacity_limit),
    (select case when r.status='requested' then 'requested'
      when r.status='going' and (r.approved or not (a.approval_required or a.mode='invite')) then 'going' else null end
     from public.rsvps r where r.activity_id=a.id and r.user_id=uid)
  from matching m
  join public.activities a on a.id=m.activity_id
  join private.beacon_discovery d on d.activity_id=a.id
  where private.discoverable_beacon(a.id)
    and private.social_entity_visible(p_entity_type,p_entity_id,uid)
  order by a.manual_closed asc,(a.starts_at<=now()) desc,a.starts_at,a.id
  limit p_limit offset p_offset;
end $$;

revoke all on function public.beacon_community_summaries(uuid[]),
  public.community_public_beacons(text,uuid,integer,integer) from public,anon;
grant execute on function public.beacon_community_summaries(uuid[]),
  public.community_public_beacons(text,uuid,integer,integer) to authenticated;
