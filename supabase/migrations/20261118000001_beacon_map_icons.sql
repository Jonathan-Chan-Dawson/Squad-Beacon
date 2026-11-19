-- Map icon bytes are bounded thumbnails. Activity RLS covers the readable
-- representation and the public projection is explicit and opt-in.
alter table public.activities
  add column map_icon text,
  add column map_icon_public boolean not null default false,
  add constraint activity_map_icon_valid check (
    (map_icon is not null or not map_icon_public) and (
      map_icon is null or map_icon in ('fitness','study','gaming','creative','social','other','music','outdoors','food','trophy')
      or (length(map_icon) <= 16000 and map_icon ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]+={0,2}$')
    )
  );

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_map_icons;
revoke all on function public.beacon_action_before_map_icons(text,jsonb,uuid) from public,anon,authenticated;

create function private.beacon_map_icon_action(action text,payload jsonb,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  viewer uuid := auth.uid();
  result jsonb;
  activity_id uuid;
  icon text;
  share boolean;
begin
  if action <> 'set_beacon_map_icon' and (
    action not in ('create_activity','create_activity_with_invitees','create_plan_beacon','create_plan_beacon_with_invitees','publish_planning_beacon')
    or not (payload ? 'map_icon')
  ) then
    return public.beacon_action_before_map_icons(action,payload,request_id);
  end if;
  if viewer is null or coalesce(payload->>'expected_actor_id',viewer::text) <> viewer::text then
    raise exception 'Sign in with the account that owns this Beacon.';
  end if;
  if jsonb_typeof(payload->'map_icon') not in ('null','string')
    or jsonb_typeof(payload->'map_icon_public') not in ('null','boolean') then
    raise exception 'Choose a valid Map icon.';
  end if;
  icon := payload->>'map_icon';
  share := icon is not null and coalesce((payload->>'map_icon_public')::boolean,false);
  if action = 'set_beacon_map_icon' then
    activity_id := (payload->>'id')::uuid;
    perform private.limit_action('set_beacon_map_icon',60);
  else
    perform pg_advisory_xact_lock(hashtextextended(viewer::text,0));
    if exists(select 1 from private.requests r where r.user_id=viewer and r.request_id=$3) then
      return public.beacon_action_before_map_icons(action,payload - 'map_icon' - 'map_icon_public',request_id);
    end if;
    result := public.beacon_action_before_map_icons(action,payload - 'map_icon' - 'map_icon_public',request_id);
    activity_id := coalesce(result->>'activity_id',result->>'id')::uuid;
  end if;
  update public.activities a set map_icon=icon,map_icon_public=share
  where a.id=activity_id and a.owner_id=viewer and a.mode <> 'solo';
  if not found then raise exception 'The Beacon is unavailable for editing.'; end if;
  return coalesce(result,jsonb_build_object('activity_id',activity_id));
end $$;
revoke all on function private.beacon_map_icon_action(text,jsonb,uuid) from public,anon;
grant execute on function private.beacon_map_icon_action(text,jsonb,uuid) to authenticated;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language sql security invoker set search_path='' as $$
  select private.beacon_map_icon_action(action,payload,request_id)
$$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create function private.public_beacon_map_icons(activity_ids uuid[])
returns table(activity_id uuid,map_icon text) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or coalesce(cardinality(activity_ids),0)>50 then return; end if;
  return query select a.id,a.map_icon from public.activities a
    where a.id=any(activity_ids) and a.map_icon_public and a.map_icon is not null
      and private.discoverable_beacon(a.id);
end $$;
revoke all on function private.public_beacon_map_icons(uuid[]) from public,anon;
grant execute on function private.public_beacon_map_icons(uuid[]) to authenticated;

create function public.public_beacon_map_icons(activity_ids uuid[])
returns table(activity_id uuid,map_icon text) language sql stable security invoker set search_path='' as $$
  select * from private.public_beacon_map_icons(activity_ids)
$$;
revoke all on function public.public_beacon_map_icons(uuid[]) from public,anon;
grant execute on function public.public_beacon_map_icons(uuid[]) to authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_map_icons;
create function public.beacon_snapshot() returns jsonb language sql security invoker set search_path='' as $$
  select s || jsonb_build_object('capabilities',coalesce(s->'capabilities','{}') || '{"beacon_map_icons":true}'::jsonb)
  from public.beacon_snapshot_before_map_icons() s
$$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
