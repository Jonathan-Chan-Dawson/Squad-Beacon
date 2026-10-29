-- Phase 5.2, authorized by the combined Phase 5 request and renewed instruction
-- to continue and finish after the Phase 5.1 local gate. Source/local tests only.
alter table private.guest_shares drop constraint guest_shares_kind_check;
alter table private.guest_shares add constraint guest_shares_kind_check check(kind in ('beacon','decision','plan','status'));
alter table private.guest_shares add column status_snapshot text;
do $$ declare tab text; begin
 foreach tab in array array['planning_ping_responses','planning_votes','planning_availability','planning_approval_ballots','planning_availability_history'] loop
 execute format('alter table public.%I drop constraint %I',tab,tab||'_user_id_fkey');
 execute format('alter table public.%I add constraint %I foreign key(user_id) references auth.users on delete cascade',tab,tab||'_user_id_fkey');
 end loop;
end $$;
create or replace function private.remove_member_guest_participation() returns trigger language plpgsql security definer set search_path='' as $$ begin
 delete from public.rsvps where user_id=old.id;
 delete from public.planning_ping_responses where user_id=old.id;
 delete from public.planning_votes where user_id=old.id;
 delete from public.planning_availability where user_id=old.id;
 delete from public.planning_approval_ballots where user_id=old.id;
 delete from public.planning_availability_history where user_id=old.id;
 return old;
end $$;
create or replace function private.guest_share_valid(s private.guest_shares) returns boolean language sql stable security definer set search_path='' as $$
 select s.id is not null and s.revoked_at is null and (s.expires_at is null or s.expires_at>now()) and case s.kind
 when 'beacon' then exists(select 1 from public.activities a where a.id=s.target_id and a.mode<>'solo' and a.owner_id=s.owner_id)
 when 'decision' then exists(select 1 from public.planning_threads t where t.id=s.target_id and t.owner_id=s.owner_id)
 when 'plan' then exists(select 1 from public.plans p where p.id=s.target_id and p.owner_id=s.owner_id and not p.routine_source and p.status<>'cancelled')
 when 'status' then exists(select 1 from public.activities a left join private.status_config c on c.activity_id=a.id and c.owner_id=a.owner_id where a.id=s.target_id and a.owner_id=s.owner_id and a.mode='solo' and a.solo_purpose='status_note' and a.status='scheduled' and a.superseded_at is null and a.starts_at<=now() and a.ends_at>now() and nullif(btrim(case when c.activity_id is null then a.title else c.note_title end),'') is not null)
 else false end;
$$;
-- Provenance remains effective when a link expires/revokes. Host removal or
-- blocks still exclude responses. Claiming transfers this provenance atomically.
create function private.guest_planning_participant(tid uuid, person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.guest_shares s join private.guest_response_access a on a.share_id=s.id
 where s.kind='decision' and s.target_id=tid and s.owner_id=(select owner_id from public.planning_threads where id=tid) and a.user_id=person and private.guest_actor_allowed(s,person));
$$;
create function private.guest_verified_participant(person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=person and email_confirmed_at is not null) and (
 exists(select 1 from private.guest_identities where user_id=person and claimed_at is null)
 or (exists(select 1 from public.profiles where id=person) and not exists(select 1 from private.guest_identities where user_id=person and claimed_at is not null and claimed_by is distinct from person)));
$$;
create or replace function public.guest_identity(actor uuid, display_name text, birth date) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verify your email first.'; end if;
 if exists(select 1 from private.guest_identities where user_id=actor and claimed_at is not null and claimed_by is distinct from actor) then raise exception 'Use the member account that claimed these responses.'; end if;
 if birth is null or birth>current_date-interval '16 years' or birth<current_date-interval '120 years' then raise exception 'Squad Beacon is for ages 16 and older.'; end if;
 if char_length(trim(coalesce(display_name,''))) not between 1 and 80 then raise exception 'Enter your name.'; end if;
 insert into private.guest_identities(user_id,name,birth_date) values(actor,trim(display_name),birth) on conflict(user_id) do nothing;
 return jsonb_build_object('verified',true);
end $$;
-- Retained historical guest rows remain manageable after claiming. Responses
-- already represented by a real member profile use the ordinary member UI.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.guest_attendance(uuid,uuid,uuid,text)'::regprocedure);
 execute replace(definition,'g.claimed_at is null','not exists(select 1 from public.profiles p where p.id=g.user_id)');
end $$;
create or replace function private.can_read_planning_member(tid uuid,member_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.planning_threads t where t.id=tid and private.can_read_planning_thread(tid)
 and (private.planning_eligible(t.owner_id,member_id,t.audience,t.audience_id) or private.guest_planning_participant(tid,member_id)) and not private.blocked(member_id));
$$;
-- Only participant eligibility changes. Proposal review, tie selection, Draw
-- randomness, host authority and publication stay in their canonical functions.
do $$ declare f regprocedure; definition text; original text; begin
 foreach f in array array['private.planning_vote_counts(uuid)'::regprocedure,'private.planning_vote_leaders(uuid)'::regprocedure,'private.apply_planning_action(text,jsonb)'::regprocedure,'private.apply_planning_action_before_connected(text,jsonb)'::regprocedure] loop
 definition:=pg_get_functiondef(f); original:=definition;
 definition:=replace(definition,'private.planning_eligible(t.owner_id,b.user_id,t.audience,t.audience_id)','(private.planning_eligible(t.owner_id,b.user_id,t.audience,t.audience_id) or private.guest_planning_participant(t.id,b.user_id))');
 definition:=replace(definition,'private.planning_eligible(t.owner_id,v.user_id,t.audience,t.audience_id)','(private.planning_eligible(t.owner_id,v.user_id,t.audience,t.audience_id) or private.guest_planning_participant(t.id,v.user_id))');
 definition:=replace(definition,'private.planning_eligible(t.owner_id,a.user_id,t.audience,t.audience_id)','(private.planning_eligible(t.owner_id,a.user_id,t.audience,t.audience_id) or private.guest_planning_participant(t.id,a.user_id))');
 definition:=replace(definition,'private.planning_eligible(thread.owner_id,v.user_id,thread.audience,thread.audience_id)','(private.planning_eligible(thread.owner_id,v.user_id,thread.audience,thread.audience_id) or private.guest_planning_participant(thread.id,v.user_id))');
 if definition=original then raise exception 'Review changed canonical planning tallies before guest rollout.'; end if;
 execute definition;
 end loop;
end $$;

alter function public.guest_share_manage(uuid,text,text,uuid,jsonb,text) rename to guest_share_manage_beacon;
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.guest_share_manage_beacon(uuid,text,text,uuid,jsonb,text)'::regprocedure);
 execute replace(definition,'guest_share_manage.kind','guest_share_manage_beacon.kind');
end $$;
revoke all on function public.guest_share_manage_beacon(uuid,text,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
create function public.guest_share_manage(actor uuid, command text, kind text, target uuid, settings jsonb default '{}', new_hash text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.guest_shares; owner uuid; source_title text; note text; source_end timestamptz; stops uuid[]; begin
 if kind='beacon' then return public.guest_share_manage_beacon(actor,command,kind,target,settings,new_hash); end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if not exists(select 1 from public.profiles where id=actor) then raise exception 'Finish your member profile first.'; end if;
 if kind='decision' then
  perform 1 from public.planning_threads where id=target for update;
  if not private.can_manage_planning_thread(target) or not private.can_read_planning_thread(target) then raise exception 'Organizer access required.'; end if;
  select owner_id,title into owner,source_title from public.planning_threads where id=target;
 elsif kind='plan' then
  perform 1 from public.plans where id=target for update;
  if not private.can_edit_living_plan(target) then raise exception 'Organizer access required.'; end if;
  select owner_id,title into owner,source_title from public.plans where id=target and not routine_source and status<>'cancelled';
 elsif kind='status' then
  select a.owner_id,coalesce(c.note_title,a.title),a.ends_at into owner,note,source_end from public.activities a left join private.status_config c on c.activity_id=a.id and c.owner_id=a.owner_id where a.id=target and a.owner_id=actor and a.mode='solo' and a.solo_purpose='status_note' and a.status='scheduled' and a.superseded_at is null and a.starts_at<=now() and a.ends_at>now();
  source_title:='A note from Squad Beacon';
 else raise exception 'This item does not support guest sharing.'; end if;
 if owner is null then raise exception 'This item is unavailable.'; end if;
 select * into s from private.guest_shares g where g.kind=guest_share_manage.kind and g.target_id=target and g.revoked_at is null;
 if command='read' then return jsonb_build_object('enabled',s.id is not null,'access',s.access,'expires_at',s.expires_at,'preview_title',s.preview_title,'preview_description',s.preview_description,'area_label',s.area_label,'stop_ids',s.stop_ids); end if;
 if command='revoke' then update private.guest_shares set revoked_at=now() where id=s.id; return jsonb_build_object('enabled',false); end if;
 if command not in ('enable','regenerate') then raise exception 'Unknown sharing action.'; end if;
 perform private.guest_limit('share:'||actor::text,60);
 if new_hash is null or new_hash !~ '^[a-f0-9]{64}$' then raise exception 'Generate a secure invitation.'; end if;
 if coalesce(settings->>'access','') not in ('preview','participate') or (kind in ('plan','status') and settings->>'access'<>'preview') then raise exception 'Choose guest access.'; end if;
 if settings->>'expires_at' is not null and ((settings->>'expires_at')::timestamptz<=now() or not isfinite((settings->>'expires_at')::timestamptz)) then raise exception 'Choose a future expiry.'; end if;
 if kind='status' and (settings->>'expires_at' is null or (settings->>'expires_at')::timestamptz>source_end) then raise exception 'Status sharing must expire before the note ends.'; end if;
 if kind='status' and (nullif(btrim(note),'') is null or settings->>'status_text' is distinct from note) then raise exception 'Status Note changed. Review it before sharing.'; end if;
 stops:=array(select value::uuid from jsonb_array_elements_text(coalesce(settings->'stop_ids','[]')));
 if kind='plan' and (cardinality(stops)=0 or exists(select 1 from unnest(stops) x where not exists(select 1 from public.plan_stops p where p.id=x and p.plan_id=target and p.approval='approved' and p.state='active'))) then raise exception 'Select approved Plan stops to share.'; end if;
 update private.guest_shares set revoked_at=now() where id=s.id;
 insert into private.guest_shares(owner_id,kind,target_id,token_hash,access,expires_at,preview_title,preview_description,area_label,stop_ids,status_snapshot)
 values(owner,kind,target,new_hash,settings->>'access',(settings->>'expires_at')::timestamptz,coalesce(nullif(trim(settings->>'preview_title'),''),source_title),coalesce(settings->>'preview_description',''),coalesce(settings->>'area_label',''),stops,case when kind='status' then note end) returning * into s;
 return jsonb_build_object('enabled',true,'access',s.access,'expires_at',s.expires_at,'stop_ids',s.stop_ids);
end $$;

-- Follow a result/selected stop using the parent capability. The child must
-- independently have valid guest access; no raw child token is stored/recovered.
create function private.guest_target_share(link_hash text, target uuid, actor uuid) returns private.guest_shares language plpgsql stable security definer set search_path='' as $$
declare parent private.guest_shares; child private.guest_shares; allowed boolean:=false; expected_kind text; begin
 select * into parent from private.guest_shares where token_hash=link_hash;
 if not private.guest_share_valid(parent) or not private.guest_actor_allowed(parent,actor) then return null; end if;
 if target is null then return parent; end if;
 if parent.kind='decision' then select materialized_activity_id=target into allowed from public.planning_threads where id=parent.target_id; expected_kind:='beacon';
 elsif parent.kind='plan' then
  select case when p.activity_id=target or t.materialized_activity_id=target then 'beacon' else 'decision' end into expected_kind
  from public.plan_stops p left join public.planning_threads t on t.id=p.thread_id
  where p.id=any(parent.stop_ids) and p.plan_id=parent.target_id and p.approval='approved' and p.state='active' and (p.activity_id=target or p.thread_id=target or t.materialized_activity_id=target)
  order by p.position,p.id limit 1;
  allowed:=expected_kind is not null;
 end if;
 if not coalesce(allowed,false) then return null; end if;
 select * into child from private.guest_shares s where s.target_id=target and s.kind=expected_kind and private.guest_share_valid(s) order by s.created_at desc limit 1;
 if not private.guest_actor_allowed(child,actor) then return null; end if;
 return child;
end $$;

alter function public.guest_preview(text,uuid) rename to guest_preview_beacon;
revoke all on function public.guest_preview_beacon(text,uuid) from public,anon,authenticated,service_role;
create function public.guest_preview(link_hash text, actor uuid default null, target uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.guest_shares; child private.guest_shares; t public.planning_threads; stop public.plan_stops; result jsonb; items jsonb; saved jsonb; title text; begin
 s:=private.guest_target_share(link_hash,target,actor);
 if s.id is null then return jsonb_build_object('state','unavailable'); end if;
 if s.kind='beacon' then return public.guest_preview_beacon(s.token_hash,actor)||jsonb_build_object('verified',private.guest_verified_participant(actor)); end if;
 result:=jsonb_build_object('state','open','kind',s.kind,'title',s.preview_title,'description',s.preview_description,'area_label',s.area_label,'access',s.access,
 'verified',private.guest_verified_participant(actor));
 if s.kind='status' then return result||jsonb_build_object('note',s.status_snapshot,'expires_at',s.expires_at); end if;
 if s.kind='plan' then
  items:='[]';
  for stop in select * from public.plan_stops p where p.plan_id=s.target_id and p.id=any(s.stop_ids) and p.approval='approved' and p.state='active' order by p.position,p.id loop
   child:=private.guest_target_share(link_hash,coalesce(stop.activity_id,stop.thread_id),actor);
   if child.id is null and stop.thread_id is not null then child:=private.guest_target_share(link_hash,stop.thread_id,actor); end if;
   if stop.activity_id is null and stop.thread_id is null then
    items:=items||jsonb_build_array(jsonb_build_object('id',stop.id,'title',stop.title,'starts_at',stop.proposed_at));
   elsif child.id is not null then
    items:=items||jsonb_build_array(jsonb_build_object('id',stop.id,'title',child.preview_title,'starts_at',stop.proposed_at,'target',child.target_id));
   end if;
  end loop;
  return result||jsonb_build_object('stops',items,'app_path','/plan/'||s.target_id::text);
 end if;
 select * into t from public.planning_threads where id=s.target_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.payload->>'title','starts_at',p.payload->>'starts_at','ends_at',p.payload->>'ends_at','timezone',p.payload->>'timezone') order by p.created_at,p.id),'[]'::jsonb) into items
 from public.planning_proposals p where p.thread_id=t.id and p.approved and p.disqualified_at is null and private.planning_eligible(t.owner_id,p.author_id,t.audience,t.audience_id) and not exists(select 1 from public.blocks b where (b.blocker_id=p.author_id and b.blocked_id=actor) or (b.blocked_id=p.author_id and b.blocker_id=actor));
 result:=result||jsonb_build_object('kind',t.kind,'deadline_at',t.deadline_at,'vote_method',t.vote_method,'options',items,'status',t.status,'state',case when t.status<>'open' or t.finalized_at is not null or t.deadline_at<=now() then 'closed' else 'open' end,
 'slots_revision',t.slots_revision,'selected_slot_id',t.selected_slot_id,'winner_proposal_id',t.winner_proposal_id,
 'result_target',case when exists(select 1 from private.guest_shares c where c.kind='beacon' and c.target_id=t.materialized_activity_id and private.guest_share_valid(c) and private.guest_actor_allowed(c,actor)) then t.materialized_activity_id end,
 'app_path','/council/'||t.id::text);
 if t.kind='ping' then select jsonb_build_object('response',response,'available_after',available_after) into saved from public.planning_ping_responses where thread_id=t.id and user_id=actor;
 elsif t.kind='vote' and t.vote_method='approval' then select jsonb_build_object('proposal_ids',proposal_ids,'none_work',none_work) into saved from public.planning_approval_ballots where thread_id=t.id and user_id=actor;
 elsif t.kind='vote' then select jsonb_build_object('proposal_id',proposal_id) into saved from public.planning_votes where thread_id=t.id and user_id=actor;
 elsif t.kind='time' then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'starts_at',starts_at,'ends_at',ends_at,'timezone',timezone) order by starts_at),'[]'::jsonb) into items from public.planning_slots where thread_id=t.id and retired_at is null;
  result:=result||jsonb_build_object('slots',items);
  select jsonb_build_object('answers',answers,'none_work',none_work,'slots_revision',slots_revision) into saved from public.planning_availability where thread_id=t.id and user_id=actor;
 end if;
 return result||jsonb_build_object('saved',saved);
end $$;

alter function public.guest_respond(text,uuid,text,jsonb,uuid) rename to guest_respond_beacon;
revoke all on function public.guest_respond_beacon(text,uuid,text,jsonb,uuid) from public,anon,authenticated,service_role;
do $$ declare definition text; original text; begin
 definition:=pg_get_functiondef('public.guest_respond_beacon(text,uuid,text,jsonb,uuid)'::regprocedure); original:=definition;
 definition:=replace(definition,'not exists(select 1 from private.guest_identities where user_id=actor and claimed_at is null) or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null)','not private.guest_verified_participant(actor)');
 if definition=original then raise exception 'Review changed guest identity guard before enabling claiming.'; end if;
 execute definition;
end $$;
create function public.guest_respond(link_hash text, actor uuid, command text, payload jsonb, request uuid, target uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.guest_shares; t public.planning_threads; p uuid; ids uuid[]; v jsonb; item record; result jsonb; fp jsonb; previous private.guest_requests; begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 s:=private.guest_target_share(link_hash,target,actor);
 if s.kind='beacon' then
  if target is not null then
   perform 1 from public.activities where id=s.target_id for update;
   perform 1 from private.guest_shares where token_hash=link_hash for share;
   s:=private.guest_target_share(link_hash,target,actor);
   if s.id is null then raise exception 'Guest participation is unavailable.'; end if;
  end if;
  return public.guest_respond_beacon(s.token_hash,actor,command,payload,request);
 end if;
 if s.id is null or s.kind<>'decision' or s.access<>'participate' then raise exception 'Guest participation is unavailable.'; end if;
 if not private.guest_verified_participant(actor) then raise exception 'Verify your email first.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(private.planning_root(s.target_id)::text,11));
 select * into t from public.planning_threads where id=s.target_id for update;
 perform 1 from private.guest_shares where token_hash=link_hash for share;
 perform 1 from private.guest_shares where id=s.id for share;
 s:=private.guest_target_share(link_hash,target,actor);
 if s.id is null or s.access<>'participate' then raise exception 'Guest participation is unavailable.'; end if;
 fp:=jsonb_build_object('share',s.id,'command',command,'payload',payload);
 select * into previous from private.guest_requests where user_id=actor and request_id=request;
 if found then if previous.fingerprint<>fp then raise exception 'This request was already used.'; end if; return previous.result; end if;
 if t.status<>'open' or t.deadline_at<=now() or t.finalized_at is not null or t.materialized_activity_id is not null or t.not_organized_at is not null or t.continuation_closed_at is not null then raise exception 'Responses are closed.'; end if;
 perform private.guest_limit('respond:'||actor::text,120);
 if command='ping' and t.kind='ping' then
  if coalesce(payload->>'response','') not in ('interested','maybe','pass') then raise exception 'Choose a supported response.'; end if;
  if coalesce((payload->>'auto_rsvp')::boolean,false) then raise exception 'Guest planning responses do not automatically RSVP.'; end if;
  if payload->>'available_after' is not null and (payload->>'response'<>'interested' or payload->>'available_after' !~* '(Z|[+-][0-9]{2}:[0-9]{2})$') then raise exception 'Choose a valid availability time for Interested.'; end if;
  insert into public.planning_ping_responses(thread_id,user_id,response,auto_rsvp,available_after) values(t.id,actor,payload->>'response',false,(payload->>'available_after')::timestamptz)
  on conflict(thread_id,user_id) do update set response=excluded.response,auto_rsvp=false,available_after=excluded.available_after,updated_at=now();
 elsif command='vote' and t.kind='vote' then
  if t.vote_method='approval' then
   if jsonb_typeof(payload->'proposal_ids') is distinct from 'array' then raise exception 'Choose approved options.'; end if;
   ids:=array(select value::uuid from jsonb_array_elements_text(payload->'proposal_ids'));
   if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or coalesce((payload->>'none_work')::boolean,false)<>(cardinality(ids)=0) then raise exception 'Choose options or None work.'; end if;
  else ids:=array[(payload->>'proposal_id')::uuid]; end if;
  foreach p in array ids loop
   if p is null or not exists(select 1 from public.planning_proposals o where o.id=p and o.thread_id=t.id and o.approved and o.disqualified_at is null and o.activity_id is null and (o.payload->>'starts_at')::timestamptz>now() and private.planning_eligible(t.owner_id,o.author_id,t.audience,t.audience_id) and not exists(select 1 from public.blocks where (blocker_id=o.author_id and blocked_id=actor) or (blocked_id=o.author_id and blocker_id=actor))) then raise exception 'Choose eligible approved options.'; end if;
  end loop;
  if t.vote_method='approval' then insert into public.planning_approval_ballots values(t.id,actor,ids,cardinality(ids)=0,now()) on conflict(thread_id,user_id) do update set proposal_ids=excluded.proposal_ids,none_work=excluded.none_work,updated_at=now();
  else insert into public.planning_votes(thread_id,proposal_id,user_id) values(t.id,ids[1],actor) on conflict(thread_id,user_id) do update set proposal_id=excluded.proposal_id,updated_at=now(); end if;
 elsif command='availability' and t.kind='time' then
  if (payload->>'slots_revision')::integer is distinct from t.slots_revision then raise exception 'Proposed times changed. Refresh before saving.'; end if;
  v:=payload->'answers'; if jsonb_typeof(v) is distinct from 'object' then raise exception 'Choose valid availability.'; end if;
  for item in select * from jsonb_each_text(v) loop
   if item.value not in ('yes','maybe','no') or not exists(select 1 from public.planning_slots where thread_id=t.id and id::text=item.key and retired_at is null) then raise exception 'A proposed time changed.'; end if;
  end loop;
  if coalesce((payload->>'none_work')::boolean,false) and (select count(*) from jsonb_each_text(v) where value='no')<>(select count(*) from public.planning_slots where thread_id=t.id and retired_at is null) then raise exception 'None work must answer every current slot.'; end if;
  insert into public.planning_availability values(t.id,actor,t.slots_revision,v,coalesce((payload->>'none_work')::boolean,false),now()) on conflict(thread_id,user_id) do update set answers=excluded.answers,slots_revision=excluded.slots_revision,none_work=excluded.none_work,updated_at=now();
 else raise exception 'This guest action is not supported.'; end if;
 insert into private.guest_response_access values(s.id,actor) on conflict do nothing;
 result:=jsonb_build_object('saved',true); insert into private.guest_requests values(actor,request,fp,result,now()); return result;
end $$;
-- Claim only live participation with recorded guest provenance. Finalized decisions
-- and past events retain attribution and recorded results instead of rewriting history.
create function private.guest_claimable(kind text, target uuid, guest_id uuid, member_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.guest_shares s join private.guest_response_access a on a.share_id=s.id
 where s.kind=guest_claimable.kind and s.target_id=target and a.user_id=guest_id
 and s.owner_id=case kind when 'beacon' then (select owner_id from public.activities where id=target) when 'decision' then (select owner_id from public.planning_threads where id=target) end)
 and case kind when 'beacon' then exists(select 1 from public.activities where id=target and status='scheduled' and ends_at>now())
 when 'decision' then exists(select 1 from public.planning_threads where id=target and status='open' and deadline_at>now() and finalized_at is null and materialized_activity_id is null and not_organized_at is null and continuation_closed_at is null)
 else false end;
$$;
create function public.guest_claim(guest_id uuid, member_id uuid, command text default 'preview') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare g private.guest_identities; tab text; field text; kind text; item record; total integer:=0; conflicts integer:=0; history integer:=0; n integer; c integer; h integer; begin
 if command not in ('preview','confirm') then raise exception 'Unknown claim action.'; end if;
 if not exists(select 1 from auth.users where id=guest_id and email_confirmed_at is not null) or not exists(select 1 from auth.users where id=member_id and email_confirmed_at is not null) or not exists(select 1 from public.profiles where id=member_id) then raise exception 'Verify both identities and finish your member profile.'; end if;
 if guest_id<>member_id and exists(select 1 from public.profiles where id=guest_id) then raise exception 'Member accounts cannot be merged through guest claiming.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(guest_id,member_id)::text,0));
 perform pg_advisory_xact_lock(hashtextextended(greatest(guest_id,member_id)::text,0));
 select * into g from private.guest_identities where user_id=guest_id for update;
 if g.user_id is null then raise exception 'Verified guest participation is required.'; end if;
 if g.claimed_at is not null then
  if g.claimed_by is distinct from member_id then raise exception 'These responses were already claimed.'; end if;
  return jsonb_build_object('claimed',true,'eligible',0,'conflicts',0,'historical',0);
 end if;
 -- Response ownership survives link expiry/revocation. Transferring it never
 -- restores link access; destination blocks/exclusions continue to apply to
 -- the canonical member ID. Carry guest-only exclusions to that same ID.
 if command='confirm' and guest_id<>member_id then
  insert into private.guest_exclusions(kind,target_id,user_id) select e.kind,e.target_id,member_id from private.guest_exclusions e where e.user_id=guest_id on conflict do nothing;
 end if;
 foreach tab in array array['rsvps','planning_ping_responses','planning_votes','planning_approval_ballots','planning_availability'] loop
 field:=case when tab='rsvps' then 'activity_id' else 'thread_id' end;
 kind:=case when tab='rsvps' then 'beacon' else 'decision' end;
 for item in execute format('select %I id from public.%I where user_id=$1 order by %I',field,tab,field) using guest_id loop
  if kind='beacon' then perform 1 from public.activities where id=item.id for update;
  else perform pg_advisory_xact_lock(hashtextextended(private.planning_root(item.id)::text,11)); perform 1 from public.planning_threads where id=item.id for update; end if;
  -- Lock each originating capability against revocation during transfer.
  perform 1 from private.guest_shares s join private.guest_response_access a on a.share_id=s.id where a.user_id=guest_id and s.kind=kind and s.target_id=item.id for share of s;
  if not private.guest_claimable(kind,item.id,guest_id,member_id) then history:=history+1; continue; end if;
  total:=total+1;
  if guest_id<>member_id then
   execute format('select count(*)::int from public.%I where %I=$1 and user_id=$2',tab,field) into n using item.id,member_id;
   if n>0 then conflicts:=conflicts+1; end if;
  end if;
  if command='confirm' and guest_id<>member_id then
   execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,to_jsonb(r)||jsonb_build_object(''user_id'',$2))).* from public.%I r where r.%I=$1 and r.user_id=$3 on conflict(%I,user_id) do nothing',tab,tab,tab,field,field) using item.id,member_id,guest_id;
   execute format('delete from public.%I where %I=$1 and user_id=$2',tab,field) using item.id,guest_id;
   insert into private.guest_response_access(share_id,user_id) select a.share_id,member_id from private.guest_response_access a join private.guest_shares s on s.id=a.share_id where a.user_id=guest_id and s.kind=kind and s.target_id=item.id on conflict do nothing;
   delete from private.guest_response_access a using private.guest_shares s where s.id=a.share_id and a.user_id=guest_id and s.kind=kind and s.target_id=item.id;
  end if;
 end loop;
 end loop;
 if command='confirm' then update private.guest_identities set claimed_by=member_id,claimed_at=now() where user_id=guest_id; end if;
 return jsonb_build_object('claimed',command='confirm','eligible',total,'conflicts',conflicts,'historical',history);
end $$;
create function public.guest_decision_responses(actor uuid, target uuid, participant uuid default null, command text default 'read') returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.planning_threads; begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform pg_advisory_xact_lock(hashtextextended(private.planning_root(target)::text,11));
 select * into t from public.planning_threads where id=target for update;
 if not exists(select 1 from public.profiles where id=actor) or not private.can_manage_planning_thread(target) or not private.can_read_planning_thread(target) then raise exception 'Organizer access required.'; end if;
 if command not in ('read','remove') then raise exception 'Unknown response action.'; end if;
 if command='remove' then
  if t.status<>'open' or t.deadline_at<=now() or t.finalized_at is not null or t.materialized_activity_id is not null then raise exception 'Responses are closed.'; end if;
  if not private.guest_planning_participant(target,participant) or not exists(select 1 from private.guest_identities where user_id=participant) then raise exception 'Guest response unavailable.'; end if;
  insert into private.guest_exclusions values('decision',target,participant) on conflict do nothing;
  delete from public.planning_ping_responses where thread_id=target and user_id=participant;
  delete from public.planning_votes where thread_id=target and user_id=participant;
  delete from public.planning_approval_ballots where thread_id=target and user_id=participant;
  delete from public.planning_availability where thread_id=target and user_id=participant;
 end if;
 return jsonb_build_object('guests',coalesce((select jsonb_agg(jsonb_build_object('id',g.user_id,'name',g.name,'response',coalesce(p.response,case when t.kind='time' then 'Availability saved' else 'Vote saved' end),'approved',false))
 from private.guest_identities g left join public.planning_ping_responses p on p.thread_id=target and p.user_id=g.user_id
 where not exists(select 1 from public.profiles where id=g.user_id) and private.guest_planning_participant(target,g.user_id)
 and (p.user_id is not null or exists(select 1 from public.planning_votes where thread_id=target and user_id=g.user_id) or exists(select 1 from public.planning_approval_ballots where thread_id=target and user_id=g.user_id) or exists(select 1 from public.planning_availability where thread_id=target and user_id=g.user_id))),'[]'::jsonb));
end $$;
revoke all on function private.guest_planning_participant(uuid,uuid),private.guest_target_share(text,uuid,uuid),private.guest_verified_participant(uuid),private.guest_claimable(text,uuid,uuid,uuid) from public,anon,authenticated;
do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('guest_share_manage','guest_preview','guest_respond','guest_claim','guest_decision_responses') loop
 execute format('revoke all on function %s from public,anon,authenticated',f); execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_external_planning;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$ declare result jsonb; begin
 result:=public.beacon_snapshot_before_external_planning();
 return result||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}'::jsonb)||'{"guest_planning":true}'::jsonb);
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
