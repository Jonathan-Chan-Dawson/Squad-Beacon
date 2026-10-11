-- Keep last-known avatars for a day, within the owner's chosen sharing session.
create or replace function private.can_location(lid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.locations l
  where l.id=lid and l.expires_at>now() and not private.blocked(l.owner_id)
   and (l.owner_id=auth.uid() or (
    l.updated_at>now()-interval '24 hours'
    and l.updated_at<=now()+interval '30 seconds'
    and private.friends(l.owner_id)
    and private.can_profile(l.owner_id)
    and exists(select 1 from private.location_recipients r where r.session_id=lid and r.user_id=auth.uid())
   ))
 );
$$;

-- Preserve the canonical action and its existing recipient/security checks.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 if position('interval ''4 hours''' in definition)=0 then
  raise exception 'Expected location duration guard in beacon_action_legacy';
 end if;
 definition:=replace(definition,'interval ''4 hours''','interval ''24 hours''');
 definition:=replace(definition,'Choose a sharing duration up to four hours.','Choose a sharing duration up to 24 hours.');
 execute definition;
end $$;
