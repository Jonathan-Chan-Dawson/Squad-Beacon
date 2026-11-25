-- Keep availability on the existing private, audience-filtered presence record.
alter table private.presence_config
  add column availability_started_at timestamptz,
  add column availability_mode text check (availability_mode in ('timed','indefinite')),
  add column availability_note text check (length(availability_note)<=120);

create or replace function private.living_activity_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a public.activities; p private.presence_config; value jsonb; result jsonb; prior jsonb; aid uuid;
 availability_end timestamptz; availability_kind text; extension_minutes integer;
 ending timestamptz; target_audience public.audience_kind; target_audience_id uuid; future_edit boolean;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and nullif(payload->>'expected_actor_id','')::uuid is distinct from uid then raise exception 'Your account changed.'; end if;
 if action not in ('save_activity_note','end_activity_note','update_presence','reconcile_current_activity','save_status_note','clear_status_notes','edit_activity','open_status') then
 return public.beacon_action_before_living_activity(action,payload,request_id); end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into prior from private.requests r where r.user_id=uid and r.request_id=living_activity_action.request_id;
 if found then return prior; end if;
 if action in ('save_status_note','edit_activity','open_status') then
 select * into a from public.activities where id=coalesce(nullif(payload->>'source_id',''),nullif(payload->>'id',''))::uuid;
 if a.solo_purpose='activity_note' then raise exception 'Use the Activity Note editor.'; end if;
 end if;
 if action in ('save_status_note','clear_status_notes','edit_activity','open_status') then
 result:=public.beacon_action_before_living_activity(action,payload,request_id);
 future_edit:=coalesce(nullif(payload->>'starts_at','')::timestamptz,a.starts_at,now())>now();
 if action='save_status_note' and not future_edit then
 insert into private.presence_config(owner_id) values(uid) on conflict do nothing;
 update private.presence_config set sharing=coalesce((payload->>'status_sharing')::boolean,sharing),
 show_current_beacon=coalesce((payload->>'status_show_current_beacon')::boolean,show_current_beacon),
 current_beacon_id=case when payload ? 'status_current_beacon_id' then nullif(payload->>'status_current_beacon_id','')::uuid else current_beacon_id end where owner_id=uid;
 perform private.reconcile_current_activity(uid);
 end if; return result;
 end if;
 insert into private.presence_config(owner_id) values(uid) on conflict do nothing;
 select * into p from private.presence_config where owner_id=uid for update;
 if action='update_presence' then
 if payload ? 'availability' and payload->>'availability' is not null and payload->>'availability' not in ('available','busy') then raise exception 'Choose valid availability.'; end if;
 if payload ? 'current_beacon_id' and payload->>'current_beacon_id' is not null and coalesce((payload->>'show_current_beacon')::boolean,p.show_current_beacon) then
 if not exists(select 1 from private.status_current_candidates(uid) x where payload->>'current_beacon_id' is null or x.id=nullif(payload->>'current_beacon_id','')::uuid) then raise exception 'Choose an eligible live Beacon.'; end if; end if;
 if payload ? 'availability_extend_minutes' then
   if payload ?| array['availability','availability_until','availability_mode','availability_note'] then
     raise exception 'Extend availability separately.';
   end if;
   extension_minutes:=(payload->>'availability_extend_minutes')::integer;
   if extension_minutes is null or extension_minutes not in (30,60)
       or p.availability is null or p.availability_until is null or p.availability_until<=now() then
     raise exception 'Choose an active timed availability to extend.';
   end if;
   availability_end:=p.availability_until+make_interval(mins=>extension_minutes);
 elsif payload ? 'availability' then
   availability_kind:=coalesce(payload->>'availability_mode','timed');
   if availability_kind not in ('timed','indefinite') then raise exception 'Choose valid availability.'; end if;
   if length(btrim(coalesce(payload->>'availability_note','')))>120 then
     raise exception 'Availability notes can be up to 120 characters.';
   end if;
   if payload->>'availability' is not null and availability_kind='timed' then
     availability_end:=case when payload ? 'availability_until' then (payload->>'availability_until')::timestamptz
       else now()+interval '1 hour' end;
     if availability_end is null then raise exception 'Choose a valid availability duration up to 24 hours.'; end if;
   end if;
 elsif payload ?| array['availability_until','availability_mode','availability_note'] then
   raise exception 'Choose Free or Busy with those availability details.';
 end if;
 if availability_end<=now() or availability_end>now()+interval '24 hours' then
   raise exception 'Choose a valid availability duration up to 24 hours.';
 end if;
 if payload ? 'current_audience' then
 perform private.validate_audience((payload->>'current_audience')::public.audience_kind,nullif(payload->>'current_audience_id','')::uuid);
 end if;
 if payload ? 'availability_audience' then
 perform private.validate_audience((payload->>'availability_audience')::public.audience_kind,nullif(payload->>'availability_audience_id','')::uuid);
 end if;
 update private.presence_config set audience=coalesce((payload->>'current_audience')::public.audience_kind,audience),
 audience_id=case when payload ? 'current_audience' then nullif(payload->>'current_audience_id','')::uuid else audience_id end, availability_audience=coalesce((payload->>'availability_audience')::public.audience_kind,availability_audience),
 availability_audience_id=case when payload ? 'availability_audience' then nullif(payload->>'availability_audience_id','')::uuid else availability_audience_id end,
 availability=case when payload ? 'availability' then payload->>'availability' else availability end,
 availability_until=case when payload ?| array['availability','availability_extend_minutes'] then availability_end else availability_until end,
 availability_started_at=case when payload ? 'availability' then
   case when payload->>'availability' is null then null
     when p.availability=payload->>'availability' and p.availability_mode=availability_kind
       and p.availability_until is not distinct from availability_end then coalesce(p.availability_started_at,now())
     else now() end else availability_started_at end,
 availability_mode=case when payload ? 'availability' then
   case when payload->>'availability' is not null then availability_kind end else availability_mode end,
 availability_note=case when payload ? 'availability' then
   case when payload->>'availability' is not null then nullif(btrim(payload->>'availability_note'),'') end else availability_note end,
 sharing=coalesce((payload->>'sharing')::boolean,sharing),show_current_beacon=coalesce((payload->>'show_current_beacon')::boolean,show_current_beacon),
 current_beacon_id=case when payload ? 'current_beacon_id' then nullif(payload->>'current_beacon_id','')::uuid else current_beacon_id end where owner_id=uid;
 if payload ? 'sharing' then
 update private.status_config c set sharing=(payload->>'sharing')::boolean from public.activities status_row where c.activity_id=status_row.id and status_row.owner_id=uid and status_row.solo_purpose='status_note' and status_row.status='scheduled' and status_row.starts_at<=now() and status_row.ends_at>now();
 end if;
 perform private.reconcile_current_activity(uid);
 elsif action='reconcile_current_activity' then perform private.reconcile_current_activity(uid);
 elsif action='end_activity_note' then
 select * into a from public.activities where id=nullif(payload->>'id','')::uuid and owner_id=uid and solo_purpose='activity_note' for update;
 if not found then raise exception 'Choose your own Activity Note.'; end if;
 update public.activities set status='completed',ends_at=greatest(starts_at+interval '1 millisecond',least(ends_at,now())) where id=a.id and status='scheduled'; aid:=a.id;
 elsif action='save_activity_note' then
 if nullif(payload->>'id','') is not null then
 select * into a from public.activities where id=(payload->>'id')::uuid and owner_id=uid and solo_purpose='activity_note' and status='scheduled' and ends_at>now() for update;
 if not found then raise exception 'This Activity Note ended. Start a new activity.'; end if;
 elsif exists(select 1 from public.activities where owner_id=uid and solo_purpose='activity_note' and status='scheduled' and starts_at<=now() and ends_at>now()) then raise exception 'Edit or end your current Activity Note first.'; end if;
 if p.show_current_beacon and exists(select 1 from private.status_current_candidates(uid) x where p.current_beacon_id is null or x.id=p.current_beacon_id) then raise exception 'Manage your Current Beacon first.'; end if;
 ending:=nullif(payload->>'ends_at','')::timestamptz;
 if ending is null or ending<=now() or ending>now()+interval '24 hours' then raise exception 'Choose a valid duration up to 24 hours.'; end if;
 if char_length(btrim(coalesce(payload->>'title',''))) not between 1 and 120 or char_length(coalesce(payload->>'description',''))>2000 then raise exception 'Give your activity a title up to 120 characters and details up to 2000 characters.'; end if;
 if payload->>'category' is null or payload->>'category' not in ('Fitness','Study','Gaming','Creative','Social','Other') then raise exception 'Choose a category.'; end if;
 target_audience:=coalesce(payload->>'audience','friends')::public.audience_kind; target_audience_id:=nullif(payload->>'audience_id','')::uuid;
 perform private.validate_audience(target_audience,target_audience_id);
 if char_length(coalesce(payload->>'label',''))>160 then raise exception 'Keep the place name under 160 characters.'; end if;
 if not exists(select 1 from pg_timezone_names where name=payload->>'timezone') then raise exception 'Choose a valid timezone.'; end if;
 if a.id is null then
 value:=payload||jsonb_build_object('mode','solo','starts_at',now(),'ends_at',ending,'available',false,'approval_required',false,'target_count',null,'enable_chat',false,'enable_comments',false,'enable_reactions',false);
 result:=public.beacon_action_before_living_activity('create_activity',value,gen_random_uuid()); aid:=(result->>'id')::uuid;
 else aid:=a.id; end if;
 update public.activities set solo_purpose='activity_note',title=btrim(payload->>'title'),description=coalesce(payload->>'description',''),category=payload->>'category',
 ends_at=ending,audience=target_audience,audience_id=target_audience_id,decoration_emoji=nullif(payload->>'decoration_emoji',''),enable_chat=false,enable_comments=false,enable_reactions=false,enable_checklist=false,enable_journal=false,enable_experiences=false,enable_focus=false,enable_scoreboard=false,enable_music=false where id=aid;
 insert into public.places(activity_id,label) values(aid,coalesce(payload->>'label','')) on conflict(activity_id) do update set label=excluded.label,latitude=null,longitude=null,online_url=null;
 end if;
 result:=jsonb_build_object('event',action,'id',aid,'committed',true);
 insert into private.requests(user_id,request_id,result) values(uid,living_activity_action.request_id,result); return result;
end $$;

create or replace function private.living_presence_projection(person uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p private.presence_config; candidate_id uuid; candidate_role text; a public.activities; selected jsonb:=null; presence_visible boolean; availability_visible boolean; availability_active boolean;
begin
 select * into p from private.presence_config where owner_id=person;
 if not found or auth.uid() is null then return null; end if;
 if private.blocked(person) then return null; end if;
 presence_visible:=auth.uid()=person or private.audience(person,p.audience,p.audience_id);
 availability_visible:=auth.uid()=person or private.audience(person,p.availability_audience,p.availability_audience_id);
 availability_active:=availability_visible and p.availability is not null and
   (p.availability_mode='indefinite' or p.availability_until>now());
 if p.sharing or auth.uid()=person then
 if p.show_current_beacon then select x.id,x.role into candidate_id,candidate_role from private.status_current_candidates(person) x where p.current_beacon_id is null or x.id=p.current_beacon_id limit 1; end if;
 if candidate_id is not null then
 if presence_visible and private.can_activity(candidate_id) then selected:=jsonb_build_object('type','beacon','id',candidate_id,'role',candidate_role); end if;
 else
 select * into a from public.activities where owner_id=person and solo_purpose='activity_note' and status='scheduled' and starts_at<=now() and ends_at>now() order by starts_at desc,id limit 1;
 if a.id is not null and private.can_activity(a.id) then selected:=jsonb_build_object('type','activity_note','id',a.id); end if;
 end if; end if;
 if not presence_visible and not availability_visible and selected is null then return null; end if;
 return jsonb_build_object('owner_id',person,'sharing',p.sharing,
   'availability',case when availability_active then p.availability end,
   'availability_until',case when availability_active then p.availability_until end,
   'availability_started_at',case when availability_active then p.availability_started_at end,
   'availability_mode',case when availability_active then coalesce(p.availability_mode,'timed') end,
   'availability_note',case when availability_active then p.availability_note end,
   'current_activity',selected)
 ||case when auth.uid()=person then jsonb_build_object('current_audience',p.audience,'current_audience_id',p.audience_id,'availability_audience',p.availability_audience,'availability_audience_id',p.availability_audience_id,'show_current_beacon',p.show_current_beacon,'current_beacon_id',p.current_beacon_id) else '{}'::jsonb end;
end $$;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_timed_availability;
revoke all on function public.beacon_snapshot_before_timed_availability() from public,anon;
grant execute on function public.beacon_snapshot_before_timed_availability() to authenticated;
create function public.beacon_snapshot() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb;
begin
  snapshot:=public.beacon_snapshot_before_timed_availability();
  return snapshot||jsonb_build_object('capabilities',coalesce(snapshot->'capabilities','{}'::jsonb)||'{"timed_availability":true}'::jsonb);
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
