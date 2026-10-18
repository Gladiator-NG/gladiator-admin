import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('confirmation queue handles booking transitions, leases, retries and access control', async () => {
  const db = new PGlite();
  try {
    // Only network/scheduler/Vault adapters are stubbed; queue and trigger SQL run in Postgres.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema vault; create schema net; create schema cron;
      create table vault.secrets(name text, decrypted_secret text);
      create view vault.decrypted_secrets as select * from vault.secrets;
      create function vault.create_secret(value text, secret_name text, description text)
        returns void language sql as 'insert into vault.secrets values (secret_name,value)';
      create table public.http_calls(url text, headers jsonb, body jsonb);
      create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int default 1000)
        returns bigint language plpgsql as $$ begin
          insert into public.http_calls values(url,headers,body); return 1; end $$;
      create function cron.schedule(job text, schedule text, command text)
        returns bigint language sql as 'select 1::bigint';
      create table public.boats(id uuid primary key, name text);
      create table public.beach_houses(id uuid primary key, name text);
      create table public.bookings(
        id uuid primary key default gen_random_uuid(), reference_code text default 'GLD-TEST',
        customer_name text default 'Test customer', customer_email text default 'customer@example.com',
        booking_type text default 'boat_cruise', status text default 'pending', payment_status text default 'pending',
        boat_id uuid, beach_house_id uuid, start_date date default '2026-10-01', end_date date default '2026-10-01',
        start_time time default '11:00', end_time time default '14:00', guest_count int default 2,
        pickup_location text, dropoff_location text, total_amount numeric default 107500,
        subtotal_amount numeric default 100000, vat_amount numeric default 7500, currency text default 'NGN'
      );
    `);
    const migration = await readFile(new URL('../supabase/migrations/20260908000100_customer_confirmation_emails.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const query = async (sql, values = []) => (await db.query(sql, values)).rows;
    const count = async () => Number((await query('select count(*) as n from booking_confirmation_emails'))[0].n);
    const insert = async (status = 'pending', payment = 'pending') =>
      (await query('insert into bookings(status,payment_status) values($1,$2) returning id', [status,payment]))[0].id;

    const id = await insert();
    assert.equal(await count(), 0, 'pending booking must not email');
    await query("update bookings set payment_status='paid' where id=$1", [id]);
    assert.equal(await count(), 0, 'payment alone is not confirmation');
    await query("update bookings set status='confirmed' where id=$1", [id]);
    assert.equal(await count(), 1, 'staff confirmation is queued');
    await query("update bookings set status='confirmed',payment_status='paid' where id=$1", [id]);
    assert.equal(await count(), 1, 'duplicate callback must not requeue');

    const [claimed] = await query('select * from claim_booking_confirmation_email()');
    assert.equal(claimed.status, 'sending');
    assert.equal(claimed.attempts, 1);
    assert.deepEqual(await query('select * from claim_booking_confirmation_email()'), [], 'active lease prevents another claim');
    await query("update booking_confirmation_emails set lease_until=now()-interval '1 minute' where id=$1", [claimed.id]);
    const [reclaimed] = await query('select * from claim_booking_confirmation_email()');
    assert.notEqual(reclaimed.lease_token, claimed.lease_token, 'expired lease can recover');
    await query("update booking_confirmation_emails set status='sent',lease_until=null where id=$1", [claimed.id]);
    assert.deepEqual(await query('select * from claim_booking_confirmation_email()'), [], 'sent emails stay sent');

    const cancelled = await insert('confirmed', 'paid');
    await query("update bookings set status='cancelled' where id=$1", [cancelled]);
    assert.deepEqual(await query('select * from claim_booking_confirmation_email()'), []);
    assert.equal((await query('select status from booking_confirmation_emails where booking_id=$1', [cancelled]))[0].status, 'cancelled');

    const old = await insert('confirmed', 'paid');
    await query("update booking_confirmation_emails set first_attempt_at=now()-interval '24 hours' where booking_id=$1", [old]);
    assert.deepEqual(await query('select * from claim_booking_confirmation_email()'), []);
    assert.equal((await query('select status from booking_confirmation_emails where booking_id=$1', [old]))[0].status, 'failed');
    const exhausted = await insert('confirmed', 'paid');
    await query('update booking_confirmation_emails set attempts=8 where booking_id=$1', [exhausted]);
    assert.deepEqual(await query('select * from claim_booking_confirmation_email()'), []);

    // Website payment functions insert pending, then confirm in the same transaction.
    await db.exec("begin; insert into bookings(reference_code) values('GLD-WEB'); update bookings set status='confirmed',payment_status='paid' where reference_code='GLD-WEB'; commit;");
    const [webJob] = await query('select * from claim_booking_confirmation_email()');
    assert.equal(webJob.booking_snapshot.reference_code, 'GLD-WEB');

    await db.exec("begin; insert into bookings(status,payment_status) values('confirmed','paid'); rollback;");
    assert.deepEqual(await query('select * from claim_booking_confirmation_email()'), [], 'rolled-back booking must not email');
    assert.equal((await query("select authorize_booking_email_worker('wrong') as ok"))[0].ok, false);
    assert.equal((await query("select authorize_booking_email_worker(decrypted_secret) as ok from vault.decrypted_secrets"))[0].ok, true);
    await db.exec('set role anon');
    await assert.rejects(query('select * from booking_confirmation_emails'), /permission denied/);
    await assert.rejects(query('select * from claim_booking_confirmation_email()'), /permission denied/);
    await db.exec('reset role');

    await db.exec('create trigger internal_email after insert on bookings for each row execute function notify_new_booking()');
    await insert();
    const [call] = await query('select * from http_calls');
    assert.equal(call.body.type, 'INSERT');
    assert.equal(call.body.table, 'bookings');
    assert.equal(call.body.record.customer_email, 'customer@example.com');
    assert.ok(call.headers['x-booking-email-token']);
  } finally { await db.close(); }
});
