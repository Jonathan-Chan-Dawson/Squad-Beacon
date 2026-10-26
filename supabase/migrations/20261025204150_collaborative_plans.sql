-- Decisions keep their own permission, response and publication authority.
alter table public.group_messages add column plan_id uuid references public.plans on delete set null;
create index group_messages_plan on public.group_messages(plan_id) where plan_id is not null;

create function private.sync_plan_decision_result() returns trigger language plpgsql security definer set search_path='' as $$
declare row_stop public.plan_stops; begin
 if new.materialized_activity_id is null then return new; end if;
 for row_stop in select * from public.plan_stops where thread_id is not null and private.planning_root(thread_id)=private.planning_root(new.id) loop
  if private.plan_reference_allowed(row_stop.plan_id,new.materialized_activity_id,row_stop.thread_id)
   and not exists(select 1 from public.plan_stops where plan_id=row_stop.plan_id and activity_id=new.materialized_activity_id and id<>row_stop.id) then
   update public.plan_stops set activity_id=new.materialized_activity_id where id=row_stop.id;
   update public.plans set revision=revision+1 where id=row_stop.plan_id;
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.sync_plan_decision_result() from public,anon,authenticated;
create trigger plan_decision_result after update of materialized_activity_id on public.planning_threads for each row when (new.materialized_activity_id is distinct from old.materialized_activity_id) execute function private.sync_plan_decision_result();

create function private.attach_existing_plan_result() returns trigger language plpgsql security definer set search_path='' as $$
declare aid uuid; begin
 select materialized_activity_id into aid from public.planning_threads where id=new.thread_id;
 if aid is not null and private.plan_reference_allowed(new.plan_id,aid,new.thread_id) and not exists(select 1 from public.plan_stops where plan_id=new.plan_id and activity_id=aid and id<>new.id) then
  update public.plan_stops set activity_id=aid where id=new.id;
 end if; return new;
end $$;
revoke all on function private.attach_existing_plan_result() from public,anon,authenticated;
create trigger existing_plan_result after insert or update of thread_id on public.plan_stops for each row when(new.thread_id is not null) execute function private.attach_existing_plan_result();

create function private.plan_suggestion_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.plans; begin
 select * into p from public.plans where id=new.plan_id;
 if tg_op='INSERT' then
  if new.approval='pending' and private.can_read_living_plan(p.id) then perform private.notify(p.owner_id,new.author_id,'A Plan suggestion is ready for your review.'); end if;
 elsif old.approval='pending' and new.approval in ('approved','dismissed') then
  if new.author_id<>auth.uid() and not private.blocked(new.author_id) and exists(select 1 from public.squad_members where squad_id=p.squad_id and user_id=new.author_id) then
   perform private.notify(new.author_id,auth.uid(),case when new.approval='approved' then 'Your Plan suggestion was approved.' else 'An organizer reviewed your Plan suggestion.' end);
  end if;
 end if;
 return new;
end $$;
revoke all on function private.plan_suggestion_notice() from public,anon,authenticated;
create trigger plan_suggestion_notice after insert or update of approval on public.plan_stops for each row execute function private.plan_suggestion_notice();

-- Permit independent following of tentative shared Plans, without touching RSVP.
do $$ declare def text; begin
 select pg_get_functiondef('private.apply_plan_membership_action(text,jsonb)'::regprocedure) into def;
 execute replace(def,'plan_row.status<>''scheduled''','plan_row.status=''cancelled''');
end $$;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_collaborative_plans;
create function private.collaborative_plan_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; pid uuid:=nullif(payload->>'return_plan_id','')::uuid; tid uuid; aid uuid; uid uuid:=auth.uid(); begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 if action='create_planning_thread' and pid is not null then
  perform 1 from public.plans where id=pid for update;
  if not private.can_edit_living_plan(pid) then raise exception 'Only Plan organizers can add decisions.'; end if;
  result:=public.beacon_action_before_collaborative_plans(action,payload,request_id); tid:=(result->>'id')::uuid;
  if not exists(select 1 from public.plan_stops where plan_id=pid and thread_id=tid) then
   perform private.apply_living_plan_action(case when nullif(payload->>'plan_stop_id','') is null then 'add_plan_stop' else 'link_plan_stop' end,
    jsonb_build_object('plan_id',pid,'stop_id',payload->>'plan_stop_id','thread_id',tid,'after_stop_id',payload->>'plan_after_stop_id'));
  end if;
  return result;
 elsif action='send_group_message' and nullif(payload->>'plan_id','') is not null then
  pid:=(payload->>'plan_id')::uuid;
  if not private.can_read_living_plan(pid) or payload->>'scope'<>'squad' or not exists(select 1 from public.plans where id=pid and squad_id=nullif(payload->>'squad_id','')::uuid) then raise exception 'This Plan is not shared with this chat.'; end if;
  result:=public.beacon_action_before_collaborative_plans(action,payload,request_id);
  update public.group_messages set plan_id=pid where id=(result->>'id')::uuid and author_id=uid;
  return result;
 end if;
 return public.beacon_action_before_collaborative_plans(action,payload,request_id);
end $$;
revoke all on function public.beacon_action_before_collaborative_plans(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.collaborative_plan_action(text,jsonb,uuid) from public,anon;
grant execute on function private.collaborative_plan_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$ select private.collaborative_plan_action(action,payload,request_id); $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_collaborative_plans;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$ declare result jsonb; begin
 result:=public.beacon_snapshot_before_collaborative_plans();
 return result||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}'::jsonb)||'{"collaborative_plans":true}'::jsonb);
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
