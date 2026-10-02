-- Private, audience-scoped planning threads. Mutations remain behind beacon_action.
create table public.planning_threads (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 coowner_ids uuid[] not null default '{}',
 kind text not null check(kind in ('ping','vote','draw')),
 title text not null check(char_length(trim(title)) between 1 and 120),
 body text not null default '' check(char_length(body)<=500),
 audience public.audience_kind not null,
 audience_id uuid,
 deadline_at timestamptz not null,
 status text not null default 'open' check(status in ('open','resolved','no_options','expired','cancelled')),
 payload jsonb,
 winner_proposal_id uuid,
 replaced_from_proposal_id uuid,
 materialized_activity_id uuid references public.activities(id) on delete set null,
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 check((audience in ('list','squad'))=(audience_id is not null)),
 check((kind='ping')=(payload is not null)),
 unique(id,owner_id)
);
create index planning_threads_owner_deadline on public.planning_threads(owner_id,status,deadline_at);
create index planning_threads_audience_deadline on public.planning_threads(audience,audience_id,status,deadline_at);

create table public.planning_ping_responses (
 thread_id uuid not null references public.planning_threads(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 response text not null check(response in ('interested','maybe','pass')),
 auto_rsvp boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(thread_id,user_id),
 check(not auto_rsvp or response='interested')
);

create table public.planning_proposals (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.planning_threads(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 payload jsonb not null,
 approved boolean not null default false,
 disqualified_at timestamptz,
 created_at timestamptz not null default now(),
 activity_id uuid references public.activities(id) on delete set null,
 unique(thread_id,id)
);
create index planning_proposals_thread_created on public.planning_proposals(thread_id,created_at,id);

create table public.planning_votes (
 thread_id uuid not null references public.planning_threads(id) on delete cascade,
 proposal_id uuid not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(thread_id,user_id),
 foreign key(thread_id,proposal_id) references public.planning_proposals(thread_id,id) on delete cascade
);

alter table public.planning_threads add constraint planning_threads_winner_fk
 foreign key(winner_proposal_id) references public.planning_proposals(id) on delete set null;

create function private.planning_eligible(owner_id uuid,candidate_id uuid,kind public.audience_kind,aid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select candidate_id is not null and owner_id is not null and (
  candidate_id=owner_id or (
   not exists(select 1 from public.blocks b where (b.blocker_id=owner_id and b.blocked_id=candidate_id) or (b.blocker_id=candidate_id and b.blocked_id=owner_id))
   and case kind
    when 'friends' then exists(select 1 from public.friendships f where f.status='accepted' and ((f.sender_id=owner_id and f.recipient_id=candidate_id) or (f.sender_id=candidate_id and f.recipient_id=owner_id)))
    when 'list' then exists(select 1 from public.lists l join public.list_members m on m.list_id=l.id where l.id=aid and l.owner_id=owner_id and m.user_id=candidate_id)
      and exists(select 1 from public.friendships f where f.status='accepted' and ((f.sender_id=owner_id and f.recipient_id=candidate_id) or (f.sender_id=candidate_id and f.recipient_id=owner_id)))
    when 'squad' then exists(select 1 from public.squad_members member join public.squads s on s.id=member.squad_id where member.squad_id=aid and member.user_id=candidate_id and not exists(select 1 from public.blocks b where (b.blocker_id=s.owner_id and b.blocked_id=candidate_id) or (b.blocker_id=candidate_id and b.blocked_id=s.owner_id)))
      and exists(select 1 from public.squad_members host where host.squad_id=aid and host.user_id=owner_id)
    else false
   end
  )
 );
$$;

create function private.can_read_planning_thread(tid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.planning_threads t where t.id=tid and private.planning_eligible(t.owner_id,auth.uid(),t.audience,t.audience_id));
$$;

create function private.can_manage_planning_thread(tid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.planning_threads t where t.id=tid and (
  t.owner_id=auth.uid() or (auth.uid()=any(t.coowner_ids) and private.planning_eligible(t.owner_id,auth.uid(),t.audience,t.audience_id))
 ));
$$;

create function private.can_read_planning_proposal(tid uuid,author uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.planning_threads t where t.id=tid and private.can_read_planning_thread(tid)
  and private.planning_eligible(t.owner_id,author,t.audience,t.audience_id) and not private.blocked(author));
$$;

create function private.can_read_planning_member(tid uuid,member_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.planning_threads t where t.id=tid and private.can_read_planning_thread(tid)
  and private.planning_eligible(t.owner_id,member_id,t.audience,t.audience_id) and not private.blocked(member_id));
$$;

create function private.can_read_planning_vote(tid uuid,member_id uuid,pid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.can_read_planning_member(tid,member_id) and exists(
  select 1 from public.planning_proposals p where p.id=pid and p.thread_id=tid and private.can_read_planning_proposal(tid,p.author_id)
 );
$$;

revoke all on function private.planning_eligible(uuid,uuid,public.audience_kind,uuid) from public,anon,authenticated;
revoke all on function private.can_read_planning_thread(uuid) from public,anon,authenticated;
revoke all on function private.can_manage_planning_thread(uuid) from public,anon,authenticated;
revoke all on function private.can_read_planning_proposal(uuid,uuid) from public,anon,authenticated;
revoke all on function private.can_read_planning_member(uuid,uuid) from public,anon,authenticated;
revoke all on function private.can_read_planning_vote(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_read_planning_thread(uuid) to authenticated;
grant execute on function private.can_read_planning_proposal(uuid,uuid) to authenticated;
grant execute on function private.can_read_planning_member(uuid,uuid) to authenticated;
grant execute on function private.can_read_planning_vote(uuid,uuid,uuid) to authenticated;

alter table public.planning_threads enable row level security;
alter table public.planning_ping_responses enable row level security;
alter table public.planning_proposals enable row level security;
alter table public.planning_votes enable row level security;
revoke all on public.planning_threads,public.planning_ping_responses,public.planning_proposals,public.planning_votes from public,anon,authenticated;
grant select on public.planning_threads,public.planning_ping_responses,public.planning_proposals,public.planning_votes to authenticated;
create policy read_planning_threads on public.planning_threads for select to authenticated using(private.can_read_planning_thread(id));
create policy read_planning_ping_responses on public.planning_ping_responses for select to authenticated using(private.can_read_planning_member(thread_id,user_id));
create policy read_planning_proposals on public.planning_proposals for select to authenticated using(private.can_read_planning_proposal(thread_id,author_id));
create policy read_planning_votes on public.planning_votes for select to authenticated using(private.can_read_planning_vote(thread_id,user_id,proposal_id));

create function private.validate_planning_beacon(owner uuid,draft jsonb,thread_audience public.audience_kind,thread_audience_id uuid,thread_deadline timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare title text; category text; mode text; starts_at timestamptz; ends_at timestamptz; timezone_name text; kind public.audience_kind; aid uuid; url text; label text; lat double precision; lng double precision; target int; description_text text;
begin
 if jsonb_typeof(draft) is distinct from 'object' then raise exception 'Add the full beacon details.'; end if;
 title:=trim(coalesce(draft->>'title','')); category:=draft->>'category'; mode:=draft->>'mode';
 if char_length(title) not between 1 and 120 then raise exception 'Give the beacon a title (up to 120 characters).'; end if;
 if category is null or category not in ('Fitness','Study','Gaming','Creative','Social','Other') then raise exception 'Choose a valid beacon category.'; end if;
 if mode is null or mode not in ('squad','invite') then raise exception 'Choose a valid shared beacon type.'; end if;
 begin starts_at:=(draft->>'starts_at')::timestamptz; ends_at:=(draft->>'ends_at')::timestamptz;
 exception when others then raise exception 'Choose valid beacon dates.'; end;
 if starts_at is null or ends_at is null or not isfinite(starts_at) or not isfinite(ends_at) then raise exception 'Choose finite beacon start and end times.'; end if;
 if starts_at<=thread_deadline then raise exception 'The beacon must start after the planning deadline.'; end if;
 if ends_at<=starts_at then raise exception 'The beacon end must be after its start.'; end if;
 timezone_name:=draft->>'timezone';
 if not exists(select 1 from pg_timezone_names where name=timezone_name) then raise exception 'Choose a valid timezone.'; end if;
 kind:=coalesce(draft->>'audience','private')::public.audience_kind;
 aid:=nullif(draft->>'audience_id','')::uuid;
 if kind<>thread_audience or aid is distinct from thread_audience_id then raise exception 'The beacon and planning thread must share the same audience.'; end if;
 if not private.planning_eligible(owner,auth.uid(),kind,aid) then raise exception 'The beacon audience is no longer available.'; end if;
 label:=coalesce(draft->>'label',''); description_text:=coalesce(draft->>'description',''); url:=nullif(trim(coalesce(draft->>'online_url','')),'');
 if char_length(label)>200 then raise exception 'Keep the location label under 200 characters.'; end if;
 if char_length(description_text)>2000 then raise exception 'Keep beacon details under 2000 characters.'; end if;
 if url is not null and (url !~* '^https://' or char_length(url)>2000) then raise exception 'Online links must begin with https:// and stay under 2000 characters.'; end if;
 lat:=nullif(draft->>'latitude','')::double precision; lng:=nullif(draft->>'longitude','')::double precision;
 if (lat is null)<>(lng is null) or (lat is not null and (lat not between -90 and 90 or lng not between -180 and 180)) then raise exception 'Choose a valid map location.'; end if;
 if nullif(draft->>'target_count','') is not null then
  target:=(draft->>'target_count')::int;
  if target not between 2 and 100 then raise exception 'Choose a crew target from 2 to 100, or leave it blank.'; end if;
 end if;
 perform private.validate_plan_aspirations(coalesce(draft->'aspiration_ids','[]'::jsonb),owner);
end $$;
revoke all on function private.validate_planning_beacon(uuid,jsonb,public.audience_kind,uuid,timestamptz) from public,anon,authenticated;

create function private.materialize_planning_beacon(thread_id uuid,draft jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare thread public.planning_threads; activity_id uuid; aspiration_ids text[]; starts_at timestamptz; ends_at timestamptz; kind public.audience_kind; aid uuid;
begin
 select * into thread from public.planning_threads t where t.id=thread_id;
 if not found then raise exception 'Planning thread unavailable.'; end if;
 starts_at:=(draft->>'starts_at')::timestamptz; ends_at:=(draft->>'ends_at')::timestamptz;
 if starts_at<=now() then raise exception 'This beacon start time has passed.'; end if;
 perform private.validate_planning_beacon(thread.owner_id,draft,thread.audience,thread.audience_id,thread.deadline_at);
 kind:=thread.audience; aid:=thread.audience_id;
 aspiration_ids:=private.validate_plan_aspirations(coalesce(draft->'aspiration_ids','[]'::jsonb),thread.owner_id);
 insert into public.activities(owner_id,title,category,mode,starts_at,ends_at,timezone,approval_required,audience,audience_id,available,target_count,description,aspiration_ids)
 values(thread.owner_id,trim(draft->>'title'),draft->>'category',draft->>'mode',starts_at,ends_at,draft->>'timezone',coalesce((draft->>'approval_required')::boolean,false),kind,aid,coalesce((draft->>'available')::boolean,false),nullif(draft->>'target_count','')::int,coalesce(draft->>'description',''),aspiration_ids)
 returning id into activity_id;
 insert into public.places(activity_id,label,latitude,longitude,online_url)
 values(activity_id,coalesce(draft->>'label',''),nullif(draft->>'latitude','')::double precision,nullif(draft->>'longitude','')::double precision,nullif(trim(coalesce(draft->>'online_url','')),''));
 return activity_id;
end $$;
revoke all on function private.materialize_planning_beacon(uuid,jsonb) from public,anon,authenticated;

create function private.apply_planning_action(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); thread_id uuid:=nullif(payload->>'thread_id','')::uuid;
 proposal_id uuid:=nullif(payload->>'proposal_id','')::uuid; request_id uuid:=nullif(payload->>'id','')::uuid;
 thread public.planning_threads; proposal public.planning_proposals; previous_proposal public.planning_proposals;
 kind text; audience public.audience_kind; aid uuid; deadline timestamptz; response text; approved_value boolean;
 coowners uuid[]:='{}'; coowner jsonb; starts_at timestamptz; materialized uuid; candidate_id uuid;
 approved_count int; result jsonb:='{}'; r public.planning_ping_responses; rsvp_row public.rsvps; activity public.activities; expected_winner_id uuid;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if not exists(select 1 from public.profiles where id=uid) then raise exception 'Finish your profile first.'; end if;
 perform private.limit_action('all',300);

 if action='create_planning_thread' then
  kind:=payload->>'kind';
  if kind is null or kind not in ('ping','vote','draw') then raise exception 'Choose a ping, vote council, or draw council.'; end if;
  begin audience:=coalesce(payload->>'audience','private')::public.audience_kind;
  exception when others then raise exception 'Choose a valid planning audience.'; end;
  aid:=nullif(payload->>'audience_id','')::uuid;
  perform private.validate_audience(audience,aid);
  if payload->'coowner_ids' is not null and jsonb_typeof(payload->'coowner_ids') not in ('array','null') then raise exception 'Choose eligible council co-owners.'; end if;
  if jsonb_array_length(coalesce(nullif(payload->'coowner_ids','null'::jsonb),'[]'::jsonb))>10 then raise exception 'Choose up to 10 council co-owners.'; end if;
  for coowner in select value from jsonb_array_elements(coalesce(nullif(payload->'coowner_ids','null'::jsonb),'[]'::jsonb)) loop
   if jsonb_typeof(coowner)<>'string' then raise exception 'Choose eligible council co-owners.'; end if;
   if not private.planning_eligible(uid,(coowner#>>'{}')::uuid,audience,aid) or (coowner#>>'{}')::uuid=uid then
    raise exception 'Council co-owners must be accepted, visible members of this audience.';
   end if;
   if (coowner#>>'{}')::uuid=any(coowners) then raise exception 'Choose each co-owner once.'; end if;
   coowners:=array_append(coowners,(coowner#>>'{}')::uuid);
  end loop;
  begin deadline:=(payload->>'deadline_at')::timestamptz;
  exception when others then raise exception 'Choose a valid planning deadline.'; end;
  if deadline<=now() or deadline>now()+interval '90 days' then raise exception 'Choose a deadline within the next 90 days.'; end if;
  if char_length(trim(coalesce(payload->>'title',''))) not between 1 and 120 then raise exception 'Give this planning thread a title (up to 120 characters).'; end if;
  if char_length(coalesce(payload->>'body',''))>500 then raise exception 'Keep planning details under 500 characters.'; end if;
  if kind='ping' then perform private.validate_planning_beacon(uid,payload->'payload',audience,aid,deadline);
  elsif payload ? 'payload' and payload->'payload'<>'null'::jsonb then raise exception 'Council beacon options are added after the council is created.';
  end if;
  if request_id is not null then
   select * into thread from public.planning_threads where id=request_id;
   if found then
    if thread.owner_id=uid then return jsonb_build_object('id',thread.id,'status',thread.status); end if;
    raise exception 'That planning ID is already in use.';
   end if;
  end if;
  insert into public.planning_threads(id,owner_id,coowner_ids,kind,title,body,audience,audience_id,deadline_at,payload)
   values(coalesce(request_id,gen_random_uuid()),uid,coowners,kind,trim(payload->>'title'),coalesce(payload->>'body',''),audience,aid,deadline,case when kind='ping' then payload->'payload' else null end)
   returning * into thread;
  return jsonb_build_object('id',thread.id,'status',thread.status);
 end if;

 if thread_id is null then raise exception 'Planning thread unavailable.'; end if;
 select * into thread from public.planning_threads where id=thread_id for update;
 if not found then raise exception 'Planning thread unavailable.'; end if;

 if action='respond_planning_ping' then
  if thread.kind<>'ping' or thread.status<>'open' or thread.deadline_at<=now()
   or not private.planning_eligible(thread.owner_id,uid,thread.audience,thread.audience_id) then raise exception 'This ping is no longer open to your response.'; end if;
  response:=payload->>'response';
  if response not in ('interested','maybe','pass') then raise exception 'Choose interested, maybe, or pass.'; end if;
  if coalesce((payload->>'auto_rsvp')::boolean,false) and response<>'interested' then raise exception 'Automatic RSVP is available with Interested.'; end if;
  insert into public.planning_ping_responses(thread_id,user_id,response,auto_rsvp)
   values(thread.id,uid,response,coalesce((payload->>'auto_rsvp')::boolean,false))
   on conflict on constraint planning_ping_responses_pkey do update set response=excluded.response,auto_rsvp=excluded.auto_rsvp,updated_at=now();
  return jsonb_build_object('thread_id',thread.id,'response',response);
 end if;

 if action='convert_planning_ping' then
  if thread.kind<>'ping' or thread.owner_id<>uid then raise exception 'Only the ping creator can make its beacon.'; end if;
  if thread.materialized_activity_id is not null then return jsonb_build_object('id',thread.materialized_activity_id,'activity_id',thread.materialized_activity_id,'status',thread.status); end if;
  if thread.status<>'open' then raise exception 'This ping can no longer be converted.'; end if;
  materialized:=private.materialize_planning_beacon(thread.id,thread.payload);
  update public.planning_threads set status='resolved',resolved_at=now(),materialized_activity_id=materialized where id=thread.id;
  select * into activity from public.activities where id=materialized;
  for r in select * from public.planning_ping_responses ping_response where ping_response.thread_id=thread.id and ping_response.response='interested' and ping_response.auto_rsvp loop
   if private.planning_eligible(thread.owner_id,r.user_id,thread.audience,thread.audience_id) then
    insert into public.rsvps(activity_id,user_id,status,approved)
     values(materialized,r.user_id,case when activity.approval_required or activity.mode='invite' then 'requested' else 'going' end,false)
     on conflict(activity_id,user_id) do nothing;
   end if;
  end loop;
  return jsonb_build_object('id',materialized,'activity_id',materialized,'status','resolved');
 end if;

 if action='add_council_proposal' then
  if thread.kind not in ('vote','draw') or thread.status<>'open' or thread.deadline_at<=now()
   or not private.planning_eligible(thread.owner_id,uid,thread.audience,thread.audience_id) then raise exception 'This council is no longer open for proposals.'; end if;
  select count(*) into approved_count from public.planning_proposals p where p.thread_id=thread.id;
  if approved_count>=30 then raise exception 'This council has reached its proposal limit.'; end if;
  perform private.validate_planning_beacon(thread.owner_id,payload->'payload',thread.audience,thread.audience_id,thread.deadline_at);
  if request_id is not null then
   select * into proposal from public.planning_proposals where id=request_id;
   if found then
    if proposal.thread_id=thread.id and proposal.author_id=uid then return jsonb_build_object('id',proposal.id,'thread_id',thread.id); end if;
    raise exception 'That proposal ID is already in use.';
   end if;
  end if;
  insert into public.planning_proposals(id,thread_id,author_id,payload)
   values(coalesce(request_id,gen_random_uuid()),thread.id,uid,payload->'payload') returning * into proposal;
  return jsonb_build_object('id',proposal.id,'thread_id',thread.id);
 end if;

 if action='approve_council_proposal' then
  if thread.kind not in ('vote','draw') or thread.status<>'open' or thread.deadline_at<=now()
   or not private.can_manage_planning_thread(thread.id) then raise exception 'Only a current council manager can approve options before the deadline.'; end if;
  proposal_id:=coalesce(proposal_id,request_id);
  select * into proposal from public.planning_proposals p where p.id=proposal_id and p.thread_id=thread.id for update;
  if not found or not private.planning_eligible(thread.owner_id,proposal.author_id,thread.audience,thread.audience_id) then raise exception 'That council option is unavailable.'; end if;
  if coalesce((payload->>'approved')::boolean,false) then
   if (proposal.payload->>'starts_at')::timestamptz<=now() then raise exception 'This option start time has passed.'; end if;
   perform private.validate_planning_beacon(thread.owner_id,proposal.payload,thread.audience,thread.audience_id,thread.deadline_at);
  end if;
  approved_value:=coalesce((payload->>'approved')::boolean,false);
  update public.planning_proposals set approved=approved_value where id=proposal.id;
  return jsonb_build_object('proposal_id',proposal.id,'approved',approved_value);
 end if;

 if action='vote_council_proposal' then
  if thread.kind<>'vote' or thread.status<>'open' or thread.deadline_at<=now()
   or not private.planning_eligible(thread.owner_id,uid,thread.audience,thread.audience_id) then raise exception 'This vote is no longer open to you.'; end if;
  select * into proposal from public.planning_proposals p where p.id=proposal_id and p.thread_id=thread.id and p.approved and p.disqualified_at is null for update;
  if not found or (proposal.payload->>'starts_at')::timestamptz<=now()
   or not private.planning_eligible(thread.owner_id,proposal.author_id,thread.audience,thread.audience_id)
   or exists(select 1 from public.blocks b where (b.blocker_id=uid and b.blocked_id=proposal.author_id) or (b.blocker_id=proposal.author_id and b.blocked_id=uid)) then raise exception 'Choose an approved option that is still visible to you.'; end if;
  insert into public.planning_votes(thread_id,proposal_id,user_id) values(thread.id,proposal.id,uid)
   on conflict on constraint planning_votes_pkey do update set proposal_id=excluded.proposal_id,updated_at=now();
  return jsonb_build_object('thread_id',thread.id,'proposal_id',proposal.id);
 end if;

 if action='resolve_planning_thread' then
  if thread.kind='ping' or not private.can_manage_planning_thread(thread.id) then raise exception 'Only a current council manager can resolve this council.'; end if;
  if thread.status<>'open' then
   return jsonb_build_object('id',thread.materialized_activity_id,'activity_id',thread.materialized_activity_id,'status',thread.status,'winner_proposal_id',thread.winner_proposal_id);
  end if;
  if thread.deadline_at>now() then raise exception 'The council deadline has not arrived.'; end if;
  select count(*) into approved_count from public.planning_proposals p where p.thread_id=thread.id and p.approved and p.disqualified_at is null
   and private.planning_eligible(thread.owner_id,p.author_id,thread.audience,thread.audience_id);
  if approved_count=0 then
   update public.planning_threads set status='no_options',resolved_at=now() where id=thread.id;
   return jsonb_build_object('id',null,'activity_id',null,'status','no_options');
  end if;
  if thread.kind='draw' then
   select p.id into candidate_id from public.planning_proposals p where p.thread_id=thread.id and p.approved and p.disqualified_at is null
    and (p.payload->>'starts_at')::timestamptz>now()
    and private.planning_eligible(thread.owner_id,p.author_id,thread.audience,thread.audience_id)
    order by random(),p.created_at,p.id limit 1;
  else
   select p.id into candidate_id from public.planning_proposals p
    left join public.planning_votes v on v.thread_id=p.thread_id and v.proposal_id=p.id
    where p.thread_id=thread.id and p.approved and p.disqualified_at is null
     and (p.payload->>'starts_at')::timestamptz>now()
     and private.planning_eligible(thread.owner_id,p.author_id,thread.audience,thread.audience_id)
    group by p.id,p.created_at
    order by count(v.user_id) filter(where v.user_id is not null
     and private.planning_eligible(thread.owner_id,v.user_id,thread.audience,thread.audience_id)
     and not exists(select 1 from public.blocks b where (b.blocker_id=v.user_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=v.user_id))) desc,p.created_at,p.id limit 1;
  end if;
  if candidate_id is null then
   update public.planning_threads set status='expired',resolved_at=now() where id=thread.id;
   return jsonb_build_object('id',null,'activity_id',null,'status','expired');
  end if;
  select * into proposal from public.planning_proposals p where p.id=candidate_id;
  materialized:=private.materialize_planning_beacon(thread.id,proposal.payload);
  update public.planning_proposals set activity_id=materialized where id=proposal.id;
  update public.planning_threads set status='resolved',winner_proposal_id=proposal.id,materialized_activity_id=materialized,resolved_at=now() where id=thread.id;
  return jsonb_build_object('id',materialized,'activity_id',materialized,'status','resolved','winner_proposal_id',proposal.id);
 end if;

 if action='replace_council_winner' then
  if thread.kind='ping' or thread.status<>'resolved' or not private.can_manage_planning_thread(thread.id)
   or coalesce((payload->>'confirm_cancel_previous')::boolean,false) is not true then raise exception 'Confirm replacing the current council winner.'; end if;
  expected_winner_id:=nullif(payload->>'expected_winner_proposal_id','')::uuid;
  if expected_winner_id is null then raise exception 'Refresh the council before replacing its winner.'; end if;
  if expected_winner_id<>thread.winner_proposal_id then
   if expected_winner_id=thread.replaced_from_proposal_id then
    return jsonb_build_object('id',thread.materialized_activity_id,'activity_id',thread.materialized_activity_id,'status','resolved','winner_proposal_id',thread.winner_proposal_id);
   end if;
   raise exception 'The council winner changed. Refresh before trying again.';
  end if;
  select * into activity from public.activities a where a.id=thread.materialized_activity_id for update;
  if not found or activity.status<>'scheduled' or activity.starts_at<=now() then raise exception 'The current winner has started or is no longer replaceable.'; end if;
  select * into previous_proposal from public.planning_proposals p where p.id=thread.winner_proposal_id and p.thread_id=thread.id for update;
  if previous_proposal.id is null then raise exception 'The current winner is unavailable.'; end if;
  if thread.kind='draw' then
   select p.id into candidate_id from public.planning_proposals p where p.thread_id=thread.id and p.id<>previous_proposal.id
    and p.approved and p.disqualified_at is null and p.activity_id is null
    and (p.payload->>'starts_at')::timestamptz>now()
    and private.planning_eligible(thread.owner_id,p.author_id,thread.audience,thread.audience_id)
    order by random(),p.created_at,p.id limit 1;
  else
   select p.id into candidate_id from public.planning_proposals p
    left join public.planning_votes v on v.thread_id=p.thread_id and v.proposal_id=p.id
    where p.thread_id=thread.id and p.id<>previous_proposal.id and p.approved and p.disqualified_at is null and p.activity_id is null
     and (p.payload->>'starts_at')::timestamptz>now()
     and private.planning_eligible(thread.owner_id,p.author_id,thread.audience,thread.audience_id)
    group by p.id,p.created_at
    order by count(v.user_id) filter(where v.user_id is not null
     and private.planning_eligible(thread.owner_id,v.user_id,thread.audience,thread.audience_id)
     and not exists(select 1 from public.blocks b where (b.blocker_id=v.user_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=v.user_id))) desc,p.created_at,p.id limit 1;
  end if;
  if candidate_id is null then raise exception 'There is no other approved option that can still take place.'; end if;
  select * into proposal from public.planning_proposals p where p.id=candidate_id for update;
  update public.activities set status='cancelled' where id=activity.id and owner_id=thread.owner_id and status='scheduled';
  update public.planning_proposals set disqualified_at=now() where id=previous_proposal.id;
  for rsvp_row in select attendee.activity_id,attendee.user_id,attendee.status,attendee.approved from public.rsvps as attendee where attendee.activity_id=thread.materialized_activity_id and attendee.status in ('going','requested','invited') loop
   perform private.notify(rsvp_row.user_id,uid,'A council-selected beacon was cancelled because its option was replaced.',activity.id);
  end loop;
  materialized:=private.materialize_planning_beacon(thread.id,proposal.payload);
  update public.planning_proposals set activity_id=materialized where id=proposal.id;
  update public.planning_threads set replaced_from_proposal_id=previous_proposal.id,winner_proposal_id=proposal.id,materialized_activity_id=materialized where id=thread.id;
  return jsonb_build_object('id',materialized,'activity_id',materialized,'status','resolved','winner_proposal_id',proposal.id,'cancelled_activity_id',activity.id);
 end if;

 raise exception 'Unknown planning action.';
end $$;
revoke all on function private.apply_planning_action(text,jsonb) from public,anon,authenticated;

-- Preserve the current chained action API; only intercept planning operations here.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_planning_legacy;
revoke all on function public.beacon_action_planning_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_planning_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'beacon_action.request_id','beacon_action_planning_legacy.request_id');
 execute definition;
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); previous jsonb; result jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select q.result into previous from private.requests q where q.user_id=uid and q.request_id=beacon_action.request_id;
 if found then return previous; end if;
 if action in ('create_planning_thread','respond_planning_ping','convert_planning_ping','add_council_proposal','approve_council_proposal','vote_council_proposal','resolve_planning_thread','replace_council_winner') then
  result:=private.apply_planning_action(action,payload);
  result:=result||jsonb_build_object('event',action,'thread_id',case when action='create_planning_thread' then result->>'id' else nullif(payload->>'thread_id','') end);
  insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
  return result;
 end if;
 return public.beacon_action_planning_legacy(action,payload,beacon_action.request_id);
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create or replace function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb:='{}'; t text; rows jsonb;
begin
 foreach t in array array['favorites','templates','plan_templates','plans','messages','profiles','friendships','lists','list_members','squads','squad_members','squad_invites','goals','milestones','habits','checkins','activities','places','rsvps','comments','reactions','locations','notices','reports','blocks','beacon_checklist_items','beacon_notes','library_folders','library_folder_items','planning_threads','planning_ping_responses','planning_proposals','planning_votes'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I) x',t) into rows;
  result:=result||jsonb_build_object(t,rows);
 end loop;
 return result||jsonb_build_object('is_moderator',private.is_moderator());
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
