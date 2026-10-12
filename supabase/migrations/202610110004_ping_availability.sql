-- Extend the existing Ping action in place. Vote/Draw resolution and all access
-- checks, row locks, request deduplication and conversion rules are retained.
alter table public.planning_ping_responses add column available_after timestamptz;
alter table public.planning_ping_responses add constraint planning_ping_availability
 check (available_after is null or (response='interested' and isfinite(available_after)));

do $patch$
declare definition text; original text; old_response text; new_response text;
begin
 select pg_get_functiondef('private.apply_planning_action(text,jsonb)'::regprocedure) into definition;
 original:=definition;
 old_response:=$old$  insert into public.planning_ping_responses(thread_id,user_id,response,auto_rsvp)
   values(thread.id,uid,response,coalesce((payload->>'auto_rsvp')::boolean,false))
   on conflict on constraint planning_ping_responses_pkey do update set response=excluded.response,auto_rsvp=excluded.auto_rsvp,updated_at=now();$old$;
 new_response:=$new$  if payload->>'available_after' is not null and
   (response<>'interested' or payload->>'available_after' !~* '(Z|[+-][0-9]{2}:[0-9]{2})$') then
   raise exception 'Choose a valid availability date/time with a timezone offset for Interested.';
  end if;
  insert into public.planning_ping_responses(thread_id,user_id,response,auto_rsvp,available_after)
   values(thread.id,uid,response,coalesce((payload->>'auto_rsvp')::boolean,false),
    case when response='interested' then (payload->>'available_after')::timestamptz else null end)
   on conflict on constraint planning_ping_responses_pkey do update set
    response=excluded.response,
    auto_rsvp=case when excluded.response<>'interested' then false
     when payload ? 'auto_rsvp' then excluded.auto_rsvp else public.planning_ping_responses.auto_rsvp end,
    available_after=case when excluded.response<>'interested' then null
     when payload ? 'available_after' then excluded.available_after else public.planning_ping_responses.available_after end,
    updated_at=now();$new$;
 definition:=replace(definition,old_response,new_response);
 if definition=original then raise exception 'Could not extend the existing Ping response action.'; end if;
 original:=definition;
 definition:=replace(definition,
  $old$ping_response.response='interested' and ping_response.auto_rsvp loop$old$,
  $new$ping_response.response='interested' and ping_response.auto_rsvp
   and (ping_response.available_after is null or ping_response.available_after<=activity.starts_at) loop$new$);
 if definition=original then raise exception 'Could not add Ping availability to the existing Auto-RSVP conversion.'; end if;
 execute definition;
end $patch$;

comment on column public.planning_ping_responses.available_after is
 'Optional earliest availability for Interested. Does not opt into Auto-RSVP; conversion skips Auto-RSVP when the Beacon starts before this timestamp.';
