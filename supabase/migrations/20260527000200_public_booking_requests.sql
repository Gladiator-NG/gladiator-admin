-- A public customer can submit a pending booking request, but never receives
-- direct insert/read access to bookings or customers. Pricing and availability
-- are calculated here from current catalogue records.

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
  p_notes text default null
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
begin
  if p_booking_type not in ('boat_cruise', 'beach_house', 'boat_rental') then
    raise exception 'Please choose a valid experience.';
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
      v_total := v_boat.price_per_hour * v_hours;
      v_pickup := v_boat.pickup_location;
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

      select name into v_pickup from public.locations where id = v_route.from_location_id;
      select name into v_dropoff from public.locations where id = v_route.to_location_id;
    end if;

    v_end_time := (v_start_time + (v_hours * interval '1 hour'))::time;
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
      raise exception 'The guest count exceeds this residence capacity.';
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
      v_total := v_house.day_use_price_per_hour * v_hours;
    else
      v_nights := p_end_date - p_start_date;
      if p_booking_mode <> 'overnight' or v_nights < 1 then
        raise exception 'An overnight stay needs a valid check-out date.';
      end if;

      v_end_date := p_end_date;
      v_start_time := v_house.check_in_time;
      v_end_time := v_house.check_out_time;
      v_total := v_house.price_per_night * v_nights;
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

revoke all on function public.submit_public_booking_request(
  text, uuid, text, text, text, text, integer, date, date, time, time,
  numeric, text, uuid, text
) from public;
grant execute on function public.submit_public_booking_request(
  text, uuid, text, text, text, text, integer, date, date, time, time,
  numeric, text, uuid, text
) to anon, authenticated;
