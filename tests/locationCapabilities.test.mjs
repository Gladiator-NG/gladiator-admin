import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = (db, name) =>
  readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8').then(sql =>
    db.exec(sql),
  );

/**
 * Minimal schema covering only what the public booking RPCs touch. The RPCs
 * themselves are the real ones loaded from the migration under test.
 */
async function setup() {
  const db = new PGlite();
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;

  await db.exec(`
    create role anon; create role authenticated; create role service_role;

    create table locations(
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      is_active boolean not null default true,
      sort_order integer not null default 0);

    create table boats(
      id uuid primary key default gen_random_uuid(),
      name text, is_active boolean default true,
      is_available_for_rental boolean default true,
      pickup_location text,
      max_guests integer default 20,
      min_booking_hours integer default 1,
      max_booking_hours integer default 12,
      price_per_hour numeric default 50000);

    create table beach_houses(
      id uuid primary key default gen_random_uuid(),
      name text, is_active boolean default true,
      arrival_jetty_location_id uuid,
      rental_price numeric,
      max_guests integer default 10,
      extra_guest_fee_per_head numeric,
      day_use_min_hours integer, day_use_max_hours integer,
      day_use_price_per_hour numeric, price_per_night numeric,
      check_in_time time default '14:00', check_out_time time default '11:00');

    create table transport_routes(
      id uuid primary key default gen_random_uuid(),
      from_location_id uuid references locations(id),
      to_location_id uuid references locations(id),
      route_price numeric, duration_hours numeric default 1,
      is_active boolean not null default true);

    create table boat_transfer_prices(
      id uuid primary key default gen_random_uuid(),
      boat_id uuid, route_id uuid, price numeric, is_active boolean default true);

    create table customers(
      id uuid primary key default gen_random_uuid(),
      full_name text, email text, phone text);

    create table bookings(
      id uuid primary key default gen_random_uuid(),
      reference_code text default 'GLD-TEST',
      booking_type text, boat_id uuid, beach_house_id uuid,
      beach_house_booking_mode text, parent_beach_house_booking_id uuid,
      customer_id uuid, customer_name text, customer_email text, customer_phone text,
      guest_count integer, start_date date, end_date date,
      start_time time, end_time time, hours numeric,
      rental_type text, rental_route_id uuid,
      pickup_location text, dropoff_location text,
      total_amount numeric, status text, payment_status text,
      source text, notes text, payment_reference text, currency text default 'NGN');

    -- The overlap/curfew logic is covered elsewhere; always available here.
    create function check_public_availability(
      p_resource_type text, p_resource_id uuid, p_start_date date,
      p_end_date date, p_start_time time, p_end_time time)
    returns boolean language sql as $$ select true $$;
  `);

  await migration(db, '20261018000200_location_booking_capabilities');

  const [cruiseJetty] = await q(
    "insert into locations(name) values('RED Bar, Lekki Phase 1') returning id",
  );
  // Ibeshe: a transfer destination that is not a cruise departure point.
  const [ibeshe] = await q(
    `insert into locations(name, available_for_cruises, available_for_transfers)
     values('Ibeshe', false, true) returning id`,
  );
  const [boat] = await q("insert into boats(name) values('No Worries') returning id");
  const [route] = await q(
    `insert into transport_routes(from_location_id, to_location_id)
     values($1, $2) returning id`,
    [cruiseJetty.id, ibeshe.id],
  );
  await q(
    'insert into boat_transfer_prices(boat_id, route_id, price) values($1,$2,500000)',
    [boat.id, route.id],
  );

  return { db, q, cruiseJetty, ibeshe, boat, route };
}

const cruise = (q, jettyId, boatId) =>
  q(
    `select public.submit_public_booking_request(
       'boat_cruise', $1, null, 'Test Customer', 'test@example.com', '08000000000',
       2, current_date + 5, null, '10:00', null, 3, null, null, null, null, $2
     ) as result`,
    [boatId, jettyId],
  );

const transfer = (q, boatId, routeId) =>
  q(
    `select public.submit_public_boat_transfer_request(
       $1, 'Test Customer', 'test@example.com', '08000000000', 2,
       current_date + 5, '10:00', 'outbound', $2, null, null
     ) as result`,
    [boatId, routeId],
  );

test('locations default to both capabilities so existing behaviour is preserved', async () => {
  const { db, q } = await setup();
  try {
    await q("insert into locations(name) values('Brand New Jetty')");
    const [row] = await q(
      "select available_for_cruises, available_for_transfers from locations where name='Brand New Jetty'",
    );
    assert.deepEqual(row, { available_for_cruises: true, available_for_transfers: true });
  } finally {
    await db.close();
  }
});

test('a cruise from a cruise-enabled jetty is accepted', async () => {
  const { db, q, cruiseJetty, boat } = await setup();
  try {
    const [{ result }] = await cruise(q, cruiseJetty.id, boat.id);
    assert.equal(result.status, 'pending');
    const [booking] = await q(
      "select pickup_location, booking_type from bookings where booking_type='boat_cruise'",
    );
    assert.equal(booking.pickup_location, 'RED Bar, Lekki Phase 1');
  } finally {
    await db.close();
  }
});

test('a cruise from a transfer-only location is rejected server-side', async () => {
  const { db, q, ibeshe, boat } = await setup();
  try {
    await assert.rejects(
      cruise(q, ibeshe.id, boat.id),
      /Yacht cruises do not depart from Ibeshe/,
    );
    assert.equal((await q('select count(*) as n from bookings'))[0].n, 0);
  } finally {
    await db.close();
  }
});

test('a transfer to Ibeshe remains allowed', async () => {
  const { db, q, boat, route } = await setup();
  try {
    const [{ result }] = await transfer(q, boat.id, route.id);
    assert.equal(result.status, 'pending');
    const [booking] = await q(
      "select pickup_location, dropoff_location from bookings where booking_type='boat_rental'",
    );
    assert.equal(booking.dropoff_location, 'Ibeshe');
  } finally {
    await db.close();
  }
});

test('a transfer is rejected when an endpoint has transfers disabled', async () => {
  const { db, q, boat, route, ibeshe } = await setup();
  try {
    await q('update locations set available_for_transfers = false where id = $1', [ibeshe.id]);
    await assert.rejects(transfer(q, boat.id, route.id), /Boat transfers do not run to Ibeshe/);
    assert.equal((await q('select count(*) as n from bookings'))[0].n, 0);
  } finally {
    await db.close();
  }
});

test('an outbound transfer can be linked to its return leg', async () => {
  const { db, q } = await setup();
  try {
    await migration(db, '20261018000300_linked_return_transfer');
    const [outbound] = await q(
      "insert into bookings(booking_type, rental_type) values('boat_rental','outbound') returning id",
    );
    const [ret] = await q(
      `insert into bookings(booking_type, rental_type, return_of_booking_id)
       values('boat_rental','return',$1) returning id, return_of_booking_id`,
      [outbound.id],
    );
    assert.equal(ret.return_of_booking_id, outbound.id);

    await assert.rejects(
      q('update bookings set return_of_booking_id = id where id = $1', [ret.id]),
      /bookings_return_of_booking_not_self/,
    );
  } finally {
    await db.close();
  }
});
