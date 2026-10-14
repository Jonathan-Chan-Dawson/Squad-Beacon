-- Finite solo-status reactions; existing Beacon dispatch and access gates stay intact.
alter table public.reactions drop constraint reactions_emoji_check;
alter table public.reactions add constraint reactions_emoji_check check(emoji in ('🙌','❤️','👍','🔥','😂','🎉','👋','✅','😊','😍','🤩','🤗','😎','🤔','😮','😢','💪','👏','🤝','☕','📚','🏀','🎮','🚶'));
-- Reuse reactions for visible, current solo statuses. No RSVP or RLS changes.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_status_emoji_legacy;
revoke all on function public.beacon_action_status_emoji_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$ declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_status_emoji_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 execute replace(definition,'beacon_action.request_id','beacon_action_status_emoji_legacy.request_id');
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); aid uuid; a public.activities; prior jsonb; result jsonb; chosen text;
begin
 if action not in ('react','react_status') then return public.beacon_action_status_emoji_legacy(action,payload,beacon_action.request_id); end if;
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
 if found then return prior; end if;
 aid:=nullif(payload->>'id','')::uuid;
 select * into a from public.activities where id=aid for update;
 if not found then raise exception 'Status unavailable.'; end if;
 if a.mode<>'solo' and action='react_status' then raise exception 'Choose a current solo status.'; end if;
 if a.mode<>'solo' then return public.beacon_action_status_emoji_legacy(action,payload,beacon_action.request_id); end if;
 if not private.can_activity(aid) or private.blocked(a.owner_id)
  or a.status<>'scheduled' or a.starts_at>now() or a.ends_at<=now() or not a.enable_reactions then
  raise exception 'Reactions are paused or unavailable for this status.';
 end if;
 perform private.limit_action('all',300);
 if payload->'remove'='true'::jsonb then
  delete from public.reactions where activity_id=aid and user_id=uid;
 else
  chosen:=coalesce(payload->>'emoji','🙌');
  if chosen not in ('🙌','❤️','👍','🔥','😂','🎉','👋','✅','😊','😍','🤩','🤗','😎','🤔','😮','😢','💪','👏','🤝','☕','📚','🏀','🎮','🚶') then raise exception 'Choose a supported status reaction.'; end if;
  insert into public.reactions(activity_id,user_id,emoji) values(aid,uid,chosen)
   on conflict(activity_id,user_id) do update set emoji=excluded.emoji;
 end if;
 result:=jsonb_build_object('id',aid,'event',action);
 insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
