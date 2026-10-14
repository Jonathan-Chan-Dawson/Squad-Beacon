-- Creation and explicitly selected invitations commit together; neither action implies Going.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_atomic_creation_legacy;
revoke all on function public.beacon_action_atomic_creation_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$ declare definition text; begin
 select pg_get_functiondef('public.beacon_action_atomic_creation_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 execute replace(definition,'beacon_action.request_id','beacon_action_atomic_creation_legacy.request_id');
end $$;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prior jsonb; result jsonb; recipient jsonb; target uuid; aid uuid; selected jsonb; creator text;
begin
 if action not in ('create_activity_with_invitees','create_plan_beacon_with_invitees') then
  return public.beacon_action_atomic_creation_legacy(action,payload,beacon_action.request_id);
 end if;
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if nullif(payload->>'expected_actor_id','')::uuid is not null and (payload->>'expected_actor_id')::uuid<>uid then raise exception 'Your account changed before publication. Return to the account that started this Beacon.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
 if found then return prior; end if;
 selected:=payload->'invitee_ids';
 if selected is null or jsonb_typeof(selected)<>'array' then raise exception 'Choose selected friends for this Beacon.'; end if;
 if jsonb_array_length(selected) not between 1 and 20 then raise exception 'Choose from 1 to 20 friends per Beacon invitation batch.'; end if;
 if payload->>'mode' is null or payload->>'mode' not in ('squad','invite') then raise exception 'Selected friends can only be invited to a shared Beacon.'; end if;
 -- Validate the entire explicit selection before any creation or notification.
 for recipient in select value from jsonb_array_elements(selected) loop
  if jsonb_typeof(recipient)<>'string' then raise exception 'Choose valid selected friends.'; end if;
  target:=(recipient#>>'{}')::uuid;
  if target=uid or not private.friends(target) then raise exception 'A selected friend is no longer eligible. Review your selected friends.'; end if;
 end loop;
 if jsonb_array_length(selected)<>(select count(distinct value::uuid) from jsonb_array_elements_text(selected)) then raise exception 'Choose each friend only once.'; end if;
 creator:=case when action='create_plan_beacon_with_invitees' then 'create_plan_beacon' else 'create_activity' end;
 result:=public.beacon_action_atomic_creation_legacy(creator,payload-'invitee_ids'-'expected_actor_id',gen_random_uuid());
 aid:=nullif(result->>'id','')::uuid;
 if aid is null then raise exception 'The Beacon could not be verified.'; end if;
 for recipient in select value from jsonb_array_elements(selected) loop
  perform private.apply_beacon_control_action('invite_activity',jsonb_build_object('id',aid,'user_id',(recipient#>>'{}')::uuid));
 end loop;
 result:=result||jsonb_build_object('event',action,'committed',true,'invited_ids',selected);
 insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
