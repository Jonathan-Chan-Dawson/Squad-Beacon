-- Server-only billing protection. Search text and place results are never stored.
create table private.places_search_budgets (
  bucket text not null,
  hour timestamptz not null,
  hits integer not null,
  primary key (bucket, hour)
);
revoke all on private.places_search_budgets from public, anon, authenticated;

create function public.reserve_places_search(account_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from public.profiles where id = account_id) then
    raise exception 'Complete your profile to search places.';
  end if;
  insert into private.places_search_budgets values ('app', date_trunc('hour', now()), 1)
    on conflict (bucket, hour) do update set hits = private.places_search_budgets.hits + 1 returning hits into n;
  if n > 1000 then raise exception 'Place search is busy. Please try again later.'; end if;
  insert into private.places_search_budgets values (account_id::text, date_trunc('hour', now()), 1)
    on conflict (bucket, hour) do update set hits = private.places_search_budgets.hits + 1 returning hits into n;
  if n > 30 then raise exception 'Too many place searches. Please try again later.'; end if;
  delete from private.places_search_budgets where hour < now() - interval '2 days';
end $$;
revoke all on function public.reserve_places_search(uuid) from public, anon, authenticated;
grant execute on function public.reserve_places_search(uuid) to service_role;
