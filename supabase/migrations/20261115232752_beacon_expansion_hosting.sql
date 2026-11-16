-- Stage 2: optional questions and scoped hosting. Sensitive answers never enter shared configs.
alter table private.premium_tool_configs drop constraint premium_tool_configs_kind_check;
alter table private.premium_tool_configs add constraint premium_tool_configs_kind_check check(kind in ('focus','appearance','teams','memories','council','agenda','hosting'));
create table private.beacon_attendee_details(activity_id uuid references public.activities on delete cascade,user_id uuid references public.profiles on delete cascade,answers jsonb not null default '{}',organizer_note text not null default '' check(length(organizer_note)<=1000),group_label text,checked_in_at timestamptz,reminders boolean not null default true,revision integer not null default 0,primary key(activity_id,user_id));
alter table private.beacon_attendee_details enable row level security;
revoke all on private.beacon_attendee_details from public,anon,authenticated;
alter function private.feature_required_tier(text) rename to feature_required_tier_before_hosting;
create function private.feature_required_tier(feature text) returns text language sql immutable set search_path='' as $$select case when feature='hosting' then 'plus' when feature='hosting_coordination' then 'pro' else private.feature_required_tier_before_hosting(feature) end$$;
revoke all on function private.feature_required_tier_before_hosting(text),private.feature_required_tier(text) from public,anon,authenticated;
alter function private.validate_tool_config(text,jsonb) rename to validate_tool_config_before_hosting;
create function private.validate_tool_config(kind text,s jsonb) returns void language plpgsql immutable set search_path='' as $$declare h jsonb:=s->'hosting';q jsonb;begin
 if kind<>'hosting' then perform private.validate_tool_config_before_hosting(kind,s);return;end if;
 if jsonb_typeof(s) is distinct from 'object' or octet_length(s::text)>12000 or exists(select 1 from jsonb_object_keys(s) k where k<>'hosting') or jsonb_typeof(h) is distinct from 'object' then raise exception 'Choose a compact hosting configuration.';end if;
 if jsonb_typeof(h->'enabled') is distinct from 'boolean' or jsonb_typeof(h->'check_in') is distinct from 'boolean' or exists(select 1 from jsonb_object_keys(h) k where k not in ('enabled','questions','groups','check_in','coordinators')) or jsonb_typeof(h->'questions') is distinct from 'array' or not coalesce(private.valid_text_array(h->'groups',12,60),false) or not coalesce(private.valid_text_array(h->'coordinators',12,64),false) then raise exception 'Choose valid hosting options.';end if;
 if jsonb_array_length(h->'questions')>8 then raise exception 'Use up to eight RSVP questions.';end if;
 for q in select value from jsonb_array_elements(h->'questions') loop
  if jsonb_typeof(q) is distinct from 'object' or not q ?& array['id','label'] or jsonb_typeof(q->'id')<>'string' or (q->>'id')!~'^[A-Za-z0-9_-]{1,64}$' or jsonb_typeof(q->'label')<>'string' or length(btrim(q->>'label')) not between 1 and 160 or exists(select 1 from jsonb_object_keys(q) k where k not in ('id','label')) then raise exception 'Choose valid RSVP questions.';end if;
 end loop;
 if (select count(*) from jsonb_array_elements(h->'questions'))<>(select count(distinct question->>'id') from jsonb_array_elements(h->'questions') question) then raise exception 'Use unique questions.';end if;
end $$;
revoke all on function private.validate_tool_config_before_hosting(text,jsonb),private.validate_tool_config(text,jsonb) from public,anon,authenticated;
alter function private.tool_feature(text,jsonb) rename to tool_feature_before_hosting;
create function private.tool_feature(kind text,s jsonb) returns text language sql immutable set search_path='' as $$select case when kind='hosting' then case when (s->'hosting'->>'check_in')::boolean or jsonb_array_length(s->'hosting'->'coordinators')>0 then 'hosting_coordination' else 'hosting' end else private.tool_feature_before_hosting(kind,s) end$$;
revoke all on function private.tool_feature_before_hosting(text,jsonb),private.tool_feature(text,jsonb) from public,anon,authenticated;

alter function private.expansion_action(text,jsonb,uuid) rename to expansion_action_before_hosting;
create function private.expansion_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid:=(payload->>'activity_id')::uuid;target uuid;h jsonb;old private.beacon_attendee_details;result jsonb;manager boolean;owner uuid;q record;begin
 if auth.uid() is null then raise exception 'Sign in to continue.';end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>auth.uid()::text then raise exception 'Your account changed.';end if;
 if action in ('save_tool_config','save_tool_preset') and payload->>'kind'='hosting' then
  perform private.validate_tool_config('hosting',payload->'settings');
  if action='save_tool_config' then
   if not private.can_manage_beacon(aid) then raise exception 'Organizer access required.';end if;
   if jsonb_array_length(payload->'settings'->'hosting'->'coordinators')>0 then
    select owner_id into owner from public.activities where id=aid;
    if auth.uid()<>owner and not exists(select 1 from public.beacon_roles where activity_id=aid and user_id=auth.uid() and role='coowner') then raise exception 'Only owners and co-hosts can delegate check-in.';end if;
    if exists(select 1 from jsonb_array_elements_text(payload->'settings'->'hosting'->'coordinators') c where c::uuid<>owner and (not private.beacon_approved_going(aid,c::uuid) or private.blocked(c::uuid))) then raise exception 'Choose current participants as coordinators.';end if;
   end if;
  else payload:=jsonb_set(payload,'{settings,hosting,coordinators}','[]');end if;
 end if;
 if action not in ('save_rsvp_answers','save_host_record','set_agenda_reminders') then return private.expansion_action_before_hosting(action,payload,request_id);end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select r.result into result from private.requests r where user_id=auth.uid() and r.request_id=$3;if found then return result;end if;
 perform 1 from public.activities where id=aid and status<>'cancelled' for update;
 if not found or not private.can_chat(aid) then raise exception 'Participant details unavailable.';end if;
 target:=case when action='save_host_record' then (payload->>'user_id')::uuid else auth.uid() end;
 select owner_id into owner from public.activities where id=aid;
 if target<>owner and (not private.beacon_approved_going(aid,target) or private.blocked(target)) then raise exception 'Choose a current participant.';end if;
 select settings->'hosting' into h from private.premium_tool_configs where activity_id=aid and kind='hosting';
 manager:=private.can_manage_beacon(aid);
 select * into old from private.beacon_attendee_details where activity_id=aid and user_id=target for update;
 if coalesce(old.revision,-1)<>coalesce((payload->>'revision')::integer,-2) then raise exception 'These participant details changed. Reopen them.';end if;
 if action='set_agenda_reminders' then
  if jsonb_typeof(payload->'reminders') is distinct from 'boolean' then raise exception 'Choose a reminder preference.';end if;
 elsif action='save_rsvp_answers' then
  if not coalesce((h->>'enabled')::boolean,false) or jsonb_typeof(payload->'answers') is distinct from 'object' or octet_length((payload->'answers')::text)>6000 then raise exception 'RSVP questions unavailable.';end if;
  for q in select * from jsonb_each(payload->'answers') loop
   if jsonb_typeof(q.value)<>'string' or length(q.value#>>'{}')>500 or not exists(select 1 from jsonb_array_elements(h->'questions') question where question->>'id'=q.key) then raise exception 'Choose valid answers up to 500 characters.';end if;
  end loop;
 else
  if not coalesce((h->>'enabled')::boolean,false) or not (manager or coalesce(h->'coordinators','[]') ? auth.uid()::text) then raise exception 'Organizer access required.';end if;
  if payload ?| array['organizer_note','group_label'] then
   if not manager then raise exception 'Only organizers can edit private notes and groups.';end if;
   perform private.require_premium_feature('hosting',aid);
   if jsonb_typeof(payload->'organizer_note') is distinct from 'string' or length(payload->>'organizer_note')>1000 or (payload->'group_label'<>'null'::jsonb and not coalesce(h->'groups','[]') ? (payload->>'group_label')) then raise exception 'Choose valid organizer details.';end if;
  end if;
  if payload ? 'checked_in' and (jsonb_typeof(payload->'checked_in') is distinct from 'boolean' or not coalesce((h->>'check_in')::boolean,false)) then raise exception 'Check-in unavailable.';end if;
 end if;
 perform private.limit_action('all',300);
 insert into private.beacon_attendee_details(activity_id,user_id,answers,organizer_note,group_label,checked_in_at,reminders,revision)
 values(aid,target,case when action='save_rsvp_answers' then payload->'answers' else coalesce(old.answers,'{}') end,
 case when action='save_host_record' and payload ? 'organizer_note' then payload->>'organizer_note' else coalesce(old.organizer_note,'') end,
 case when action='save_host_record' and payload ? 'group_label' then payload->>'group_label' else old.group_label end,
 case when action='save_host_record' and payload ? 'checked_in' then case when (payload->>'checked_in')::boolean then now() else null end else old.checked_in_at end,
 case when action='set_agenda_reminders' then (payload->>'reminders')::boolean else coalesce(old.reminders,true) end,coalesce(old.revision,-1)+1)
 on conflict(activity_id,user_id) do update set answers=excluded.answers,organizer_note=excluded.organizer_note,group_label=excluded.group_label,checked_in_at=excluded.checked_in_at,reminders=excluded.reminders,revision=excluded.revision;
 result:=jsonb_build_object('id',target);insert into private.requests(user_id,request_id,result) values(auth.uid(),$3,result);return result;
end $$;
revoke all on function private.expansion_action_before_hosting(text,jsonb,uuid),private.expansion_action(text,jsonb,uuid) from public,anon;
grant execute on function private.expansion_action(text,jsonb,uuid) to authenticated;
-- Internal chain entry point must not be directly callable.
revoke all on function private.expansion_action_before_hosting(text,jsonb,uuid) from authenticated;
create function private.attendee_details_projection() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('activity_id',d.activity_id,'user_id',d.user_id,'group_label',d.group_label,'checked_in_at',d.checked_in_at,'revision',d.revision)||case when d.user_id=auth.uid() or private.can_manage_beacon(d.activity_id) then jsonb_build_object('answers',d.answers,'reminders',d.reminders) else '{}'::jsonb end||case when private.can_manage_beacon(d.activity_id) then jsonb_build_object('organizer_note',d.organizer_note) else '{}'::jsonb end),'[]'::jsonb)
 from private.beacon_attendee_details d where private.can_chat(d.activity_id) and not private.blocked(d.user_id) and (d.user_id=(select owner_id from public.activities where id=d.activity_id) or private.beacon_approved_going(d.activity_id,d.user_id))
$$;
revoke all on function private.attendee_details_projection() from public,anon;
grant execute on function private.attendee_details_projection() to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_hosting;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$declare s jsonb;begin s:=public.beacon_snapshot_before_hosting();return s||jsonb_build_object('attendee_details',private.attendee_details_projection(),'capabilities',coalesce(s->'capabilities','{}')||'{"beacon_hosting":true}'::jsonb);end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
-- Free notification preferences also apply at delivery, including quiet-hour retries.
do $migration$ declare definition text;begin
 select pg_get_functiondef('private.send_agenda_reminders()'::regprocedure) into definition;
 definition:=replace(definition,'if private.can_chat(row.activity_id) then','if private.can_chat(row.activity_id) and not exists(select 1 from private.beacon_attendee_details d where d.activity_id=row.activity_id and d.user_id=recipient and not d.reminders) then');execute definition;
 select pg_get_functiondef('private.agenda_push_valid(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'private.can_chat(a.id)','private.can_chat(a.id) and not exists(select 1 from private.beacon_attendee_details d where d.activity_id=a.id and d.user_id=auth.uid() and not d.reminders)');execute definition;
end $migration$;

-- Editing timing generates one authorized notice per participant, within the config write.
create function private.agenda_schedule_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare before_times jsonb;after_times jsonb;recipient uuid;actor uuid:=auth.uid();prior_sub text:=current_setting('request.jwt.claim.sub',true);nid uuid;begin
 if new.kind<>'agenda' or not coalesce((new.settings->'agenda'->>'enabled')::boolean,false) or not coalesce((old.settings->'agenda'->>'enabled')::boolean,false) then return new;end if;
 select jsonb_agg(jsonb_build_array(r->>'id',r->>'label',r->>'offset',r->>'minutes') order by r->>'id') into before_times from jsonb_array_elements(old.settings->'agenda'->'steps') r;
 select jsonb_agg(jsonb_build_array(r->>'id',r->>'label',r->>'offset',r->>'minutes') order by r->>'id') into after_times from jsonb_array_elements(new.settings->'agenda'->'steps') r;
 if before_times is not distinct from after_times then return new;end if;
 if not exists(select 1 from public.activities where id=new.activity_id and status='scheduled') then return new;end if;
 for recipient in select owner_id from public.activities where id=new.activity_id union select user_id from public.rsvps where activity_id=new.activity_id and private.beacon_approved_going(new.activity_id,user_id) loop
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  if recipient is distinct from actor and private.can_chat(new.activity_id) and not exists(select 1 from private.beacon_attendee_details where activity_id=new.activity_id and user_id=recipient and not reminders) then
   insert into public.notices(recipient_id,actor_id,body,activity_id) values(recipient,actor,'The activity agenda changed. Review the latest timings.',new.activity_id) returning id into nid;
   insert into private.push_queue(notice_id,token) select nid,token from public.push_tokens where user_id=recipient;
  end if;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);return new;
end $$;
revoke all on function private.agenda_schedule_notice() from public,anon,authenticated;
create trigger agenda_schedule_notice after update on private.premium_tool_configs for each row execute function private.agenda_schedule_notice();
