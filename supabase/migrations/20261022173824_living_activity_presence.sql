
-- Activity Notes reuse activities; owner presence is independent of note lifetime.
alter table public.activities add column solo_purpose text not null default 'status_note' check(solo_purpose in ('status_note','activity_note')), add column superseded_at timestamptz;
alter table public.activities add constraint activity_note_solo check(solo_purpose<>'activity_note' or mode='solo');
create index activities_solo_purpose on public.activities(owner_id,solo_purpose,starts_at desc) where mode='solo' and status='scheduled';
create table private.presence_config(
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 sharing boolean not null default true, availability text check(availability in ('available','busy')), availability_until timestamptz,
 audience public.audience_kind not null default 'friends', audience_id uuid,
 show_current_beacon boolean not null default false,current_beacon_id uuid);
alter table private.presence_config enable row level security;
revoke all on private.presence_config from public,anon,authenticated;
insert into private.presence_config
 select distinct on(a.owner_id) a.owner_id,coalesce(c.sharing,true),case when a.available then 'available' when a.available=false then 'busy' end,a.ends_at,a.audience,a.audience_id,coalesce(c.show_current_beacon,false),c.current_beacon_id
 from public.activities a left join private.status_config c on c.activity_id=a.id where a.mode='solo' and a.status='scheduled' and a.starts_at<=now() and a.ends_at>now() order by a.owner_id,a.starts_at desc,a.id;
alter table private.presence_config add column availability_audience public.audience_kind not null default 'friends', add column availability_audience_id uuid;
update private.presence_config set availability_audience=audience,availability_audience_id=audience_id;
-- Preserve validated Status writers, excluding the new purpose from their queries.
do $$ declare def text; f regprocedure; begin
 foreach f in array array['public.beacon_action_atomic_creation_legacy(text,jsonb,uuid)'::regprocedure,'public.beacon_action(text,jsonb,uuid)'::regprocedure] loop
 select pg_get_functiondef(f) into def;
 if position('mode=''solo''' in def)=0 then raise exception 'Status writer changed; review Activity Note isolation before enabling this capability.'; end if;
 execute replace(def,'mode=''solo''','mode=''solo'' and solo_purpose=''status_note''');
 end loop;
end $$;
create or replace function private.can_activity(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.activities a where a.id=aid and not private.blocked(a.owner_id)
 and (a.owner_id=auth.uid() or (
 not exists(select 1 from private.status_config c where c.activity_id=a.id and (not c.sharing or a.starts_at>now()))
 and (a.mode<>'solo' or not exists(select 1 from private.presence_config p where p.owner_id=a.owner_id and not p.sharing))
 and (a.solo_purpose<>'activity_note' or a.status='scheduled' and a.starts_at<=now() and a.ends_at>now()
 and not exists(select 1 from private.presence_config pc cross join lateral private.status_current_candidates(a.owner_id) candidate
 where pc.owner_id=a.owner_id and pc.show_current_beacon and (pc.current_beacon_id is null or candidate.id=pc.current_beacon_id)))))
 and not exists(select 1 from private.activity_exclusions e where e.activity_id=aid and e.user_id=auth.uid())
 and (private.audience(a.owner_id,a.audience,a.audience_id) or (a.audience<>'organization' and exists(select 1 from public.rsvps r where r.activity_id=aid and r.user_id=auth.uid() and r.approved))));
$$;
create function private.reconcile_current_activity(person uuid) returns void language plpgsql security definer set search_path='' as $$
declare p private.presence_config;
begin
 select * into p from private.presence_config where owner_id=person;
 if coalesce(p.show_current_beacon,false) and exists(select 1 from private.status_current_candidates(person) x where p.current_beacon_id is null or x.id=p.current_beacon_id) then
 update public.activities set status='completed',superseded_at=now(),ends_at=greatest(starts_at+interval '1 millisecond',least(ends_at,now()))
 where owner_id=person and solo_purpose='activity_note' and status='scheduled' and starts_at<=now() and ends_at>now();
 end if;
end $$;
revoke all on function private.reconcile_current_activity(uuid) from public,anon,authenticated;
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_living_activity;
revoke all on function public.beacon_action_before_living_activity(text,jsonb,uuid) from public,anon,authenticated;
do $$ declare def text; begin
 select pg_get_functiondef('public.beacon_action_before_living_activity(text,jsonb,uuid)'::regprocedure) into def;
 execute replace(def,'beacon_action.request_id','beacon_action_before_living_activity.request_id');
end $$;
create function private.living_activity_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a public.activities; p private.presence_config; value jsonb; result jsonb; prior jsonb; aid uuid;
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
 if payload ? 'availability_until' and (nullif(payload->>'availability_until','')::timestamptz is null or (payload->>'availability_until')::timestamptz<=now() or (payload->>'availability_until')::timestamptz>now()+interval '24 hours') then raise exception 'Choose a valid availability duration up to 24 hours.'; end if;
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
 availability_until=case when payload ? 'availability' then coalesce(nullif(payload->>'availability_until','')::timestamptz,now()+interval '1 hour') else availability_until end,
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
revoke all on function private.living_activity_action(text,jsonb,uuid) from public,anon;
grant execute on function private.living_activity_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$
 select private.living_activity_action(action,payload,request_id);
$$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_living_activity;
revoke all on function public.beacon_snapshot_before_living_activity() from public,anon,authenticated;
create function private.living_presence_projection(person uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p private.presence_config; candidate_id uuid; candidate_role text; a public.activities; selected jsonb:=null; presence_visible boolean; availability_visible boolean;
begin
 select * into p from private.presence_config where owner_id=person;
 if not found or auth.uid() is null then return null; end if;
 if private.blocked(person) then return null; end if;
 presence_visible:=auth.uid()=person or private.audience(person,p.audience,p.audience_id);
 availability_visible:=auth.uid()=person or private.audience(person,p.availability_audience,p.availability_audience_id);
 if p.sharing or auth.uid()=person then
 if p.show_current_beacon then select x.id,x.role into candidate_id,candidate_role from private.status_current_candidates(person) x where p.current_beacon_id is null or x.id=p.current_beacon_id limit 1; end if;
 if candidate_id is not null then
 if presence_visible and private.can_activity(candidate_id) then selected:=jsonb_build_object('type','beacon','id',candidate_id,'role',candidate_role); end if;
 else
 select * into a from public.activities where owner_id=person and solo_purpose='activity_note' and status='scheduled' and starts_at<=now() and ends_at>now() order by starts_at desc,id limit 1;
 if a.id is not null and private.can_activity(a.id) then selected:=jsonb_build_object('type','activity_note','id',a.id); end if;
 end if; end if;
 if not presence_visible and not availability_visible and selected is null then return null; end if;
 return jsonb_build_object('owner_id',person,'sharing',p.sharing,'availability',case when availability_visible and p.availability_until>now() then p.availability end,'availability_until',case when availability_visible then p.availability_until end,'current_activity',selected)
 ||case when auth.uid()=person then jsonb_build_object('current_audience',p.audience,'current_audience_id',p.audience_id,'availability_audience',p.availability_audience,'availability_audience_id',p.availability_audience_id,'show_current_beacon',p.show_current_beacon,'current_beacon_id',p.current_beacon_id) else '{}'::jsonb end;
end $$;
revoke all on function private.living_presence_projection(uuid) from public,anon;
grant execute on function private.living_presence_projection(uuid) to authenticated;
grant execute on function public.beacon_snapshot_before_living_activity() to authenticated;
create function private.living_presence_snapshot(people uuid[]) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(private.living_presence_projection(p.owner_id)),'[]'::jsonb)
 from private.presence_config p where auth.uid() is not null and (p.owner_id=auth.uid() or p.owner_id=any(people))
 and private.living_presence_projection(p.owner_id) is not null;
$$;
revoke all on function private.living_presence_snapshot(uuid[]) from public,anon;
grant execute on function private.living_presence_snapshot(uuid[]) to authenticated;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
 result:=public.beacon_snapshot_before_living_activity();
 return result||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}'::jsonb)||jsonb_build_object('living_activity',true),
 'presence',private.living_presence_snapshot(array(select (person->>'id')::uuid from jsonb_array_elements(result->'profiles') person)));

end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

do $$ declare def text; begin
 select pg_get_functiondef('public.activity_history_page(text,text,integer)'::regprocedure) into def;
 execute replace(def,'and a.mode<>''solo''','and (a.mode<>''solo'' or a.solo_purpose=''activity_note'' and a.owner_id=uid)');
end $$;
