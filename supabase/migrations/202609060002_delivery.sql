-- Only service-role workers can lease notifications or run maintenance.
create function public.beacon_maintenance() returns void language plpgsql security definer set search_path='' as $$
declare h public.habits; a public.activities; recipient uuid; key text; inserted int;
begin
 delete from public.locations where expires_at<=now();
 delete from private.usage_events where created_at<now()-interval '90 days';
 delete from private.requests where created_at<now()-interval '7 days';
 delete from private.action_limits where bucket<now()-interval '1 day';
 delete from public.reports where created_at<now()-interval '90 days';
 delete from public.notices where created_at<now()-interval '30 days';
 delete from private.reminder_log where created_at<now()-interval '90 days';
 for h in select * from public.habits where reminder_hour is not null loop
  if extract(hour from now() at time zone h.timezone)::int=h.reminder_hour
   and (h.schedule='weekly' or extract(dow from now() at time zone h.timezone)::int=any(h.weekdays))
   and not exists(select 1 from public.checkins where habit_id=h.id and local_date=(now() at time zone h.timezone)::date) then
   key:='habit:'||h.id||':'||(now() at time zone h.timezone)::date;
   insert into private.reminder_log values(key,now()) on conflict do nothing;
   get diagnostics inserted=row_count;
   if inserted=1 then perform private.notify(h.owner_id,null,'A little time for your habits?'); end if;
  end if;
 end loop;
 for a in select * from public.activities where status='scheduled' and starts_at>now() and starts_at<=now()+interval '30 minutes' loop
  for recipient in select owner_id from public.activities where id=a.id union select user_id from public.rsvps where activity_id=a.id and status='going' loop
   key:='activity:'||a.id||':'||a.starts_at||':'||recipient;
   insert into private.reminder_log values(key,now()) on conflict do nothing;
   get diagnostics inserted=row_count;
   if inserted=1 then perform private.notify(recipient,null,'An activity you’re going to starts soon.',a.id); end if;
  end loop;
 end loop;
end $$;
create function public.beacon_claim_push() returns jsonb language plpgsql security definer set search_path='' as $$
declare q private.push_queue; n public.notices; p public.profiles; hr int; valid boolean; result jsonb:='[]'; old_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 for q in select * from private.push_queue where not done and attempts<5 and available_at<=now() and (lease_until is null or lease_until<now()) order by available_at limit 50 for update skip locked loop
  select * into n from public.notices where id=q.notice_id;
  select * into p from public.profiles where id=n.recipient_id;
  perform set_config('request.jwt.claim.sub',n.recipient_id::text,true);
  valid:=p.id is not null and exists(select 1 from public.push_tokens where token=q.token and user_id=n.recipient_id)
    and (n.actor_id is null or not private.blocked(n.actor_id)) and (n.activity_id is null or private.can_activity(n.activity_id));
  if not valid then update private.push_queue set done=true where id=q.id; continue; end if;
  hr:=extract(hour from now() at time zone p.timezone);
  if (p.quiet_start<p.quiet_end and hr>=p.quiet_start and hr<p.quiet_end) or (p.quiet_start>p.quiet_end and (hr>=p.quiet_start or hr<p.quiet_end)) then
   update private.push_queue set available_at=now()+interval '15 minutes' where id=q.id; continue;
  end if;
  update private.push_queue set lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=q.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',q.id,'token',q.token,'body',n.body));
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return result;
end $$;
create function public.beacon_finish_push(job_id uuid,ticket text default null,invalid_token boolean default false,retry boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if invalid_token then delete from public.push_tokens where token=(select token from private.push_queue where id=job_id); end if;
 update private.push_queue set done=not retry or attempts>=5,ticket_id=ticket,lease_until=null,available_at=now()+interval '5 minutes' where id=job_id;
end $$;
create function public.beacon_claim_receipts() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with leased as (
  update private.push_queue set lease_until=now()+interval '5 minutes'
  where id in(select id from private.push_queue where done and ticket_id is not null and not receipt_checked and available_at<now()-interval '15 minutes' and (lease_until is null or lease_until<now()) limit 100 for update skip locked)
  returning id,ticket_id,token
 ) select coalesce(jsonb_agg(to_jsonb(leased)),'[]') into result from leased;
 return result;
end $$;
create function public.beacon_finish_receipt(job_id uuid,invalid_token boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if invalid_token then delete from public.push_tokens where token=(select token from private.push_queue where id=job_id); end if;
 update private.push_queue set receipt_checked=true,lease_until=null where id=job_id;
end $$;
revoke all on function public.beacon_maintenance(),public.beacon_claim_push(),public.beacon_finish_push(uuid,text,boolean,boolean),public.beacon_claim_receipts(),public.beacon_finish_receipt(uuid,boolean) from public,anon,authenticated;
grant execute on function public.beacon_maintenance(),public.beacon_claim_push(),public.beacon_finish_push(uuid,text,boolean,boolean),public.beacon_claim_receipts(),public.beacon_finish_receipt(uuid,boolean) to service_role;
