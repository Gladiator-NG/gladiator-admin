import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('discount validation, durable limits, VAT snapshots, permissions and operations notice exception', async () => {
  const db = new PGlite();
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const migration = async name => db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create table profiles(id uuid primary key,role text);
      insert into profiles values ('11111111-1111-1111-1111-111111111111','Admin'),('22222222-2222-2222-2222-222222222222','Staff');
      grant usage on schema auth to authenticated;
      grant select on profiles to authenticated;
      create table bookings(id uuid primary key default gen_random_uuid(), reference_code text default 'TEST',
        booking_type text default 'boat_cruise', customer_email text default 'one@example.com', source text default 'web',
        status text default 'pending', payment_status text default 'pending', payment_reference text,
        total_amount numeric default 10000, currency text default 'NGN', start_date date default current_date+3,
        start_time time default '12:00');
      create table payment_attempts(payment_reference text primary key,request_key text not null,booking_payload jsonb not null,
        quoted_amount numeric not null,currency text,status text default 'initialized',authorization_url text,
        created_at timestamptz default now());
    `);
    await migration('20260825000100_web_booking_vat');
    await migration('20261006000100_admin_booking_notice');
    await migration('20261006000300_staff_booking_notice_override');
    await db.exec('create trigger notice before insert or update on bookings for each row execute function enforce_booking_minimum_notice()');
    await migration('20261006000200_discount_codes');
    // Stub only asset booking creation; execute the actual payment confirmation RPCs.
    for (const [file, name, type] of [
      ['20260819000100_customer_selected_pickup_jetty','submit_public_booking_request','boat_cruise'],
      ['20260822000100_fixed_beach_house_rates','submit_public_beach_house_request','beach_house'],
      ['20260818000100_boat_specific_transfer_pricing','submit_public_boat_transfer_request','boat_rental'],
    ]) {
      const source = await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), 'utf8');
      const start = source.indexOf(`create or replace function public.${name}(`);
      const header = source.slice(start, source.indexOf('returns jsonb', start));
      await db.exec(`${header} returns jsonb language plpgsql as $$ declare b bookings%rowtype; begin
        insert into bookings(booking_type,customer_email) values('${type}',p_customer_email) returning * into b;
        return to_jsonb(b); end; $$;`);
    }
    await q("insert into discount_codes(code,discount_type,value,max_uses,max_uses_per_customer) values('AGENT10','percentage',10,2,1)");
    const quote = async (code='agent10', email='one@example.com', subtotal=10000, type='boat_cruise') => (await q('select quote_discount($1,$2,$3,$4) as result',[code,subtotal,type,email]))[0].result;
    assert.deepEqual(await quote(), { id: (await q('select id from discount_codes'))[0].id, code:'AGENT10', discountAmount:1000,subtotal:9000,vatAmount:675,totalAmount:9675 });
    const reserve = async (ref,key,email='one@example.com') => (await q('select reserve_discount_checkout($1,$2,$3,10000) as result',[ref,key,JSON.stringify({discount_code:'AGENT10',booking_type:'boat_cruise',customer_email:email,total_amount:9675})]))[0].result;
    await assert.rejects(q('select reserve_discount_checkout($1,$2,$3,10000)', ['bad-total','bad-total', JSON.stringify({discount_code:'AGENT10',booking_type:'boat_cruise',customer_email:'one@example.com',total_amount:1})]), /discount changed/);
    assert.equal((await q('select count(*) as n from payment_attempts'))[0].n,0,'failed total check does not consume a slot');
    await reserve('pay1','key1');
    assert.equal((await reserve('retry','key1')).payment_reference,'pay1');
    await assert.rejects(quote(), /usage limit/);
    await reserve('pay2','key2','two@example.com');
    await assert.rejects(quote('AGENT10','three@example.com'), /usage limit/);
    await q("update discount_codes set is_active=false,value=20");
    await assert.rejects(quote(), /no longer active/);
    await q("update payment_attempts set status='paid' where payment_reference='pay1'");
    await db.exec("begin; select set_config('app.confirming_payment','pay1',true); insert into bookings default values; commit;");
    const [booking] = await q('select total_amount,discount_code,discount_amount,subtotal_amount,vat_amount from bookings');
    assert.deepEqual(booking,{total_amount:'9675.00',discount_code:'AGENT10',discount_amount:'1000.00',subtotal_amount:'9000.00',vat_amount:'675.00'});
    // Ordinary requests cannot inherit payment discount context from a prior transaction.
    await q('insert into bookings default values');
    assert.equal((await q('select count(*) as n from bookings where total_amount=10750'))[0].n,1);
    await q("insert into discount_codes(code,discount_type,value,booking_type,minimum_subtotal) values('FIXED','fixed',500,'beach_house',2000)");
    assert.equal((await quote('FIXED','one@example.com',5000,'beach_house')).totalAmount,4837.5);
    await assert.rejects(quote('FIXED'), /does not apply/);
    await assert.rejects(quote('FIXED','one@example.com',1000,'beach_house'), /minimum spend/);
    await q("update discount_codes set expires_at=now()-interval '1 hour' where code='FIXED'");
    await assert.rejects(quote('FIXED'), /no longer active/);
    await q("update discount_codes set expires_at=null,starts_at=now()+interval '1 hour' where code='FIXED'");
    await assert.rejects(quote('FIXED'), /no longer active/);
    await q("update discount_codes set starts_at=null,minimum_subtotal=0 where code='FIXED'");
    await assert.rejects(quote('FIXED','one@example.com',500,'beach_house'), /greater than/);
    await assert.rejects(q("insert into bookings(start_date,start_time,source) values(current_date,'00:00','admin')"), /2 hours/);
    await assert.rejects(q("insert into bookings(booking_type,start_date) values('beach_house',current_date)"), /24 hours/);
    await db.exec("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");
    await q("insert into bookings(start_date,source) values(current_date,'admin')");
    await q("insert into bookings(booking_type,start_date,source) values('beach_house',current_date,'admin')");
    await db.exec("select set_config('test.uid','33333333-3333-3333-3333-333333333333',false)");
    await assert.rejects(q("insert into bookings(start_date) values(current_date)"), /2 hours/);
    await db.exec("select set_config('test.uid','11111111-1111-1111-1111-111111111111',false)");
    await q("insert into bookings(start_date,source) values(current_date,'admin')");
    await q("insert into bookings(booking_type,start_date,source) values('beach_house',current_date,'admin')");
    await db.exec("select set_config('test.uid','',false)");
    await q("insert into discount_codes(code,discount_type,value) values('PAYTEST','percentage',10)");
    for (const [fn, type] of [['confirm_public_booking_payment','boat_cruise'],['confirm_public_beach_house_payment','beach_house'],['confirm_public_boat_transfer_payment','boat_rental']]) {
      const reference = `confirm-${type}`;
      const payload = { discount_code:'PAYTEST', booking_type:type, customer_email:'paid@example.com', total_amount:9675 };
      await q('select reserve_discount_checkout($1,$1,$2,10000)',[reference, JSON.stringify(payload)]);
      await q("update payment_attempts set status='paid' where payment_reference=$1",[reference]);
      const extra = type === 'boat_cruise' ? ", p_booking_type => 'boat_cruise'" : type === 'beach_house' ? ", p_booking_mode => 'day_use'" : '';
      const call = `select ${fn}(p_payment_reference => $1,p_expected_total => 9675,p_currency => 'NGN',p_asset_id => '33333333-3333-3333-3333-333333333333',p_customer_name => 'Customer',p_customer_email => 'paid@example.com'${extra}) as result`;
      const first = (await q(call,[reference]))[0].result;
      assert.equal(first.total_amount,9675);
      assert.equal(first.payment_status,'paid');
      assert.equal((await q(call,[reference]))[0].result.id,first.id,'duplicate confirmation returns same booking');
      assert.equal((await q('select count(*) as n from bookings where payment_reference=$1',[reference]))[0].n,1);
    }
    await db.exec("select set_config('test.uid','11111111-1111-1111-1111-111111111111',false)");
    await db.exec('set role authenticated');
    assert.equal((await q('select count(*) as n from discount_codes'))[0].n,3);
    await db.exec("reset role; select set_config('test.uid','22222222-2222-2222-2222-222222222222',false); set role authenticated");
    assert.equal((await q('select count(*) as n from discount_codes'))[0].n,0);
    await assert.rejects(q("insert into discount_codes(code,discount_type,value) values('BAD','fixed',1)"), /row-level security/);
    await assert.rejects(quote(), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(q('select * from discount_codes'), /permission denied/);
    await assert.rejects(reserve('bad','bad'), /permission denied/);
  } finally { await db.close(); }
});
