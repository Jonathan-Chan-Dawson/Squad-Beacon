-- Reuse reactions for visible, current solo statuses. No RSVP or RLS changes.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_solo_status_legacy;
revoke all on function public.beacon_action_solo_status_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$ declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_solo_status_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 execute replace(definition,'beacon_action.request_id','beacon_action_solo_status_legacy.request_id');
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); aid uuid; a public.activities; prior jsonb; result jsonb;
begin
 if action<>'react' then return public.beacon_action_solo_status_legacy(action,payload,beacon_action.request_id); end if;
 if uid is null then raise exception 'Sign in to continue.'; end if;
 aid:=nullif(payload->>'id','')::uuid;
 select * into a from public.activities where id=aid for update;
 if not found then raise exception 'Status unavailable.'; end if;
 if a.mode<>'solo' then return public.beacon_action_solo_status_legacy(action,payload,beacon_action.request_id); end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
 if found then return prior; end if;
 if not private.can_activity(aid) or private.blocked(a.owner_id)
  or a.status<>'scheduled' or a.starts_at>now() or a.ends_at<=now() or not a.enable_reactions then
  raise exception 'Reactions are paused or unavailable for this status.';
 end if;
 perform private.limit_action('all',300);
 if payload->'remove'='true'::jsonb then
  delete from public.reactions where activity_id=aid and user_id=uid;
 else
  insert into public.reactions(activity_id,user_id,emoji) values(aid,uid,'🙌') on conflict do nothing;
 end if;
 result:=jsonb_build_object('id',aid,'event',action);
 insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
