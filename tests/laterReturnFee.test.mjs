import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = (db, name) =>
  readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8').then(sql =>
    db.exec(sql),
  );

/**
 * A later-day return pickup is recorded on the transfer the customer already
 * paid for: the date it was agreed for and the amount negotiated with them.
 */
async function setup() {
  const db = new PGlite();
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;

  await db.exec(`
    create table bookings(
      id uuid primary key default gen_random_uuid(),
      booking_type text not null default 'boat_rental',
      start_date date not null,
      end_date date not null,
      total_amount numeric not null default 0);
  `);

  await migration(db, '20261020000100_later_return_fee');
  return { db, q };
}

test('a transfer defaults to no later return and no extra charge', async () => {
  const { q } = await setup();
  const [row] = await q(
    `insert into bookings (start_date, end_date) values ('2026-05-12','2026-05-12')
     returning later_return_date, later_return_fee`,
  );

  assert.equal(row.later_return_date, null);
  assert.equal(Number(row.later_return_fee), 0);
});

test('staff can record the agreed pickup date and its negotiated fee', async () => {
  const { q } = await setup();
  const [booking] = await q(
    `insert into bookings (start_date, end_date, total_amount)
     values ('2026-05-12','2026-05-12', 250000) returning id`,
  );

  const [updated] = await q(
    `update bookings
       set later_return_date = '2026-05-15',
           later_return_fee = 80000,
           total_amount = total_amount + 80000
     where id = $1
     returning later_return_date, later_return_fee, total_amount`,
    [booking.id],
  );

  assert.equal(
    updated.later_return_date.toISOString().slice(0, 10),
    '2026-05-15',
  );
  assert.equal(Number(updated.later_return_fee), 80000);
  assert.equal(Number(updated.total_amount), 330000);
});

test('the booking date range is left alone, so the boat stays free in between', async () => {
  const { q } = await setup();
  const [row] = await q(
    `insert into bookings (start_date, end_date) values ('2026-05-12','2026-05-12')
     returning id`,
  );
  await q(`update bookings set later_return_date = '2026-05-15' where id = $1`, [
    row.id,
  ]);

  const [dates] = await q(
    `select start_date, end_date from bookings where id = $1`,
    [row.id],
  );

  assert.equal(
    dates.end_date.toISOString().slice(0, 10),
    '2026-05-12',
    'end_date must not stretch to the return date',
  );
});

test('a negative fee is rejected', async () => {
  const { q } = await setup();
  await assert.rejects(
    q(`insert into bookings (start_date, end_date, later_return_fee)
       values ('2026-05-12','2026-05-12', -1)`),
    /later_return_fee_non_negative/,
  );
});
