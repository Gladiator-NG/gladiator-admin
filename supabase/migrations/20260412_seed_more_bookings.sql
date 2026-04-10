-- ═══════════════════════════════════════════════════════════════════════════
-- Seed: 30 additional bookings for pagination testing
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  boat1_id   uuid;
  boat2_id   uuid;
  house1_id  uuid;
  house2_id  uuid;

  -- reuse existing customers by email lookup
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;

begin
  select id into boat1_id  from public.boats        order by created_at asc limit 1 offset 0;
  select id into boat2_id  from public.boats        order by created_at asc limit 1 offset 1;
  select id into house1_id from public.beach_houses order by created_at asc limit 1 offset 0;
  select id into house2_id from public.beach_houses order by created_at asc limit 1 offset 1;

  select id into c1 from public.customers where lower(email) = 'adaeze.okonkwo@gmail.com'  limit 1;
  select id into c2 from public.customers where lower(email) = 'emeka.nwosu@yahoo.com'      limit 1;
  select id into c3 from public.customers where lower(email) = 'fatima.bello@outlook.com'   limit 1;
  select id into c4 from public.customers where lower(email) = 'chidi.okafor@gmail.com'     limit 1;
  select id into c5 from public.customers where lower(email) = 'ngozi.eze@hotmail.com'      limit 1;
  select id into c6 from public.customers where lower(email) = 'babs.lawal@gmail.com'       limit 1;

  -- ── 30 extra bookings ────────────────────────────────────────────────────
  -- Using ON CONFLICT DO NOTHING so reruns are safe.

  insert into public.bookings
    (id, booking_type, boat_id, beach_house_id, customer_id,
     customer_name, customer_email, customer_phone,
     guest_count, start_date, end_date, start_time, end_time,
     total_amount, status, payment_status, source, notes)
  select (gen_random_uuid()), t.btype,
    case when t.btype = 'boat_cruise' then t.bid else null end,
    case when t.btype in ('beach_house','transport') then t.hid else null end,
    t.cid, t.cname, t.cemail, t.cphone,
    t.guests, t.sd::date, t.ed::date, t.st::time without time zone, t.et::time without time zone,
    t.amount, t.status, t.pstatus, t.source, t.notes
  from (values
    -- April (current month) ----------------------------------------------------
    ('boat_cruise', boat1_id, house1_id, c1, 'Adaeze Okonkwo',  'adaeze.okonkwo@gmail.com',   '+2348012345678', 10, current_date - 2,  current_date - 2,  '09:00','15:00', 520000, 'confirmed','paid',   'web',   'VIP deck reserved'),
    ('boat_cruise', boat2_id, house1_id, c2, 'Emeka Nwosu',     'emeka.nwosu@yahoo.com',       '+2348023456789',  5, current_date - 3,  current_date - 3,  '11:00','17:00', 310000, 'confirmed','paid',   'admin', null),
    ('beach_house', boat1_id, house1_id, c3, 'Fatima Bello',    'fatima.bello@outlook.com',    '+2348034567890',  3, current_date - 4,  current_date - 2,  null,   null,    420000, 'confirmed','paid',   'web',   'Early check-in requested'),
    ('boat_cruise', boat1_id, house2_id, c4, 'Chidi Okafor',    'chidi.okafor@gmail.com',      '+2348045678901', 15, current_date - 5,  current_date - 5,  '08:00','14:00', 750000, 'confirmed','paid',   'admin', 'Corporate outing'),
    ('beach_house', boat2_id, house2_id, c5, 'Ngozi Eze',       'ngozi.eze@hotmail.com',       '+2348056789012',  2, current_date - 6,  current_date - 4,  null,   null,    380000, 'confirmed','paid',   'mobile',null),
    ('boat_cruise', boat2_id, house1_id, c6, 'Babatunde Lawal', 'babs.lawal@gmail.com',        '+2348067890123',  8, current_date - 7,  current_date - 7,  '10:00','16:00', 480000, 'pending',  'pending','web',   null),
    ('beach_house', boat1_id, house1_id, c1, 'Adaeze Okonkwo',  'adaeze.okonkwo@gmail.com',    '+2348012345678',  4, current_date - 8,  current_date - 5,  null,   null,    460000, 'confirmed','paid',   'web',   null),
    ('boat_cruise', boat1_id, house2_id, c2, 'Emeka Nwosu',     'emeka.nwosu@yahoo.com',       '+2348023456789',  7, current_date - 9,  current_date - 9,  '13:00','19:00', 395000, 'cancelled','pending','web',   'Customer cancelled day before'),
    ('beach_house', boat2_id, house2_id, c3, 'Fatima Bello',    'fatima.bello@outlook.com',    '+2348034567890',  5, current_date - 10, current_date - 7,  null,   null,    510000, 'confirmed','paid',   'admin', null),
    ('boat_cruise', boat1_id, house1_id, c4, 'Chidi Okafor',    'chidi.okafor@gmail.com',      '+2348045678901', 20, current_date - 11, current_date - 11, '09:00','17:00', 900000, 'confirmed','paid',   'admin', 'Full-day charter — 20 pax'),
    ('beach_house', boat1_id, house1_id, c5, 'Ngozi Eze',       'ngozi.eze@hotmail.com',       '+2348056789012',  2, current_date - 12, current_date - 11, null,   null,    260000, 'confirmed','paid',   'mobile',null),
    ('boat_cruise', boat2_id, house2_id, c6, 'Babatunde Lawal', 'babs.lawal@gmail.com',        '+2348067890123',  6, current_date - 13, current_date - 13, '15:00','20:00', 350000, 'pending',  'pending','web',   'Awaiting deposit'),
    -- upcoming (still April)
    ('boat_cruise', boat1_id, house1_id, c1, 'Adaeze Okonkwo',  'adaeze.okonkwo@gmail.com',    '+2348012345678', 12, current_date + 3,  current_date + 3,  '10:00','16:00', 600000, 'confirmed','paid',   'web',   null),
    ('beach_house', boat2_id, house1_id, c2, 'Emeka Nwosu',     'emeka.nwosu@yahoo.com',       '+2348023456789',  4, current_date + 4,  current_date + 7,  null,   null,    520000, 'confirmed','paid',   'admin', null),
    ('boat_cruise', boat2_id, house2_id, c3, 'Fatima Bello',    'fatima.bello@outlook.com',    '+2348034567890',  9, current_date + 6,  current_date + 6,  '12:00','18:00', 440000, 'pending',  'pending','web',   null),
    ('beach_house', boat1_id, house2_id, c4, 'Chidi Okafor',    'chidi.okafor@gmail.com',      '+2348045678901',  6, current_date + 8,  current_date + 11, null,   null,    680000, 'confirmed','paid',   'admin', 'Long weekend package'),
    ('boat_cruise', boat1_id, house1_id, c5, 'Ngozi Eze',       'ngozi.eze@hotmail.com',       '+2348056789012',  3, current_date + 10, current_date + 10, '09:00','13:00', 220000, 'pending',  'pending','mobile',null),
    -- March (last month) -------------------------------------------------------
    ('boat_cruise', boat2_id, house1_id, c6, 'Babatunde Lawal', 'babs.lawal@gmail.com',        '+2348067890123', 10, current_date - 20, current_date - 20, '10:00','16:00', 500000, 'confirmed','paid',   'web',   null),
    ('beach_house', boat1_id, house1_id, c1, 'Adaeze Okonkwo',  'adaeze.okonkwo@gmail.com',    '+2348012345678',  5, current_date - 22, current_date - 19, null,   null,    490000, 'confirmed','paid',   'admin', null),
    ('boat_cruise', boat1_id, house2_id, c2, 'Emeka Nwosu',     'emeka.nwosu@yahoo.com',       '+2348023456789',  8, current_date - 25, current_date - 25, '14:00','20:00', 420000, 'confirmed','paid',   'web',   null),
    ('beach_house', boat2_id, house2_id, c3, 'Fatima Bello',    'fatima.bello@outlook.com',    '+2348034567890',  3, current_date - 27, current_date - 24, null,   null,    360000, 'expired',  'pending','mobile','Did not pay — expired'),
    ('boat_cruise', boat1_id, house1_id, c4, 'Chidi Okafor',    'chidi.okafor@gmail.com',      '+2348045678901', 14, current_date - 30, current_date - 30, '09:00','15:00', 700000, 'confirmed','paid',   'admin', null),
    -- February ------------------------------------------------------------------
    ('beach_house', boat2_id, house1_id, c5, 'Ngozi Eze',       'ngozi.eze@hotmail.com',       '+2348056789012',  2, current_date - 40, current_date - 38, null,   null,    280000, 'confirmed','paid',   'web',   null),
    ('boat_cruise', boat1_id, house2_id, c6, 'Babatunde Lawal', 'babs.lawal@gmail.com',        '+2348067890123',  6, current_date - 42, current_date - 42, '11:00','17:00', 340000, 'confirmed','paid',   'web',   null),
    ('beach_house', boat1_id, house1_id, c1, 'Adaeze Okonkwo',  'adaeze.okonkwo@gmail.com',    '+2348012345678',  4, current_date - 45, current_date - 42, null,   null,    430000, 'confirmed','paid',   'admin', null),
    ('boat_cruise', boat2_id, house2_id, c2, 'Emeka Nwosu',     'emeka.nwosu@yahoo.com',       '+2348023456789',  7, current_date - 50, current_date - 50, '13:00','19:00', 390000, 'cancelled','pending','web',   'No-show'),
    -- January -------------------------------------------------------------------
    ('beach_house', boat1_id, house1_id, c3, 'Fatima Bello',    'fatima.bello@outlook.com',    '+2348034567890',  2, current_date - 65, current_date - 62, null,   null,    320000, 'confirmed','paid',   'mobile',null),
    ('boat_cruise', boat2_id, house1_id, c4, 'Chidi Okafor',    'chidi.okafor@gmail.com',      '+2348045678901', 18, current_date - 70, current_date - 70, '09:00','17:00', 850000, 'confirmed','paid',   'admin', 'New Year eve party cruise'),
    ('beach_house', boat1_id, house2_id, c5, 'Ngozi Eze',       'ngozi.eze@hotmail.com',       '+2348056789012',  3, current_date - 75, current_date - 72, null,   null,    370000, 'confirmed','paid',   'web',   null),
    ('boat_cruise', boat1_id, house1_id, c6, 'Babatunde Lawal', 'babs.lawal@gmail.com',        '+2348067890123',  9, current_date - 80, current_date - 80, '10:00','16:00', 460000, 'confirmed','paid',   'web',   null)
  ) as t(btype, bid, hid, cid, cname, cemail, cphone, guests, sd, ed, st, et, amount, status, pstatus, source, notes)
  on conflict do nothing;

end $$;
