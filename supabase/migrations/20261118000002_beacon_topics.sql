create table private.beacon_topics (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check(entity_type in ('squad','space','organization')),
  entity_id uuid not null,
  squad_id uuid generated always as (case when entity_type='squad' then entity_id end) stored references public.squads(id) on delete cascade,
  space_id uuid generated always as (case when entity_type='space' then entity_id end) stored references public.spaces(id) on delete cascade,
  organization_id uuid generated always as (case when entity_type='organization' then entity_id end) stored references public.organizations(id) on delete cascade,
  name text not null check(name=btrim(name) and char_length(name) between 1 and 40),
  created_by uuid references public.profiles(id) on delete set null,
  archived boolean not null default false
);
create unique index beacon_topic_names on private.beacon_topics(entity_type,entity_id,lower(name)) where not archived;
create table private.beacon_topic_assignments (
  activity_id uuid primary key references public.activity_social_links(activity_id) on delete cascade,
  topic_id uuid not null references private.beacon_topics(id) on delete cascade
);
create index beacon_topic_assigned_topic on private.beacon_topic_assignments(topic_id);
create table private.beacon_topic_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid references private.beacon_topics(id) on delete set null,
  prioritize boolean not null default true,
  unique(user_id,topic_id)
);
alter table private.beacon_topics enable row level security;
alter table private.beacon_topic_assignments enable row level security;
alter table private.beacon_topic_follows enable row level security;
revoke all on private.beacon_topics, private.beacon_topic_assignments, private.beacon_topic_follows from public,anon,authenticated;

create function private.clear_reassigned_beacon_topic() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (old.entity_type,old.entity_id) is distinct from (new.entity_type,new.entity_id) then
    delete from private.beacon_topic_assignments where activity_id=old.activity_id;
  end if;
  return new;
end $$;
revoke all on function private.clear_reassigned_beacon_topic() from public,anon,authenticated;
create trigger clear_reassigned_beacon_topic after update on public.activity_social_links
  for each row execute function private.clear_reassigned_beacon_topic();

create function private.set_activity_topic(aid uuid,tid uuid,viewer uuid) returns void
language plpgsql security definer set search_path='' as $$
declare link public.activity_social_links;
begin
  if not exists(select 1 from public.activities a where a.id=aid and a.owner_id=viewer and a.mode<>'solo' and a.status='scheduled') then
    raise exception 'Only the host can change the topic of this Beacon.';
  end if;
  if tid is null then
    delete from private.beacon_topic_assignments where activity_id=aid;
    return;
  end if;
  select l.* into link from public.activity_social_links l where l.activity_id=aid for update;
  if not found or not private.social_active(link.entity_type,link.entity_id,viewer)
    or not private.social_active(link.entity_type,link.entity_id,link.created_by) then
    raise exception 'Choose a topic from your Beacon’s current community.';
  end if;
  perform 1 from private.beacon_topics t where t.id=tid and not t.archived
    and (t.entity_type,t.entity_id)=(link.entity_type,link.entity_id) for share;
  if not found then raise exception 'Choose an active topic from this community.'; end if;
  insert into private.beacon_topic_assignments values(aid,tid)
    on conflict(activity_id) do update set topic_id=excluded.topic_id;
end $$;
revoke all on function private.set_activity_topic(uuid,uuid,uuid) from public,anon,authenticated;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_topics;
revoke all on function public.beacon_action_before_topics(text,jsonb,uuid) from public,anon,authenticated;
create function private.beacon_topics_action(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  viewer uuid := auth.uid();
  kind text := payload->>'entity_type';
  entity uuid;
  topic uuid;
  name text := btrim(payload->>'name');
  activity uuid;
  result jsonb;
begin
  if action not in ('save_beacon_topic','archive_beacon_topic','follow_beacon_topic','update_beacon_topic_follow','unfollow_beacon_topic','set_beacon_topic') then
    if action not in ('create_activity','create_activity_with_invitees','create_plan_beacon','create_plan_beacon_with_invitees','publish_planning_beacon') or not (payload ? 'beacon_topic_id') then
      return public.beacon_action_before_topics(action,payload,request_id);
    end if;
  end if;
  if viewer is null or coalesce(payload->>'expected_actor_id',viewer::text)<>viewer::text then raise exception 'Your account changed.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(viewer::text,0));
  topic := (payload->>'beacon_topic_id')::uuid;
  if action in ('save_beacon_topic','archive_beacon_topic') then
    entity := (payload->>'entity_id')::uuid;
    if kind not in ('squad','space','organization') or not coalesce(private.social_active(kind,entity,viewer),false)
      or private.organization_role_rank(private.social_role(kind,entity,viewer))<3 then
      raise exception 'You cannot manage topics for this community.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('beacon-topics:'||entity::text,0));
    perform private.limit_action('manage_beacon_topic',60);
    if action='archive_beacon_topic' then
      update private.beacon_topics t set archived=true where t.id=topic and (t.entity_type,t.entity_id)=(kind,entity) and not t.archived;
    elsif topic is not null then
      update private.beacon_topics t set name=beacon_topics_action.name where t.id=topic and (t.entity_type,t.entity_id)=(kind,entity) and not t.archived;
    else
      if (select count(*) from private.beacon_topics t where (t.entity_type,t.entity_id)=(kind,entity) and not t.archived)>=6 then
        raise exception 'This community already has six active topics.';
      end if;
      insert into private.beacon_topics(entity_type,entity_id,name,created_by) values(kind,entity,name,viewer) returning id into topic;
    end if;
    if not found then raise exception 'This topic is unavailable.'; end if;
    return jsonb_build_object('topic_id',topic);
  elsif action='follow_beacon_topic' then
    if not exists(select 1 from private.beacon_topics t where t.id=topic and not t.archived and private.social_entity_visible(t.entity_type,t.entity_id,viewer)) then
      raise exception 'This topic is unavailable.';
    end if;
    perform private.limit_action('follow_beacon_topic',90);
    insert into private.beacon_topic_follows(user_id,topic_id) values(viewer,topic) on conflict(user_id,topic_id) do nothing;
  elsif action='update_beacon_topic_follow' then
    update private.beacon_topic_follows f set prioritize=(payload->>'prioritize')::boolean
    where f.id=(payload->>'follow_id')::uuid and f.user_id=viewer
      and exists(select 1 from private.beacon_topics t where t.id=f.topic_id and not t.archived and private.social_entity_visible(t.entity_type,t.entity_id,viewer));
    if not found then raise exception 'This follow is unavailable.'; end if;
  elsif action='unfollow_beacon_topic' then
    delete from private.beacon_topic_follows f where f.id=(payload->>'follow_id')::uuid and f.user_id=viewer;
  elsif action='set_beacon_topic' then
    perform private.set_activity_topic((payload->>'id')::uuid,topic,viewer);
  else
    if exists(select 1 from private.requests r where r.user_id=viewer and r.request_id=$3) then
      return public.beacon_action_before_topics(action,payload-'beacon_topic_id',request_id);
    end if;
    result := public.beacon_action_before_topics(action,payload-'beacon_topic_id',request_id);
    activity := coalesce(result->>'activity_id',result->>'id')::uuid;
    perform private.set_activity_topic(activity,topic,viewer);
    return result;
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function private.beacon_topics_action(text,jsonb,uuid) from public,anon;
grant execute on function private.beacon_topics_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language sql security invoker set search_path='' as $$ select private.beacon_topics_action(action,payload,request_id) $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create function private.community_beacon_topics(kind text,entity uuid)
returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
  select t.id,t.name from private.beacon_topics t
  where auth.uid() is not null and (t.entity_type,t.entity_id)=(kind,entity) and not t.archived
    and private.social_entity_visible(kind,entity,auth.uid())
  order by lower(t.name),t.id
$$;
revoke all on function private.community_beacon_topics(text,uuid) from public,anon;
grant execute on function private.community_beacon_topics(text,uuid) to authenticated;
create function public.community_beacon_topics(kind text,entity uuid)
returns table(id uuid,name text) language sql stable security invoker set search_path='' as $$ select * from private.community_beacon_topics(kind,entity) $$;
revoke all on function public.community_beacon_topics(text,uuid) from public,anon;
grant execute on function public.community_beacon_topics(text,uuid) to authenticated;

create function private.beacon_topics_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'beacon_topic_assignments',coalesce((select jsonb_agg(jsonb_build_object('activity_id',x.activity_id,'topic_id',x.topic_id))
      from private.beacon_topic_assignments x join private.beacon_topics t on t.id=x.topic_id
      join public.activity_social_links l on l.activity_id=x.activity_id
      join public.activities a on a.id=x.activity_id
      where not t.archived and private.can_activity(x.activity_id) and private.social_entity_visible(t.entity_type,t.entity_id,auth.uid())
        and private.social_active(l.entity_type,l.entity_id,l.created_by) and private.social_active(l.entity_type,l.entity_id,a.owner_id)),'[]'),
    'beacon_topic_follows',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'topic_id',t.id,'name',t.name,'prioritize',f.prioritize))
      from private.beacon_topic_follows f left join private.beacon_topics t on t.id=f.topic_id and not t.archived
        and private.social_entity_visible(t.entity_type,t.entity_id,auth.uid()) where f.user_id=auth.uid()),'[]')
  )
$$;
revoke all on function private.beacon_topics_snapshot() from public,anon;
grant execute on function private.beacon_topics_snapshot() to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_topics;
create function public.beacon_snapshot() returns jsonb language sql security invoker set search_path='' as $$
  select s || private.beacon_topics_snapshot() || jsonb_build_object('capabilities',coalesce(s->'capabilities','{}') || '{"beacon_topics":true}'::jsonb)
  from public.beacon_snapshot_before_topics() s
$$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
