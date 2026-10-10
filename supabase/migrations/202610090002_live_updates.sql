-- Additive only. This file is not applied or deployed by the implementation task.
create table public.pulse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  place_key text not null, lat double precision not null, lng double precision not null,
  category text not null, kind text not null, value jsonb not null, note text,
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  last_confirmed_at timestamptz, confirm_count integer not null default 0,
  unique (reporter_id, place_key, kind)
);
create index pulse_reports_bounds on public.pulse_reports(lat,lng,expires_at);
create index pulse_reports_place on public.pulse_reports(place_key,expires_at);
alter table public.pulse_reports enable row level security;
revoke all on public.pulse_reports from public,anon,authenticated;
grant insert,delete on public.pulse_reports to authenticated;
create policy pulse_insert_own on public.pulse_reports for insert to authenticated with check (reporter_id=auth.uid());
create policy pulse_delete_own on public.pulse_reports for delete to authenticated using (reporter_id=auth.uid());

create table private.pulse_post_events(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, at timestamptz not null);
create index pulse_post_events_rate on private.pulse_post_events(user_id,at);
-- Private transaction marker: clients cannot set or forge the RPC batch credit.
create table private.pulse_batches(tx bigint not null,user_id uuid not null,primary key(tx,user_id));
create table private.pulse_confirmations(user_id uuid references public.profiles(id) on delete cascade,place_key text,last_at timestamptz not null,primary key(user_id,place_key));
create table private.pulse_note_reports(viewer_id uuid references public.profiles(id) on delete cascade,report_id uuid references public.pulse_reports(id) on delete cascade,at timestamptz not null default now(),primary key(viewer_id,report_id));
revoke all on private.pulse_post_events,private.pulse_batches,private.pulse_confirmations,private.pulse_note_reports from public,anon,authenticated;

create function private.pulse_ttl(k text,v jsonb) returns interval language sql immutable set search_path='' as $$
 select case when v='"blocked_closed"'::jsonb then interval '4 hours' else case k when 'crowd' then interval '90 minutes' when 'wait' then interval '45 minutes' when 'parking' then interval '60 minutes' when 'availability' then interval '90 minutes' when 'condition' then interval '6 hours' end end
$$;
create function private.pulse_allowed(c text,k text,v jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(case
 when k='crowd' then c in ('restaurant','cafe','bar','gym','library','study','unknown','area','park','trail') and v in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb) and (c not in ('park','trail') or v<>'3'::jsonb)
 when k='wait' then c in ('restaurant','cafe','bar') and v in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb)
 when k='parking' then c='parking' and v in ('0'::jsonb,'1'::jsonb,'2'::jsonb)
 when k='availability' then (c in ('restaurant','cafe','bar','library','study') and v='"seats_available"'::jsonb) or (c='gym' and v='"equipment_available"'::jsonb) or (c in ('court','field','recreation') and v in ('"courts_open"'::jsonb,'"courts_occupied"'::jsonb,'"people_waiting"'::jsonb))
 when k='condition' then (c in ('court','field','recreation') and v='"field_wet"'::jsonb) or (c in ('park','trail') and v in ('"trail_muddy"'::jsonb,'"blocked_closed"'::jsonb))
 else false end,false)
$$;
create function private.pulse_area_key(latitude double precision,longitude double precision) returns text language plpgsql immutable set search_path='' as $$
declare lo_lat double precision:=-90; hi_lat double precision:=90; lo_lng double precision:=-180; hi_lng double precision:=180; midpoint double precision; upper_half boolean; code integer:=0; bits integer:=0; result text:='area:'; alphabet text:='0123456789bcdefghjkmnpqrstuvwxyz';
begin
 for i in 0..34 loop
  if i%2=0 then midpoint:=(lo_lng+hi_lng)/2; upper_half:=longitude>=midpoint; if upper_half then lo_lng:=midpoint; else hi_lng:=midpoint; end if;
  else midpoint:=(lo_lat+hi_lat)/2; upper_half:=latitude>=midpoint; if upper_half then lo_lat:=midpoint; else hi_lat:=midpoint; end if; end if;
  code:=code*2+case when upper_half then 1 else 0 end; bits:=bits+1;
  if bits=5 then result:=result||substr(alphabet,code+1,1); code:=0; bits:=0; end if;
 end loop; return result;
end $$;
create function private.pulse_charge_post(u uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('pulse-post:'||u::text,0));
 if (select count(*) from private.pulse_post_events where user_id=u and at>now()-interval '1 hour')>=6 then raise exception 'pulse_rate_limited'; end if;
 insert into private.pulse_post_events(user_id,at) values(u,now());
end $$;
create function private.pulse_area_center(key_value text) returns table(lat float8,lng float8) language plpgsql immutable set search_path='' as $$
declare lo_lat float8:=-90;hi_lat float8:=90;lo_lng float8:=-180;hi_lng float8:=180;code integer;bit_index integer:=0;midpoint float8;upper_half boolean;alphabet text:='0123456789bcdefghjkmnpqrstuvwxyz';
begin
 if key_value !~ '^area:[0123456789bcdefghjkmnpqrstuvwxyz]{7}$' then raise exception 'pulse_invalid_area';end if;
 for i in 6..12 loop
  code:=strpos(alphabet,substr(key_value,i,1))-1;
  for j in reverse 4..0 loop
   upper_half:=(code & (1<<j))<>0;
   if bit_index%2=0 then midpoint:=(lo_lng+hi_lng)/2;if upper_half then lo_lng:=midpoint;else hi_lng:=midpoint;end if;
   else midpoint:=(lo_lat+hi_lat)/2;if upper_half then lo_lat:=midpoint;else hi_lat:=midpoint;end if;end if;
   bit_index:=bit_index+1;
  end loop;
 end loop;
 lat:=(lo_lat+hi_lat)/2;lng:=(lo_lng+hi_lng)/2;return next;
end $$;
create function private.pulse_guard_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); existing public.pulse_reports;
begin
 if u is null or new.reporter_id<>u or not exists(select 1 from public.profiles where id=u) then raise exception 'pulse_unauthorized'; end if;
 if new.lat is null or new.lng is null or new.lat not between -90 and 90 or new.lng not between -180 and 180 or new.lat='NaN'::float8 or new.lng='NaN'::float8 or
  length(btrim(new.place_key)) not between 1 and 200 or not private.pulse_allowed(new.category,new.kind,new.value) then raise exception 'pulse_invalid_update'; end if;
 if (new.category='area' or new.place_key like 'area:%') and (new.category<>'area' or new.place_key<>private.pulse_area_key(new.lat,new.lng)) then raise exception 'pulse_invalid_area'; end if;
 if new.category='area' then select c.lat,c.lng into new.lat,new.lng from private.pulse_area_center(new.place_key) c;end if;
 new.note:=nullif(btrim(new.note),''); if length(new.note)>80 then raise exception 'pulse_note_too_long'; end if;
 if not exists(select 1 from private.pulse_batches where tx=txid_current() and user_id=u) then perform private.pulse_charge_post(u); end if;
 perform pg_advisory_xact_lock(hashtextextended('pulse-place:'||new.place_key,0));
 select * into existing from public.pulse_reports where place_key=new.place_key and expires_at>now() order by created_at,id limit 1;
 if found and (existing.category<>new.category or abs(existing.lat-new.lat)>0.00001 or abs(existing.lng-new.lng)>0.00001) then raise exception 'pulse_place_changed'; end if;
 new.id:=gen_random_uuid(); new.created_at:=now(); new.expires_at:=now()+private.pulse_ttl(new.kind,new.value); new.last_confirmed_at:=null; new.confirm_count:=0;
 delete from public.pulse_reports where reporter_id=u and place_key=new.place_key and kind=new.kind;
 return new;
end $$;
create trigger pulse_reports_guard before insert on public.pulse_reports for each row execute function private.pulse_guard_insert();

create function private.pulse_summary(p text,t timestamptz,viewer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; first_row public.pulse_reports; k text; total double precision; mean double precision; newest double precision; level integer; fresh double precision:=0; kind_fresh double precision; importance double precision:=0; conditions jsonb:='[]'; confidence jsonb:='{}'; signals jsonb:='{}'; n integer; note_value text; note_expiry timestamptz; valid_until double precision; kind_updated double precision;
begin
 select * into first_row from public.pulse_reports where place_key=p and expires_at>t order by created_at desc,id desc limit 1;
 if not found then return null; end if;
 select jsonb_build_object('placeKey',p,'lat',first_row.lat,'lng',first_row.lng,'category',first_row.category,'recentCount',count(*),'confirmCount',coalesce(max(confirm_count),0),'updatedAt',coalesce(max(extract(epoch from greatest(created_at,coalesce(last_confirmed_at,created_at)))*1000),0)) into result from public.pulse_reports where place_key=p and expires_at>t;
 foreach k in array array['crowd','wait','parking','availability','condition'] loop
  with weighted as (select *,power(0.5::float8,greatest(0,extract(epoch from (t-greatest(created_at,coalesce(last_confirmed_at,created_at))))/60)/case k when 'wait' then 15 when 'availability' then 30 when 'condition' then 180 else 20 end) w from public.pulse_reports where place_key=p and kind=k and expires_at>t)
  select sum(w),max(w),count(*),min(extract(epoch from expires_at)*1000),max(extract(epoch from greatest(created_at,coalesce(last_confirmed_at,created_at)))*1000) into total,kind_fresh,n,valid_until,kind_updated from weighted;
  if n>0 then signals:=signals||jsonb_build_object(k,jsonb_build_object('totalWeight',total,'freshness',kind_fresh,'validUntil',valid_until,'count',n,'updatedAt',kind_updated)); end if;
  if coalesce(total,0)<0.15 then continue; end if;
  fresh:=greatest(fresh,kind_fresh); confidence:=confidence||jsonb_build_object(k,n);
  if k in ('crowd','wait','parking') then
   with weighted as (select *,power(0.5::float8,greatest(0,extract(epoch from (t-greatest(created_at,coalesce(last_confirmed_at,created_at))))/60)/case k when 'wait' then 15 else 20 end) w from public.pulse_reports where place_key=p and kind=k and expires_at>t)
   select sum((value#>>'{}')::float8*w)/total into mean from weighted;
   select (value#>>'{}')::float8 into newest from public.pulse_reports where place_key=p and kind=k and expires_at>t order by greatest(created_at,coalesce(last_confirmed_at,created_at)) desc,id desc limit 1;
   if abs(mean-floor(mean)-0.5)<0.000000001 then level:=case when newest>=mean then ceil(mean)::integer else floor(mean)::integer end; else level:=floor(mean+0.5)::integer; end if;
   result:=result||jsonb_build_object(k,level); importance:=greatest(importance,level::float8/case k when 'parking' then 2 else 3 end);
  else
   select conditions||coalesce(jsonb_agg(jsonb_build_object('key',key,'strength',case when support>=2 then 'likely' else 'reported' end) order by key),'[]'::jsonb) into conditions from (select value#>>'{}' key,count(distinct reporter_id) support from public.pulse_reports where place_key=p and kind=k and expires_at>t group by value) grouped;
  end if;
 end loop;
 if jsonb_array_length(conditions)>0 then importance:=greatest(importance,case when conditions @> '[{"key":"blocked_closed"}]'::jsonb then 0.9 else 0.65 end); end if;
 select r.note,r.expires_at into note_value,note_expiry from public.pulse_reports r where r.place_key=p and r.expires_at>t and r.note is not null and not exists(select 1 from private.pulse_note_reports flag where flag.viewer_id=viewer and flag.report_id=r.id) order by r.created_at desc,r.id desc limit 1;
 result:=result||jsonb_build_object('conditions',conditions,'confidence',confidence,'freshness',least(1,fresh),'importance',importance,'generatedAt',extract(epoch from t)*1000,'signals',signals);
 if note_value is not null then result:=result||jsonb_build_object('noteSample',note_value,'noteValidUntil',extract(epoch from note_expiry)*1000); end if;
 return result;
end $$;
create function public.get_pulse_summaries(bounds jsonb,zoom double precision) returns jsonb language plpgsql security definer set search_path='' as $$
declare n double precision; s double precision; e double precision; w double precision; result jsonb;
begin
 if auth.uid() is null then raise exception 'pulse_unauthorized'; end if;
 if bounds is null or jsonb_typeof(bounds) is distinct from 'object' or jsonb_typeof(bounds->'north') is distinct from 'number' or jsonb_typeof(bounds->'south') is distinct from 'number' or jsonb_typeof(bounds->'east') is distinct from 'number' or jsonb_typeof(bounds->'west') is distinct from 'number' then raise exception 'pulse_invalid_bounds'; end if;
 n:=(bounds->>'north')::float8; s:=(bounds->>'south')::float8; e:=(bounds->>'east')::float8; w:=(bounds->>'west')::float8;
 if n is null or s is null or e is null or w is null or n not between -90 and 90 or s not between -90 and 90 or n<s or e not between -180 and 180 or w not between -180 and 180 or zoom is null or zoom not between 0 and 24 then raise exception 'pulse_invalid_bounds'; end if;
 select coalesce(jsonb_agg(summary order by (summary->>'importance')::float8*(summary->>'freshness')::float8 desc),'[]'::jsonb) into result from
 (select private.pulse_summary(place_key,now(),auth.uid()) summary from public.pulse_reports where expires_at>now() and lat between s and n and ((w<=e and lng between w and e) or (w>e and (lng>=w or lng<=e))) group by place_key order by max(created_at) desc limit 500) places;
 return result;
end $$;
create function public.post_pulse(draft jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); answer record; first_answer boolean:=true; key_value text;
begin
 if u is null or not exists(select 1 from public.profiles where id=u) then raise exception 'pulse_unauthorized'; end if;
 if draft is null or jsonb_typeof(draft) is distinct from 'object' or jsonb_typeof(draft->'answers') is distinct from 'object' or jsonb_typeof(draft->'placeKey') is distinct from 'string' or jsonb_typeof(draft->'category') is distinct from 'string' or jsonb_typeof(draft->'lat') is distinct from 'number' or jsonb_typeof(draft->'lng') is distinct from 'number' or (draft ? 'note' and jsonb_typeof(draft->'note') not in ('string','null')) then raise exception 'pulse_invalid_update'; end if;
 if (select count(*) from jsonb_object_keys(draft->'answers')) not between 1 and 5 then raise exception 'pulse_invalid_update'; end if;
 key_value:=draft->>'placeKey';
 perform private.pulse_charge_post(u);
 insert into private.pulse_batches values(txid_current(),u);
 for answer in select * from jsonb_each(draft->'answers') loop
  insert into public.pulse_reports(reporter_id,place_key,lat,lng,category,kind,value,note,expires_at) values(u,key_value,(draft->>'lat')::float8,(draft->>'lng')::float8,draft->>'category',answer.key,answer.value,case when first_answer then draft->>'note' else null end,now());
  first_answer:=false;
 end loop;
 delete from private.pulse_batches where tx=txid_current() and user_id=u;
 return private.pulse_summary(key_value,now(),u);
end $$;
create function public.confirm_pulse(place_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from public.profiles where id=u) then raise exception 'pulse_unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pulse-confirm:'||u::text||':'||place_key,0));
 if exists(select 1 from private.pulse_confirmations c where c.user_id=u and c.place_key=confirm_pulse.place_key and c.last_at>now()-interval '10 minutes') then raise exception 'pulse_confirm_cooldown'; end if;
 if not exists(select 1 from public.pulse_reports r where r.place_key=confirm_pulse.place_key and r.expires_at>now()) then raise exception 'pulse_no_active_updates'; end if;
 insert into private.pulse_confirmations values(u,confirm_pulse.place_key,now()) on conflict on constraint pulse_confirmations_pkey do update set last_at=excluded.last_at;
 update public.pulse_reports r set last_confirmed_at=now(),expires_at=least(r.created_at+2*private.pulse_ttl(r.kind,r.value),greatest(r.expires_at,now()+private.pulse_ttl(r.kind,r.value))),confirm_count=r.confirm_count+1 where r.place_key=confirm_pulse.place_key and r.expires_at>now();
 return private.pulse_summary(place_key,now(),u);
end $$;
create function public.report_pulse_note(place_key text,note_sample text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'pulse_unauthorized'; end if;
 if note_sample is null or length(note_sample) not between 1 and 80 then raise exception 'pulse_invalid_note'; end if;
 insert into private.pulse_note_reports(viewer_id,report_id) select auth.uid(),r.id from public.pulse_reports r where r.place_key=report_pulse_note.place_key and r.note=note_sample and r.expires_at>now() on conflict do nothing;
end $$;
create function public.cleanup_pulse_reports() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.pulse_reports where expires_at<=now();
 delete from private.pulse_post_events where at<=now()-interval '1 day';
 delete from private.pulse_confirmations where last_at<=now()-interval '1 day';
end $$;
revoke all on function private.pulse_ttl(text,jsonb),private.pulse_allowed(text,text,jsonb),private.pulse_area_key(float8,float8),private.pulse_area_center(text),private.pulse_charge_post(uuid),private.pulse_guard_insert(),private.pulse_summary(text,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.get_pulse_summaries(jsonb,float8),public.post_pulse(jsonb),public.confirm_pulse(text),public.report_pulse_note(text,text),public.cleanup_pulse_reports() from public,anon,authenticated;
grant execute on function public.get_pulse_summaries(jsonb,float8),public.post_pulse(jsonb),public.confirm_pulse(text),public.report_pulse_note(text,text) to authenticated;
grant execute on function public.cleanup_pulse_reports() to service_role;
