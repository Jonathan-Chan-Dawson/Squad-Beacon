-- Persist one icon per Squad; existing memberships and discovery projections remain unchanged.
alter table public.squads add column icon_key text not null default 'users'
 check(icon_key in ('users','fitness','sports','gaming','coffee','study','music','sparkles'));

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_squad_icon_legacy;
revoke all on function public.beacon_action_squad_icon_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$ declare definition text;
begin
 select pg_get_functiondef('public.beacon_action_squad_icon_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 execute replace(definition,'beacon_action.request_id','beacon_action_squad_icon_legacy.request_id');
end $$;

create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; icon text; prior jsonb; result jsonb;
begin
 if action<>'update_squad_icon' then return public.beacon_action_squad_icon_legacy(action,payload,beacon_action.request_id); end if;
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
 if found then return prior; end if;
 sid:=nullif(payload->>'squad_id','')::uuid;
 perform 1 from public.squads where id=sid for update;
 if not found or not private.social_active('squad',sid,uid)
  or coalesce(private.organization_role_rank(private.social_role('squad',sid,uid)),0)<3 then
  raise exception 'Only current Squad admins can change its icon.';
 end if;
 icon:=payload->>'icon_key';
 if icon is null or icon not in ('users','fitness','sports','gaming','coffee','study','music','sparkles') then raise exception 'Choose a valid Squad icon.'; end if;
 perform private.limit_action('all',300);
 update public.squads set icon_key=icon where id=sid;
 result:=jsonb_build_object('id',sid,'icon_key',icon,'event',action);
 insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
