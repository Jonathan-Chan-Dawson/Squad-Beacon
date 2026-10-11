-- Place-only facts. No public report rows, identities, demand counts or stranger GPS.
create table private.pulse_places (
 place_key text primary key, lat float8 not null, lng float8 not null, category text not null
);
create table private.place_tips (
 id uuid primary key default gen_random_uuid(), place_key text not null references private.pulse_places,
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(length(body) between 1 and 180),
 created_at timestamptz not null default now(), accurate_at timestamptz not null default now(),
 unique(place_key,author_id)
);
create table private.place_tip_votes (
 tip_id uuid references private.place_tips on delete cascade,
 viewer_id uuid references public.profiles(id) on delete cascade,
 helpful boolean not null default false, accuracy text check(accuracy in ('accurate','stale')),
 accuracy_at timestamptz, reported boolean not null default false,
 primary key(tip_id,viewer_id)
);
create table private.place_interest (
 viewer_id uuid primary key references public.profiles(id) on delete cascade,
 -- Approximate area only; never store a person's exact location or a venue key.
 cell_lat integer not null, cell_lng integer not null,
 kind text not null check(kind in ('pickup','study','food','hike','workout')),
 expires_at timestamptz not null
);
create table private.place_knowledge_events (
 viewer_id uuid references public.profiles(id) on delete cascade, at timestamptz not null default now()
);
create index place_knowledge_rate on private.place_knowledge_events(viewer_id,at);
create index place_interest_area on private.place_interest(cell_lat,cell_lng,kind,expires_at);
revoke all on private.pulse_places,private.place_tips,private.place_tip_votes,private.place_interest,private.place_knowledge_events from public,anon,authenticated;

create function public.pulse_place_context(place jsonb, action text default 'read', payload text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); p text:=place->>'placeKey'; c text:=place->>'category';
 latitude float8; longitude float8; cell_y integer; cell_x integer;
 venue private.pulse_places; tip private.place_tips; result jsonb; choices text[];
begin
 if u is null or not exists(select 1 from public.profiles where id=u) then raise exception 'pulse_unauthorized'; end if;
 if jsonb_typeof(place) is distinct from 'object' or jsonb_typeof(place->'placeKey') is distinct from 'string' or jsonb_typeof(place->'lat') is distinct from 'number'
  or jsonb_typeof(place->'lng') is distinct from 'number' or length(p) not between 1 and 200 or p like 'area:%'
  or c not in ('restaurant','cafe','bar','gym','court','field','recreation','parking','trail','park','library','study','unknown')
  or p is null or c is null then raise exception 'pulse_invalid_place'; end if;
 latitude:=(place->>'lat')::float8; longitude:=(place->>'lng')::float8;
 if latitude not between -90 and 90 or longitude not between -180 and 180 then raise exception 'pulse_invalid_place'; end if;
 cell_y:=floor(latitude*50); cell_x:=floor(longitude*50);
 choices:=case c when 'court' then array['pickup'] when 'field' then array['pickup'] when 'recreation' then array['pickup']
  when 'cafe' then array['study','food'] when 'restaurant' then array['food'] when 'bar' then array['food']
  when 'library' then array['study'] when 'study' then array['study'] when 'trail' then array['hike']
  when 'park' then array['hike','pickup'] when 'gym' then array['workout'] else array[]::text[] end;
 if action not in ('read','tip','helpful','accurate','stale','report','interest','withdraw') or action is null then raise exception 'pulse_invalid_action'; end if;
 if action<>'read' then
  perform pg_advisory_xact_lock(hashtextextended('place-context-user:'||u::text,0));
  delete from private.place_knowledge_events where viewer_id=u and at<=now()-interval '1 hour';
  if (select count(*) from private.place_knowledge_events where viewer_id=u)>=30 then raise exception 'pulse_rate_limited'; end if;
  insert into private.place_knowledge_events(viewer_id) values(u);
  perform pg_advisory_xact_lock(hashtextextended('place-context:'||p,0));
  insert into private.pulse_places values(p,latitude,longitude,c) on conflict do nothing;
 end if;
 select * into venue from private.pulse_places where place_key=p;
 if found and (abs(venue.lat-latitude)>0.00001 or abs(venue.lng-longitude)>0.00001 or venue.category<>c) then raise exception 'pulse_place_changed'; end if;
 if action='tip' then
  payload:=btrim(payload);
  if payload is null or length(payload) not between 1 and 180 then raise exception 'pulse_invalid_tip'; end if;
  -- Replacing your tip removes its old endorsements rather than transferring them.
  delete from private.place_tips where place_key=p and author_id=u;
  insert into private.place_tips(place_key,author_id,body) values(p,u,payload);
 elsif action in ('helpful','accurate','stale','report') then
  select * into tip from private.place_tips where id=payload::uuid and place_key=p and not private.blocked(author_id) for update;
  if not found or tip.accurate_at<=now()-interval '90 days' or tip.author_id=u then raise exception 'pulse_invalid_tip'; end if;
  insert into private.place_tip_votes(tip_id,viewer_id) values(tip.id,u) on conflict do nothing;
  if action='helpful' then update private.place_tip_votes set helpful=true where tip_id=tip.id and viewer_id=u;
  elsif action='report' then update private.place_tip_votes set reported=true where tip_id=tip.id and viewer_id=u;
  else
   if action='accurate' and exists(select 1 from private.place_tip_votes where tip_id=tip.id and viewer_id=u and accuracy_at>now()-interval '30 days') then raise exception 'pulse_accuracy_cooldown'; end if;
   update private.place_tip_votes set accuracy=action,accuracy_at=now() where tip_id=tip.id and viewer_id=u;
   if action='accurate' then update private.place_tips set accurate_at=now() where id=tip.id; end if;
  end if;
 elsif action='interest' then
  if payload is null or not payload=any(choices) then raise exception 'pulse_invalid_interest'; end if;
  insert into private.place_interest values(u,cell_y,cell_x,payload,now()+interval '2 hours')
   on conflict(viewer_id) do update set cell_lat=excluded.cell_lat,cell_lng=excluded.cell_lng,kind=excluded.kind,expires_at=excluded.expires_at;
 elsif action='withdraw' then delete from private.place_interest where viewer_id=u;
 end if;
 select jsonb_build_object('tips',coalesce(jsonb_agg(item order by score desc,accurate_at desc),'[]'::jsonb)) into result from (
  select t.accurate_at,
   count(*) filter(where v.helpful)::float8/(1+extract(epoch from now()-t.accurate_at)/2592000) score,
   jsonb_build_object('id',t.id,'text',t.body,'helpful',count(*) filter(where v.helpful),
    'accurateAt',extract(epoch from t.accurate_at)*1000,'own',t.author_id=u,
    'helped',coalesce(bool_or(v.helpful) filter(where v.viewer_id=u),false),
    'accuracy',max(v.accuracy) filter(where v.viewer_id=u)) item
  from private.place_tips t left join private.place_tip_votes v on v.tip_id=t.id
  where t.place_key=p and t.accurate_at>now()-interval '90 days' and not private.blocked(t.author_id)
   and not exists(select 1 from private.place_tip_votes hidden where hidden.tip_id=t.id and hidden.viewer_id=u and hidden.reported)
  group by t.id
  having count(*) filter(where v.reported)<3 and
   (count(*) filter(where v.accuracy='stale' and v.accuracy_at>now()-interval '90 days')<3 or
    count(*) filter(where v.accuracy='stale' and v.accuracy_at>now()-interval '90 days')<=count(*) filter(where v.accuracy='accurate' and v.accuracy_at>now()-interval '90 days'))
  order by score desc,t.accurate_at desc limit 4
 ) tips;
 -- At least five OTHER distinct people, one active interest per person. Threshold expiry
 -- is the fifth latest expiry; identities, exact counts and venue locations stay private.
 return result||jsonb_build_object('interest',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'validUntil',expiry)) from (
  select kind,(array_agg(extract(epoch from expires_at)*1000 order by expires_at desc))[5] expiry
  from private.place_interest where cell_lat=cell_y and cell_lng=cell_x and expires_at>now() and viewer_id<>u and not private.blocked(viewer_id) and kind=any(choices)
  group by kind having count(*)>=5
 ) demand),'[]'::jsonb),'ownInterest',(select kind from private.place_interest where viewer_id=u and cell_lat=cell_y and cell_lng=cell_x and expires_at>now()));
end $$;
revoke all on function public.pulse_place_context(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.pulse_place_context(jsonb,text,text) to authenticated;

create or replace function public.cleanup_pulse_reports() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.pulse_reports where expires_at<=now();
 delete from private.pulse_post_events where at<=now()-interval '1 day';
 delete from private.pulse_confirmations where last_at<=now()-interval '1 day';
 delete from private.place_interest where expires_at<=now();
 delete from private.place_tips where accurate_at<=now()-interval '90 days';
 delete from private.place_knowledge_events where at<=now()-interval '1 day';
end $$;

-- Align live reporting with venue type; courts have crowd and availability, fields
-- have crowd and field conditions rather than court-only options.
create or replace function private.pulse_allowed(c text,k text,v jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(case
 when k='crowd' then c in ('restaurant','cafe','bar','gym','library','study','unknown','area','park','trail','court','field','recreation') and v in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb) and (c not in ('park','trail') or v<>'3'::jsonb)
 when k='wait' then c in ('restaurant','cafe','bar') and v in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb)
 when k='parking' then c='parking' and v in ('0'::jsonb,'1'::jsonb,'2'::jsonb)
 when k='availability' then (c in ('restaurant','cafe','bar','library','study') and v='"seats_available"'::jsonb) or (c='gym' and v='"equipment_available"'::jsonb) or (c in ('court','recreation') and v in ('"courts_open"'::jsonb,'"courts_occupied"'::jsonb,'"people_waiting"'::jsonb))
 when k='condition' then (c in ('field','recreation') and v='"field_wet"'::jsonb) or (c in ('park','trail') and v in ('"trail_muddy"'::jsonb,'"blocked_closed"'::jsonb))
 else false end,false)
$$;
