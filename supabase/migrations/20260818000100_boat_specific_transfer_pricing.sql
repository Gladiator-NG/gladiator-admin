-- Price each directional transfer route per boat. A row represents the full
-- price for one boat on one route; route-level prices remain only as legacy
-- data while existing bookings and older clients are phased out.

create table if not exists public.boat_transfer_prices (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete cascade,
  price numeric not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (boat_id, route_id)
);

create index if not exists boat_transfer_prices_route_idx
  on public.boat_transfer_prices (route_id);

create index if not exists boat_transfer_prices_boat_idx
  on public.boat_transfer_prices (boat_id);

drop trigger if exists boat_transfer_prices_updated_at on public.boat_transfer_prices;
create trigger boat_transfer_prices_updated_at
  before update on public.boat_transfer_prices
  for each row execute function public.handle_updated_at();

-- Preserve the currently configured price for eligible boats. This prevents
-- routes from disappearing as soon as the new application code is deployed;
-- admins can then give each vessel its real price.
insert into public.boat_transfer_prices (boat_id, route_id, price)
select b.id, r.id, r.route_price
from public.transport_routes r
join public.locations origin on origin.id = r.from_location_id
join public.boats b
  on b.is_available_for_rental = true
 and (
   b.jetty_location_id = r.from_location_id
   or (
     b.jetty_location_id is null
     and b.pickup_location = origin.name
   )
 )
where r.route_price is not null
on conflict (boat_id, route_id) do nothing;

alter table public.boat_transfer_prices enable row level security;

drop policy if exists "Admins can manage boat transfer prices"
  on public.boat_transfer_prices;
create policy "Admins can manage boat transfer prices"
  on public.boat_transfer_prices for all
  to authenticated using (true) with check (true);

drop policy if exists "Anyone can read active boat transfer prices"
  on public.boat_transfer_prices;
create policy "Anyone can read active boat transfer prices"
  on public.boat_transfer_prices for select
  to anon
  using (
    is_active = true
    and exists (
      select 1 from public.boats
      where boats.id = boat_transfer_prices.boat_id
        and boats.is_active = true
        and boats.is_available_for_rental = true
    )
    and exists (
      select 1 from public.transport_routes
      where transport_routes.id = boat_transfer_prices.route_id
        and transport_routes.is_active = true
    )
  );

grant select on public.boat_transfer_prices to anon;
grant select, insert, update, delete on public.boat_transfer_prices to authenticated;

-- New transfer rows always use the configured full boat/route price. Existing
-- round-trip rows are untouched; only future inserts are rejected.
create or replace function public.enforce_new_boat_transfer_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price numeric;
begin
  if new.booking_type <> 'boat_rental' then
    return new;
  end if;

  if new.rental_type = 'round_trip' then
    raise exception 'Round-trip transfers are no longer offered. Book each direction separately.';
  end if;

  select price
  into v_price
  from public.boat_transfer_prices
  where boat_id = new.boat_id
    and route_id = new.rental_route_id
    and is_active = true;

  if not found then
    raise exception 'That vessel is not priced for the selected transfer route.';
  end if;

  new.total_amount := v_price;
  new.hours := null;
  new.rental_type := coalesce(new.rental_type, 'outbound');
  return new;
end;
$$;

drop trigger if exists enforce_new_boat_transfer_price on public.bookings;
create trigger enforce_new_boat_transfer_price
  before insert on public.bookings
  for each row execute function public.enforce_new_boat_transfer_price();

create or replace function public.submit_public_boat_transfer_request(
  p_asset_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default '',
  p_guest_count integer default 1,
  p_start_date date default null,
  p_start_time time default null,
  p_rental_type text default 'outbound',
  p_rental_route_id uuid default null,
  p_parent_beach_house_booking_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_boat public.boats%rowtype;
  v_route public.transport_routes%rowtype;
  v_parent_booking public.bookings%rowtype;
  v_house public.beach_houses%rowtype;
  v_parent_reference text := nullif(upper(trim(p_parent_beach_house_booking_reference)), '');
  v_customer_id uuid;
  v_booking_id uuid;
  v_reference_code text;
  v_price numeric;
  v_end_time time;
  v_pickup text;
  v_dropoff text;
  v_rental_type text := coalesce(nullif(p_rental_type, ''), 'outbound');
begin
  if nullif(trim(p_customer_name), '') is null
    or nullif(trim(p_customer_email), '') is null
    or nullif(trim(p_customer_phone), '') is null then
    raise exception 'Name, email and phone are required.';
  end if;

  if p_guest_count < 1 or p_start_date is null or p_start_time is null then
    raise exception 'Please provide valid transfer details.';
  end if;

  if v_rental_type = 'round_trip' then
    raise exception 'Round-trip transfers are no longer offered. Book each direction separately.';
  end if;

  if v_rental_type not in ('outbound', 'return') then
    raise exception 'Please select a valid journey type.';
  end if;

  select * into v_boat
  from public.boats
  where id = p_asset_id
    and is_active = true
    and is_available_for_rental = true;

  if not found then
    raise exception 'That vessel is not available for transfers.';
  end if;

  if p_guest_count > coalesce(v_boat.max_guests, p_guest_count) then
    raise exception 'The guest count exceeds this vessel capacity.';
  end if;

  select * into v_route
  from public.transport_routes
  where id = p_rental_route_id and is_active = true;

  if not found then
    raise exception 'Please choose an available transfer route.';
  end if;

  select price into v_price
  from public.boat_transfer_prices
  where boat_id = p_asset_id
    and route_id = p_rental_route_id
    and is_active = true;

  if not found then
    raise exception 'That vessel is not priced for the selected transfer route.';
  end if;

  select name into v_pickup from public.locations where id = v_route.from_location_id;
  select name into v_dropoff from public.locations where id = v_route.to_location_id;
  v_end_time := (
    p_start_time + (coalesce(v_route.duration_hours, 1) * interval '1 hour')
  )::time;

  if v_parent_reference is not null then
    select * into v_parent_booking
    from public.bookings
    where upper(reference_code) = v_parent_reference
    limit 1;

    if not found or v_parent_booking.booking_type <> 'beach_house' then
      raise exception 'Please provide a valid waterfront stay booking number.';
    end if;

    if v_parent_booking.status in ('cancelled', 'expired') then
      raise exception 'That waterfront stay booking is not active.';
    end if;

    select * into v_house
    from public.beach_houses
    where id = v_parent_booking.beach_house_id;

    if not found then
      raise exception 'The linked waterfront stay could not be verified.';
    end if;

    if v_route.to_location_id = v_house.arrival_jetty_location_id then
      v_rental_type := 'outbound';
    elsif v_route.from_location_id = v_house.arrival_jetty_location_id then
      v_rental_type := 'return';
    else
      raise exception 'Please choose a route connected to the linked waterfront stay.';
    end if;
  end if;

  if public.check_public_availability(
    'boat', p_asset_id, p_start_date, p_start_date, p_start_time, v_end_time
  ) is not true then
    raise exception 'That time is no longer available. Please select another option.';
  end if;

  select id into v_customer_id
  from public.customers
  where lower(email) = lower(trim(p_customer_email))
  limit 1;

  if v_customer_id is null then
    insert into public.customers (full_name, email, phone)
    values (trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone))
    returning id into v_customer_id;
  end if;

  insert into public.bookings (
    booking_type, boat_id, parent_beach_house_booking_id, customer_id,
    customer_name, customer_email, customer_phone, guest_count,
    start_date, end_date, start_time, end_time, hours, rental_type,
    rental_route_id, pickup_location, dropoff_location, total_amount,
    status, payment_status, source, notes
  ) values (
    'boat_rental', p_asset_id, v_parent_booking.id, v_customer_id,
    trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone),
    p_guest_count, p_start_date, p_start_date, p_start_time, v_end_time, null,
    v_rental_type, p_rental_route_id, v_pickup, v_dropoff, v_price,
    'pending', 'pending', 'web', nullif(trim(p_notes), '')
  )
  returning id, reference_code into v_booking_id, v_reference_code;

  return jsonb_build_object(
    'id', v_booking_id,
    'reference_code', v_reference_code,
    'total_amount', v_price,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.submit_public_boat_transfer_request(
  uuid, text, text, text, integer, date, time, text, uuid, text, text
) from public;
grant execute on function public.submit_public_boat_transfer_request(
  uuid, text, text, text, integer, date, time, text, uuid, text, text
) to anon, authenticated, service_role;

create or replace function public.confirm_public_boat_transfer_payment(
  p_payment_reference text,
  p_expected_total numeric,
  p_currency text,
  p_asset_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default '',
  p_guest_count integer default 1,
  p_start_date date default null,
  p_start_time time default null,
  p_rental_type text default 'outbound',
  p_rental_route_id uuid default null,
  p_parent_beach_house_booking_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.bookings%rowtype;
  v_created jsonb;
  v_booking_id uuid;
  v_total numeric;
begin
  if nullif(trim(p_payment_reference), '') is null then
    raise exception 'Payment reference is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(trim(p_payment_reference), 0));

  select * into v_existing
  from public.bookings
  where payment_reference = trim(p_payment_reference)
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'reference_code', v_existing.reference_code,
      'status', v_existing.status,
      'payment_status', v_existing.payment_status,
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency
    );
  end if;

  v_created := public.submit_public_boat_transfer_request(
    p_asset_id, p_customer_name, p_customer_email, p_customer_phone,
    p_guest_count, p_start_date, p_start_time, p_rental_type,
    p_rental_route_id, p_parent_beach_house_booking_reference, p_notes
  );

  v_booking_id := (v_created->>'id')::uuid;
  select total_amount into v_total from public.bookings where id = v_booking_id;

  if v_total is distinct from p_expected_total then
    raise exception 'The booking price changed after payment was initialized.';
  end if;

  update public.bookings
  set payment_reference = trim(p_payment_reference),
      payment_status = 'paid',
      status = 'confirmed',
      currency = upper(trim(p_currency))
  where id = v_booking_id
  returning * into v_existing;

  return jsonb_build_object(
    'id', v_existing.id,
    'reference_code', v_existing.reference_code,
    'status', v_existing.status,
    'payment_status', v_existing.payment_status,
    'total_amount', v_existing.total_amount,
    'currency', v_existing.currency
  );
end;
$$;

revoke all on function public.confirm_public_boat_transfer_payment(
  text, numeric, text, uuid, text, text, text, integer, date, time,
  text, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.confirm_public_boat_transfer_payment(
  text, numeric, text, uuid, text, text, text, integer, date, time,
  text, uuid, text, text
) to service_role;

notify pgrst, 'reload schema';
