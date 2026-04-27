-- Rename transport terminology to boat rental terminology while preserving
-- the existing route-based booking behavior.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'boats'
      and column_name = 'is_available_for_transport'
  ) then
    alter table public.boats
      rename column is_available_for_transport to is_available_for_rental;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'beach_houses'
      and column_name = 'transport_price'
  ) then
    alter table public.beach_houses
      rename column transport_price to rental_price;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'transport_type'
  ) then
    alter table public.bookings
      rename column transport_type to rental_type;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'transport_route_id'
  ) then
    alter table public.bookings
      rename column transport_route_id to rental_route_id;
  end if;
end $$;

alter table public.bookings drop constraint if exists bookings_booking_type_check;
alter table public.bookings drop constraint if exists no_overlapping_beach_house_bookings;

update public.bookings
set booking_type = 'boat_rental'
where booking_type = 'transport';

alter table public.bookings
  add constraint bookings_booking_type_check
  check (booking_type in ('boat_cruise', 'beach_house', 'boat_rental'));

alter table public.bookings
  add constraint no_overlapping_beach_house_bookings
  exclude using gist (
    beach_house_id with =,
    booking_range with &&
  )
  where (
    status in ('pending', 'confirmed')
    and beach_house_id is not null
    and booking_type <> 'boat_rental'
  );
