-- Boat rentals now use a flat route price rather than per-person pricing.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transport_routes'
      and column_name = 'price_per_trip'
  ) then
    alter table public.transport_routes
      rename column price_per_trip to route_price;
  end if;
end $$;

alter table public.transport_routes
  drop constraint if exists transport_routes_price_per_trip_check;

alter table public.transport_routes
  drop constraint if exists transport_routes_route_price_check;

alter table public.transport_routes
  add constraint transport_routes_route_price_check
  check (route_price >= 0);
