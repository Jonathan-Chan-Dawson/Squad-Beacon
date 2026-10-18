-- Read-only profile pages. Authorization is explicit in the private definer;
-- the Data API exposes only a narrow invoker wrapper, never raw profile rows.
create index if not exists beacon_memories_author_activity_created
 on public.beacon_memories(author_id,activity_id,created_at desc,id desc);

create function private.profile_content_page(
 p_person uuid,p_filter text,p_query text,p_cursor text,p_page_size integer
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); kind text:=coalesce(p_filter,'all');
 needle text:=nullif(btrim(p_query),''); size integer:=greatest(1,least(coalesce(p_page_size,6),20));
 cursor_time timestamptz; cursor_id uuid; page_rows jsonb; total integer;
 next_value text; last_row jsonb; friends jsonb; squads jsonb;
begin
 if uid is null then raise exception 'Sign in to view profiles.'; end if;
 if kind not in ('all','upcoming','past','albums') then raise exception 'Choose a valid profile section.'; end if;
 if char_length(needle)>80 then raise exception 'Search is limited to 80 characters.'; end if;
 if not private.can_profile(p_person) or private.blocked(p_person) then
  return jsonb_build_object('rows','[]'::jsonb,'nextCursor',null,'beaconCount',0,'friendIds','[]'::jsonb,'squadIds','[]'::jsonb);
 end if;
 if p_cursor is not null then
  begin
   if char_length(p_cursor)>180 or length(p_cursor)-length(replace(p_cursor,'|',''))<>1 then raise exception 'Invalid cursor'; end if;
   cursor_time:=split_part(p_cursor,'|',1)::timestamptz;
   cursor_id:=split_part(p_cursor,'|',2)::uuid;
   if cursor_time is null or cursor_id is null then raise exception 'Invalid cursor'; end if;
  exception when others then raise exception 'Profile cursor is invalid.';
  end;
 end if;
 select coalesce(jsonb_agg(person order by person),'[]'::jsonb) into friends from (
  select distinct case when f.sender_id=p_person then f.recipient_id else f.sender_id end person
  from public.friendships f where f.status='accepted' and p_person in (f.sender_id,f.recipient_id)
 ) candidates where not private.blocked(person) and
  (p_person=uid or (private.friends(person) and private.can_profile(person)));
 select coalesce(jsonb_agg(s.id order by s.id),'[]'::jsonb) into squads
 from public.squads s where private.social_active('squad',s.id,p_person)
  and private.social_active('squad',s.id,uid) and private.social_entity_visible('squad',s.id,uid);

 with activities as materialized (
  select a.*, (a.owner_id=p_person or private.beacon_approved_going(a.id,p_person)) participated
  from public.activities a where a.mode<>'solo' and private.can_activity(a.id)
   and not (a.plan_id is not null and a.plan_step is not null and a.plan_started_at is null and a.status='scheduled')
 ), eligible as materialized (
  select a.*, own_media.photos,own_media.videos,own_media.cover,
   exists(select 1 from public.beacon_memories m where m.activity_id=a.id
     and a.enable_experiences and private.can_chat(a.id) and private.can_profile(m.author_id) and not private.blocked(m.author_id)) has_memories
  from activities a
  cross join lateral (
   select count(*) filter(where m.media_type='image')::integer photos,
    count(*) filter(where m.media_type='video')::integer videos,
    (array_agg(m.object_path order by m.created_at desc,m.id desc) filter(where m.media_type='image'))[1] cover
   from public.beacon_memories m where m.activity_id=a.id and m.author_id=p_person
    and a.enable_experiences and private.can_chat(a.id) and private.can_profile(m.author_id) and not private.blocked(m.author_id)
  ) own_media
  where ((kind='albums' and a.status='completed' and own_media.photos+own_media.videos>0)
    or (kind<>'albums' and a.participated))
   and (kind not in ('past','upcoming') or
    (kind='past' and (a.status<>'scheduled' or a.ends_at<=now())) or
    (kind='upcoming' and a.status='scheduled' and a.ends_at>now()))
   and (needle is null or position(lower(needle) in lower(a.title||' '||a.category))>0)
   and (cursor_time is null or
    (kind='upcoming' and (a.starts_at,a.id)>(cursor_time,cursor_id)) or
    (kind<>'upcoming' and (a.starts_at,a.id)<(cursor_time,cursor_id)))
 ), selected as (
  select * from eligible order by
   case when kind='upcoming' then starts_at end asc,
   case when kind<>'upcoming' then starts_at end desc,
   case when kind='upcoming' then id end asc,
   case when kind<>'upcoming' then id end desc limit size+1
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'title',title,'category',category,'startsAt',starts_at,'endsAt',ends_at,'status',status,
  'role',case when owner_id=p_person then 'host' else 'attendee' end,
  'photoCount',photos,'videoCount',videos,'coverPath',cover,'hasMemories',has_memories
 ) order by case when kind='upcoming' then starts_at end asc,case when kind<>'upcoming' then starts_at end desc,
   case when kind='upcoming' then id end asc,case when kind<>'upcoming' then id end desc),'[]'::jsonb),
 (select count(*)::integer from activities where participated)
 into page_rows,total from selected;
 if jsonb_array_length(page_rows)>size then
  page_rows:=page_rows-(jsonb_array_length(page_rows)-1);
  last_row:=page_rows->(size-1);
  next_value:=to_char((last_row->>'startsAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')||'|'||(last_row->>'id');
 end if;
 return jsonb_build_object('rows',page_rows,'nextCursor',next_value,'beaconCount',total,'friendIds',friends,'squadIds',squads);
end $$;
revoke all on function private.profile_content_page(uuid,text,text,text,integer) from public,anon;
grant execute on function private.profile_content_page(uuid,text,text,text,integer) to authenticated;
create function public.profile_content_page(
 p_person uuid,p_filter text default 'all',p_query text default null,p_cursor text default null,p_page_size integer default 6
) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.profile_content_page(p_person,p_filter,p_query,p_cursor,p_page_size);
$$;
revoke all on function public.profile_content_page(uuid,text,text,text,integer) from public,anon;
grant execute on function public.profile_content_page(uuid,text,text,text,integer) to authenticated;

-- Preserve the existing projection, adding only the viewer-safe hide-featured bit.
create or replace function private.profile_snapshot_data() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare people jsonb; grants jsonb; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sign in to view profiles.'; end if;
 select coalesce(jsonb_agg(
  case
   when p.id=uid then to_jsonb(p)||jsonb_build_object('viewer_can_view_full_profile',true)
   when private.can_profile(p.id) then
    (to_jsonb(p)-array['default_audience','timezone','quiet_start','quiet_end','profile_visibility','onboarding_survey_status','featured_activity_id','hide_featured'])
    ||jsonb_build_object(
      'viewer_can_view_full_profile',true,
      'viewer_profile_feature_hidden',p.hide_featured,
      'viewer_featured_activity_id',case
       when not p.hide_featured and p.featured_activity_id is not null and exists(
        select 1 from public.activities a where a.id=p.featured_activity_id and a.owner_id=p.id and private.can_activity(a.id)
       ) then p.featured_activity_id else null end
    )
   else jsonb_build_object('id',p.id,'username',p.username,'name',p.name,'viewer_can_view_full_profile',false)
  end order by p.name,p.id
 ),'[]'::jsonb) into people
 from public.profiles p where private.can_profile(p.id) or private.can_minimal_profile(p.id);
 select coalesce(jsonb_agg(jsonb_build_object('owner_id',g.owner_id,'kind',g.kind,'target_id',g.target_id) order by g.kind,g.target_id),'[]'::jsonb)
 into grants from (
  select owner_id,'person'::text kind,person_id target_id from private.profile_visibility_people where owner_id=uid
  union all select owner_id,'squad'::text kind,squad_id target_id from private.profile_visibility_squads where owner_id=uid
  union all select owner_id,'list'::text kind,list_id target_id from private.profile_visibility_lists where owner_id=uid
  union all select owner_id,'organization'::text kind,organization_id target_id from private.profile_visibility_organizations where owner_id=uid
 ) g;
 return jsonb_build_object('profiles',people,'profile_visibility_grants',grants);
end $$;
