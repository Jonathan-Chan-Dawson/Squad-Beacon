alter table
  public.profiles
add
  column avatar_updated_at timestamptz;

create function private.avatar_changed() returns trigger language plpgsql security definer
set
  search_path = '' as $ $ declare object_name text;

bucket text;

begin if tg_op = 'DELETE' then object_name := old.name;

bucket := old.bucket_id;

else object_name := new.name;

bucket := new.bucket_id;

end if;

if bucket = 'avatars'
and object_name ~ '^[0-9a-f-]{36}/avatar.jpg$' then
update
  public.profiles
set
  avatar_updated_at =case
    when tg_op = 'DELETE' then null
    else now()
  end
where
  id = split_part(object_name, '/', 1) :: uuid;

end if;

return null;

end $ $;

revoke all on function private.avatar_changed()
from
  public,
  anon,
  authenticated;

create trigger beacon_avatar_changed
after
insert
  or
update
  or delete on storage.objects for each row execute function private.avatar_changed();

create table private.usage_events(
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles on delete cascade,
  kind text not null,
  activity_id uuid references public.activities on delete cascade,
  squad_id uuid references public.squads on delete cascade,
  created_at timestamptz not null default now()
);

create index usage_events_time on private.usage_events(created_at);

create function private.record_usage() returns trigger language plpgsql security definer
set
  search_path = '' as $ $ begin if new.result ->> 'event' not in (
    'onboard',
    'create_activity',
    'rsvp',
    'checkin',
    'create_squad',
    'friend_request',
    'accept_friend',
    'accept_squad',
    'save_goal',
    'save_habit',
    'comment',
    'activity_status'
  ) then return null;

end if;

-- Record only intentional engagement. Never copy titles, comments, dates of birth or coordinates.
insert into
  private.usage_events(user_id, kind, activity_id, squad_id)
values
(
    new.user_id,
    coalesce(new.result ->> 'event', 'action'),
    nullif(new.result ->> 'activity_id', '') :: uuid,
    nullif(new.result ->> 'squad_id', '') :: uuid
  );

return null;

end $ $;

-- Successful request results are enriched in beacon_action before this trigger runs.
revoke all on function private.record_usage()
from
  public,
  anon,
  authenticated;

create trigger beacon_usage
after
insert
  on private.requests for each row execute function private.record_usage();

create function public.beacon_pilot_metrics() returns jsonb language plpgsql security definer
set
  search_path = '' as $ $ begin if not private.is_moderator() then raise exception 'Moderator access required.';

end if;

return jsonb_build_object(
  'weekly_active_people',
(
    select
      count(distinct user_id)
    from
      private.usage_events
    where
      created_at > now() - interval '7 days'
  ),
  'weekly_active_squads',
(
    select
      count(distinct squad_id)
    from
      private.usage_events
    where
      created_at > now() - interval '7 days'
  ),
  'activities_with_rsvps',
(
    select
      count(distinct activity_id)
    from
      public.rsvps
    where
      status in ('going', 'interested')
  ),
  'accepted_friendships',
(
    select
      count(*)
    from
      public.friendships
    where
      status = 'accepted'
  ),
  'weekly_checkins',
(
    select
      count(*)
    from
      public.checkins
    where
      local_date >= current_date -7
  ),
  'push_retry_jobs',
(
    select
      count(*)
    from
      private.push_queue
    where
      attempts > 1
      and not done
  ),
  'push_failed_jobs',
(
    select
      count(*)
    from
      private.push_queue
    where
      attempts >= 5
      and ticket_id is null
  )
);

end $ $;

revoke all on function public.beacon_pilot_metrics()
from
  public,
  anon;

grant execute on function public.beacon_pilot_metrics() to authenticated;

create function public.beacon_location_recipients() returns uuid [] language sql security definer
set
  search_path = '' as $ $
select
  coalesce(array_agg(r.user_id), '{}')
from
  private.location_recipients r
  join public.locations l on l.id = r.session_id
where
  l.owner_id = auth.uid()
  and l.expires_at > now();

$ $;

revoke all on function public.beacon_location_recipients()
from
  public,
  anon;

grant execute on function public.beacon_location_recipients() to authenticated;