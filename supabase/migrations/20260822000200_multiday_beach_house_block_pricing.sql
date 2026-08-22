-- Multi-day beach-house stays occupy both overnight and intervening daytime
-- booking blocks. This migration is additive and does not delete or rewrite data.

create or replace function public.calculate_beach_house_stay_price(
  p_booking_mode text,
  p_day_rate numeric,
  p_overnight_rate numeric,
  p_nights integer default 1
)
returns numeric
language sql
immutable
as $$
  select case
    when p_booking_mode = 'day_use' then p_day_rate
    when p_booking_mode = 'overnight'
      and p_nights >= 1
      and p_overnight_rate is not null
      and (p_nights = 1 or p_day_rate is not null)
      then (p_overnight_rate * p_nights)
        + (coalesce(p_day_rate, 0) * greatest(p_nights - 1, 0))
    else null
  end;
$$;

revoke all on function public.calculate_beach_house_stay_price(
  text, numeric, numeric, integer
) from public, anon, authenticated;
grant execute on function public.calculate_beach_house_stay_price(
  text, numeric, numeric, integer
) to service_role;

create or replace function public.submit_public_beach_house_request(
  p_asset_id uuid,
  p_booking_mode text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default '',
  p_guest_count integer default 1,
  p_start_date date default null,
  p_end_date date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.beach_houses%rowtype;
  v_customer_id uuid;
  v_booking_id uuid;
  v_reference_code text;
  v_total numeric;
  v_stay_price numeric;
  v_start_time time;
  v_end_time time;
  v_end_date date;
  v_nights integer := 1;
  v_extra_guests integer := 0;
  v_extra_guest_charge numeric := 0;
  v_available boolean;
begin
  if p_booking_mode not in ('day_use', 'overnight') then
    raise exception 'Please choose day use or an overnight stay.';
  end if;

  if nullif(trim(p_customer_name), '') is null
    or nullif(trim(p_customer_email), '') is null
    or nullif(trim(p_customer_phone), '') is null then
    raise exception 'Name, email and phone are required.';
  end if;

  if p_guest_count < 1 or p_start_date is null then
    raise exception 'Please provide valid booking details.';
  end if;

  select * into v_house
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
    v_end_date := p_start_date;
    v_start_time := time '12:00';
    v_end_time := time '20:00';
  else
    if p_end_date is null then
      raise exception 'An overnight stay needs a valid check-out date.';
    end if;
    v_nights := p_end_date - p_start_date;
    if v_nights < 1 then
      raise exception 'An overnight stay needs a valid check-out date.';
    end if;
    v_end_date := p_end_date;
    v_start_time := time '20:00';
    v_end_time := time '09:00';
  end if;

  v_stay_price := public.calculate_beach_house_stay_price(
    p_booking_mode, v_house.day_rate, v_house.overnight_rate, v_nights
  );
  v_total := v_stay_price + v_extra_guest_charge;

  if v_total is null or v_total <= 0 then
    raise exception 'Pricing is not configured for this residence.';
  end if;

  v_available := public.check_public_availability(
    'beach_house', p_asset_id, p_start_date, v_end_date, v_start_time, v_end_time
  );
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
    booking_type, beach_house_id, beach_house_booking_mode, customer_id,
    customer_name, customer_email, customer_phone, guest_count,
    start_date, end_date, start_time, end_time, hours, late_checkout_hours,
    total_amount, status, payment_status, source, notes
  ) values (
    'beach_house', p_asset_id, p_booking_mode, v_customer_id,
    trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone),
    p_guest_count, p_start_date, v_end_date, v_start_time, v_end_time, null, 0,
    v_total, 'pending', 'pending', 'web', nullif(trim(p_notes), '')
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

revoke all on function public.submit_public_beach_house_request(
  uuid, text, text, text, text, integer, date, date, text
) from public;
grant execute on function public.submit_public_beach_house_request(
  uuid, text, text, text, text, integer, date, date, text
) to anon, authenticated;

notify pgrst, 'reload schema';
