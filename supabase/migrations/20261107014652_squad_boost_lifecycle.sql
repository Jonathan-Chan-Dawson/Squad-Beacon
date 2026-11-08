-- Included Boosts are private allocations of verified allowance, never purchases.
create table private.boost_allocations(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,squad_id uuid references public.squads on delete set null,assigned_at timestamptz not null default now(),released_at timestamptz,available_at timestamptz,hidden boolean not null default false,check((released_at is null)=(available_at is null)));
create index boost_owner_active on private.boost_allocations(owner_id,assigned_at,id) where released_at is null;
create index boost_squad_active on private.boost_allocations(squad_id) where released_at is null;
create table private.squad_boost_state(squad_id uuid primary key references public.squads on delete cascade,qualified_tier text not null default 'free',retained_tier text not null default 'free',grace_until timestamptz,last_event_at timestamptz not null default '-infinity');
alter table private.boost_allocations enable row level security;
alter table private.squad_boost_state enable row level security;
revoke all on private.boost_allocations,private.squad_boost_state from public,anon,authenticated;
create function private.boost_allowance(uid uuid) returns integer language sql stable security definer set search_path='' as $$select case private.premium_tier(uid) when 'pro' then 5 when 'plus' then 2 else 0 end$$;
create function private.boost_tier(n bigint) returns text language sql immutable set search_path='' as $$select case when n>=4 then 'pro' when n>=2 then 'plus' else 'free' end$$;
create function private.boost_count_at(sid uuid,event_on timestamptz) returns bigint language sql stable security definer set search_path='' as $$select count(*) from private.boost_allocations b where b.squad_id=sid and b.assigned_at<=event_on and (b.released_at is null or b.released_at>event_on)$$;
create function private.live_boost_count(sid uuid) returns bigint language sql stable security definer set search_path='' as $$
 select count(*) from (select b.*,row_number() over(partition by b.owner_id order by b.assigned_at,b.id) priority from private.boost_allocations b where b.released_at is null and exists(select 1 from public.squad_members m where m.squad_id=b.squad_id and m.user_id=b.owner_id)) eligible where squad_id=sid and priority<=private.boost_allowance(owner_id)
$$;
create function private.record_boost_level(sid uuid,event_on timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare s private.squad_boost_state; tier text; retained text; until_at timestamptz; begin
 if not exists(select 1 from public.squads where id=sid) then return; end if;
 insert into private.squad_boost_state(squad_id) values(sid) on conflict do nothing;
 select * into s from private.squad_boost_state where squad_id=sid for update;
 if event_on<s.last_event_at then return; end if;
 tier:=private.boost_tier(private.boost_count_at(sid,event_on)); retained:=s.retained_tier; until_at:=s.grace_until;
 if private.premium_rank(tier)<private.premium_rank(s.qualified_tier) then
  if until_at is null or event_on>=until_at then retained:=s.qualified_tier; until_at:=event_on+interval '72 hours'; end if;
 end if;
 if private.premium_rank(tier)>=private.premium_rank(retained) then retained:=tier; until_at:=null; end if;
 update private.squad_boost_state set qualified_tier=tier,retained_tier=retained,grace_until=until_at,last_event_at=event_on where squad_id=sid;
end $$;
create function private.reconcile_boosts() returns void language plpgsql security definer set search_path='' as $$
declare b record; events jsonb:='[]'; lost timestamptz; e record; begin
 -- One lifecycle lock precedes every allocation, level and reconciliation write.
 perform pg_advisory_xact_lock(hashtextextended('squad-boost-lifecycle',0));
 for b in select a.*,g.valid_until,g.revoked_at from private.boost_allocations a left join private.premium_grants g on g.owner_id=a.owner_id where a.released_at is null
  and (private.boost_allowance(a.owner_id)=0 or not exists(select 1 from public.squad_members m where m.squad_id=a.squad_id and m.user_id=a.owner_id)) for update of a loop
  lost:=least(now(),coalesce(b.valid_until,now()),coalesce(b.revoked_at,now()));
  update private.boost_allocations set released_at=lost,available_at=lost+interval '72 hours' where id=b.id;
  events:=events||jsonb_build_array(jsonb_build_object('squad',b.squad_id,'at',lost));
 end loop;
 for b in select * from (select a.*,row_number() over(partition by owner_id order by assigned_at,id) priority from private.boost_allocations a where released_at is null) ranked where priority>private.boost_allowance(owner_id) loop
  update private.boost_allocations set released_at=now(),available_at=now()+interval '72 hours' where id=b.id;
  events:=events||jsonb_build_array(jsonb_build_object('squad',b.squad_id,'at',now()));
 end loop;
 for e in select distinct (v->>'squad')::uuid sid,(v->>'at')::timestamptz at_time from jsonb_array_elements(events) v where v->>'squad' is not null order by at_time,sid loop perform private.record_boost_level(e.sid,e.at_time); end loop;
end $$;
create function private.squad_boost_status(sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s private.squad_boost_state; n bigint:=private.live_boost_count(sid); tier text; held text; until_at timestamptz; lost timestamptz; threshold integer; begin
 select * into s from private.squad_boost_state where squad_id=sid; tier:=private.boost_tier(n); held:=tier;
 if s.grace_until>now() and private.premium_rank(s.retained_tier)>private.premium_rank(tier) then held:=s.retained_tier; until_at:=s.grace_until;
 elsif private.premium_rank(tier)<private.premium_rank(s.qualified_tier) then
  -- Derive the actual first threshold-crossing expiry, even before a maintenance run.
  threshold:=case s.qualified_tier when 'pro' then 4 else 2 end;
  select min(g.valid_until) into lost from private.boost_allocations b join private.premium_grants g on g.owner_id=b.owner_id
   where b.squad_id=sid and b.released_at is null and g.valid_until<=now() and
    (select count(*) from private.boost_allocations x left join private.premium_grants gx on gx.owner_id=x.owner_id where x.squad_id=sid and x.released_at is null and (gx.valid_until is null or gx.valid_until>g.valid_until))<threshold;
  if lost is not null and lost+interval '72 hours'>now() and (s.grace_until is null or lost>=s.grace_until) then held:=s.qualified_tier; until_at:=lost+interval '72 hours'; end if;
 end if;
 return jsonb_build_object('squad_id',sid,'total',n,'qualified_tier',tier,'tier',held,'source',case when held<>tier then 'grace' when held<>'free' then 'squad' else 'free' end,'grace_until',until_at);
end $$;
create or replace function private.squad_premium_tier(sid uuid) returns text language sql stable security definer set search_path='' as $$select private.squad_boost_status(sid)->>'tier'$$;
create function private.boost_grant_changed() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.reconcile_boosts(); return null; end $$;
create trigger boost_grant_changed after insert or update or delete on private.premium_grants for each statement execute function private.boost_grant_changed();
create function private.boost_member_left() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform private.reconcile_boosts(); return old;
end $$;
create trigger boost_member_left after delete on public.squad_members for each row execute function private.boost_member_left();
revoke all on function private.boost_allowance(uuid),private.boost_tier(bigint),private.boost_count_at(uuid,timestamptz),private.live_boost_count(uuid),private.record_boost_level(uuid,timestamptz),private.reconcile_boosts(),private.squad_boost_status(uuid),private.boost_grant_changed(),private.boost_member_left() from public,anon,authenticated;

create or replace function private.routine_premium_allowed(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select r.run_mode='manual' or jsonb_array_length(private.plan_routine_steps(r.plan_id))<=1 or private.premium_tier(r.owner_id) in ('plus','pro') or
  (p.squad_id is not null and exists(select 1 from public.squad_members m where m.squad_id=p.squad_id and m.user_id=r.owner_id) and private.squad_premium_tier(p.squad_id) in ('plus','pro') and
   case when source.plan_id is not null then cardinality(source.activity_ids)>0 and not exists(select 1 from unnest(source.activity_ids) source_ids(source_id) left join public.activities a on a.id=source_ids.source_id where a.id is null or a.audience<>'squad' or a.audience_id is distinct from p.squad_id or exists(select 1 from private.beacon_discovery d where d.activity_id=a.id))
   else exists(select 1 from public.activities a where a.plan_id=p.id) and not exists(select 1 from public.activities a where a.plan_id=p.id and (a.audience<>'squad' or a.audience_id is distinct from p.squad_id or exists(select 1 from private.beacon_discovery d where d.activity_id=a.id))) end)
  from public.plan_routines r join public.plans p on p.id=r.plan_id left join private.plan_repeat_sources source on source.plan_id=p.id where r.id=rid),false)
$$;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_squad_boosts;
revoke all on function public.beacon_action_before_squad_boosts(text,jsonb,uuid) from public,anon,authenticated;
create function private.boost_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid:=nullif(payload->>'squad_id','')::uuid; b private.boost_allocations; used integer; result jsonb; begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 if action like '%squad%' or action in ('assign_boost','withdraw_boost','set_boost_privacy','remove_member','promote_member') then perform pg_advisory_xact_lock(hashtextextended('squad-boost-lifecycle',0)); end if;
 if action not in ('assign_boost','withdraw_boost','set_boost_privacy') then return public.beacon_action_before_squad_boosts(action,payload,request_id); end if;
 perform private.reconcile_boosts();
 select q.result into result from private.requests q where q.user_id=uid and q.request_id=boost_action.request_id; if found then return result; end if;
 perform private.limit_action('all',300);
 if action='assign_boost' then
  if not exists(select 1 from public.squad_members m join public.squads s on s.id=m.squad_id where m.squad_id=sid and m.user_id=uid and s.archived_at is null) then raise exception 'Join this Squad before contributing a Boost.'; end if;
  select count(*) into used from private.boost_allocations where owner_id=uid and (released_at is null or available_at>now());
  if used>=private.boost_allowance(uid) then raise exception 'No Boost slots available. Released Boosts have a 72-hour transfer wait.'; end if;
  if private.live_boost_count(sid)>=5 then raise exception 'This Squad already has five active Boosts.'; end if;
  insert into private.boost_allocations(owner_id,squad_id,hidden) values(uid,sid,coalesce((payload->>'hidden')::boolean,false)) returning * into b;
  perform private.record_boost_level(sid,now());
 else
  select * into b from private.boost_allocations where id=(payload->>'id')::uuid and owner_id=uid for update;
  if not found then raise exception 'Boost allocation unavailable.'; end if;
  if action='withdraw_boost' and b.released_at is null then
   update private.boost_allocations set released_at=now(),available_at=now()+interval '72 hours' where id=b.id;
   perform private.record_boost_level(b.squad_id,now());
  elsif action='set_boost_privacy' then
   if jsonb_typeof(payload->'hidden') is distinct from 'boolean' then raise exception 'Choose contributor visibility.'; end if;
   update private.boost_allocations set hidden=(payload->>'hidden')::boolean where id=b.id;
  end if;
 end if;
 result:=jsonb_build_object('id',b.id); insert into private.requests(user_id,request_id,result) values(uid,boost_action.request_id,result); return result;
end $$;
revoke all on function private.boost_action(text,jsonb,uuid) from public,anon;
grant execute on function private.boost_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select private.boost_action(action,payload,request_id)$$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create function private.boost_projection() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object(
 'boost_allocations',coalesce((select jsonb_agg(to_jsonb(b)) from private.boost_allocations b where b.owner_id=auth.uid() and (b.released_at is null or b.available_at>now())),'[]'::jsonb),
 'squad_premium',coalesce((select jsonb_agg(private.squad_boost_status(s.id)||jsonb_build_object('contributors',coalesce((select jsonb_agg(jsonb_build_object('allocation_id',b.id,'user_id',case when not b.hidden and private.can_profile(b.owner_id) and not private.blocked(b.owner_id) then b.owner_id end)) from private.boost_allocations b where b.squad_id=s.id and b.released_at is null),'[]'::jsonb))) from public.squads s where exists(select 1 from public.squad_members m where m.squad_id=s.id and m.user_id=auth.uid())),'[]'::jsonb),
 'beacon_premium',coalesce((select jsonb_object_agg(a.id::text,jsonb_build_object('tier',private.beacon_premium_tier(a.id),'source',case when private.premium_rank(private.beacon_premium_tier(a.id))>private.premium_rank(private.premium_tier(a.owner_id)) then private.squad_boost_status(a.audience_id)->>'source' when private.beacon_premium_tier(a.id)='free' then 'free' else 'verified' end,'grace_until',case when private.premium_rank(private.beacon_premium_tier(a.id))>private.premium_rank(private.premium_tier(a.owner_id)) then private.squad_boost_status(a.audience_id)->'grace_until' end)) from public.activities a where private.can_chat(a.id)),'{}'::jsonb)||coalesce((select jsonb_object_agg(t.id::text,jsonb_build_object('tier',private.thread_premium_tier(t.id),'source',case when private.premium_rank(private.thread_premium_tier(t.id))>private.premium_rank(private.premium_tier(t.owner_id)) then 'squad' when private.thread_premium_tier(t.id)='free' then 'free' else 'verified' end,'grace_until',null)) from public.planning_threads t where private.can_read_planning_thread(t.id)),'{}'::jsonb)
)$$;
revoke all on function private.boost_projection() from public,anon;
grant execute on function private.boost_projection() to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_squad_boosts;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$declare result jsonb; begin
 perform private.refresh_boost_snapshot();
 result:=public.beacon_snapshot_before_squad_boosts(); return result||private.boost_projection()||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}')||'{"squad_boosts":true}'::jsonb);
end $$;
create function private.refresh_boost_snapshot() returns void language plpgsql security definer set search_path='' as $$begin if auth.uid() is null then raise exception 'Sign in to continue.'; end if; perform private.reconcile_boosts(); end $$;
revoke all on function private.refresh_boost_snapshot() from public,anon;
grant execute on function private.refresh_boost_snapshot() to authenticated;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
alter function public.run_due_plan_routines(integer) rename to run_due_plan_routines_before_boosts;
revoke all on function public.run_due_plan_routines_before_boosts(integer) from public,anon,authenticated;
create function public.run_due_plan_routines(horizon_days integer default 30) returns integer language plpgsql security definer set search_path='' as $$begin
 if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'Trusted runner required.'; end if;
 perform private.reconcile_boosts(); return public.run_due_plan_routines_before_boosts(horizon_days);
end $$;
revoke all on function public.run_due_plan_routines(integer) from public,anon,authenticated;
grant execute on function public.run_due_plan_routines(integer) to service_role;
