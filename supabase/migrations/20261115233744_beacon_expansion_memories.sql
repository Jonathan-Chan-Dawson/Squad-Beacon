-- Stage 3: deterministic presentation and free, revocable participant consent.
alter table private.memory_recaps add column layout text not null default 'album' check(layout in ('album','timeline','story')),add column participant_ids uuid[] not null default '{}';
create table private.beacon_recap_consents(activity_id uuid references public.activities on delete cascade,user_id uuid references public.profiles on delete cascade,allowed boolean not null default false,primary key(activity_id,user_id));
alter table private.beacon_recap_consents enable row level security;
revoke all on private.beacon_recap_consents from public,anon,authenticated;
alter function private.validate_tool_config(text,jsonb) rename to validate_tool_config_before_stories;
create function private.validate_tool_config(kind text,s jsonb) returns void language plpgsql immutable set search_path='' as $$declare row jsonb;begin
 if kind<>'appearance' then perform private.validate_tool_config_before_stories(kind,s);return;end if;
 perform private.validate_tool_config_before_stories(kind,s-'sections');
 if s ? 'sections' then
  if jsonb_typeof(s->'sections') is distinct from 'array' or jsonb_array_length(s->'sections')>6 then raise exception 'Use up to six activity sections.';end if;
  for row in select value from jsonb_array_elements(s->'sections') loop
   if jsonb_typeof(row) is distinct from 'object' or not row ?& array['id','title','body'] or jsonb_typeof(row->'id')<>'string' or length(row->>'id') not between 1 and 64 or jsonb_typeof(row->'title')<>'string' or length(btrim(row->>'title')) not between 1 and 80 or jsonb_typeof(row->'body')<>'string' or length(row->>'body')>1000 or exists(select 1 from jsonb_object_keys(row) k where k not in ('id','title','body')) then raise exception 'Choose compact activity sections.';end if;
  end loop;
  if (select count(*) from jsonb_array_elements(s->'sections'))<>(select count(distinct section->>'id') from jsonb_array_elements(s->'sections') section) then raise exception 'Use distinct activity sections.';end if;
 end if;
end $$;
revoke all on function private.validate_tool_config_before_stories(text,jsonb),private.validate_tool_config(text,jsonb) from public,anon,authenticated;
alter function private.tool_feature(text,jsonb) rename to tool_feature_before_stories;
create function private.tool_feature(kind text,s jsonb) returns text language sql immutable set search_path='' as $$select case when kind='appearance' then case when coalesce(s->>'layout','standard')<>'standard' or jsonb_array_length(coalesce(s->'sections','[]'))>0 then 'layouts' else 'appearance' end else private.tool_feature_before_stories(kind,s) end$$;
revoke all on function private.tool_feature_before_stories(text,jsonb),private.tool_feature(text,jsonb) from public,anon,authenticated;

alter function private.expansion_action(text,jsonb,uuid) rename to expansion_action_before_stories;
create function private.expansion_action(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare aid uuid:=(payload->>'activity_id')::uuid;result jsonb;people uuid[];begin
 if auth.uid() is null then raise exception 'Sign in to continue.';end if;
 if payload ? 'expected_actor_id' and payload->>'expected_actor_id'<>auth.uid()::text then raise exception 'Your account changed.';end if;
 if action not in ('set_recap_consent','save_memory_recap') then return private.expansion_action_before_stories(action,payload,request_id);end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select r.result into result from private.requests r where user_id=auth.uid() and r.request_id=$3;if found then return result;end if;
 if action='set_recap_consent' then
  if not private.can_chat(aid) or jsonb_typeof(payload->'allowed') is distinct from 'boolean' then raise exception 'Recap consent unavailable.';end if;
  perform private.limit_action('all',300);
  insert into private.beacon_recap_consents values(aid,auth.uid(),(payload->>'allowed')::boolean) on conflict(activity_id,user_id) do update set allowed=excluded.allowed;
  result:=jsonb_build_object('id',aid);insert into private.requests(user_id,request_id,result) values(auth.uid(),$3,result);return result;
 end if;
 if payload ? 'layout' and (jsonb_typeof(payload->'layout')<>'string' or payload->>'layout' not in ('album','timeline','story')) then raise exception 'Choose a recap layout.';end if;
 if payload ? 'participant_ids' then
  if not coalesce(private.valid_text_array(payload->'participant_ids',50,64),false) then raise exception 'Choose consenting participants.';end if;
  select coalesce(array_agg(p::uuid),'{}') into people from jsonb_array_elements_text(payload->'participant_ids') p;
  -- Lock consent rows until this write commits; revocation is reflected again at read time.
  perform 1 from private.beacon_recap_consents where activity_id=aid and user_id=any(people) for share;
  if exists(select 1 from unnest(people) p where not exists(select 1 from private.beacon_recap_consents c join public.activities a on a.id=c.activity_id where c.activity_id=aid and c.user_id=p and c.allowed and not private.blocked(p) and (p=a.owner_id or private.beacon_approved_going(aid,p)))) then raise exception 'Only consenting current participants can appear in recaps.';end if;
 end if;
 result:=private.expansion_action_before_stories(action,payload,request_id);
 update private.memory_recaps set layout=coalesce(payload->>'layout',layout),participant_ids=coalesce(people,participant_ids) where id=(result->>'id')::uuid;
 return result;
end $$;
revoke all on function private.expansion_action_before_stories(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function private.expansion_action(text,jsonb,uuid) from public,anon;
grant execute on function private.expansion_action(text,jsonb,uuid) to authenticated;
alter function private.advanced_tools_projection() rename to advanced_tools_projection_before_stories;
revoke all on function private.advanced_tools_projection_before_stories() from public,anon,authenticated;
create function private.advanced_tools_projection() returns jsonb language plpgsql stable security definer set search_path='' as $$declare s jsonb;begin
 s:=private.advanced_tools_projection_before_stories();
 return s||jsonb_build_object('memory_recaps',coalesce((select jsonb_agg(r||jsonb_build_object('participant_ids',coalesce((select jsonb_agg(p) from jsonb_array_elements_text(r->'participant_ids') p join private.beacon_recap_consents c on c.user_id=p::uuid and c.activity_id=(r->>'activity_id')::uuid where c.allowed and not private.blocked(p::uuid) and (p::uuid=(select owner_id from public.activities where id=c.activity_id) or private.beacon_approved_going(c.activity_id,p::uuid))),'[]'::jsonb))) from jsonb_array_elements(s->'memory_recaps') r),'[]'::jsonb),
 'recap_consents',coalesce((select jsonb_agg(to_jsonb(c)) from private.beacon_recap_consents c where private.can_chat(c.activity_id) and not private.blocked(c.user_id) and (c.user_id=auth.uid() or c.allowed) and (c.user_id=(select owner_id from public.activities where id=c.activity_id) or private.beacon_approved_going(c.activity_id,c.user_id))),'[]'::jsonb));
end $$;
revoke all on function private.advanced_tools_projection() from public,anon;
grant execute on function private.advanced_tools_projection() to authenticated;

alter function public.beacon_snapshot() rename to beacon_snapshot_before_beacon_stories;
create function public.beacon_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$declare s jsonb;begin s:=public.beacon_snapshot_before_beacon_stories();return s||jsonb_build_object('capabilities',coalesce(s->'capabilities','{}')||'{"beacon_stories":true}'::jsonb);end $$;
revoke all on function public.beacon_snapshot() from public,anon;
grant execute on function public.beacon_snapshot() to authenticated;
