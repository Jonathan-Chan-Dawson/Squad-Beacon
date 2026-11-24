alter table private.beacon_score_awards drop constraint beacon_score_awards_kind_check;
alter table private.beacon_score_awards add constraint beacon_score_awards_kind_check
  check (kind in ('tap','legacy','attend','host','joined','friend','comment','message','reaction',
    'activity_note','status_note','note_reaction'));

create function private.award_published_note_score()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Activity Note creation inserts a solo row and sets its purpose in the same transaction.
  insert into private.beacon_score_awards(owner_id,kind,source,points)
  select a.owner_id,a.solo_purpose,to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD'),250
  from public.activities a
  where a.id=new.id and a.owner_id=auth.uid() and a.mode='solo' and a.status='scheduled'
  on conflict(owner_id,kind,source) do nothing;
  return null;
end $$;

create constraint trigger beacon_note_score_on_publish
after insert on public.activities deferrable initially deferred
for each row when (new.mode='solo') execute function private.award_published_note_score();

create function private.award_note_reaction_score()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into private.beacon_score_awards(owner_id,kind,source,points)
  select a.owner_id,'note_reaction',a.id::text||':'||new.user_id::text,10
  from public.activities a
  where a.id=new.activity_id and a.mode='solo' and a.status='scheduled'
    and a.enable_reactions and a.starts_at<=now() and a.ends_at>now()
    and a.owner_id<>new.user_id and new.user_id=auth.uid()
    and private.can_activity(a.id) and not private.blocked(a.owner_id)
  on conflict(owner_id,kind,source) do nothing;
  return null;
end $$;

create trigger beacon_note_score_on_reaction after insert on public.reactions
for each row execute function private.award_note_reaction_score();

revoke all on function private.award_published_note_score(),private.award_note_reaction_score()
  from public,anon,authenticated;

alter function public.sync_beacon_score(uuid,uuid,bigint,bigint,boolean) rename to sync_beacon_score_before_note_awards;
revoke all on function public.sync_beacon_score_before_note_awards(uuid,uuid,bigint,bigint,boolean) from public,anon,authenticated;

create function public.sync_beacon_score(
  p_owner uuid, p_stream uuid, p_taps bigint, p_legacy bigint, p_show_badge boolean default null
) returns jsonb language sql security definer set search_path='' as $$
  select jsonb_set(result,'{rewards}',result->'rewards'||'{"activity_note":250,"status_note":250,"note_reaction":10}'::jsonb)
  from public.sync_beacon_score_before_note_awards(p_owner,p_stream,p_taps,p_legacy,p_show_badge) result;
$$;
revoke all on function public.sync_beacon_score(uuid,uuid,bigint,bigint,boolean) from public,anon;
grant execute on function public.sync_beacon_score(uuid,uuid,bigint,bigint,boolean) to authenticated;
