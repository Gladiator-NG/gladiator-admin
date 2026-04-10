-- Edge-case bookings:
--   1. Beach house stay (parent)
--   2. Transport sub-booking linked to that stay (boat + parent_beach_house_booking_id)
--   3. Standalone boat transport (no beach house, no parent)

do $$
declare
  boat1_id  uuid;
  boat2_id  uuid;
  house1_id uuid;
  c1        uuid;
  parent_id uuid := gen_random_uuid();
begin
  select id into boat1_id  from public.boats        order by created_at asc limit 1 offset 0;
  select id into boat2_id  from public.boats        order by created_at asc limit 1 offset 1;
  select id into house1_id from public.beach_houses order by created_at asc limit 1 offset 0;
  select id into c1
    from public.customers
   where lower(email) = 'adaeze.okonkwo@gmail.com'
   limit 1;

  -- 1. Parent beach house booking
  insert into public.bookings (
    id, booking_type,
    beach_house_id, customer_id,
    customer_name, customer_email, customer_phone,
    guest_count, start_date, end_date,
    total_amount, status, payment_status, source, notes
  )
  select
    parent_id, 'beach_house',
    house1_id, c1,
    'Adaeze Okonkwo', 'adaeze.okonkwo@gmail.com', '+2348012345678',
    4, current_date + 15, current_date + 18,
    540000, 'confirmed', 'paid', 'web',
    'Edge case: parent beach house stay — boat transport linked below'
  where house1_id is not null
  on conflict do nothing;

  -- 2. Transport sub-booking: boat shuttles guests to the beach house (round trip)
  insert into public.bookings (
    id, booking_type,
    boat_id, beach_house_id, parent_beach_house_booking_id,
    customer_id, customer_name, customer_email, customer_phone,
    guest_count, start_date, end_date, start_time, end_time,
    transport_type, total_amount, status, payment_status, source, notes
  )
  select
    gen_random_uuid(), 'transport',
    boat1_id, house1_id, parent_id,
    c1, 'Adaeze Okonkwo', 'adaeze.okonkwo@gmail.com', '+2348012345678',
    4, current_date + 15, current_date + 18,
    '07:00'::time without time zone, '09:00'::time without time zone,
    'round_trip', 80000, 'confirmed', 'paid', 'web',
    'Edge case: boat shuttle linked to beach house stay'
  where boat1_id is not null and house1_id is not null
  on conflict do nothing;

  -- 3. Standalone boat transport (no beach house, no parent booking)
  insert into public.bookings (
    id, booking_type,
    boat_id, customer_id,
    customer_name, customer_email, customer_phone,
    guest_count, start_date, end_date, start_time, end_time,
    transport_type, total_amount, status, payment_status, source, notes
  )
  select
    gen_random_uuid(), 'transport',
    boat2_id, c1,
    'Adaeze Okonkwo', 'adaeze.okonkwo@gmail.com', '+2348012345678',
    6, current_date + 20, current_date + 20,
    '10:00'::time without time zone, '12:00'::time without time zone,
    'outbound', 50000, 'pending', 'pending', 'admin',
    'Edge case: standalone boat transport only, no beach house'
  where boat2_id is not null
  on conflict do nothing;
end $$;
