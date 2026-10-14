-- Bounded, read-only calendar projection. The private occurrence ledger stays private.
create function public.calendar_routine_occurrences(start_on date,end_on date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); routine record; child public.plans; occurrence private.plan_routine_occurrences;
 candidate date; lower_on date; rows jsonb:='[]'::jsonb; entry jsonb; truncated boolean:=false;
begin
 if uid is null then raise exception 'Sign in to view your calendar.'; end if;
 if start_on is null or end_on is null or end_on<start_on or end_on-start_on>61 then raise exception 'Choose a calendar range of 1 to 62 days.'; end if;
 for routine in select r.*,p.timezone,p.start_date from public.plan_routines r join public.plans p on p.id=r.plan_id
  where r.status='active' and r.run_mode='scheduled' and p.status='scheduled'
   and private.plan_routine_source_is_active(p.id)
   -- Preserve both Plan and Routine RLS visibility, then narrow to personal owned/joined schedules.
   and (p.owner_id=uid or (p.squad_id is not null and private.member(p.squad_id) and not private.blocked(p.owner_id)))
   and (p.owner_id=uid or exists(select 1 from public.plan_members m where m.plan_id=p.id and m.user_id=uid))
  order by r.id loop
  lower_on:=greatest(start_on,(now() at time zone routine.timezone)::date);
  candidate:=private.next_plan_routine_date(routine.anchor_date,routine.weekdays,routine.interval_weeks,lower_on-1,routine.ends_on);
  while candidate is not null and candidate<=end_on loop
   entry:=null;
   select * into occurrence from private.plan_routine_occurrences o where o.routine_id=routine.id and o.occurrence_on=candidate;
   if found then
    if occurrence.status='created' and occurrence.occurrence_plan_id is not null then
     select * into child from public.plans where id=occurrence.occurrence_plan_id;
     if found and child.status='scheduled' and (child.owner_id=uid or (child.squad_id is not null and private.member(child.squad_id) and not private.blocked(child.owner_id))) then
      entry:=jsonb_build_object('routine_id',routine.id,'plan_id',routine.plan_id,'occurrence_on',candidate,'state','materialized','occurrence_plan_id',child.id);
     end if;
    end if;
    -- Skipped, missing, unreadable or cancelled child records never turn back into projections.
   elsif routine.next_occurrence_on is not null and candidate>=routine.next_occurrence_on then
    entry:=jsonb_build_object('routine_id',routine.id,'plan_id',routine.plan_id,'occurrence_on',candidate,'state','projected');
   end if;
   if entry is not null then
    if jsonb_array_length(rows)>=500 then truncated:=true; exit; end if;
    rows:=rows||jsonb_build_array(entry);
   end if;
   candidate:=private.next_plan_routine_date(routine.anchor_date,routine.weekdays,routine.interval_weeks,candidate,routine.ends_on);
  end loop;
  if truncated then exit; end if;
 end loop;
 return jsonb_build_object('viewer_id',uid,'rows',rows,'truncated',truncated,'limit',500);
end $$;
revoke all on function public.calendar_routine_occurrences(date,date) from public,anon;
grant execute on function public.calendar_routine_occurrences(date,date) to authenticated;
