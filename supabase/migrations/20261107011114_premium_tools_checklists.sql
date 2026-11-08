-- Additive Premium tools. Existing action chains retain their resource checks.
create function private.premium_rank(tier text) returns integer language sql immutable set search_path='' as $$select case tier when 'pro' then 2 when 'plus' then 1 else 0 end$$;
create function private.squad_premium_tier(sid uuid) returns text language sql stable security definer set search_path='' as $$select 'free'::text$$;
create function private.beacon_premium_tier(aid uuid) returns text language sql stable security definer set search_path='' as $$
 select case when private.premium_rank(private.premium_tier(a.owner_id))>=private.premium_rank(case when a.audience='squad' and exists(select 1 from public.squad_members m where m.squad_id=a.audience_id and m.user_id=a.owner_id) and not exists(select 1 from private.beacon_discovery d where d.activity_id=a.id) then private.squad_premium_tier(a.audience_id) else 'free' end)
 then private.premium_tier(a.owner_id) else private.squad_premium_tier(a.audience_id) end from public.activities a where a.id=aid
$$;
create function private.feature_required_tier(feature text) returns text language sql immutable set search_path='' as $$
 select case when feature in ('preparation','focus_groups','journal_reflections','afterglow','team_rotation','council_readiness','layouts') then 'pro'
 when feature in ('checklist_details','checklist_presets','library_organization','focus_sequences','journal_formatting','journal_templates','memory_collections','team_presets','council_presets','appearance') then 'plus' else null end
$$;
create function private.require_premium_feature(feature text,aid uuid default null) returns void language plpgsql stable security definer set search_path='' as $$
declare tier text; required text:=private.feature_required_tier(feature); begin
 if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
 tier:=case when aid is null then private.premium_tier(auth.uid()) else private.beacon_premium_tier(aid) end;
 if required is null or private.premium_rank(tier)<private.premium_rank(required) then raise exception 'PREMIUM_REQUIRED: % requires BEACON+%. Existing content stays available.',replace(feature,'_',' '),case when required='pro' then ' Pro' else '' end; end if;
end $$;
revoke all on function private.premium_rank(text),private.squad_premium_tier(uuid),private.beacon_premium_tier(uuid),private.feature_required_tier(text),private.require_premium_feature(text,uuid) from public,anon,authenticated;

-- Replace only the reviewed legacy limit clauses; keep canonical validation/authorization.
do $migration$ declare definition text; begin
 select pg_get_functiondef('private.apply_module_collection_action(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'jsonb_array_length(json_sections)>30 or jsonb_array_length(json_items)>50','false');
 definition:=replace(definition,'if section_count>=30 then raise exception ''A checklist can have up to 30 sections.''; end if;','');
 definition:=replace(definition,'if item_count>=50 then raise exception ''This Beacon already has 50 checklist items.''; end if;','');
 definition:=replace(definition,'section_position not between 0 and 29','section_position<0');
 definition:=replace(definition,'if assigned is not null and not private.beacon_approved_going(aid,assigned)','if assigned is not null and (action<>''edit_checklist_item'' or assigned is distinct from item.assignee_id) and not private.beacon_approved_going(aid,assigned)');
 execute definition;
 select pg_get_functiondef('private.copy_saved_checklist_to_beacon(uuid,uuid,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'if jsonb_array_length(saved.items)>50 or jsonb_array_length(saved.sections)>30 then raise exception ''This saved List exceeds Beacon limits.''; end if;','');
 definition:=replace(definition,'greatest(0,least(29,coalesce((section_obj->>''position'')::integer,0)))','greatest(0,coalesce((section_obj->>''position'')::integer,0))');
 definition:=replace(definition,'assignee:=nullif(item_obj->>''assignee_id'','''')::uuid;','assignee:=null; -- Presets do not transfer people assignments.');
 execute definition;
 select pg_get_functiondef('private.apply_beacon_module_action(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'if v_count>=50 then raise exception ''This beacon already has 50 checklist items.''; end if;','');
 execute definition;
end $migration$;
alter table public.beacon_checklist_sections drop constraint beacon_checklist_sections_position_check;
alter table public.beacon_checklist_sections add constraint beacon_checklist_sections_position_check check(position>=0);

alter table public.beacon_checklist_items add column due_on date,add column due_at timestamptz,add column due_timezone text,
 add column reminder_minutes integer check(reminder_minutes between 0 and 10080),add column timing_revision integer not null default 0;
create function private.checklist_premium_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare prior_sub text:=current_setting('request.jwt.claim.sub',true); begin
 if (tg_op='INSERT' and new.assignee_id is not null) or (tg_op='UPDATE' and new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id) then
  perform private.require_premium_feature('checklist_details',new.activity_id);
  if private.blocked(new.assignee_id) then raise exception 'Assign items to a current Beacon participant.'; end if;
  perform set_config('request.jwt.claim.sub',new.assignee_id::text,true);
  if not private.can_chat(new.activity_id) then raise exception 'Assign items to a current Beacon participant.'; end if;
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 end if;
 if (tg_op='INSERT' and (new.due_on is not null or new.due_at is not null or new.reminder_minutes is not null)) or (tg_op='UPDATE' and ((new.due_on is not null and new.due_on is distinct from old.due_on) or (new.due_at is not null and new.due_at is distinct from old.due_at) or (new.reminder_minutes is not null and new.reminder_minutes is distinct from old.reminder_minutes) or ((new.due_on is not null or new.due_at is not null) and new.due_timezone is distinct from old.due_timezone))) then perform private.require_premium_feature('checklist_details',new.activity_id); end if;
 if new.due_on is not null and new.due_at is not null then raise exception 'Choose a due date or a due time.'; end if;
 if new.reminder_minutes is not null and new.due_on is null and new.due_at is null then raise exception 'Choose a deadline before a reminder.'; end if;
 if new.due_on is not null or new.due_at is not null then
  new.due_timezone:=coalesce(new.due_timezone,(select timezone from public.activities where id=new.activity_id));
  if not exists(select 1 from pg_timezone_names where name=new.due_timezone) then raise exception 'Choose a valid timezone.'; end if;
 end if;
 if tg_op='UPDATE' and (new.due_on,new.due_at,new.reminder_minutes,new.assignee_id) is distinct from (old.due_on,old.due_at,old.reminder_minutes,old.assignee_id) then new.timing_revision:=old.timing_revision+1; end if;
 return new;
end $$;
revoke all on function private.checklist_premium_guard() from public,anon,authenticated;
create trigger checklist_premium_guard before insert or update on public.beacon_checklist_items for each row execute function private.checklist_premium_guard();

create table public.beacon_supply_requests(id uuid primary key,activity_id uuid not null references public.activities on delete cascade,label text not null check(length(btrim(label)) between 1 and 120),kind text not null check(kind in ('group','personal')),quantity integer not null check(quantity between 1 and 999),created_at timestamptz not null default now());
create index beacon_supply_activity on public.beacon_supply_requests(activity_id,created_at,id);
create table public.beacon_supply_claims(request_id uuid references public.beacon_supply_requests on delete cascade,activity_id uuid not null references public.activities on delete cascade,user_id uuid references public.profiles on delete cascade,quantity integer not null check(quantity between 1 and 999),primary key(request_id,user_id));
alter table public.beacon_supply_requests enable row level security;
alter table public.beacon_supply_claims enable row level security;
revoke all on public.beacon_supply_requests,public.beacon_supply_claims from public,anon,authenticated;
grant select on public.beacon_supply_requests,public.beacon_supply_claims to authenticated;
create function private.supply_eligible(aid uuid,uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.activities a where a.id=aid and (a.owner_id=uid or private.beacon_approved_going(aid,uid)) and not exists(select 1 from public.blocks b where (b.blocker_id=a.owner_id and b.blocked_id=uid) or (b.blocked_id=a.owner_id and b.blocker_id=uid)))
$$;
revoke all on function private.supply_eligible(uuid,uuid) from public,anon;
grant execute on function private.supply_eligible(uuid,uuid) to authenticated;
create policy read_supplies on public.beacon_supply_requests for select to authenticated using(private.can_chat(activity_id));
create policy read_supply_claims on public.beacon_supply_claims for select to authenticated using(private.can_chat(activity_id) and private.supply_eligible(activity_id,user_id) and not private.blocked(user_id));
create function private.apply_supply_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.beacon_supply_requests; a public.activities; rid uuid; amount integer; claimed integer; begin
 if action not in ('save_supply_request','delete_supply_request','claim_supply') then return null; end if;
 perform private.limit_action('all',300);
 rid:=nullif(coalesce(payload->>'request_id',payload->>'id'),'')::uuid;
 select * into r from public.beacon_supply_requests where id=rid for update;
 select * into a from public.activities where id=coalesce(r.activity_id,nullif(payload->>'activity_id','')::uuid);
 if a.id is null or a.status<>'scheduled' or not private.can_chat(a.id) then raise exception 'Beacon unavailable.'; end if;
 if action='claim_supply' then
  if r.id is null or r.kind<>'group' or not private.supply_eligible(a.id,uid) then raise exception 'Join this Beacon before claiming supplies.'; end if;
  amount:=(payload->>'quantity')::int;
  select coalesce(sum(quantity),0) into claimed from public.beacon_supply_claims c where c.request_id=r.id and c.user_id<>uid and private.supply_eligible(a.id,c.user_id);
  if amount is null or amount<0 or amount>999 or claimed+amount>r.quantity then raise exception 'Choose the remaining supply quantity.'; end if;
  delete from public.beacon_supply_claims where request_id=r.id and user_id=uid;
  if amount>0 then insert into public.beacon_supply_claims values(r.id,a.id,uid,amount); end if;
 else
  if not private.can_manage_beacon(a.id) then raise exception 'Only Beacon organizers can manage supplies.'; end if;
  if action='delete_supply_request' then delete from public.beacon_supply_requests where id=r.id;
  else
   select coalesce(sum(quantity),0) into claimed from public.beacon_supply_claims c where c.request_id=r.id and private.supply_eligible(a.id,c.user_id);
   amount:=(payload->>'quantity')::int;
   if claimed>0 and (amount<claimed or payload->>'kind'<>r.kind) then raise exception 'Release existing commitments before reducing this request.'; end if;
   if r.id is null then insert into public.beacon_supply_requests(id,activity_id,label,kind,quantity) values(rid,a.id,btrim(payload->>'label'),payload->>'kind',amount);
   else update public.beacon_supply_requests set label=btrim(payload->>'label'),kind=payload->>'kind',quantity=amount where id=r.id; end if;
  end if;
 end if;
 return jsonb_build_object('id',rid,'activity_id',a.id);
end $$;
revoke all on function private.apply_supply_action(text,jsonb) from public,anon,authenticated;

alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_premium_tools;
revoke all on function public.beacon_action_before_premium_tools(text,jsonb,uuid) from public,anon,authenticated;
create function private.premium_tools_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; uid uuid:=auth.uid(); aid uuid; item public.beacon_checklist_items; begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select q.result into result from private.requests q where q.user_id=uid and q.request_id=premium_tools_action.request_id;
 if found then return result; end if;
 result:=private.apply_supply_action(action,payload);
 if result is not null then insert into private.requests(user_id,request_id,result) values(uid,premium_tools_action.request_id,result); return result; end if;
 if action='ensure_saved_checklist_copy' and not exists(select 1 from public.library_saved_checklists where owner_id=uid and source_activity_id=(payload->>'activity_id')::uuid) then perform private.require_premium_feature('checklist_presets'); end if;
 if action='save_library_checklist' and not exists(select 1 from public.library_saved_checklists where owner_id=uid and id=nullif(payload->>'id','')::uuid) then perform private.require_premium_feature('checklist_presets'); end if;
 if (action='create_library_folder' or action='move_library_resource' and nullif(payload->>'folder_id','') is not null) then perform private.require_premium_feature('library_organization'); end if;
 result:=public.beacon_action_before_premium_tools(action,payload,request_id);
 if action in ('add_checklist_item','edit_checklist_item') and payload ?| array['due_on','due_at','due_timezone','reminder_minutes'] then
  select * into item from public.beacon_checklist_items where id=(result->>'id')::uuid for update;
  if not found or not private.can_edit_beacon_checklist(item.activity_id) then raise exception 'Checklist item unavailable.'; end if;
  update public.beacon_checklist_items set due_on=case when payload ? 'due_on' then nullif(payload->>'due_on','')::date else due_on end,
   due_at=case when payload ? 'due_at' then nullif(payload->>'due_at','')::timestamptz else due_at end,
   due_timezone=case when payload ? 'due_timezone' then nullif(payload->>'due_timezone','') else due_timezone end,
   reminder_minutes=case when payload ? 'reminder_minutes' then nullif(payload->>'reminder_minutes','')::integer else reminder_minutes end where id=item.id;

 end if;
 return result;
end $$;
revoke all on function private.premium_tools_action(text,jsonb,uuid) from public,anon;
grant execute on function private.premium_tools_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select private.premium_tools_action(action,payload,request_id)$$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create table private.checklist_reminders(id uuid primary key default gen_random_uuid(),item_id uuid references public.beacon_checklist_items on delete set null,revision integer not null, sent_at timestamptz not null default now(),notice_id uuid references public.notices on delete cascade,unique(item_id,revision));
create index checklist_reminder_notice on private.checklist_reminders(notice_id);
alter table private.checklist_reminders enable row level security;
revoke all on private.checklist_reminders from public,anon,authenticated;
create function private.send_checklist_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare row record; recipient uuid; notice uuid; prior_sub text:=current_setting('request.jwt.claim.sub',true); sent integer:=0; begin
 for row in select i.*,coalesce(i.due_at,((i.due_on+1)::timestamp at time zone i.due_timezone)) deadline from public.beacon_checklist_items i join public.activities a on a.id=i.activity_id
  where not i.completed and a.status='scheduled' and i.reminder_minutes is not null
   and coalesce(i.due_at,((i.due_on+1)::timestamp at time zone i.due_timezone))>now()-interval '15 minutes'
   and coalesce(i.due_at,((i.due_on+1)::timestamp at time zone i.due_timezone))-make_interval(mins=>i.reminder_minutes)<=now()
   and not exists(select 1 from private.checklist_reminders r where r.item_id=i.id and r.revision=i.timing_revision) for update of i skip locked loop
  recipient:=coalesce(row.assignee_id,row.author_id);
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  if private.can_chat(row.activity_id) and not private.blocked(row.author_id) then
   insert into private.checklist_reminders(item_id,revision) values(row.id,row.timing_revision) on conflict do nothing;
   if found then
    insert into public.notices(recipient_id,actor_id,body,activity_id) values(recipient,null,'Task due: '||row.text,row.activity_id) returning id into notice;
    update private.checklist_reminders set notice_id=notice where item_id=row.id and revision=row.timing_revision;
    insert into private.push_queue(notice_id,token) select notice,token from public.push_tokens where user_id=recipient;
    sent:=sent+1;
   end if;
  end if;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true); return sent;
end $$;
revoke all on function private.send_checklist_reminders() from public,anon,authenticated;
-- Recheck an unsent task reminder at the normal push claim boundary (including quiet-hour retries).
create function private.checklist_push_valid(nid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.checklist_reminders where notice_id=nid) or exists(select 1 from private.checklist_reminders r join public.beacon_checklist_items i on i.id=r.item_id join public.activities a on a.id=i.activity_id where r.notice_id=nid and i.timing_revision=r.revision and not i.completed and a.status='scheduled' and a.enable_checklist and coalesce(i.assignee_id,i.author_id)=auth.uid() and private.can_chat(a.id) and not private.blocked(i.author_id))
$$;
revoke all on function private.checklist_push_valid(uuid) from public,anon,authenticated;
do $migration$ declare definition text; begin
 select pg_get_functiondef('public.beacon_claim_push()'::regprocedure) into definition;
 definition:=replace(definition,'valid:=p.id is not null','valid:=private.checklist_push_valid(n.id) and p.id is not null');
 execute definition;
end $migration$;
alter function public.run_due_plan_routines(integer) rename to run_due_plan_routines_before_task_reminders;
revoke all on function public.run_due_plan_routines_before_task_reminders(integer) from public,anon,authenticated;
create function public.run_due_plan_routines(horizon_days integer default 30) returns integer language plpgsql security definer set search_path='' as $$declare made integer; begin
 if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'Trusted runner required.'; end if;
 made:=public.run_due_plan_routines_before_task_reminders(horizon_days); perform private.send_checklist_reminders(); return made;
end $$;
revoke all on function public.run_due_plan_routines(integer) from public,anon,authenticated;
grant execute on function public.run_due_plan_routines(integer) to service_role;

create function private.premium_tools_projection() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('beacon_supply_requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('claimed_quantity',(select coalesce(sum(c.quantity),0) from public.beacon_supply_claims c where c.request_id=r.id and private.supply_eligible(r.activity_id,c.user_id)))) from public.beacon_supply_requests r where private.can_chat(r.activity_id)),'[]'::jsonb),'beacon_supply_claims',coalesce((select jsonb_agg(to_jsonb(c)) from public.beacon_supply_claims c where private.can_chat(c.activity_id) and private.supply_eligible(c.activity_id,c.user_id) and not private.blocked(c.user_id)),'[]'::jsonb),'beacon_premium',coalesce((select jsonb_object_agg(a.id::text,jsonb_build_object('tier',private.beacon_premium_tier(a.id),'source',case when private.beacon_premium_tier(a.id)='free' then 'free' else 'verified' end,'grace_until',null)) from public.activities a where private.can_chat(a.id)),'{}'::jsonb))
$$;
revoke all on function private.premium_tools_projection() from public,anon;
grant execute on function private.premium_tools_projection() to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_premium_tools;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$declare result jsonb; begin
 result:=public.beacon_snapshot_before_premium_tools();
 return result||private.premium_tools_projection()||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}')||'{"premium_tools":true,"beacon_supplies":true}'::jsonb);
end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

-- Bound the canonical snapshot without limiting the persisted checklist itself.
do $migration$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'beacon_snapshot%' and p.prosrc like '%foreach t in array%' loop
  select pg_get_functiondef(f.oid) into definition;
  definition:=replace(definition,E'  else execute format(',E'  elsif t in (''beacon_checklist_items'',''beacon_checklist_sections'') then\n   execute format(''select coalesce(jsonb_agg(to_jsonb(x)-''''page_row''''),''''[]''''::jsonb) from (select *,row_number() over(partition by activity_id order by created_at,id) page_row from public.%I) x where page_row<=200'',t) into rows;\n  else execute format(');
  execute definition;
 end loop;
end $migration$;
create function public.checklist_page(activity_id uuid,kind text default 'items',cursor_id uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare rows jsonb; more boolean; total integer; completed integer:=0; cursor_time timestamptz; begin
 if auth.uid() is null or not private.can_chat(activity_id) then raise exception 'Checklist unavailable.'; end if;
 if kind='items' then
  if cursor_id is not null then select created_at into cursor_time from public.beacon_checklist_items i where i.id=cursor_id and i.activity_id=checklist_page.activity_id; if not found then raise exception 'This checklist changed. Refresh it.'; end if; end if;
  select count(*),count(*) filter(where i.completed) into total,completed from public.beacon_checklist_items i where i.activity_id=checklist_page.activity_id;
  select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into rows from (select * from public.beacon_checklist_items i where i.activity_id=checklist_page.activity_id and (cursor_id is null or (i.created_at,i.id)>(cursor_time,cursor_id)) order by i.created_at,i.id limit 101) i;
 elsif kind='sections' then
  if cursor_id is not null then select created_at into cursor_time from public.beacon_checklist_sections i where i.id=cursor_id and i.activity_id=checklist_page.activity_id; if not found then raise exception 'This checklist changed. Refresh it.'; end if; end if;
  select count(*) into total from public.beacon_checklist_sections i where i.activity_id=checklist_page.activity_id;
  select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into rows from (select * from public.beacon_checklist_sections i where i.activity_id=checklist_page.activity_id and (cursor_id is null or (i.created_at,i.id)>(cursor_time,cursor_id)) order by i.created_at,i.id limit 101) i;
 else raise exception 'Choose checklist items or sections.'; end if;
 more:=jsonb_array_length(rows)>100;
 return jsonb_build_object('viewer_id',auth.uid(),'rows',(select coalesce(jsonb_agg(v),'[]'::jsonb) from (select v from jsonb_array_elements(rows) with ordinality a(v,n) where n<=100) page),'has_more',more,'total',total,'completed',completed);
end $$;
revoke all on function public.checklist_page(uuid,text,uuid) from public,anon;
grant execute on function public.checklist_page(uuid,text,uuid) to authenticated;

create function private.normalize_supply_label() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.activity_id::text,7));
 new.label:=btrim(regexp_replace(new.label,'\s+',' ','g'));
 if exists(select 1 from public.beacon_supply_requests r where r.activity_id=new.activity_id and r.kind=new.kind and r.id<>new.id and lower(btrim(regexp_replace(r.label,'\s+',' ','g')))=lower(new.label)) then raise exception 'This supply is already listed. Update its contribution instead.'; end if;
 return new;
end $$;
revoke all on function private.normalize_supply_label() from public,anon,authenticated;
create trigger normalize_supply_label before insert or update of label,kind on public.beacon_supply_requests for each row execute function private.normalize_supply_label();
