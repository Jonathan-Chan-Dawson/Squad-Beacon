-- User-approved policy: 50 recommended per Beacon, 300 Beacon invitations/hour.
-- Keep atomic creation, explicit friendship validation, replay, grants and notices.
do $migration$
declare candidate record; definition text; patched integer := 0;
  old_guard text := $guard$if jsonb_array_length(selected) not between 1 and 20 then raise exception 'Choose from 1 to 20 friends per Beacon invitation batch.'; end if;$guard$;
begin
  for candidate in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'beacon_action%' and p.prokind='f'
  loop
    definition := pg_get_functiondef(candidate.oid);
    if strpos(definition, old_guard)>0 then
      execute replace(definition,old_guard,'if jsonb_array_length(selected)<1 then raise exception ''Choose at least one friend for this Beacon invitation batch.''; end if;');
      patched := patched+1;
    end if;
  end loop;
  if patched<>1 then raise exception 'Expected one atomic invitation guard, found %.',patched; end if;
  definition := pg_get_functiondef('private.apply_beacon_control_action(text,jsonb)'::regprocedure);
  if strpos(definition,'private.limit_action(''invitations'',20)')=0 then raise exception 'Beacon invitation throttle was not found.'; end if;
  -- Only this Beacon participant action changes; other social invitation limits stay intact.
  -- The existing general 300/hour action throttle remains in force as well.
  execute replace(definition,'private.limit_action(''invitations'',20)','private.limit_action(''invitations'',300)');
end $migration$;
