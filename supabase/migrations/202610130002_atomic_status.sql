-- Atomic own-status mutations reuse validated writers and preserve cancelled history.
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_atomic_status_legacy;
revoke all on function public.beacon_action_atomic_status_legacy(text,jsonb,uuid) from public,anon,authenticated;
do $$ declare definition text; begin
 select pg_get_functiondef('public.beacon_action_atomic_status_legacy(text,jsonb,uuid)'::regprocedure) into definition;
 execute replace(definition,'beacon_action.request_id','beacon_action_atomic_status_legacy.request_id');
end $$;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); source public.activities; source_place public.places; row_id uuid; source_id uuid;
 prior jsonb; result jsonb; value jsonb; starts timestamptz; ending timestamptz; cleared integer:=0;
begin
 if action not in ('save_status_note','clear_status_notes') then
  return public.beacon_action_atomic_status_legacy(action,payload,beacon_action.request_id);
 end if;
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into prior from private.requests r where r.user_id=uid and r.request_id=beacon_action.request_id;
 if found then return prior; end if;
 -- Owner lock precedes every row lock; do not trust client status lists.
 perform 1 from public.activities a where a.owner_id=uid and a.mode='solo'
  and a.status='scheduled' and a.starts_at<=now() and a.ends_at>now() order by a.id for update;
 if action='save_status_note' then
  source_id:=nullif(payload->>'source_id','')::uuid;
  if source_id is not null then
   select * into source from public.activities where id=source_id and owner_id=uid and mode='solo' for update;
   if not found or source.owner_id<>uid or source.mode<>'solo' then raise exception 'Choose your own status note.'; end if;
  else
   select * into source from public.activities a where a.owner_id=uid and a.mode='solo'
    and a.status='scheduled' and a.starts_at<=now() and a.ends_at>now() order by a.starts_at desc,a.id limit 1;
  end if;
  select * into source_place from public.places where activity_id=source.id;
  starts:=coalesce(nullif(payload->>'starts_at','')::timestamptz,now());
  ending:=coalesce(nullif(payload->>'ends_at','')::timestamptz,case when starts<=now() and source.status='scheduled' and source.ends_at>now() then source.ends_at else starts+interval '1 hour' end);
  if ending<=now() or ending<=starts then raise exception 'Choose an end time in the future.'; end if;
  value:=jsonb_build_object('title',coalesce(source.title,'Free to hang'),'description',coalesce(source.description,''),
   'category',coalesce(source.category,'Social'),'available',coalesce(source.available,true),
   'timezone',coalesce(source.timezone,(select timezone from public.profiles where id=uid),'UTC'),
   'audience',coalesce(source.audience::text,'friends'),'audience_id',source.audience_id,
   'enable_reactions',coalesce(source.enable_reactions,true),'aspiration_ids',coalesce(to_jsonb(source.aspiration_ids),'[]'::jsonb),
   'label',coalesce(source_place.label,''),'latitude',source_place.latitude,'longitude',source_place.longitude,'online_url',source_place.online_url)
   ||payload||jsonb_build_object('mode','solo','starts_at',starts,'ends_at',ending,'target_count',null,'approval_required',false);
  -- Distinct child IDs keep the parent idempotency result reserved for the entire transaction.
  if source.id is not null and source.status='scheduled' and source.starts_at<=now() and source.ends_at>now() and starts<=now()
   and (value->>'available')::boolean is not distinct from source.available
   and value->>'description'=coalesce(source.description,'') and value->>'category'=source.category
   and value->>'timezone'=source.timezone and value->>'audience'=source.audience::text
   and nullif(value->>'audience_id','')::uuid is not distinct from source.audience_id
   and (value->>'enable_reactions')::boolean is not distinct from source.enable_reactions
   and value->'aspiration_ids'=to_jsonb(source.aspiration_ids)
   and value->>'label'=coalesce(source_place.label,'')
   and nullif(value->>'latitude','')::double precision is not distinct from source_place.latitude
   and nullif(value->>'longitude','')::double precision is not distinct from source_place.longitude
   and nullif(value->>'online_url','') is not distinct from source_place.online_url then
   perform public.beacon_action_atomic_status_legacy('edit_activity',jsonb_build_object('id',source.id,'title',value->>'title','starts_at',source.starts_at,'ends_at',ending),gen_random_uuid());
   row_id:=source.id;
  else
   result:=public.beacon_action_atomic_status_legacy('create_activity',value,gen_random_uuid());
   row_id:=nullif(result->>'id','')::uuid;
  end if;
  if row_id is null then raise exception 'Status could not be verified.'; end if;
  result:=jsonb_build_object('id',row_id,'event',action);
 end if;
 -- Scheduled future notes coexist with current availability; Clear affects only current live notes.
 if action='clear_status_notes' or starts<=now() then
  for source_id in select a.id from public.activities a where a.owner_id=uid and a.mode='solo'
   and a.status='scheduled' and a.starts_at<=now() and a.ends_at>now() and a.id is distinct from row_id order by a.id loop
   perform public.beacon_action_atomic_status_legacy('activity_status',jsonb_build_object('id',source_id,'status','cancelled'),gen_random_uuid());
   cleared:=cleared+1;
  end loop;
 end if;
 result:=coalesce(result,jsonb_build_object('event',action))||jsonb_build_object('cleared_count',cleared);
 insert into private.requests(user_id,request_id,result) values(uid,beacon_action.request_id,result);
 return result;
end $$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;
