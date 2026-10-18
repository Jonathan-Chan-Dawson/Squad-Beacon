-- Additive resolved responses. Invitation grants remain independent of RSVP.
alter table public.rsvps drop constraint rsvps_status_check;
alter table public.rsvps add constraint rsvps_status_check
 check(status in ('interested','going','requested','invited','declined'));

create function private.can_read_resolved_beacon_response(aid uuid,person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select person=auth.uid() or exists(select 1 from public.activities a where a.id=aid and a.owner_id=auth.uid()) or private.can_manage_beacon(aid);
$$;
revoke all on function private.can_read_resolved_beacon_response(uuid,uuid) from public,anon;
grant execute on function private.can_read_resolved_beacon_response(uuid,uuid) to authenticated;
drop policy read_rsvps on public.rsvps;
create policy read_rsvps on public.rsvps for select to authenticated using (
 private.can_activity(activity_id) and not private.blocked(user_id)
 and (status<>'declined' or private.can_read_resolved_beacon_response(activity_id,user_id))
);

alter function public.beacon_action(text,jsonb,uuid) set schema private;
alter function private.beacon_action(text,jsonb,uuid) rename to beacon_action_before_smart_rsvp;
do $migration$
begin
 execute replace(pg_get_functiondef('private.beacon_action_before_smart_rsvp(text,jsonb,uuid)'::regprocedure), 'beacon_action.', 'beacon_action_before_smart_rsvp.');
end $migration$;
revoke all on function private.beacon_action_before_smart_rsvp(text,jsonb,uuid) from public,anon,authenticated;
create function public.beacon_action(action text,payload jsonb default '{}'::jsonb,request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); aid uuid; a public.activities; r public.rsvps;
 result jsonb; previous jsonb; intent text:=payload->>'intent'; invited boolean;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select q.result into previous from private.requests q where q.user_id=uid and q.request_id=beacon_action.request_id;
 if found then return previous; end if;
 if action in ('rsvp','invite_activity') then
  aid:=nullif(payload->>'id','')::uuid;
  if payload ? 'activity_id' and nullif(payload->>'activity_id','')::uuid is distinct from aid then
   raise exception 'Choose one Beacon.';
  end if;
  select * into a from public.activities where id=aid for update;
  if a.id is null or not private.can_activity(aid) then raise exception 'This Beacon is no longer available.'; end if;
  select * into r from public.rsvps where activity_id=aid and user_id=case when action='invite_activity' then nullif(payload->>'user_id','')::uuid else uid end for update;
  if action='invite_activity' and r.status='declined' and not coalesce((payload->>'reinvite')::boolean,false) then
   if not private.can_admit_beacon(aid) then raise exception 'Only an authorized manager can invite participants.'; end if;
   result:=jsonb_build_object('event',action,'activity_id',aid,'status','declined','resolved',true);
   insert into private.requests(user_id,request_id,result) values(uid,request_id,result);
   return result;
  end if;
  if action='rsvp' then
   if intent is not null and intent not in ('leave','cancel_request','remove_maybe') then raise exception 'Unknown RSVP intent.'; end if;
   if intent is not null and payload->>'status'<>'withdraw' then raise exception 'Withdrawal intent requires withdrawal.'; end if;
   select exists(select 1 from public.beacon_invitation_grants g where g.activity_id=aid and g.user_id=uid) into invited;
   -- Legacy withdrawals and retried operations must never reopen a resolved invitation.
   if payload->>'status'='withdraw' and r.status='declined' then
    result:=jsonb_build_object('event','rsvp','activity_id',aid,'status','declined');
    insert into private.requests(user_id,request_id,result) values(uid,request_id,result);
    return result;
   end if;
   if payload->>'status'='declined' then
    if a.owner_id=uid or a.mode='solo' or a.status<>'scheduled' or a.ends_at<=now()
     or not invited or r.status not in ('invited','interested','declined') or r.status is null then
     raise exception 'Only an active invitation can be declined. Use Leave Beacon for confirmed attendance.';
    end if;
    update public.rsvps set status='declined' where activity_id=aid and user_id=uid;
    result:=jsonb_build_object('event','rsvp','activity_id',aid,'status','declined');
    insert into private.requests(user_id,request_id,result) values(uid,request_id,result);
    return result;
   end if;
   if intent='leave' and not private.beacon_approved_going(aid,uid) then raise exception 'Your response changed. Refresh before leaving.'; end if;
   if intent='cancel_request' and not coalesce((r.status='requested' or (r.status='going' and not private.beacon_approved_going(aid,uid))),false) then raise exception 'There is no pending request to cancel.'; end if;
   if intent='remove_maybe' and (r.status is distinct from 'interested' or invited) then raise exception 'Your tentative response changed. Refresh to review it.'; end if;
  end if;
 end if;
 result:=private.beacon_action_before_smart_rsvp(action,payload,request_id);
 if action='rsvp' and intent='leave' and invited and exists(select 1 from public.beacon_invitation_grants g where g.activity_id=aid and g.user_id=uid) then
  update public.rsvps set status='declined' where activity_id=aid and user_id=uid;
  result:=result||jsonb_build_object('status','declined');
  update private.requests q set result=jsonb_set(q.result,'{status}','"declined"'::jsonb) where q.user_id=uid and q.request_id=beacon_action.request_id;
 end if;
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

-- Preserve the four-state legacy read vocabulary. New readers merge the additive
-- resolved projection into the same canonical RSVP collection, never another store.
alter function public.beacon_snapshot() set schema private;
alter function private.beacon_snapshot() rename to beacon_snapshot_before_smart_rsvp;
revoke all on function private.beacon_snapshot_before_smart_rsvp() from public,anon;
grant execute on function private.beacon_snapshot_before_smart_rsvp() to authenticated;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=private.beacon_snapshot_before_smart_rsvp();
 result:=jsonb_set(result,'{rsvps}',coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(result->'rsvps','[]'::jsonb)) x where x->>'status' in ('invited','requested','interested','going')),'[]'::jsonb));
 return result||jsonb_build_object(
  'resolved_beacon_responses',coalesce((select jsonb_agg(to_jsonb(r)) from public.rsvps r where r.status='declined'),'[]'::jsonb),
  'capabilities',coalesce(result->'capabilities','{}'::jsonb)||jsonb_build_object('rsvp_decline',true)
 );
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
