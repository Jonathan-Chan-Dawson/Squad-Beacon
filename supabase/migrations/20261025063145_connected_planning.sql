-- Additive planning persistence; existing Councils retain their recorded rules.
alter table public.planning_threads drop constraint planning_threads_kind_check;
alter table public.planning_threads add constraint planning_threads_kind_check check(kind in ('ping','vote','draw','time'));
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.planning_threads'::regclass and contype='c' and pg_get_constraintdef(oid) like '%payload%' loop
 execute format('alter table public.planning_threads drop constraint %I',c.conname); end loop;
end $$;
alter table public.planning_threads add constraint planning_payload_kind check((kind in ('ping','time'))=(payload is not null));
alter table public.planning_threads
 add column vote_method text not null default 'pick_one' check(vote_method in ('pick_one','approval')),
 add column resolution_policy text not null default 'legacy' check(resolution_policy in ('legacy','explicit')),
 add column interest_target integer check(interest_target between 2 and 100),
 add column allow_backup_hosting boolean not null default false,
 add column source_thread_id uuid references public.planning_threads(id),
 add column source_activity_note_id uuid references public.activities(id) on delete set null,
 add column slots_revision integer not null default 1,
 add column selected_slot_id uuid,
 add column finalized_by uuid references public.profiles(id),
 add column finalized_at timestamptz,
 add column continuation_closed_at timestamptz,
 add column not_organized_at timestamptz,
 add column organizer_notified_at timestamptz,
 add column result_summary jsonb,
 add column reserved_draw_id uuid references public.planning_proposals(id);
create unique index planning_one_continuation on public.planning_threads(source_thread_id) where source_thread_id is not null;
alter table public.planning_proposals add column approved_at timestamptz;
update public.planning_proposals set approved_at=created_at where approved;
create table public.planning_slots (
 id uuid primary key, thread_id uuid not null references public.planning_threads on delete cascade,
 starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null, retired_at timestamptz,
 unique(thread_id,id), check(isfinite(starts_at) and isfinite(ends_at) and ends_at-starts_at between interval '5 minutes' and interval '24 hours')
);
create table public.planning_availability (
 thread_id uuid not null references public.planning_threads on delete cascade, user_id uuid not null references public.profiles on delete cascade,
 slots_revision integer not null, answers jsonb not null check(jsonb_typeof(answers)='object'), none_work boolean not null default false,
 updated_at timestamptz not null default now(), primary key(thread_id,user_id)
);
create table public.planning_approval_ballots (
 thread_id uuid not null references public.planning_threads on delete cascade, user_id uuid not null references public.profiles on delete cascade,
 proposal_ids uuid[] not null, none_work boolean not null, updated_at timestamptz not null default now(), primary key(thread_id,user_id), check(none_work=(cardinality(proposal_ids)=0))
);
create table public.planning_organizer_messages (
 thread_id uuid not null references public.planning_threads on delete cascade, user_id uuid not null references public.profiles on delete cascade,
 message text not null check(char_length(message) between 1 and 500), updated_at timestamptz not null default now(), primary key(thread_id,user_id)
);
create table private.planning_recovery (thread_id uuid primary key references public.planning_threads on delete cascade,owner_id uuid not null references public.profiles,context jsonb not null);
create table private.planning_claims (thread_id uuid primary key references public.planning_threads on delete cascade,user_id uuid not null references public.profiles,token uuid not null default gen_random_uuid(),expires_at timestamptz not null,revision integer not null);
create table private.planning_claim_attempts (thread_id uuid not null references public.planning_threads on delete cascade,user_id uuid not null references public.profiles,revision integer not null,primary key(thread_id,user_id,revision));
do $$ declare tab text; begin
 foreach tab in array array['planning_slots','planning_availability','planning_approval_ballots','planning_organizer_messages'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant select on public.%I to authenticated',tab);
 end loop;
end $$;
create policy read_slots on public.planning_slots for select to authenticated using(private.can_read_planning_thread(thread_id));
create policy read_availability on public.planning_availability for select to authenticated using(private.can_read_planning_member(thread_id,user_id));
create policy read_approvals on public.planning_approval_ballots for select to authenticated using(private.can_read_planning_member(thread_id,user_id));
create policy read_organizer_messages on public.planning_organizer_messages for select to authenticated using(private.can_read_planning_member(thread_id,user_id) and (user_id=auth.uid() or private.can_manage_planning_thread(thread_id)));
grant execute on function private.can_manage_planning_thread(uuid) to authenticated;
create function private.planning_root(tid uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare parent uuid; depth integer:=0; begin loop
 select source_thread_id into parent from public.planning_threads where id=tid;
 if parent is null then return tid; end if;
 tid:=parent; depth:=depth+1; if depth>20 then raise exception 'Planning continuation is too deep.'; end if;
end loop; end $$;
create function private.planning_start(tid uuid) returns timestamptz language sql stable security definer set search_path='' as $$
 select case when t.kind='ping' then (t.payload->>'starts_at')::timestamptz
 when t.kind='time' then (select min(s.starts_at) from public.planning_slots s where s.thread_id=t.id and s.retired_at is null and (t.selected_slot_id is null or s.id=t.selected_slot_id) and s.starts_at>now())
 else (select min((p.payload->>'starts_at')::timestamptz) from public.planning_proposals p where p.thread_id=t.id and p.approved and p.disqualified_at is null and (p.payload->>'starts_at')::timestamptz>now() and private.planning_eligible(t.owner_id,p.author_id,t.audience,t.audience_id) and (coalesce(t.winner_proposal_id,t.reserved_draw_id) is null or p.id=coalesce(t.winner_proposal_id,t.reserved_draw_id))) end from public.planning_threads t where t.id=tid;
$$;
create function private.planning_backup_at(tid uuid) returns timestamptz language sql stable security definer set search_path='' as $$
 select t.deadline_at+least(interval '24 hours',greatest(interval '15 minutes',(private.planning_start(t.id)-t.deadline_at)*0.25),greatest(interval '0',private.planning_start(t.id)-t.deadline_at-interval '25 minutes')) from public.planning_threads t where id=tid;
$$;
create function private.planning_context(v jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(v) where key in ('title','description','category','mode','starts_at','ends_at','timezone','label','online_url','latitude','longitude','approval_required','target_count','audience','audience_id');
$$;
create function private.planning_vote_counts(tid uuid) returns table(id uuid,total bigint) language sql stable security definer set search_path='' as $$
 with counts as (select p.id,case when t.vote_method='approval' then
 (select count(*) from public.planning_approval_ballots b where b.thread_id=t.id and p.id=any(b.proposal_ids) and private.planning_eligible(t.owner_id,b.user_id,t.audience,t.audience_id) and not exists(select 1 from public.blocks x where (x.blocker_id=b.user_id and x.blocked_id=p.author_id) or (x.blocked_id=b.user_id and x.blocker_id=p.author_id)))
 else (select count(*) from public.planning_votes v where v.thread_id=t.id and v.proposal_id=p.id and private.planning_eligible(t.owner_id,v.user_id,t.audience,t.audience_id) and not exists(select 1 from public.blocks x where (x.blocker_id=v.user_id and x.blocked_id=p.author_id) or (x.blocked_id=v.user_id and x.blocker_id=p.author_id))) end total
 from public.planning_threads t join public.planning_proposals p on p.thread_id=t.id where t.id=tid and p.approved and p.disqualified_at is null and p.activity_id is null and (p.payload->>'starts_at')::timestamptz>now() and private.planning_eligible(t.owner_id,p.author_id,t.audience,t.audience_id))
 select counts.id,counts.total from counts;
$$;
create function private.planning_vote_leaders(tid uuid) returns table(id uuid,total bigint) language sql stable security definer set search_path='' as $$
 with counts as (select p.id,case when t.vote_method='approval' then
 (select count(*) from public.planning_approval_ballots b where b.thread_id=t.id and p.id=any(b.proposal_ids) and private.planning_eligible(t.owner_id,b.user_id,t.audience,t.audience_id) and not exists(select 1 from public.blocks x where (x.blocker_id=b.user_id and x.blocked_id=p.author_id) or (x.blocked_id=b.user_id and x.blocker_id=p.author_id)))
 else (select count(*) from public.planning_votes v where v.thread_id=t.id and v.proposal_id=p.id and private.planning_eligible(t.owner_id,v.user_id,t.audience,t.audience_id) and not exists(select 1 from public.blocks x where (x.blocker_id=v.user_id and x.blocked_id=p.author_id) or (x.blocked_id=v.user_id and x.blocker_id=p.author_id))) end total
 from public.planning_threads t join public.planning_proposals p on p.thread_id=t.id where t.id=tid and p.approved and p.disqualified_at is null and p.activity_id is null and (p.payload->>'starts_at')::timestamptz>now() and private.planning_eligible(t.owner_id,p.author_id,t.audience,t.audience_id))
 select counts.id,counts.total from counts where counts.total=(select max(c.total) from counts c);
$$;

alter function private.apply_planning_action(text,jsonb) rename to apply_planning_action_before_connected;
create function private.apply_planning_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); tid uuid:=nullif(payload->>'thread_id','')::uuid; root_id uuid; t public.planning_threads; source public.planning_threads;
 result jsonb; v jsonb; slot public.planning_slots; candidate uuid; chosen uuid; start_at timestamptz;
 ids uuid[]; counts integer; top_total bigint; claim private.planning_claims; manager boolean; draft jsonb; published uuid; item record;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 if action='create_planning_thread' then
  if exists(select 1 from public.planning_threads where id=nullif(payload->>'id','')::uuid) then
   select * into t from public.planning_threads where id=(payload->>'id')::uuid;
   if t.owner_id<>uid then raise exception 'That planning ID is already in use.'; end if;
   return jsonb_build_object('id',t.id,'status',t.status);
  end if;
  if payload->>'vote_method'='approval' and payload->>'kind'<>'vote' then raise exception 'Approval voting requires a Vote Council.'; end if;
  if payload->>'kind'='time' then
   perform private.validate_audience((payload->>'audience')::public.audience_kind,nullif(payload->>'audience_id','')::uuid);
   if char_length(trim(coalesce(payload->>'title',''))) not between 1 and 120 or char_length(coalesce(payload->>'body',''))>500 then raise exception 'Check the title and description.'; end if;
   if (payload->>'deadline_at')::timestamptz<=now() or (payload->>'deadline_at')::timestamptz>now()+interval '90 days' then raise exception 'Choose a future deadline within 90 days.'; end if;
   if jsonb_typeof(payload->'slots') is distinct from 'array' or jsonb_array_length(payload->'slots') not between 2 and 10 then raise exception 'Choose 2 to 10 proposed times.'; end if;
   insert into public.planning_threads(id,owner_id,kind,title,body,audience,audience_id,deadline_at,payload)
   values(coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()),uid,'time',trim(payload->>'title'),coalesce(payload->>'body',''),(payload->>'audience')::public.audience_kind,nullif(payload->>'audience_id','')::uuid,(payload->>'deadline_at')::timestamptz,private.planning_context(payload->'payload')) returning id into tid;
   if jsonb_array_length(coalesce(payload->'coowner_ids','[]'::jsonb))>10 then raise exception 'Choose up to 10 co-organizers.'; end if;
   for v in select value from jsonb_array_elements(coalesce(payload->'coowner_ids','[]'::jsonb)) loop
    if not private.planning_eligible(uid,(v#>>'{}')::uuid,(payload->>'audience')::public.audience_kind,nullif(payload->>'audience_id','')::uuid) then raise exception 'Choose eligible co-organizers.'; end if;
    update public.planning_threads set coowner_ids=array_append(coowner_ids,(v#>>'{}')::uuid) where id=tid;
   end loop;
   result:=jsonb_build_object('id',tid,'status','open');
  else result:=private.apply_planning_action_before_connected(action,payload); tid:=(result->>'id')::uuid; end if;
  if nullif(payload->>'source_thread_id','') is not null then
   select * into source from public.planning_threads where id=(payload->>'source_thread_id')::uuid;
   if source.owner_id is distinct from uid or not private.can_read_planning_thread(source.id) or source.audience::text<>payload->>'audience' or source.audience_id is distinct from nullif(payload->>'audience_id','')::uuid or source.continuation_closed_at is not null or source.not_organized_at is not null or source.status in ('cancelled','expired','no_options') then raise exception 'This source cannot be continued.'; end if;
   root_id:=private.planning_root(source.id); perform pg_advisory_xact_lock(hashtextextended(root_id::text,11));
   if exists(select 1 from public.planning_threads where id=root_id and materialized_activity_id is not null) then raise exception 'This plan already became a Beacon. Refresh to view it.'; end if;
   update public.planning_threads set source_thread_id=source.id where id=tid;
  end if;
  if nullif(payload->>'source_activity_note_id','') is not null then
   if not exists(select 1 from public.activities where id=(payload->>'source_activity_note_id')::uuid and owner_id=uid and mode='solo') or not private.can_activity((payload->>'source_activity_note_id')::uuid) then raise exception 'This Activity Note is unavailable.'; end if;
   update public.planning_threads set source_activity_note_id=(payload->>'source_activity_note_id')::uuid where id=tid;
  end if;
  update public.planning_threads set vote_method=coalesce(payload->>'vote_method','pick_one'),resolution_policy='explicit',interest_target=nullif(payload->>'interest_target','')::int,
   allow_backup_hosting=coalesce((payload->>'allow_backup_hosting')::boolean,payload->>'audience'='squad') where id=tid;
  if payload->'recovery_context' is not null then insert into private.planning_recovery values(tid,uid,private.planning_context(payload->'recovery_context')||case when payload->>'local_draft_token' ~ '^creation:[a-zA-Z0-9_-]+$' then jsonb_build_object('local_draft_token',payload->>'local_draft_token') else '{}'::jsonb end); end if;
  if payload->>'kind'='time' then
   for v in select value from jsonb_array_elements(payload->'slots') loop
    if (v->>'starts_at')::timestamptz<=(payload->>'deadline_at')::timestamptz or not exists(select 1 from pg_timezone_names where name=v->>'timezone') then raise exception 'Check proposed times and time zones.'; end if;
    if exists(select 1 from public.planning_slots where thread_id=tid and starts_at=(v->>'starts_at')::timestamptz and ends_at=(v->>'ends_at')::timestamptz) then raise exception 'Duplicate proposed time.'; end if;
    insert into public.planning_slots values((v->>'id')::uuid,tid,(v->>'starts_at')::timestamptz,(v->>'ends_at')::timestamptz,v->>'timezone',null);
   end loop;
  end if;
  return result;
 end if;
 root_id:=private.planning_root(tid); perform pg_advisory_xact_lock(hashtextextended(root_id::text,11));
 select * into t from public.planning_threads where id=tid for update;
 if t.id is null or not private.can_read_planning_thread(tid) then raise exception 'Planning decision unavailable.'; end if;
 manager:=private.can_manage_planning_thread(tid);
 select materialized_activity_id into published from public.planning_threads where id=root_id;
 if action in ('publish_planning_beacon','convert_planning_ping','resolve_planning_thread','claim_planning_host') and published is not null then
  return jsonb_build_object('id',published,'activity_id',published,'status','resolved','already_published',true);
 end if;
 if action='save_planning_organizer_message' then
  if char_length(coalesce(payload->>'message',''))>500 then raise exception 'Keep your message under 500 characters.'; end if;
  if trim(coalesce(payload->>'message',''))='' then delete from public.planning_organizer_messages where thread_id=tid and user_id=uid;
  else insert into public.planning_organizer_messages values(tid,uid,trim(payload->>'message'),now()) on conflict(thread_id,user_id) do update set message=excluded.message,updated_at=now(); end if;
  return jsonb_build_object('thread_id',tid);
 end if;
 if action='set_planning_backup' then
  if t.owner_id<>uid then raise exception 'Only the owner can change backup hosting.'; end if;
  update public.planning_threads set allow_backup_hosting=(payload->>'enabled')::boolean where id=tid;
  delete from private.planning_claims where thread_id=tid;
  return jsonb_build_object('thread_id',tid);
 end if;
 if action='save_planning_availability' then
  if t.kind<>'time' or t.status<>'open' or t.deadline_at<=now() or t.finalized_at is not null then raise exception 'Availability responses are closed.'; end if;
  if (payload->>'slots_revision')::int is distinct from t.slots_revision then raise exception 'Proposed times changed. Refresh before saving.'; end if;
  v:=payload->'answers'; if jsonb_typeof(v) is distinct from 'object' then raise exception 'Choose valid availability.'; end if;
  for item in select * from jsonb_each_text(v) loop
   if item.value not in ('yes','maybe','no') or not exists(select 1 from public.planning_slots where thread_id=tid and id::text=item.key and retired_at is null) then raise exception 'A proposed time changed.'; end if;
  end loop;
  if coalesce((payload->>'none_work')::boolean,false) and (select count(*) from jsonb_each_text(v) where value='no')<>(select count(*) from public.planning_slots where thread_id=tid and retired_at is null) then raise exception 'None work must answer every current slot.'; end if;
  insert into public.planning_availability values(tid,uid,t.slots_revision,v,coalesce((payload->>'none_work')::boolean,false),now()) on conflict(thread_id,user_id) do update set answers=excluded.answers,slots_revision=excluded.slots_revision,none_work=excluded.none_work,updated_at=now();
  return jsonb_build_object('thread_id',tid);
 end if;
 if action='amend_planning_slots' then
  if not manager or t.kind<>'time' or t.status<>'open' or t.deadline_at<=now() or t.finalized_at is not null then raise exception 'These proposed times cannot be edited.'; end if;
  if (payload->>'slots_revision')::int is distinct from t.slots_revision then raise exception 'Proposed times changed. Refresh.'; end if;
  if jsonb_array_length(payload->'slots') not between 2 and 10 then raise exception 'Choose 2 to 10 proposed times.'; end if;
  update public.planning_slots set retired_at=now() where thread_id=tid and retired_at is null and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'slots'));
  for v in select value from jsonb_array_elements(payload->'slots') loop
   if (v->>'starts_at')::timestamptz<=greatest(now(),t.deadline_at) or not exists(select 1 from pg_timezone_names where name=v->>'timezone') then raise exception 'Check proposed times and time zones.'; end if;
   select * into slot from public.planning_slots where id=(v->>'id')::uuid;
   if found then
    if slot.thread_id<>tid or slot.retired_at is not null or slot.starts_at<>(v->>'starts_at')::timestamptz or slot.ends_at<>(v->>'ends_at')::timestamptz or slot.timezone<>v->>'timezone' then raise exception 'Changed times need a new slot identity.'; end if;
   else insert into public.planning_slots values((v->>'id')::uuid,tid,(v->>'starts_at')::timestamptz,(v->>'ends_at')::timestamptz,v->>'timezone',null); end if;
  end loop;
  if exists(select 1 from public.planning_slots where thread_id=tid and retired_at is null group by starts_at,ends_at having count(*)>1) then raise exception 'Duplicate proposed time.'; end if;
  update public.planning_threads set slots_revision=slots_revision+1 where id=tid;
  return jsonb_build_object('thread_id',tid);
 end if;
 if action='finalize_planning_time' then
  if not manager or t.kind<>'time' or coalesce((payload->>'confirmed')::boolean,false) is not true then raise exception 'Confirm the selected time as an organizer.'; end if;
  if t.finalized_at is not null then return jsonb_build_object('thread_id',tid,'selected_slot_id',t.selected_slot_id); end if;
  if t.status<>'open' then raise exception 'This Time Finder is closed.'; end if;
  if t.deadline_at>now() and not exists(select 1 from public.planning_availability a where a.thread_id=tid and exists(select 1 from public.planning_slots s where s.thread_id=tid and s.retired_at is null and a.answers ? s.id::text) and private.planning_eligible(t.owner_id,a.user_id,t.audience,t.audience_id)) then raise exception 'Wait for a saved response or the deadline.'; end if;
  select * into slot from public.planning_slots where id=(payload->>'slot_id')::uuid and thread_id=tid and retired_at is null and starts_at>now();
  if slot.id is null or (payload->>'slots_revision')::int is distinct from t.slots_revision then raise exception 'The selected time changed or has passed.'; end if;
  update public.planning_threads set selected_slot_id=slot.id,finalized_at=now(),finalized_by=uid,status='resolved',resolved_at=now() where id=tid;
  return jsonb_build_object('thread_id',tid,'selected_slot_id',slot.id);
 end if;
 if action='save_council_approval_ballot' then
  if t.kind<>'vote' or t.vote_method<>'approval' or t.status<>'open' or t.deadline_at<=now() then raise exception 'This approval vote is closed.'; end if;
  if jsonb_typeof(payload->'proposal_ids') is distinct from 'array' then raise exception 'Choose options or None work.'; end if;
  ids:=array(select value::uuid from jsonb_array_elements_text(payload->'proposal_ids'));
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or coalesce((payload->>'none_work')::boolean,false)<>(cardinality(ids)=0) then raise exception 'Choose options or explicitly select None work.'; end if;
  foreach candidate in array ids loop
   if not exists(select 1 from public.planning_proposals p where p.id=candidate and p.thread_id=tid and p.approved and p.disqualified_at is null and (p.payload->>'starts_at')::timestamptz>now() and private.can_read_planning_proposal(tid,p.author_id)) then raise exception 'Choose eligible approved options.'; end if;
  end loop;
  insert into public.planning_approval_ballots values(tid,uid,ids,(payload->>'none_work')::boolean,now()) on conflict(thread_id,user_id) do update set proposal_ids=excluded.proposal_ids,none_work=excluded.none_work,updated_at=now();
  return jsonb_build_object('thread_id',tid);
 end if;
 if action='vote_council_proposal' and t.vote_method<>'pick_one' then raise exception 'Use an approval ballot for this Council.'; end if;
 if action='close_planning_without_beacon' then
  if not manager or published is not null or t.deadline_at>now() then raise exception 'This decision cannot be closed without a Beacon.'; end if;
  update public.planning_threads set continuation_closed_at=now(),status=case when finalized_at is null then 'no_options' else status end,resolved_at=coalesce(resolved_at,now()) where id=tid;
  delete from private.planning_claims where thread_id=tid;
  return jsonb_build_object('thread_id',tid);
 end if;
 if action='replace_council_winner' and t.kind='vote' and (t.vote_method='approval' or t.resolution_policy='explicit') then
  if not manager or t.status<>'resolved' or coalesce((payload->>'confirm_cancel_previous')::boolean,false) is not true then raise exception 'Confirm replacement as an organizer.'; end if;
  if nullif(payload->>'expected_winner_proposal_id','')::uuid is distinct from t.winner_proposal_id then
   if nullif(payload->>'expected_winner_proposal_id','')::uuid=t.replaced_from_proposal_id then return jsonb_build_object('id',t.materialized_activity_id,'activity_id',t.materialized_activity_id); end if;
   raise exception 'The winner changed. Refresh before replacing it.';
  end if;
  if not exists(select 1 from public.activities where id=t.materialized_activity_id and status='scheduled' and starts_at>now()) then raise exception 'The current Beacon cannot be replaced.'; end if;
  select count(*),max(total) into counts,top_total from private.planning_vote_leaders(tid);
  candidate:=nullif(payload->>'proposal_id','')::uuid;
  if candidate is null and counts=1 and top_total>0 then select id into candidate from private.planning_vote_leaders(tid); end if;
  if candidate is null or not exists(select 1 from private.planning_vote_leaders(tid) where id=candidate) then raise exception 'Explicitly choose an eligible replacement leader.'; end if;
  for item in select user_id from public.rsvps where activity_id=t.materialized_activity_id and status in ('going','requested','invited') loop
   perform private.notify(item.user_id,uid,'A council-selected Beacon was cancelled because its option was replaced.',t.materialized_activity_id);
  end loop;
  update public.activities set status='cancelled' where id=t.materialized_activity_id;
  update public.planning_proposals set disqualified_at=now() where id=t.winner_proposal_id;
  update public.planning_threads set result_summary=jsonb_build_object('support',(select total from private.planning_vote_counts(tid) where id=candidate),'tie_count',counts) where id=tid;
  select p.payload into draft from public.planning_proposals p where p.id=candidate;
  published:=private.materialize_planning_beacon(tid,draft);
  update public.planning_proposals set activity_id=published where id=candidate;
  update public.planning_threads set materialized_activity_id=published where private.planning_root(id)=root_id;
  update public.planning_threads set replaced_from_proposal_id=winner_proposal_id,winner_proposal_id=candidate where id=tid;
  return jsonb_build_object('id',published,'activity_id',published,'cancelled_activity_id',t.materialized_activity_id);
 end if;
 if action in ('claim_planning_host','release_planning_host') then
  if action='release_planning_host' then delete from private.planning_claims where thread_id=tid and user_id=uid and token=(payload->>'claim_token')::uuid; return jsonb_build_object('thread_id',tid); end if;
  start_at:=private.planning_start(tid);
  if not t.allow_backup_hosting or t.continuation_closed_at is not null or t.not_organized_at is not null or t.status in ('cancelled','expired','no_options') or start_at is null or start_at<=now() or now()<private.planning_backup_at(tid) then raise exception 'Backup hosting is not available yet.'; end if;
  select * into claim from private.planning_claims where thread_id=tid;
  if claim.expires_at>now() then
   if claim.user_id<>uid then raise exception 'Another participant is reviewing this plan. Try again when their claim expires.'; end if;
   return jsonb_build_object('thread_id',tid,'claim_token',claim.token,'expires_at',claim.expires_at);
  end if;
  insert into private.planning_claim_attempts values(tid,uid,t.slots_revision) on conflict do nothing;
  if not found then raise exception 'Your previous hosting attempt expired. Another participant can volunteer.'; end if;
  delete from private.planning_claims where thread_id=tid;
  insert into private.planning_claims(thread_id,user_id,expires_at,revision) values(tid,uid,least(now()+interval '10 minutes',start_at),t.slots_revision) returning * into claim;
  if t.kind='draw' and t.reserved_draw_id is null then
   select p.id into candidate from public.planning_proposals p where p.thread_id=tid and p.approved and p.disqualified_at is null and (p.payload->>'starts_at')::timestamptz>now() and private.planning_eligible(t.owner_id,p.author_id,t.audience,t.audience_id) order by random() limit 1;
   update public.planning_threads set reserved_draw_id=candidate where id=tid;
  end if;
  return jsonb_build_object('thread_id',tid,'claim_token',claim.token,'expires_at',claim.expires_at);
 end if;
 if action='publish_planning_beacon' or (action='resolve_planning_thread' and (t.vote_method='approval' or t.resolution_policy='explicit' or t.reserved_draw_id is not null)) then
  if t.continuation_closed_at is not null or t.not_organized_at is not null or t.status in ('cancelled','expired','no_options') then raise exception 'This continuation is closed.'; end if;
  if not manager or (action='publish_planning_beacon' and uid<>t.owner_id) then
   select * into claim from private.planning_claims where thread_id=tid and user_id=uid and token=(payload->>'claim_token')::uuid and expires_at>now() and revision=t.slots_revision;
   if claim.token is null or not t.allow_backup_hosting then raise exception 'Your hosting claim expired. Refresh this decision.'; end if;
  end if;
  if coalesce((payload->>'confirmed')::boolean,false) is not true then raise exception 'Confirm publication of the selected activity.'; end if;
  if t.kind in ('vote','draw') then
   if t.deadline_at>now() then raise exception 'The Council deadline has not arrived.'; end if;
   if t.kind='vote' then
    select count(*),max(total) into counts,top_total from private.planning_vote_leaders(tid);
    candidate:=nullif(payload->>'proposal_id','')::uuid;
    if candidate is null and counts=1 and top_total>0 then select id into candidate from private.planning_vote_leaders(tid); end if;
    if candidate is null or not exists(select 1 from private.planning_vote_leaders(tid) where id=candidate) then raise exception 'Explicitly choose an eligible leading option, or close without a Beacon.'; end if;
   else
    candidate:=t.reserved_draw_id;
    if candidate is null then select p.id into candidate from public.planning_proposals p where p.thread_id=tid and p.approved and p.disqualified_at is null and (p.payload->>'starts_at')::timestamptz>now() and private.planning_eligible(t.owner_id,p.author_id,t.audience,t.audience_id) order by random() limit 1; end if;
   end if;
   select p.payload into draft from public.planning_proposals p where p.id=candidate and p.thread_id=tid and p.approved and p.disqualified_at is null and (p.payload->>'starts_at')::timestamptz>now() and private.planning_eligible(t.owner_id,p.author_id,t.audience,t.audience_id);
   if draft is null then raise exception 'No eligible activity remains.'; end if;
  elsif t.kind='time' then
   chosen:=coalesce(t.selected_slot_id,nullif(payload->>'slot_id','')::uuid);
   if t.selected_slot_id is null and ((manager and claim.token is null) or t.deadline_at>now()) then raise exception 'Select a time before reviewing the Beacon.'; end if;
   select * into slot from public.planning_slots where id=chosen and thread_id=tid and retired_at is null and starts_at>now();
   if slot.id is null then raise exception 'Choose a valid future time.'; end if;
   draft:=private.planning_context(payload->'payload')||private.planning_review_controls(payload->'payload')||jsonb_build_object('starts_at',slot.starts_at,'ends_at',slot.ends_at,'timezone',slot.timezone);
  else draft:=coalesce(private.planning_context(payload->'payload')||private.planning_review_controls(payload->'payload'),t.payload); end if;
  if t.kind='vote' then
   update public.planning_threads set result_summary=jsonb_build_object('support',(select total from private.planning_vote_counts(tid) where id=candidate),'tie_count',(select count(*) from private.planning_vote_leaders(tid))) where id=tid;
  end if;
  if action='resolve_planning_thread' then
   if not manager then raise exception 'Only current Council managers may resolve as the original host.'; end if;
   published:=private.materialize_planning_beacon(tid,draft);
  else
   if uid<>t.owner_id and t.audience in ('friends','list') then
    draft:=draft||jsonb_build_object('audience',payload->'payload'->'audience','audience_id',payload->'payload'->'audience_id');
    if draft->>'audience'<>'private' or nullif(draft->>'audience_id','') is not null then raise exception 'Review explicit invitations for private backup hosting.'; end if;
    for v in select value from jsonb_array_elements(coalesce(payload->'invitee_ids','[]'::jsonb)) loop
     if not private.planning_eligible(t.owner_id,(v#>>'{}')::uuid,t.audience,t.audience_id) or not private.friends((v#>>'{}')::uuid) then raise exception 'A selected recipient is not eligible for this original plan.'; end if;
    end loop;
   elsif draft->>'audience' is distinct from t.audience::text or nullif(draft->>'audience_id','')::uuid is distinct from t.audience_id then raise exception 'Keep the authorized decision audience.'; end if;
   perform private.validate_planning_beacon(uid,draft,(draft->>'audience')::public.audience_kind,nullif(draft->>'audience_id','')::uuid,t.deadline_at);
   if uid=t.owner_id and t.kind='ping' then
    update public.planning_threads set payload=draft where id=tid;
    result:=private.apply_planning_action_before_connected('convert_planning_ping',jsonb_build_object('thread_id',tid));
    perform private.save_beacon_controls((result->>'activity_id')::uuid,draft);
   elsif jsonb_array_length(coalesce(payload->'invitee_ids','[]'::jsonb))>0 then
    result:=public.beacon_action_before_connected('create_activity_with_invitees',draft||jsonb_build_object('invitee_ids',payload->'invitee_ids','expected_actor_id',uid),gen_random_uuid());
   else result:=public.beacon_action_before_connected('create_activity',draft||jsonb_build_object('expected_actor_id',uid),gen_random_uuid()); end if;
   published:=(result->>'id')::uuid;
  end if;
  if published is null then raise exception 'Publication could not be verified.'; end if;
  update public.planning_threads set materialized_activity_id=published,status=case when id=tid then 'resolved' else status end,winner_proposal_id=case when id=tid then coalesce(candidate,winner_proposal_id) else winner_proposal_id end,selected_slot_id=case when id=tid then coalesce(chosen,selected_slot_id) else selected_slot_id end,finalized_by=case when id=tid then coalesce(finalized_by,uid) else finalized_by end,finalized_at=case when id=tid then coalesce(finalized_at,now()) else finalized_at end,resolved_at=case when id=tid then now() else resolved_at end where private.planning_root(id)=root_id;
  if candidate is not null then update public.planning_proposals set activity_id=published where id=candidate; end if;
  delete from private.planning_claims where private.planning_root(thread_id)=root_id;
  return jsonb_build_object('id',published,'activity_id',published,'status','resolved');
 end if;
 if action in ('convert_planning_ping','resolve_planning_thread') and (t.continuation_closed_at is not null or t.not_organized_at is not null) then raise exception 'This continuation is closed.'; end if;
 result:=private.apply_planning_action_before_connected(action,payload);
 if action='approve_council_proposal' then update public.planning_proposals set approved_at=case when approved then now() else null end where id=(payload->>'proposal_id')::uuid; end if;
 if action in ('convert_planning_ping','resolve_planning_thread','replace_council_winner') and result->>'activity_id' is not null then
 update public.planning_threads set materialized_activity_id=(result->>'activity_id')::uuid where private.planning_root(id)=root_id;
 delete from private.planning_claims where private.planning_root(thread_id)=root_id;
 end if;
 return result;
end $$;
revoke all on function private.apply_planning_action(text,jsonb),private.apply_planning_action_before_connected(text,jsonb),private.planning_root(uuid),private.planning_start(uuid),private.planning_backup_at(uuid),private.planning_context(jsonb),private.planning_vote_leaders(uuid) from public,anon,authenticated;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_connected;
do $$ declare def text; begin select pg_get_functiondef('public.beacon_action_before_connected(text,jsonb,uuid)'::regprocedure) into def; execute replace(def,'beacon_action.request_id','beacon_action_before_connected.request_id'); end $$;
revoke all on function public.beacon_action_before_connected(text,jsonb,uuid) from public,anon,authenticated;
create function private.connected_planning_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; uid uuid:=auth.uid(); begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 if action in ('create_planning_thread','respond_planning_ping','convert_planning_ping','add_council_proposal','approve_council_proposal','vote_council_proposal','resolve_planning_thread','replace_council_winner','save_planning_availability','amend_planning_slots','finalize_planning_time','save_council_approval_ballot','close_planning_without_beacon','save_planning_organizer_message','set_planning_backup','claim_planning_host','release_planning_host','publish_planning_beacon') then
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into result from private.requests r where r.user_id=uid and r.request_id=connected_planning_action.request_id;
 if found then return result; end if;
 result:=private.apply_planning_action(action,payload);
 insert into private.requests(user_id,request_id,result) values(uid,request_id,result); return result;
 end if;
 return public.beacon_action_before_connected(action,payload,request_id);
end $$;
revoke all on function private.connected_planning_action(text,jsonb,uuid) from public,anon;
grant execute on function private.connected_planning_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$ select private.connected_planning_action(action,payload,request_id); $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
create function private.planning_private_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('planning_claims',coalesce((select jsonb_agg(c) from private.planning_claims c where c.user_id=auth.uid() and private.can_read_planning_thread(c.thread_id)),'[]'::jsonb),
 'planning_member_access',coalesce((select jsonb_agg(jsonb_build_object('thread_id',m.thread_id,'user_id',m.user_id)) from (select thread_id,author_id user_id from public.planning_proposals union select thread_id,user_id from public.planning_ping_responses union select thread_id,user_id from public.planning_votes union select thread_id,user_id from public.planning_availability union select thread_id,user_id from public.planning_approval_ballots) m where private.can_read_planning_member(m.thread_id,m.user_id)),'[]'::jsonb),
 'planning_option_counts',coalesce((select jsonb_agg(jsonb_build_object('thread_id',t.id,'proposal_id',c.id,'total',c.total)) from public.planning_threads t cross join lateral private.planning_vote_counts(t.id) c join public.planning_proposals p on p.id=c.id where private.can_read_planning_thread(t.id) and private.can_read_planning_proposal(t.id,p.author_id)),'[]'::jsonb),
 'planning_backup_invitees',coalesce((select jsonb_agg(jsonb_build_object('thread_id',c.thread_id,'user_ids',array(select p.id from public.profiles p where p.id<>auth.uid() and private.friends(p.id) and private.planning_eligible(t.owner_id,p.id,t.audience,t.audience_id)))) from private.planning_claims c join public.planning_threads t on t.id=c.thread_id where c.user_id=auth.uid() and c.expires_at>now() and private.can_read_planning_thread(t.id)),'[]'::jsonb),
 'planning_recovery',coalesce((select jsonb_agg(r) from private.planning_recovery r where r.owner_id=auth.uid() and private.can_read_planning_thread(r.thread_id)),'[]'::jsonb));
$$;
revoke all on function private.planning_private_snapshot() from public,anon;
grant execute on function private.planning_private_snapshot() to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_connected;
grant execute on function public.beacon_snapshot_before_connected() to authenticated;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$ declare result jsonb; begin
 result:=public.beacon_snapshot_before_connected();
 return result||private.planning_private_snapshot()||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}'::jsonb)||'{"connected_planning":true}'::jsonb,
 'planning_slots',coalesce((select jsonb_agg(s) from public.planning_slots s),'[]'::jsonb),
 'planning_availability',coalesce((select jsonb_agg(a) from public.planning_availability a),'[]'::jsonb),
 'planning_approval_ballots',coalesce((select jsonb_agg(b) from public.planning_approval_ballots b),'[]'::jsonb),
 'planning_organizer_messages',coalesce((select jsonb_agg(m) from public.planning_organizer_messages m),'[]'::jsonb));
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

-- Run with the existing minute maintenance job; no separate notification system.
alter function public.beacon_maintenance() rename to beacon_maintenance_before_connected;
revoke all on function public.beacon_maintenance_before_connected() from public,anon,authenticated;
create function public.beacon_maintenance() returns void language plpgsql security definer set search_path='' as $$
declare t public.planning_threads; root_id uuid; begin
 perform public.beacon_maintenance_before_connected();
 for t in select p.* from public.planning_threads p where p.materialized_activity_id is null and (p.deadline_at<=now() or p.finalized_at is not null) and p.continuation_closed_at is null and p.not_organized_at is null and p.status not in ('cancelled','no_options','expired') and not exists(select 1 from public.planning_threads child where child.source_thread_id=p.id) loop
  root_id:=private.planning_root(t.id); perform pg_advisory_xact_lock(hashtextextended(root_id::text,11));
  if exists(select 1 from public.planning_threads where id=root_id and materialized_activity_id is not null) then continue; end if;
  if private.planning_start(t.id) is null or private.planning_start(t.id)<=now() then
   update public.planning_threads set not_organized_at=now() where private.planning_root(id)=root_id and materialized_activity_id is null;
   delete from private.planning_claims where private.planning_root(thread_id)=root_id;
  elsif t.organizer_notified_at is null then
   perform private.notify(t.owner_id,null,'Your planning decision needs your action. Open Responses & Invitations.');
   update public.planning_threads set organizer_notified_at=now() where id=t.id;
  end if;
 end loop;
 delete from private.planning_claims where expires_at<=now();
end $$;
revoke all on function public.beacon_maintenance() from public,anon,authenticated;
grant execute on function public.beacon_maintenance() to service_role;

-- Retain old answers when a participant answers amended slots or changes a saved set.
create table public.planning_availability_history (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.planning_threads on delete cascade,
 user_id uuid not null references public.profiles on delete cascade, slots_revision integer not null,
 answers jsonb not null, none_work boolean not null, updated_at timestamptz not null
);
alter table public.planning_availability_history enable row level security;
revoke all on public.planning_availability_history from public,anon,authenticated;
grant select on public.planning_availability_history to authenticated;
create policy read_availability_history on public.planning_availability_history for select to authenticated using(private.can_read_planning_member(thread_id,user_id));
create function private.archive_planning_availability() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.planning_availability_history(thread_id,user_id,slots_revision,answers,none_work,updated_at) values(old.thread_id,old.user_id,old.slots_revision,old.answers,old.none_work,old.updated_at); return new;
end $$;
revoke all on function private.archive_planning_availability() from public,anon,authenticated;
create trigger archive_planning_availability before update on public.planning_availability for each row execute function private.archive_planning_availability();

-- Only settings explicitly reviewed in the Beacon editor reach publication.
create function private.planning_review_controls(v jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(v) where key in
 ('capacity_limit','capacity_policy','manual_closed','enable_chat','enable_checklist','enable_journal','enable_experiences','enable_focus','enable_reactions','enable_comments','enable_scoreboard','enable_music','checklist_edit_policy','music_url','display_emoji','display_accent');
$$;
revoke all on function private.planning_review_controls(jsonb) from public,anon,authenticated;
alter table public.planning_threads add constraint selected_slot_in_thread foreign key(id,selected_slot_id) references public.planning_slots(thread_id,id);
do $$ declare tab text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach tab in array array['planning_threads','planning_availability','planning_approval_ballots'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tab) then
    execute format('alter publication supabase_realtime add table public.%I',tab);
   end if;
  end loop;
 end if;
end $$;

revoke all on function private.planning_vote_counts(uuid) from public,anon,authenticated;
create index planning_recovery_owner on private.planning_recovery(owner_id);
create index planning_claims_user_expiry on private.planning_claims(user_id,expires_at);
create index planning_availability_history_thread_user on public.planning_availability_history(thread_id,user_id,updated_at desc);
