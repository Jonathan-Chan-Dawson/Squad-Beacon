-- Opt-in preferences remain private; current Beacon details are always derived.
alter table private.status_config add column show_current_beacon boolean not null default false,
 add column current_beacon_id uuid;
-- Keep stale Specific references so deletion never silently switches to Automatic.
alter table public.activities drop constraint activities_title_check;
alter table public.activities add constraint activities_title_check
 check(length(title)<=120 and (mode='solo' or length(btrim(title))>=1));

create function private.status_current_candidates(person uuid)
returns table(id uuid,role text,starts_at timestamptz) language sql stable security definer set search_path='' as $$
 select a.id, case when a.owner_id=person then 'hosting'
  when exists(select 1 from public.beacon_roles r where r.activity_id=a.id and r.user_id=person and r.role='coowner') then 'cohosting'
  else 'going' end, a.starts_at
 from public.activities a
 where person is not null and a.mode<>'solo' and a.status='scheduled' and a.starts_at<=now() and a.ends_at>now()
  and not(a.plan_id is not null and a.plan_step is not null and a.plan_started_at is null)
  and private.beacon_person_visible(a.id,person)
  and (a.owner_id=person or private.beacon_approved_going(a.id,person))
 order by case when a.owner_id=person or exists(select 1 from public.beacon_roles r where r.activity_id=a.id and r.user_id=person and r.role='coowner') then 0 else 1 end,
  a.starts_at desc,a.id;
$$;
revoke all on function private.status_current_candidates(uuid) from public,anon,authenticated;

create or replace function private.status_projection(aid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c private.status_config; a public.activities; attachment jsonb:=null; current_beacon jsonb:=null;
 owner boolean; candidate record;
begin
 if auth.uid() is null or not private.can_activity(aid) then return null; end if;
 select * into a from public.activities where id=aid and mode='solo';
 if not found then return jsonb_build_object('viewer_can_read',true); end if;
 select * into c from private.status_config where activity_id=aid;
 if not found then return jsonb_build_object('viewer_can_read',true); end if;
 owner:=a.owner_id=auth.uid();
 if c.attachment_id is not null and (owner or (
  c.sharing and not c.note_hidden and c.presentation<>'text_only' and a.status='scheduled' and a.starts_at<=now() and a.ends_at>now()
  and private.status_feature_eligible(c.owner_id,c.attachment_type,c.attachment_id)
  and case when c.attachment_type='beacon' then private.can_activity(c.attachment_id) else private.can_read_planning_thread(c.attachment_id) end
 )) then attachment:=jsonb_build_object('type',c.attachment_type,'id',c.attachment_id); end if;
 if c.show_current_beacon and c.sharing and a.status='scheduled' and a.starts_at<=now() and a.ends_at>now() then
  -- Choose for the owner FIRST. Viewer permissions never change the selection.
  select * into candidate from private.status_current_candidates(c.owner_id) x
   where c.current_beacon_id is null or x.id=c.current_beacon_id limit 1;
  if found and private.can_activity(candidate.id) then
   current_beacon:=jsonb_build_object('id',candidate.id,'role',candidate.role);
  end if;
 end if;
 return jsonb_build_object('viewer_can_read',true,
  'title',case when owner then c.note_title when c.note_hidden or c.presentation='activity_only' then '' else c.note_title end,
  'description',case when owner then c.note_description when c.note_hidden or c.presentation='activity_only' then '' else c.note_description end,
  'status_attachment',attachment,'status_presentation',c.presentation,'status_sharing',c.sharing,'status_note_hidden',c.note_hidden,
  'status_current_beacon',current_beacon)
 ||case when owner then jsonb_build_object('status_show_current_beacon',c.show_current_beacon,'status_current_beacon_id',c.current_beacon_id,
  'own_status_note',jsonb_build_object('title',c.note_title,'description',c.note_description)) else '{}'::jsonb end;
end $$;
revoke all on function private.status_projection(uuid) from public,anon;
grant execute on function private.status_projection(uuid) to authenticated;

create or replace function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=private.beacon_snapshot_before_status_attachments();
 result:=result||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}'::jsonb)||jsonb_build_object('status_attachments',true,'status_privacy',true,'status_current_beacon',true));
 return jsonb_set(result,'{activities}',coalesce((select jsonb_agg(x||private.status_projection((x->>'id')::uuid))
  from jsonb_array_elements(result->'activities') x where private.status_projection((x->>'id')::uuid) is not null),'[]'::jsonb));
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

-- Remove the legacy new-Status fallback. Actual blank values pass to the same
-- canonical activity writers; non-solo title constraints remain unchanged.
do $$ declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_atomic_creation_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 if position('coalesce(source.title,''Free to hang'')' in definition)=0 then raise exception 'Status writer changed; review blank-title migration.'; end if;
 definition:=replace(definition,'coalesce(source.title,''Free to hang'')','coalesce(source.title,'''')');
 -- A replacement current record keeps the source start, avoiding a transient
 -- future Status when a reader's clock snapshot predates the save by milliseconds.
 definition:=replace(definition,'coalesce(nullif(payload->>''starts_at'','''')::timestamptz,now())',
  'coalesce(nullif(payload->>''starts_at'','''')::timestamptz,case when source.status=''scheduled'' and source.starts_at<=now() and source.ends_at>now() then source.starts_at else now() end)');
 execute definition;
end $$;

create or replace function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
<<status_save>>
declare uid uuid:=auth.uid(); source public.activities; c private.status_config; result jsonb; prior jsonb;
 aid uuid; target uuid; kind text; presentation_mode text; note text; detail text; sharing boolean; hidden boolean; value jsonb; show_current boolean; current_id uuid; independent_current boolean;
begin
 -- Canonical response actions retain their existing authorization and semantics.
 if action not in ('save_status_note','edit_activity','react_status') then
  return private.beacon_action_before_status_attachments(action,payload,request_id);
 end if;
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if action='react_status' then
  aid:=nullif(payload->>'id','')::uuid;
  if exists(select 1 from private.status_config s where s.activity_id=aid and (not s.sharing or s.note_hidden)) then raise exception 'This status is hidden.'; end if;
  return private.beacon_action_before_status_attachments(action,payload,request_id);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
 if found then return prior; end if;
 if action='edit_activity' then
  select * into source from public.activities where id=nullif(payload->>'id','')::uuid for update;
  if not found or source.mode<>'solo' then return private.beacon_action_before_status_attachments(action,payload,request_id); end if;
 else
  if nullif(payload->>'source_id','') is not null then
   select * into source from public.activities where id=(payload->>'source_id')::uuid for update;
  else
   select * into source from public.activities where owner_id=uid and mode='solo' and status='scheduled' and starts_at<=now() and ends_at>now() order by starts_at desc,id limit 1 for update;
  end if;
 end if;
 if source.id is not null and (source.owner_id<>uid or source.mode<>'solo') then raise exception 'Choose your own status note.'; end if;
 select * into c from private.status_config where activity_id=source.id;
 -- A newly scheduled Status does not inherit the current Status configuration.
 if action='save_status_note' and nullif(payload->>'source_id','') is null and nullif(payload->>'starts_at','')::timestamptz>now() then c:=null; end if;
 if action='edit_activity' and c.activity_id is null then return private.beacon_action_before_status_attachments(action,payload,request_id); end if;
 presentation_mode:=coalesce(payload->>'status_presentation',c.presentation,'text_only');
 if presentation_mode not in ('text_only','activity_only','text_activity') then raise exception 'Choose a valid Status presentation.'; end if;
 sharing:=coalesce((payload->>'status_sharing')::boolean,c.sharing,true);
 hidden:=coalesce((payload->>'status_note_hidden')::boolean,c.note_hidden,false);
 independent_current:=action='save_status_note' and nullif(payload->>'starts_at','')::timestamptz>now()
  and (source.id is null or source.starts_at<=now());
 show_current:=coalesce((payload->>'status_show_current_beacon')::boolean,case when independent_current then false else c.show_current_beacon end,false);
 current_id:=case when payload ? 'status_current_beacon_id' then nullif(payload->>'status_current_beacon_id','')::uuid
  when independent_current then null else c.current_beacon_id end;
 if current_id is not null and current_id is distinct from c.current_beacon_id
  and not exists(select 1 from private.status_current_candidates(uid) x where x.id=current_id) then
  raise exception 'Choose one of your eligible current Beacons.';
 end if;
 note:=coalesce(payload->>'status_note_title',payload->>'title',c.note_title,source.title,'');
 detail:=coalesce(payload->>'status_note_description',payload->>'description',c.note_description,source.description,'');
 if char_length(note)>120 or char_length(detail)>2000 then raise exception 'Add a note of up to 120 characters.'; end if;
 if payload ? 'status_attachment' then
  if payload->'status_attachment'<>'null'::jsonb and jsonb_typeof(payload->'status_attachment')<>'object' then raise exception 'Choose a valid attachment.'; end if;
  kind:=payload->'status_attachment'->>'type'; target:=nullif(payload->'status_attachment'->>'id','')::uuid;
 else kind:=c.attachment_type; target:=c.attachment_id; end if;
 if (kind is null)<>(target is null) or (kind is not null and kind not in ('beacon','ping','vote','draw')) then raise exception 'Choose a valid attachment.'; end if;
 -- Retain an existing unavailable selection; reject newly selected unavailable content.
 if target is not null and (target is distinct from c.attachment_id or kind is distinct from c.attachment_type) then
  if not private.status_feature_eligible(uid,kind,target) or not (case when kind='beacon' then private.can_activity(target) else private.can_read_planning_thread(target) end) then
   raise exception 'Choose an eligible activity you own or cohost.';
  end if;
 end if;
 value:=payload||jsonb_build_object('title',case when hidden or not sharing or presentation_mode='activity_only' then '' else note end,
  'description',case when hidden or not sharing or presentation_mode='activity_only' then '' else detail end);
 result:=private.beacon_action_before_status_attachments(action,value,request_id);
 aid:=case when action='edit_activity' then source.id else nullif(result->>'id','')::uuid end;
 if aid is null then raise exception 'Status could not be verified.'; end if;
 insert into private.status_config(activity_id,owner_id,note_title,note_description,attachment_type,attachment_id,presentation,sharing,note_hidden,show_current_beacon,current_beacon_id)
 values(aid,uid,note,detail,kind,target,presentation_mode,sharing,hidden,show_current,current_id)
 on conflict(activity_id) do update set note_title=excluded.note_title,note_description=excluded.note_description,
  attachment_type=excluded.attachment_type,attachment_id=excluded.attachment_id,presentation=excluded.presentation,sharing=excluded.sharing,note_hidden=excluded.note_hidden,
  show_current_beacon=excluded.show_current_beacon,current_beacon_id=excluded.current_beacon_id;
 if action='save_status_note' and source.id is not null and source.starts_at>now() and source.id<>aid then
  perform private.beacon_action_before_status_attachments('activity_status',jsonb_build_object('id',source.id,'status','cancelled'),gen_random_uuid());
  result:=result||jsonb_build_object('replaced_scheduled',true);
  update private.requests r set result=status_save.result where r.user_id=uid and r.request_id=beacon_action.request_id;
 end if;
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
