-- Optional Phase 4A UI progress. No changes to registration or the survey gate.
create table public.onboarding_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key in (
    'entry.eligible.v1','welcome.seen.v1','welcome.dismissed.v1',
    'tip.ping.v1','tip.vote.v1','tip.plan.v1','tip.visibility.v1','tip.sonar.v1','tip.routine.v1',
    'success.firstBeacon.v1','success.firstConnection.v1','success.firstCompletion.v1'
  )),
  created_at timestamptz not null default now(),
  primary key (user_id,key)
);
alter table public.onboarding_progress enable row level security;
revoke all on public.onboarding_progress from public, anon, authenticated;
grant select,insert on public.onboarding_progress to authenticated;
create policy onboarding_read on public.onboarding_progress for select to authenticated
  using (user_id=(select auth.uid()));
create policy onboarding_mark on public.onboarding_progress for insert to authenticated
  with check (user_id=(select auth.uid()) and key<>'entry.eligible.v1');

-- Existing empty accounts are deliberately not backfilled as new accounts.
create function private.mark_first_profile_entry() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.onboarding_progress(user_id,key) values(new.id,'entry.eligible.v1') on conflict do nothing;
  return new;
end $$;
revoke all on function private.mark_first_profile_entry() from public,anon,authenticated;
create trigger onboarding_first_profile after insert on public.profiles
  for each row execute function private.mark_first_profile_entry();

create function public.claim_onboarding_progress(progress_key text, expected_viewer uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare uid uuid:=auth.uid(); affected integer;
begin
  if uid is null then raise exception 'Sign in to save progress.'; end if;
  if expected_viewer is distinct from uid then raise exception 'Your account changed. Reload before saving progress.'; end if;
  if progress_key='entry.eligible.v1' then raise exception 'First entry is server-owned.'; end if;
  -- An old or partial snapshot cannot establish a first achievement.
  if progress_key like 'success.%' then
    if not exists(select 1 from public.onboarding_progress where user_id=uid and key='entry.eligible.v1') then return false; end if;
    if progress_key='success.firstBeacon.v1' and (select count(*) from public.activities where owner_id=uid and mode<>'solo')<>1 then return false; end if;
    if progress_key='success.firstConnection.v1' and (select count(*) from public.friendships where status='accepted' and uid in (sender_id,recipient_id))<>1 then return false; end if;
    if progress_key='success.firstCompletion.v1' and (select count(*) from public.activities where owner_id=uid and status='completed' and mode<>'solo')<>1 then return false; end if;
  end if;
  insert into public.onboarding_progress(user_id,key) values(uid,progress_key) on conflict do nothing;
  get diagnostics affected = row_count;
  return affected=1;
end $$;
revoke all on function public.claim_onboarding_progress(text,uuid) from public,anon;
grant execute on function public.claim_onboarding_progress(text,uuid) to authenticated;
