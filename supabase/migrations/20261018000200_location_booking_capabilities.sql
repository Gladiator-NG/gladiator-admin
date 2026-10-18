-- Locations are used for two different products and the two are not
-- interchangeable: a waterfront destination can be a valid boat-transfer
-- endpoint while never being a place a yacht cruise departs from.
--
-- `is_active` stays the master switch (hide the location everywhere). These two
-- capability flags narrow it per product. Both default to true and existing
-- rows are backfilled to true, so current behaviour is preserved exactly until
-- an admin turns a capability off.

alter table public.locations
  add column if not exists available_for_cruises boolean not null default true;

alter table public.locations
  add column if not exists available_for_transfers boolean not null default true;

-- Backfill: every existing location keeps both capabilities, matching the
-- behaviour before this migration (any active location could be used for
-- either product). Operators narrow individual locations from the admin UI.
update public.locations
set available_for_cruises = true
where available_for_cruises is null;

update public.locations
set available_for_transfers = true
where available_for_transfers is null;

create index if not exists locations_cruise_capability_idx
  on public.locations (available_for_cruises)
  where is_active = true;

create index if not exists locations_transfer_capability_idx
  on public.locations (available_for_transfers)
  where is_active = true;

-- ── Server-side enforcement ──────────────────────────────────────────────────
-- Frontend filtering is a convenience only. Both public booking entry points
-- re-check the capability, so a crafted request cannot book a cruise from a
-- transfer-only jetty. Each function below is the current definition with the
-- capability check added.

create or replace function public.submit_public_booking_request(
  p_booking_type text,
  p_asset_id uuid,
  p_booking_mode text default null,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_phone text default '',
  p_guest_count integer default 1,
  p_start_date date default null,
  p_end_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_hours numeric default null,
  p_rental_type text default null,
  p_rental_route_id uuid default null,
  p_parent_beach_house_booking_reference text default null,
  p_notes text default null,
  p_pickup_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_boat public.boats%rowtype;
  v_house public.beach_houses%rowtype;
  v_route public.transport_routes%rowtype;
  v_parent_booking public.bookings%rowtype;
  v_parent_reference text := nullif(upper(trim(p_parent_beach_house_booking_reference)), '');
  v_customer_id uuid;
  v_booking_id uuid;
  v_reference_code text;
  v_total numeric;
  v_hours numeric;
  v_start_time time;
  v_end_time time;
  v_start_date date := p_start_date;
  v_end_date date := p_end_date;
  v_pickup text;
  v_dropoff text;
  v_available boolean;
  v_nights integer;
  v_multiplier integer := case when p_rental_type = 'round_trip' then 2 else 1 end;
  v_extra_guests integer := 0;
  v_extra_guest_charge numeric := 0;
  v_location_allows_cruises boolean;
begin
  if p_booking_type not in ('boat_cruise', 'beach_house', 'boat_rental') then
    raise exception 'Please choose a valid experience.';
  end if;

  if v_parent_reference is not null and p_booking_type <> 'boat_rental' then
    raise exception 'Beach house booking references can only be linked to boat transfers.';
  end if;

  if nullif(trim(p_customer_name), '') is null
    or nullif(trim(p_customer_email), '') is null
    or nullif(trim(p_customer_phone), '') is null then
    raise exception 'Name, email and phone are required.';
  end if;

  if p_guest_count < 1 or p_start_date is null then
    raise exception 'Please provide valid booking details.';
  end if;

  if p_booking_type in ('boat_cruise', 'boat_rental') then
    select *
    into v_boat
    from public.boats
    where id = p_asset_id and is_active = true;

    if not found then
      raise exception 'That vessel is no longer available.';
    end if;

    if p_guest_count > coalesce(v_boat.max_guests, p_guest_count) then
      raise exception 'The guest count exceeds this vessel capacity.';
    end if;

    if p_start_time is null then
      raise exception 'Please choose a departure time.';
    end if;

    v_start_time := p_start_time;
    v_start_date := p_start_date;
    v_end_date := p_start_date;

    if p_booking_type = 'boat_cruise' then
      v_hours := p_hours;
      if v_hours is null
        or v_hours < coalesce(v_boat.min_booking_hours, 1)
        or (
          v_boat.max_booking_hours is not null
          and v_hours > v_boat.max_booking_hours
        ) then
        raise exception 'Please choose a valid charter duration.';
      end if;
      v_end_time := (v_start_time + (v_hours * interval '1 hour'))::time;
      v_total := v_boat.price_per_hour * v_hours;

      -- The customer picks any active jetty; the boat is not bound to one.
      -- When the caller omits it (a website build predating this change), fall
      -- back to the boat's legacy pickup_location so an in-flight deploy does
      -- not start rejecting cruise bookings.
      if p_pickup_location_id is not null then
        select name, available_for_cruises
        into v_pickup, v_location_allows_cruises
        from public.locations
        where id = p_pickup_location_id and is_active = true;

        if not found then
          raise exception 'Please choose an available pickup jetty.';
        end if;

        if v_location_allows_cruises is not true then
          raise exception
            'Yacht cruises do not depart from %. Please choose a different pickup jetty.',
            v_pickup;
        end if;
      else
        v_pickup := v_boat.pickup_location;
      end if;
    else
      if v_boat.is_available_for_rental is not true then
        raise exception 'That vessel is not available for transfers.';
      end if;
      if p_rental_type not in ('outbound', 'return', 'round_trip') then
        raise exception 'Please select a valid journey type.';
      end if;

      select *
      into v_route
      from public.transport_routes
      where id = p_rental_route_id and is_active = true;

      if not found then
        raise exception 'Please choose an available transfer route.';
      end if;

      v_hours := coalesce(v_route.duration_hours, 1) * v_multiplier;
      v_total := v_route.route_price * v_multiplier;

      if p_rental_type = 'round_trip' then
        if p_end_date is null or p_end_time is null then
          raise exception 'Please choose a return date and time.';
        end if;
        if p_end_date < p_start_date
          or (p_end_date = p_start_date and p_end_time <= p_start_time) then
          raise exception 'Return pickup must be after outbound pickup.';
        end if;
        v_end_date := p_end_date;
        v_end_time := p_end_time;
      else
        v_end_date := p_start_date;
        v_end_time := (v_start_time + (coalesce(v_route.duration_hours, 1) * interval '1 hour'))::time;
      end if;

      select name into v_pickup from public.locations where id = v_route.from_location_id;
      select name into v_dropoff from public.locations where id = v_route.to_location_id;

      if v_parent_reference is not null then
        select *
        into v_parent_booking
        from public.bookings
        where upper(reference_code) = v_parent_reference
        limit 1;

        if not found or v_parent_booking.booking_type <> 'beach_house' then
          raise exception 'Please provide a valid waterfront stay booking number.';
        end if;

        if v_parent_booking.status in ('cancelled', 'expired') then
          raise exception 'That waterfront stay booking is not active.';
        end if;

        select *
        into v_house
        from public.beach_houses
        where id = v_parent_booking.beach_house_id;

        if not found then
          raise exception 'The linked waterfront stay could not be verified.';
        end if;

        if p_rental_type = 'return'
          and v_route.from_location_id is distinct from v_house.arrival_jetty_location_id then
          raise exception 'Please choose a route that starts from the linked waterfront stay.';
        end if;

        if p_rental_type <> 'return'
          and v_route.to_location_id is distinct from v_house.arrival_jetty_location_id then
          raise exception 'Please choose a route that goes to the linked waterfront stay.';
        end if;

        v_total := coalesce(v_house.rental_price, v_route.route_price) * v_multiplier;
      end if;
    end if;

    v_available := public.check_public_availability(
      'boat', p_asset_id, v_start_date, v_end_date, v_start_time, v_end_time
    );
  else
    select *
    into v_house
    from public.beach_houses
    where id = p_asset_id and is_active = true;

    if not found then
      raise exception 'That residence is no longer available.';
    end if;

    if p_guest_count > coalesce(v_house.max_guests, p_guest_count) then
      if v_house.extra_guest_fee_per_head is null then
        raise exception 'The guest count exceeds this residence capacity.';
      end if;
      v_extra_guests := p_guest_count - v_house.max_guests;
      v_extra_guest_charge := v_extra_guests * v_house.extra_guest_fee_per_head;
    end if;

    if p_booking_mode = 'day_use' then
      v_start_date := p_start_date;
      v_end_date := p_start_date;
      v_start_time := p_start_time;
      v_hours := p_hours;

      if v_start_time is null
        or v_hours is null
        or v_hours < coalesce(v_house.day_use_min_hours, 1)
        or (
          v_house.day_use_max_hours is not null
          and v_hours > v_house.day_use_max_hours
        ) then
        raise exception 'Please choose valid day-use hours.';
      end if;

      v_end_time := (v_start_time + (v_hours * interval '1 hour'))::time;
      v_total := v_house.day_use_price_per_hour * v_hours + v_extra_guest_charge;
    else
      v_nights := p_end_date - p_start_date;
      if p_booking_mode <> 'overnight' or v_nights < 1 then
        raise exception 'An overnight stay needs a valid check-out date.';
      end if;

      v_end_date := p_end_date;
      v_start_time := coalesce(p_start_time, v_house.check_in_time);
      v_end_time := coalesce(p_end_time, v_house.check_out_time);
      v_total := v_house.price_per_night * v_nights + v_extra_guest_charge;
    end if;

    v_available := public.check_public_availability(
      'beach_house', p_asset_id, v_start_date, v_end_date, v_start_time, v_end_time
    );
  end if;

  if v_total is null or v_total < 0 then
    raise exception 'Pricing is not configured for this experience.';
  end if;

  if v_available is not true then
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
    booking_type,
    boat_id,
    beach_house_id,
    beach_house_booking_mode,
    parent_beach_house_booking_id,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    guest_count,
    start_date,
    end_date,
    start_time,
    end_time,
    hours,
    rental_type,
    rental_route_id,
    pickup_location,
    dropoff_location,
    total_amount,
    status,
    payment_status,
    source,
    notes
  ) values (
    p_booking_type,
    case when p_booking_type in ('boat_cruise', 'boat_rental') then p_asset_id end,
    case when p_booking_type = 'beach_house' then p_asset_id end,
    case when p_booking_type = 'beach_house' then p_booking_mode end,
    case when p_booking_type = 'boat_rental' then v_parent_booking.id end,
    v_customer_id,
    trim(p_customer_name),
    lower(trim(p_customer_email)),
    trim(p_customer_phone),
    p_guest_count,
    v_start_date,
    v_end_date,
    v_start_time,
    v_end_time,
    case when v_hours is not null then ceil(v_hours)::smallint end,
    case when p_booking_type = 'boat_rental' then p_rental_type end,
    case when p_booking_type = 'boat_rental' then p_rental_route_id end,
    v_pickup,
    v_dropoff,
    v_total,
    'pending',
    'pending',
    'web',
    nullif(trim(p_notes), '')
  )
  returning id, reference_code into v_booking_id, v_reference_code;

  return jsonb_build_object(
    'id', v_booking_id,
    'reference_code', v_reference_code,
    'total_amount', v_total,
    'status', 'pending'
  );
end;
$$;

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
  v_from_allows_transfers boolean;
  v_to_allows_transfers boolean;
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

  select name, available_for_transfers
  into v_pickup, v_from_allows_transfers
  from public.locations where id = v_route.from_location_id;
  select name, available_for_transfers
  into v_dropoff, v_to_allows_transfers
  from public.locations where id = v_route.to_location_id;

  if v_from_allows_transfers is not true then
    raise exception 'Boat transfers do not depart from %.', v_pickup;
  end if;

  if v_to_allows_transfers is not true then
    raise exception 'Boat transfers do not run to %.', v_dropoff;
  end if;
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

revoke all on function public.submit_public_booking_request(
  text, uuid, text, text, text, text, integer, date, date, time, time,
  numeric, text, uuid, text, text, uuid
) from public;
grant execute on function public.submit_public_booking_request(
  text, uuid, text, text, text, text, integer, date, date, time, time,
  numeric, text, uuid, text, text, uuid
) to anon, authenticated;

revoke all on function public.submit_public_boat_transfer_request(
  uuid, text, text, text, integer, date, time, text, uuid, text, text
) from public;
grant execute on function public.submit_public_boat_transfer_request(
  uuid, text, text, text, integer, date, time, text, uuid, text, text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
