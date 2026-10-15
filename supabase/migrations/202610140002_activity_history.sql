-- A bounded history projection lets the activity screens page history without
-- expanding the authenticated snapshot or exposing unrelated Beacon details.
create index if not exists activities_history_cursor
 on public.activities(starts_at desc,id desc);

create function public.activity_history_page(
 p_query text default null,
 p_cursor text default null,
 p_page_size integer default 3
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();
 query_text text:=nullif(btrim(p_query),'');
 cursor_parts text[];
 cursor_starts timestamptz;
 cursor_id uuid;
 page_size integer:=greatest(1,least(coalesce(p_page_size,3),20));
 result_rows jsonb;
 more_rows boolean;
 cursor_starts_out timestamptz;
 cursor_id_out uuid;
 next_cursor text;
begin
 if uid is null then raise exception 'Sign in to view activity history.'; end if;
 if query_text is not null and char_length(query_text)>80 then
  raise exception 'Activity history search is limited to 80 characters.';
 end if;
 if p_cursor is not null then
  if char_length(p_cursor)>180 or length(p_cursor)-length(replace(p_cursor,'|',''))<>1 then
   raise exception 'Activity history cursor is invalid.';
  end if;
  cursor_parts:=string_to_array(p_cursor,'|');
  begin
   cursor_starts:=cursor_parts[1]::timestamptz;
   cursor_id:=cursor_parts[2]::uuid;
  exception when others then
   raise exception 'Activity history cursor is invalid.';
  end;
 end if;

 with selected as materialized (
  select
   a.id,a.owner_id,a.title,a.category,a.mode,a.status,a.starts_at,a.ends_at,a.timezone,
   case when a.owner_id=uid or private.can_profile(a.owner_id) then owner_profile.name else null end owner_name,
   case when a.owner_id=uid then 'host' else 'attendee' end viewer_role,
   viewer_rsvp.status viewer_rsvp_status
  from public.activities a
  left join public.profiles owner_profile on owner_profile.id=a.owner_id
  left join public.rsvps viewer_rsvp on viewer_rsvp.activity_id=a.id and viewer_rsvp.user_id=uid
  where (a.status in ('cancelled','completed') or a.ends_at<=now())
   and a.mode<>'solo'
   and not (a.plan_id is not null and a.plan_step is not null and a.plan_started_at is null and a.status='scheduled')
   and private.can_activity(a.id)
   and (
    a.owner_id=uid
    or (private.can_chat(a.id) and private.beacon_approved_going(a.id,uid))
   )
   and (
    query_text is null
    or position(lower(query_text) in lower(coalesce(a.title,'')||' '||coalesce(a.category,'')||' '||coalesce(a.description,'')))>0
    or (private.can_profile(a.owner_id) and position(lower(query_text) in lower(coalesce(owner_profile.name,'')))>0)
   )
   and (cursor_starts is null or (a.starts_at,a.id)<(cursor_starts,cursor_id))
  order by a.starts_at desc,a.id desc
  limit page_size+1
 ), page as (
  select * from selected order by starts_at desc,id desc limit page_size
 ), encoded as (
  select
   coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'owner_id',owner_id,
    'title',title,
    'category',category,
    'mode',mode,
    'status',status,
    'history_label',case when status='cancelled' then 'cancelled' when status='completed' then 'completed' else 'ended' end,
    'starts_at',starts_at,
    'ends_at',ends_at,
    'timezone',timezone,
    'owner_name',owner_name,
    'viewer_role',viewer_role,
    'viewer_rsvp_status',viewer_rsvp_status
   ) order by starts_at desc,id desc),'[]'::jsonb) rows,
   count(*)::integer row_count,
   (array_agg(starts_at order by starts_at asc,id asc))[1] cursor_starts,
   (array_agg(id order by starts_at asc,id asc))[1] cursor_id
  from page
 ), more as (
  select count(*)>page_size has_more from selected
 )
 select encoded.rows,more.has_more,encoded.cursor_starts,encoded.cursor_id
 into result_rows,more_rows,cursor_starts_out,cursor_id_out
 from encoded cross join more;

 if more_rows and cursor_starts_out is not null then
  next_cursor:=to_char(cursor_starts_out at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')||'|'||cursor_id_out::text;
 end if;
 return jsonb_build_object(
  'rows',coalesce(result_rows,'[]'::jsonb),
  'has_more',more_rows,
  'next_cursor',next_cursor
 );
end $$;

revoke all on function public.activity_history_page(text,text,integer) from public,anon;
grant execute on function public.activity_history_page(text,text,integer) to authenticated;
