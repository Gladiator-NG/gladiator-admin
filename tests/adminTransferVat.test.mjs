import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const readMigration = name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');

test('transfer pricing preserves admin VAT, net discounts and fees through insert and updates', async () => {
  const db = new PGlite();
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  try {
    await db.exec(`
      create table bookings (
        id serial primary key, reference_code text, booking_type text default 'boat_rental',
        boat_id int default 1, rental_route_id int default 1, rental_type text default 'outbound',
        source text default 'admin', hours numeric, subtotal_amount numeric,
        discount_amount numeric default 0, vat_rate numeric, vat_amount numeric,
        total_amount numeric, later_return_fee numeric default 0
      );
      create table boat_transfer_prices (boat_id int, route_id int, is_active boolean, price numeric);
      insert into boat_transfer_prices values(1,1,true,920000);
    `);
    const old = await readMigration('20260818000100_boat_specific_transfer_pricing');
    const start = old.indexOf('create or replace function public.enforce_new_boat_transfer_price()');
    const end = old.indexOf('create or replace function public.submit_public_boat_transfer_request(', start);
    await db.exec(old.slice(start, end));
    await db.exec(await readMigration('20261020000100_normalize_admin_booking_totals'));
    await db.exec(await readMigration('20260825000100_web_booking_vat'));
    const insert = async (subtotal, vat, discount = 0, fee = 0, ref = null) => (await q(`
      insert into bookings(subtotal_amount,vat_rate,vat_amount,total_amount,discount_amount,later_return_fee,reference_code)
      values($1,0.075,$2,$1::numeric+$2::numeric,$3,$4,$5) returning *`, [subtotal, vat, discount, fee, ref]))[0];
    const broken = await insert(920000, 69000, 0, 0, 'GLD-10138');
    assert.equal(Number(broken.total_amount),920000,'reproduce the old trigger overwriting VAT');
    await db.exec(await readMigration('20261025000100_preserve_admin_transfer_vat'));
    assert.equal(Number((await q("select total_amount from bookings where reference_code='GLD-10138'"))[0].total_amount),989000);
    assert.equal(Number((await insert(920000,69000)).total_amount),989000);
    assert.equal(Number((await insert(920000,0)).total_amount),920000);
    const discounted = await insert(828000,62100,92000);
    assert.equal(Number(discounted.total_amount),890100,'discount is already in the net subtotal');
    const updated = (await q('update bookings set hours=null where id=$1 returning total_amount',[discounted.id]))[0];
    assert.equal(Number(updated.total_amount),890100,'status/edit updates must not deduct discount again');
    assert.equal(Number((await insert(1020000,76500,0,100000)).total_amount),1096500,'later return fee remains included');
    const web = (await q("insert into bookings(source,total_amount) values('web',920000) returning total_amount"))[0];
    assert.equal(Number(web.total_amount),989000,'web VAT still applies after transfer pricing');
    await assert.rejects(q("insert into bookings(rental_type,total_amount) values('round_trip',920000)"), /no longer offered/);
    await assert.rejects(q('insert into bookings(boat_id,total_amount) values(2,920000)'), /not priced/);
    await db.exec(await readMigration('20261025000100_preserve_admin_transfer_vat'));
    assert.equal(Number((await q("select total_amount from bookings where reference_code='GLD-10138'"))[0].total_amount),989000,'repair is idempotent');
  } finally { await db.close(); }
});
