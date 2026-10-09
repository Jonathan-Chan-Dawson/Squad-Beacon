-- Unblocking removes only the caller's block. It does not recreate friendships,
-- invitations, profile grants, location recipients, or community memberships.
do $profile_settings_unblock$
declare definition text; anchor text;
begin
  select pg_get_functiondef('public.beacon_action(text,jsonb,uuid)'::regprocedure)
    into definition;
  anchor := ' if action in (''join_squad''';
  if position(anchor in definition) = 0 then
    raise exception 'Could not add the profile-settings unblock action.';
  end if;
  definition := replace(definition, anchor, $branch$
 if action='unblock' then
  if nullif(payload->>'id','') is null or (payload->>'id')::uuid=uid then
   raise exception 'Choose a blocked person.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into prior from private.requests r
   where r.user_id=uid and r.request_id=beacon_action.request_id;
  if found then return prior; end if;
  perform private.limit_action('all',300);
  delete from public.blocks
   where blocker_id=uid and blocked_id=(payload->>'id')::uuid;
  result:=jsonb_build_object('event','unblock','id',payload->>'id');
  insert into private.requests(user_id,request_id,result)
   values(uid,beacon_action.request_id,result);
  return result;
 end if;
 if action in ('join_squad'$branch$);
  execute definition;
end $profile_settings_unblock$;

revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
