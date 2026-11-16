-- Stage 4: round breakdowns update the canonical team total in the same transaction.
create table private.beacon_round_scores(activity_id uuid not null references public.activities on delete cascade,team_id uuid references public.beacon_teams on delete cascade,round_name text check(length(btrim(round_name)) between 1 and 60),score integer not null check(score between 0 and 9999),revision integer not null default 0,primary key(team_id,round_name));
alter table private.beacon_round_scores enable row level security;
revoke all on private.beacon_round_scores from public,anon,authenticated;
create index round_scores_activity on private.beacon_round_scores(activity_id);
alter function private.feature_required_tier(text) rename to feature_required_tier_before_specialized;
create function private.feature_required_tier(feature text) returns text language sql immutable set search_path='' as $$select case when feature in ('score_rounds','council_workflows') then 'pro' else private.feature_required_tier_before_specialized(feature) end$$;
revoke all on function private.feature_required_tier_before_specialized(text),private.feature_required_tier(text) from public,anon,authenticated;
alter function private.validate_tool_config(text,jsonb) rename to validate_tool_config_before_specialized;
create function private.validate_tool_config(kind text,s jsonb) returns void language plpgsql immutable set search_path='' as $$declare row jsonb;begin
 if kind='teams' then
  perform private.validate_tool_config_before_specialized(kind,s-'round_names');
  if s ? 'round_names' and not coalesce(private.valid_text_array(s->'round_names',12,60),false) then raise exception 'Use up to twelve named scoring rounds.';end if;
 elsif kind='council' then
  perform private.validate_tool_config_before_specialized(kind,s-'workflow');
  if s ? 'workflow' then
   if jsonb_typeof(s->'workflow') is distinct from 'array' or jsonb_array_length(s->'workflow')>8 then raise exception 'Link up to eight Council decisions.';end if;
   for row in select value from jsonb_array_elements(s->'workflow') loop
    if jsonb_typeof(row) is distinct from 'object' or not row ?& array['thread_id','label'] or jsonb_typeof(row->'thread_id')<>'string' or length(row->>'thread_id') not between 1 and 64 or jsonb_typeof(row->'label')<>'string' or length(btrim(row->>'label')) not between 1 and 60 or exists(select 1 from jsonb_object_keys(row) k where k not in ('thread_id','label')) then raise exception 'Choose valid linked Council decisions.';end if;
   end loop;
   if (select count(*) from jsonb_array_elements(s->'workflow'))<>(select count(distinct w->>'thread_id') from jsonb_array_elements(s->'workflow') w) then raise exception 'Use distinct Council stages.';end if;
  end if;
 else perform private.validate_tool_config_before_specialized(kind,s);end if;
end $$;
revoke all on function private.validate_tool_config_before_specialized(text,jsonb),private.validate_tool_config(text,jsonb) from public,anon,authenticated;
alter function private.tool_feature(text,jsonb) rename to tool_feature_before_specialized;
create function private.tool_feature(kind text,s jsonb) returns text language sql immutable set search_path='' as $$select case when kind='teams' and jsonb_array_length(coalesce(s->'round_names','[]'))>0 then 'score_rounds' when kind='council' and jsonb_array_length(coalesce(s->'workflow','[]'))>0 then 'council_workflows' else private.tool_feature_before_specialized(kind,s) end$$;
revoke all on function private.tool_feature_before_specialized(text,jsonb),private.tool_feature(text,jsonb) from public,anon,authenticated;
alter function private.expansion_action(text,jsonb,uuid) rename to expansion_action_before_specialized;
create function private.expansion_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;team public.beacon_teams;aid uuid;settings jsonb;old private.beacon_round_scores;delta integer;source public.planning_threads;begin
 if auth.uid() is null then raise exception 'Sign in to continue.';end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>auth.uid()::text then raise exception 'Your account changed.';end if;
 if action in ('save_tool_config','save_tool_preset') and payload->>'kind'='council' and payload->'settings' ? 'workflow' then
  perform private.validate_tool_config('council',payload->'settings');
  if action='save_tool_preset' then payload:=jsonb_set(payload,'{settings,workflow}','[]');
  else
   select * into source from public.planning_threads where id=($2->>'thread_id')::uuid;
   if not found or not private.can_read_planning_thread(source.id) or not private.can_manage_planning_thread(source.id) then raise exception 'Council unavailable.';end if;
   if exists(select 1 from jsonb_array_elements(payload->'settings'->'workflow') w where not exists(select 1 from public.planning_threads t where t.id=(w->>'thread_id')::uuid and t.kind<>'ping' and t.audience=source.audience and t.audience_id is not distinct from source.audience_id and private.can_read_planning_thread(t.id) and private.can_manage_planning_thread(t.id))) then raise exception 'Link readable Councils you organize for the same audience.';end if;
  end if;
 end if;
 if action<>'record_round_score' then return private.expansion_action_before_specialized(action,payload,request_id);end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select r.result into result from private.requests r where user_id=auth.uid() and r.request_id=$3;if found then return result;end if;
 select activity_id into aid from public.beacon_teams where id=(payload->>'team_id')::uuid;
 perform 1 from public.activities where id=aid for update;
 select * into team from public.beacon_teams where id=(payload->>'team_id')::uuid for update;
 if not found or not private.can_manage_beacon(aid) then raise exception 'Only current organizers can score rounds.';end if;
 perform private.require_premium_feature('score_rounds',aid);
 select c.settings into settings from private.premium_tool_configs c where activity_id=aid and kind='teams';
 if not coalesce(settings->'round_names','[]') ? (payload->>'round_name') then raise exception 'Choose a configured round.';end if;
 delta:=(payload->>'delta')::integer;
 if delta is null or jsonb_typeof(payload->'delta') is distinct from 'number' or (payload->>'delta')::numeric<>delta or (delta not in (-1,1) and not exists(select 1 from jsonb_array_elements(settings->'score_steps') s where (s->>'points')::int=delta)) then raise exception 'Choose a configured score increment.';end if;
 select * into old from private.beacon_round_scores where team_id=team.id and round_name=payload->>'round_name' for update;
 if coalesce(old.revision,-1)<>coalesce((payload->>'revision')::int,-2) then raise exception 'This round score changed. Refresh it.';end if;
 if team.score+delta not between 0 and 9999 or coalesce(old.score,0)+delta not between 0 and 9999 then raise exception 'Score would be outside its limits.';end if;
 perform private.limit_action('all',300);
 result:=private.apply_beacon_media_team_action('adjust_beacon_team_score',jsonb_build_object('team_id',team.id,'delta',delta));
 insert into private.beacon_round_scores values(aid,team.id,payload->>'round_name',coalesce(old.score,0)+delta,coalesce(old.revision,-1)+1) on conflict(team_id,round_name) do update set score=excluded.score,revision=excluded.revision;
 insert into private.requests(user_id,request_id,result) values(auth.uid(),$3,result);return result;
end $$;
revoke all on function private.expansion_action_before_specialized(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.expansion_action(text,jsonb,uuid) from public,anon;
grant execute on function private.expansion_action(text,jsonb,uuid) to authenticated;
alter function private.advanced_tools_projection() rename to advanced_tools_projection_before_specialized;
revoke all on function private.advanced_tools_projection_before_specialized() from public,anon,authenticated;
create function private.advanced_tools_projection() returns jsonb language plpgsql stable security definer set search_path='' as $$declare s jsonb;begin
 s:=private.advanced_tools_projection_before_specialized();
 return s||jsonb_build_object('round_scores',coalesce((select jsonb_agg(to_jsonb(r)) from private.beacon_round_scores r where private.can_chat(r.activity_id)),'[]'::jsonb),
 'premium_tool_configs',coalesce((select jsonb_agg(case when c->>'kind'='council' and c->'settings' ? 'workflow' then jsonb_set(c,'{settings,workflow}',coalesce((select jsonb_agg(w) from jsonb_array_elements(c->'settings'->'workflow') w where private.can_read_planning_thread((w->>'thread_id')::uuid)),'[]')) else c end) from jsonb_array_elements(s->'premium_tool_configs') c),'[]'::jsonb));
end $$;
revoke all on function private.advanced_tools_projection() from public,anon;
grant execute on function private.advanced_tools_projection() to authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_beacon_specialized;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$declare s jsonb;begin s:=public.beacon_snapshot_before_beacon_specialized();return s||jsonb_build_object('capabilities',coalesce(s->'capabilities','{}')||'{"beacon_specialized":true}'::jsonb);end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
