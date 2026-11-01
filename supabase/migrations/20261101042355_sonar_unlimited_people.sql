-- Remove only Sonar's recipient-count ceiling. Keep explicit accepted-friend
-- validation, expiry, owner scoping, request replay and existing execute grants.
do $migration$
declare
  definition text;
  old_guard text := $guard$if jsonb_array_length(coalesce(payload->'recipients','[]')) not between 1 and 50 then raise exception 'Select 1 to 50 accepted friends.'; end if;$guard$;
begin
  select pg_get_functiondef('public.beacon_action_legacy(text,jsonb,uuid)'::regprocedure) into definition;
  if strpos(definition,old_guard)=0 then
    raise exception 'Expected Sonar recipient guard in beacon_action_legacy.';
  end if;
  execute replace(definition,old_guard,
    $guard$if jsonb_array_length(coalesce(payload->'recipients','[]'))<1 then raise exception 'Select at least one accepted friend.'; end if;$guard$);
end $migration$;
