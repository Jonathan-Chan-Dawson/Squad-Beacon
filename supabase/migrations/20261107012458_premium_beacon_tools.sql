-- Advanced configuration extends canonical modules; participants and content stay canonical.
create table private.premium_tool_configs(id uuid primary key default gen_random_uuid(),activity_id uuid references public.activities on delete cascade,thread_id uuid references public.planning_threads on delete cascade,kind text not null check(kind in ('focus','appearance','teams','memories','council')),settings jsonb not null,revision integer not null default 0,check((activity_id is null)<>(thread_id is null)),check((kind='council')=(thread_id is not null)));
create unique index tool_config_beacon_kind on private.premium_tool_configs(activity_id,kind) where activity_id is not null;
create unique index tool_config_thread on private.premium_tool_configs(thread_id) where thread_id is not null;
create table private.premium_presets(id uuid primary key,owner_id uuid not null references public.profiles on delete cascade,kind text not null,title text not null check(length(btrim(title)) between 1 and 100),settings jsonb not null);
create table private.council_option_groups(proposal_id uuid primary key references public.planning_proposals on delete cascade,group_label text not null check(length(group_label) between 1 and 60));
create table private.council_explanations(thread_id uuid references public.planning_threads on delete cascade,user_id uuid references public.profiles on delete cascade,body text not null check(length(body) between 1 and 500),primary key(thread_id,user_id));
alter table private.council_option_groups enable row level security;
alter table private.council_explanations enable row level security;
revoke all on private.council_option_groups,private.council_explanations from public,anon,authenticated;
create index premium_presets_owner on private.premium_presets(owner_id,kind);
create table private.journal_details(note_id uuid primary key references public.beacon_notes on delete cascade,format text not null check(format in ('plain','markdown')),tags jsonb not null default '[]',linked_note_ids uuid[] not null default '{}');
create table private.memory_recaps(id uuid primary key,activity_id uuid not null references public.activities on delete cascade,title text not null check(length(btrim(title)) between 1 and 100),introduction text not null default '' check(length(introduction)<=1000),memory_ids uuid[] not null default '{}',revision integer not null default 0,check(cardinality(memory_ids)<=50));
alter table private.premium_tool_configs enable row level security;
alter table private.premium_presets enable row level security;
alter table private.journal_details enable row level security;
alter table private.memory_recaps enable row level security;
revoke all on private.premium_tool_configs,private.premium_presets,private.journal_details,private.memory_recaps from public,anon,authenticated;
create function private.valid_text_array(v jsonb,cap integer,len integer) returns boolean language sql immutable set search_path='' as $$select jsonb_typeof(v)='array' and jsonb_array_length(v)<=cap and not exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e)<>'string' or length(btrim(e#>>'{}')) not between 1 and len) and (select count(*) from jsonb_array_elements(v))=(select count(distinct e) from jsonb_array_elements(v) e)$$;
create function private.validate_tool_config(kind text,s jsonb) returns void language plpgsql immutable set search_path='' as $$
declare keys text[]; row jsonb; k text; begin
 if jsonb_typeof(s) is distinct from 'object' or octet_length(s::text)>12000 then raise exception 'Choose a compact tool configuration.'; end if;
 keys:=case kind when 'journal' then array['body','heading','format','tags'] when 'focus' then array['steps','group','summary'] when 'appearance' then array['style','layout','module_order'] when 'teams' then array['team_names','score_steps','rotation'] when 'memories' then array['title','memory_ids','highlights'] when 'council' then array['groups','explanations','readiness'] end;
 if keys is null or exists(select 1 from jsonb_object_keys(s) f(key) where not f.key=any(keys)) then raise exception 'Unsupported tool configuration.'; end if;
 if kind='journal' then
  if length(btrim(s->>'body')) not between 1 and 1000 or not s ? 'body' or length(coalesce(s->>'heading',''))>100 or coalesce(s->>'format','plain') not in ('plain','markdown') or not private.valid_text_array(coalesce(s->'tags','[]'),12,36) then raise exception 'Choose a valid Journal template.'; end if;
 elsif kind='focus' then
  if jsonb_typeof(s->'steps') is distinct from 'array' or jsonb_array_length(s->'steps') not between 1 and 12 then raise exception 'Use one to twelve named intervals.'; end if;
  for row in select value from jsonb_array_elements(s->'steps') loop
   if jsonb_typeof(row) is distinct from 'object' or length(btrim(row->>'label')) not between 1 and 36 or (row->>'minutes')::numeric not between 1 and 1440 or (row->>'minutes')::numeric<>trunc((row->>'minutes')::numeric) or not row ?& array['label','minutes'] or exists(select 1 from jsonb_object_keys(row) f(key) where f.key not in ('label','minutes')) then raise exception 'Choose valid named focus intervals.'; end if;
  end loop;
  if s ? 'group' and (jsonb_typeof(s->'group')<>'string' or length(s->>'group')>60) then raise exception 'Use a shorter group name.'; end if;
 elsif kind='appearance' then
  if coalesce(s->>'style','standard') not in ('standard','sunrise','ocean') or coalesce(s->>'layout','standard') not in ('standard','preparation','session') then raise exception 'Choose a supported appearance.'; end if;
  if s ? 'module_order' and (not private.valid_text_array(s->'module_order',7,20) or exists(select 1 from jsonb_array_elements_text(s->'module_order') f(module_key) where f.module_key not in ('checklist','journal','focus','scoreboard','experiences','music','chat'))) then raise exception 'Choose enabled module names.'; end if;
 elsif kind='teams' then
  if not private.valid_text_array(coalesce(s->'team_names','[]'),8,36) or jsonb_typeof(s->'score_steps') is distinct from 'array' or jsonb_array_length(s->'score_steps') not between 1 and 6 then raise exception 'Choose team names and scoring increments.'; end if;
  for row in select value from jsonb_array_elements(s->'score_steps') loop
   if jsonb_typeof(row) is distinct from 'object' or length(btrim(row->>'label')) not between 1 and 36 or (row->>'points')::numeric not between 1 and 1000 or (row->>'points')::numeric<>trunc((row->>'points')::numeric) or not row ?& array['label','points'] or exists(select 1 from jsonb_object_keys(row) f(key) where f.key not in ('label','points')) then raise exception 'Choose valid scoring increments.'; end if;
  end loop;
 elsif kind='council' then
  if not private.valid_text_array(coalesce(s->'groups','[]'),12,60) then raise exception 'Choose distinct option groups.'; end if;
 elsif kind='memories' then
  if length(coalesce(s->>'title',''))>100 or not private.valid_text_array(coalesce(s->'memory_ids','[]'),50,64) or not private.valid_text_array(coalesce(s->'highlights','[]'),50,64) or exists(select 1 from jsonb_array_elements_text(coalesce(s->'highlights','[]')) id where not coalesce(s->'memory_ids','[]') ? id) then raise exception 'Choose existing memories and highlights.'; end if;
 end if;
 foreach k in array array['summary','rotation','explanations','readiness'] loop if s ? k and jsonb_typeof(s->k)<>'boolean' then raise exception 'Choose valid tool options.'; end if; end loop;
end $$;
create function private.tool_feature(kind text,s jsonb) returns text language sql immutable set search_path='' as $$select case kind when 'journal' then 'journal_templates' when 'focus' then case when nullif(s->>'group','') is not null or coalesce((s->>'summary')::boolean,false) then 'focus_groups' else 'focus_sequences' end when 'appearance' then case when coalesce(s->>'layout','standard')<>'standard' or jsonb_array_length(coalesce(s->'module_order','[]'))>0 then 'layouts' else 'appearance' end when 'teams' then case when coalesce((s->>'rotation')::boolean,false) then 'team_rotation' else 'team_presets' end when 'council' then case when coalesce((s->>'readiness')::boolean,false) then 'council_readiness' else 'council_presets' end when 'memories' then 'memory_collections' end$$;
create function private.thread_premium_tier(tid uuid) returns text language sql stable security definer set search_path='' as $$select case when t.audience='squad' and exists(select 1 from public.squad_members m where m.squad_id=t.audience_id and m.user_id=t.owner_id) and private.premium_rank(private.squad_premium_tier(t.audience_id))>private.premium_rank(private.premium_tier(t.owner_id)) then private.squad_premium_tier(t.audience_id) else private.premium_tier(t.owner_id) end from public.planning_threads t where t.id=tid$$;
create function private.note_details_allowed(nid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.beacon_notes n where n.id=nid and (n.author_id=auth.uid() or n.visibility='shared' and private.can_chat(n.activity_id) and not private.blocked(n.author_id)))$$;
create function private.premium_memory_allowed(mid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.beacon_memories m join public.activities a on a.id=m.activity_id where m.id=mid and a.enable_experiences and private.can_activity(a.id) and private.can_chat(a.id) and private.can_profile(m.author_id) and not private.blocked(m.author_id))$$;
revoke all on function private.valid_text_array(jsonb,integer,integer),private.validate_tool_config(text,jsonb),private.tool_feature(text,jsonb),private.thread_premium_tier(uuid),private.note_details_allowed(uuid),private.premium_memory_allowed(uuid) from public,anon,authenticated;

create function private.can_curate_memories(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.activities a where a.id=aid and a.status<>'cancelled' and private.can_chat(a.id) and (a.owner_id=auth.uid() or exists(select 1 from public.beacon_roles r where r.activity_id=a.id and r.user_id=auth.uid() and r.role in ('coowner','admin') and private.beacon_approved_going(a.id,auth.uid()))))
$$;
revoke all on function private.can_curate_memories(uuid) from public,anon,authenticated;

create function private.council_extra_action(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t public.planning_threads; c private.premium_tool_configs; proposal public.planning_proposals; begin
 if action not in ('set_council_option_group','save_council_explanation') then return null; end if;
 select * into t from public.planning_threads where id=(council_extra_action.payload->>'thread_id')::uuid for update;
 if not found or not private.can_read_planning_thread(t.id) then raise exception 'Council unavailable.'; end if;
 select * into c from private.premium_tool_configs where thread_id=t.id and kind='council';
 if action='save_council_explanation' then
  if not coalesce((c.settings->>'explanations')::boolean,false) or t.status<>'open' or t.deadline_at<=now() then raise exception 'This explanation cannot be changed.'; end if;
  if length(btrim(council_extra_action.payload->>'body'))>500 then raise exception 'Use a shorter explanation.'; end if;
  delete from private.council_explanations where thread_id=t.id and user_id=auth.uid();
  if nullif(btrim(council_extra_action.payload->>'body'),'') is not null then insert into private.council_explanations values(t.id,auth.uid(),btrim(council_extra_action.payload->>'body')); end if;
 else
  select * into proposal from public.planning_proposals where id=(council_extra_action.payload->>'proposal_id')::uuid and thread_id=t.id;
  if not found or not private.can_manage_planning_thread(t.id) or not private.can_read_planning_proposal(t.id,proposal.author_id) then raise exception 'Option unavailable.'; end if;
  if nullif(council_extra_action.payload->>'group_label','') is not null then
   if private.premium_rank(private.thread_premium_tier(t.id))<1 then raise exception 'PREMIUM_REQUIRED: Option groups require BEACON+.'; end if;
   if not coalesce(c.settings->'groups','[]') ? (council_extra_action.payload->>'group_label') then raise exception 'Choose a configured option group.'; end if;
  end if;
  delete from private.council_option_groups where proposal_id=proposal.id;
  if nullif(council_extra_action.payload->>'group_label','') is not null then insert into private.council_option_groups values(proposal.id,council_extra_action.payload->>'group_label'); end if;
 end if;
 return jsonb_build_object('id',t.id);
end $$;
revoke all on function private.council_extra_action(text,jsonb) from public,anon,authenticated;
create function private.prepare_rotated_teams(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare source_id uuid:=(payload->>'activity_id')::uuid; target_id uuid:=(payload->>'target_activity_id')::uuid; pid uuid:=(payload->>'plan_id')::uuid; c private.premium_tool_configs; src integer; dest integer; n integer; offset_by integer; i integer; begin
 if not private.can_read_living_plan(pid) or not private.can_manage_beacon(source_id) or not private.can_manage_beacon(target_id) then raise exception 'Both sessions must be available to their current organizer.'; end if;
 perform private.require_premium_feature('team_rotation',source_id);perform private.require_premium_feature('team_rotation',target_id);
 select min(position) into src from public.plan_stops where plan_id=pid and activity_id=source_id and state='active' and approval='approved';
 select min(position) into dest from public.plan_stops where plan_id=pid and activity_id=target_id and state='active' and approval='approved';
 if src is null or dest is null or dest<=src then raise exception 'Choose a later linked session in this Plan.'; end if;
 select * into c from private.premium_tool_configs where activity_id=source_id and kind='teams';
 if not found or not coalesce((c.settings->>'rotation')::boolean,false) or c.revision<>coalesce((payload->>'revision')::int,-1) then raise exception 'Review the current rotation preset.'; end if;
 perform 1 from public.activities where id=target_id for update;
 if exists(select 1 from public.beacon_teams where activity_id=target_id) then raise exception 'This session already has teams.'; end if;
 n:=jsonb_array_length(coalesce(c.settings->'team_names','[]')); if n=0 then raise exception 'Save team names before preparing another session.'; end if;
 offset_by:=(dest-src)%n;
 for i in 0..n-1 loop perform private.apply_beacon_media_team_action('create_beacon_team',jsonb_build_object('activity_id',target_id,'id',gen_random_uuid(),'name',c.settings->'team_names'->>((i+offset_by)%n))); end loop;
 return jsonb_build_object('id',target_id);
end $$;
revoke all on function private.prepare_rotated_teams(jsonb) from public,anon,authenticated;
alter function public.beacon_action(text,jsonb,uuid) rename to beacon_action_before_advanced_tools;
revoke all on function public.beacon_action_before_advanced_tools(text,jsonb,uuid) from public,anon,authenticated;
create function private.advanced_tools_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
<<tool_write>>
declare uid uuid:=auth.uid(); result jsonb; aid uuid:=nullif(payload->>'activity_id','')::uuid; tid uuid:=nullif(payload->>'thread_id','')::uuid; rid uuid:=nullif(payload->>'id','')::uuid; kind text:=payload->>'kind'; settings jsonb:=payload->'settings'; old private.premium_tool_configs; preset private.premium_presets; note public.beacon_notes; recap private.memory_recaps; refs uuid[]; feature text; begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>uid::text then raise exception 'Your account changed.'; end if;
 if action in ('create_activity','create_plan_beacon','create_activity_with_invitees','create_plan_beacon_with_invitees') and payload->'premium_appearance' is not null and payload->'premium_appearance'<>'null' then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into result from private.requests r where r.user_id=uid and r.request_id=advanced_tools_action.request_id; if found then return result; end if;
  result:=public.beacon_action_before_advanced_tools(action,payload-'premium_appearance',request_id);
  perform private.advanced_tools_action('save_tool_config',jsonb_build_object('activity_id',coalesce(result->>'activity_id',result->>'id'),'kind','appearance','settings',payload->'premium_appearance','revision',-1),gen_random_uuid());
  return result;
 end if;
 if action='save_template' and payload ? 'premium_appearance' then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select r.result into result from private.requests r where r.user_id=uid and r.request_id=advanced_tools_action.request_id; if found then return result; end if;
  result:=public.beacon_action_before_advanced_tools(action,payload-'premium_appearance',request_id);
  update public.templates set premium_appearance=nullif(payload->'premium_appearance','null'::jsonb) where id=(result->>'id')::uuid and owner_id=uid;
  return result;
 end if;
 if action not in ('prepare_plan_teams','set_council_option_group','save_council_explanation','save_tool_config','clear_tool_config','save_tool_preset','delete_tool_preset','save_journal_details','save_memory_recap','delete_memory_recap') then return public.beacon_action_before_advanced_tools(action,payload,request_id); end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select r.result into result from private.requests r where r.user_id=uid and r.request_id=advanced_tools_action.request_id; if found then return result; end if;
 perform private.limit_action('all',300);
 if action='prepare_plan_teams' then result:=private.prepare_rotated_teams(payload); insert into private.requests(user_id,request_id,result) values(uid,advanced_tools_action.request_id,result); return result; end if;
 result:=private.council_extra_action(action,payload);
 if result is not null then insert into private.requests(user_id,request_id,result) values(uid,advanced_tools_action.request_id,result); return result; end if;
 if action in ('save_tool_preset','delete_tool_preset') then
  select * into preset from private.premium_presets where id=rid for update;
  if found and preset.owner_id<>uid then raise exception 'Preset unavailable.'; end if;
  if action='delete_tool_preset' then delete from private.premium_presets where id=rid and owner_id=uid;
  else
   perform private.validate_tool_config(kind,settings); perform private.require_premium_feature(private.tool_feature(kind,settings));
   if kind='memories' then settings:=jsonb_build_object('title',settings->>'title','memory_ids','[]'::jsonb,'highlights','[]'::jsonb); end if;
   insert into private.premium_presets values(rid,uid,kind,btrim(payload->>'title'),settings) on conflict(id) do update set title=excluded.title,kind=excluded.kind,settings=excluded.settings where premium_presets.owner_id=uid;
   if not found then raise exception 'Preset unavailable.'; end if;
  end if;
 elsif action='save_journal_details' then
  select * into note from public.beacon_notes where id=(payload->>'note_id')::uuid for update;
  if not found or note.author_id<>uid or not private.note_details_allowed(note.id) then raise exception 'Journal entry unavailable.'; end if;
  if payload->>'format' not in ('plain','markdown') or not private.valid_text_array(coalesce(payload->'tags','[]'),12,36) then raise exception 'Choose valid Journal details.'; end if;
  refs:=array(select value::uuid from jsonb_array_elements_text(coalesce(payload->'linked_note_ids','[]')));
  if cardinality(refs)>12 or exists(select 1 from unnest(refs) n where not private.note_details_allowed(n)) then raise exception 'A linked reflection is unavailable.'; end if;
  if payload->>'format'<>'plain' or jsonb_array_length(coalesce(payload->'tags','[]'))>0 or cardinality(refs)>0 then perform private.require_premium_feature(case when cardinality(refs)>0 then 'journal_reflections' else 'journal_formatting' end,case when note.visibility='shared' then note.activity_id end); end if;
  if payload ? 'body' then perform private.apply_module_collection_action('save_beacon_note',jsonb_build_object('id',note.id,'activity_id',note.activity_id,'body',payload->>'body','section_heading',note.section_heading,'visibility',note.visibility,'expected_revision',payload->'expected_revision')); end if;
  insert into private.journal_details values(note.id,payload->>'format',coalesce(payload->'tags','[]'),refs) on conflict(note_id) do update set format=excluded.format,tags=excluded.tags,linked_note_ids=excluded.linked_note_ids;
  rid:=note.id;
 elsif action in ('save_memory_recap','delete_memory_recap') then
  select * into recap from private.memory_recaps where id=rid for update;
  aid:=coalesce(recap.activity_id,aid);
  if aid is null or not private.can_curate_memories(aid) then raise exception 'Only current Beacon organizers can edit recaps.'; end if;
  if action='delete_memory_recap' then delete from private.memory_recaps where id=rid;
  else
   perform private.require_premium_feature('afterglow',aid);
   refs:=array(select value::uuid from jsonb_array_elements_text(payload->'memory_ids'));
   if cardinality(refs)>50 or exists(select 1 from unnest(refs) mid where not private.premium_memory_allowed(mid)) then raise exception 'Memory unavailable.'; end if;
   if recap.id is not null and (recap.activity_id<>aid or recap.revision<>coalesce((payload->>'revision')::int,-1)) then raise exception 'This recap changed. Reopen it before saving.'; end if;
   insert into private.memory_recaps values(rid,aid,payload->>'title',coalesce(payload->>'introduction',''),refs,0) on conflict(id) do update set title=excluded.title,introduction=excluded.introduction,memory_ids=excluded.memory_ids,revision=memory_recaps.revision+1 where memory_recaps.activity_id=aid and memory_recaps.revision=coalesce((payload->>'revision')::int,-1);
   if not found then raise exception 'This recap changed. Reopen it before saving.'; end if;
  end if;
 else
  if kind='council' then
   if tid is null or not private.can_manage_planning_thread(tid) then raise exception 'Council unavailable.'; end if;
  elsif aid is null or not (case when kind='memories' then private.can_curate_memories(aid) else private.can_manage_beacon(aid) end) then raise exception 'Only current Beacon organizers can configure this tool.'; end if;
  select * into old from private.premium_tool_configs t where t.kind=tool_write.kind and (t.activity_id=aid or t.thread_id=tid) for update;
  if old.id is not null and old.revision<>coalesce((payload->>'revision')::int,-1) then raise exception 'This tool changed. Reopen its settings.'; end if;
  if action='clear_tool_config' then delete from private.premium_tool_configs where id=old.id;
  else
   perform private.validate_tool_config(kind,settings); feature:=private.tool_feature(kind,settings);
   if kind='council' then
    if private.premium_rank(private.thread_premium_tier(tid))<private.premium_rank(private.feature_required_tier(feature)) then raise exception 'PREMIUM_REQUIRED: This Council configuration requires BEACON+.'; end if;
   else perform private.require_premium_feature(feature,aid); end if;
   if kind='memories' and exists(select 1 from jsonb_array_elements_text(coalesce(settings->'memory_ids','[]')) m where not private.premium_memory_allowed(m::uuid) or not exists(select 1 from public.beacon_memories bm where bm.id=m::uuid and bm.activity_id=aid)) then raise exception 'Memory unavailable.'; end if;
   rid:=coalesce(old.id,gen_random_uuid());
   if old.id is null then insert into private.premium_tool_configs values(rid,aid,tid,kind,settings,0);
   else update private.premium_tool_configs set settings=tool_write.settings,revision=revision+1 where id=rid; end if;
  end if;
 end if;
 result:=jsonb_build_object('id',rid); insert into private.requests(user_id,request_id,result) values(uid,advanced_tools_action.request_id,result); return result;
end $$;
revoke all on function private.advanced_tools_action(text,jsonb,uuid) from public,anon;
grant execute on function private.advanced_tools_action(text,jsonb,uuid) to authenticated;
create function public.beacon_action(action text,payload jsonb default '{}',request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select private.advanced_tools_action(action,payload,request_id)$$;
revoke all on function public.beacon_action(text,jsonb,uuid) from public,anon;
grant execute on function public.beacon_action(text,jsonb,uuid) to authenticated;

create function private.advanced_tools_projection() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object(
 'council_option_groups',coalesce((select jsonb_agg(to_jsonb(g)) from private.council_option_groups g join public.planning_proposals p on p.id=g.proposal_id where private.can_read_planning_proposal(p.thread_id,p.author_id)),'[]'::jsonb),
 'council_explanations',coalesce((select jsonb_agg(to_jsonb(e)) from private.council_explanations e where private.can_read_planning_thread(e.thread_id) and (e.user_id=auth.uid() or private.can_manage_planning_thread(e.thread_id)) and not private.blocked(e.user_id)),'[]'::jsonb),
 'premium_tool_configs',coalesce((select jsonb_agg(to_jsonb(t)||case when t.kind='memories' then jsonb_build_object('settings',t.settings||jsonb_build_object('memory_ids',coalesce((select jsonb_agg(m) from jsonb_array_elements_text(t.settings->'memory_ids') m where private.premium_memory_allowed(m::uuid)),'[]'::jsonb),'highlights',coalesce((select jsonb_agg(m) from jsonb_array_elements_text(t.settings->'highlights') m where private.premium_memory_allowed(m::uuid)),'[]'::jsonb))) else '{}' end) from private.premium_tool_configs t where (t.activity_id is not null and private.can_chat(t.activity_id)) or (t.thread_id is not null and private.can_read_planning_thread(t.thread_id))),'[]'::jsonb),
 'premium_presets',coalesce((select jsonb_agg(to_jsonb(p)) from private.premium_presets p where p.owner_id=auth.uid()),'[]'::jsonb),
 'journal_details',coalesce((select jsonb_agg(to_jsonb(d)||jsonb_build_object('linked_note_ids',coalesce((select jsonb_agg(n) from unnest(d.linked_note_ids) n where private.note_details_allowed(n)),'[]'::jsonb))) from private.journal_details d where private.note_details_allowed(d.note_id)),'[]'::jsonb),
 'memory_recaps',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('memory_ids',coalesce((select jsonb_agg(m) from unnest(r.memory_ids) m where private.premium_memory_allowed(m)),'[]'::jsonb))) from private.memory_recaps r where private.can_chat(r.activity_id)),'[]'::jsonb)
)$$;
revoke all on function private.advanced_tools_projection() from public,anon;
grant execute on function private.advanced_tools_projection() to authenticated;
alter function public.beacon_snapshot() rename to beacon_snapshot_before_advanced_tools;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$declare result jsonb; begin result:=public.beacon_snapshot_before_advanced_tools();return result||private.advanced_tools_projection()||jsonb_build_object('capabilities',coalesce(result->'capabilities','{}')||'{"advanced_beacon_tools":true}'::jsonb);end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;

-- Scheduled drafts use the same public dispatcher as ordinary publication.
do $migration$ declare definition text; begin
 select pg_get_functiondef('private.plan_editor_action(text,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'created:=public.beacon_action_before_plan_editor(','created:=public.beacon_action(');
 execute definition;
end $migration$;

alter table public.templates add column premium_appearance jsonb;
create function private.template_appearance_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.premium_appearance is not null and (tg_op='INSERT' or new.premium_appearance is distinct from old.premium_appearance) then
  perform private.validate_tool_config('appearance',new.premium_appearance);
  if private.premium_rank(private.premium_tier(new.owner_id))<private.premium_rank(private.feature_required_tier(private.tool_feature('appearance',new.premium_appearance))) then raise exception 'PREMIUM_REQUIRED: Personal appearance presets require your own BEACON+ membership.'; end if;
 end if;
 return new;
end $$;
revoke all on function private.template_appearance_guard() from public,anon,authenticated;
create trigger template_appearance_guard before insert or update on public.templates for each row execute function private.template_appearance_guard();

create function private.protect_beacon_premium_scope() returns trigger language plpgsql security definer set search_path='' as $$declare tier text; feature text; c record; begin
 if (new.owner_id,new.audience,new.audience_id) is not distinct from (old.owner_id,old.audience,old.audience_id) then return new; end if;
 tier:=private.premium_tier(new.owner_id);
 if new.audience='squad' and exists(select 1 from public.squad_members m where m.squad_id=new.audience_id and m.user_id=new.owner_id) and not exists(select 1 from private.beacon_discovery d where d.activity_id=new.id) and private.premium_rank(private.squad_premium_tier(new.audience_id))>private.premium_rank(tier) then tier:=private.squad_premium_tier(new.audience_id); end if;
 for c in select kind,settings from private.premium_tool_configs where activity_id=new.id loop
  feature:=private.tool_feature(c.kind,c.settings);
  if private.premium_rank(tier)<private.premium_rank(private.feature_required_tier(feature)) then raise exception 'PREMIUM_REQUIRED: Clear advanced tool settings or choose an eligible audience before moving this Beacon.'; end if;
 end loop;
 if private.premium_rank(tier)<1 and exists(select 1 from public.beacon_checklist_items i where i.activity_id=new.id and (i.assignee_id is not null or i.due_at is not null or i.due_on is not null)) then raise exception 'PREMIUM_REQUIRED: Clear paid checklist details before moving this Beacon outside its eligible audience.'; end if;
 if private.premium_rank(tier)<2 and exists(select 1 from private.memory_recaps r where r.activity_id=new.id) then raise exception 'PREMIUM_REQUIRED: Afterglow needs a Pro audience or personal Pro membership.'; end if;
 return new;
end $$;
revoke all on function private.protect_beacon_premium_scope() from public,anon,authenticated;
create trigger protect_beacon_premium_scope before update of owner_id,audience,audience_id on public.activities for each row execute function private.protect_beacon_premium_scope();

-- Extend the existing score writer; ordinary +/-1 always remains Free.
do $migration$ declare definition text; begin
 select pg_get_functiondef('private.apply_beacon_media_team_action(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'delta is null or delta not in (-1,1)',E'delta is null or (delta not in (-1,1) and not (private.premium_rank(private.beacon_premium_tier(aid))>=1 and exists(select 1 from private.premium_tool_configs c,jsonb_array_elements(c.settings->''score_steps'') s where c.activity_id=aid and c.kind=''teams'' and (s->>''points'')::int=delta)))');
 execute definition;
end $migration$;
