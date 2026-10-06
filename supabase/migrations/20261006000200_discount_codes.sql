-- Discount slots are reserved before checkout, including pending payments.
create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(trim(code)) and code ~ '^[A-Z0-9_-]{3,40}$'),
  partner_name text not null default '',
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  value numeric not null check (value > 0 and value <> 'NaN'::numeric),
  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer check (max_uses > 0),
  max_uses_per_customer integer check (max_uses_per_customer > 0),
  minimum_subtotal numeric not null default 0 check (minimum_subtotal >= 0),
  booking_type text check (booking_type in ('boat_cruise', 'boat_rental', 'beach_house')),
  created_at timestamptz not null default now(),
  check (discount_type <> 'percentage' or value < 100),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);
alter table public.discount_codes enable row level security;
create policy admin_discount_codes on public.discount_codes for all to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'Admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'Admin'));
revoke all on public.discount_codes from anon, authenticated;
grant select, insert, update on public.discount_codes to authenticated;
grant all on public.discount_codes to service_role;

alter table public.payment_attempts
  add column discount_code_id uuid references public.discount_codes(id),
  add column discount_code text,
  add column original_subtotal numeric,
  add column discount_amount numeric not null default 0;
create index payment_attempts_discount_idx on public.payment_attempts(discount_code_id);
alter table public.bookings
  add column discount_code_id uuid references public.discount_codes(id),
  add column discount_code text,
  add column original_subtotal numeric,
  add column discount_amount numeric not null default 0;

create function public.quote_discount(p_code text, p_subtotal numeric, p_booking_type text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.discount_codes%rowtype; amount numeric; used integer; personal integer;
begin
  if p_subtotal is null or p_subtotal <= 0 or p_subtotal = 'NaN'::numeric then
    raise exception 'Invalid booking subtotal.';
  end if;
  select * into d from public.discount_codes where code = upper(trim(p_code)) for update;
  if not found or not d.is_active or d.starts_at > now() or d.expires_at <= now() then
    raise exception 'This discount code is invalid or no longer active.';
  end if;
  if d.booking_type is not null and d.booking_type <> p_booking_type then
    raise exception 'This code does not apply to this experience.';
  end if;
  if p_subtotal < d.minimum_subtotal then
    raise exception 'The booking does not meet this code''s minimum spend.';
  end if;
  select count(*), count(*) filter (where lower(trim(booking_payload->>'customer_email')) = lower(trim(p_email)))
    into used, personal from public.payment_attempts
    where discount_code_id = d.id and status <> 'abandoned';
  if used >= d.max_uses or personal >= d.max_uses_per_customer then
    raise exception 'This discount code has reached its usage limit.';
  end if;
  amount := round(case when d.discount_type = 'percentage' then p_subtotal * d.value / 100 else d.value end, 2);
  if amount >= p_subtotal then raise exception 'This code requires a booking subtotal greater than the discount.'; end if;
  return jsonb_build_object('id', d.id, 'code', d.code, 'discountAmount', amount,
    'subtotal', p_subtotal - amount, 'vatAmount', round((p_subtotal - amount) * 0.075, 2),
    'totalAmount', p_subtotal - amount + round((p_subtotal - amount) * 0.075, 2));
end;
$$;
revoke all on function public.quote_discount(text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.quote_discount(text,numeric,text,text) to service_role;

create function public.reserve_discount_checkout(p_reference text, p_request_key text, p_input jsonb, p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q jsonb; a public.payment_attempts%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_key, 1));
  select * into a from public.payment_attempts where request_key = p_request_key and status <> 'abandoned' order by created_at desc limit 1;
  if found then return to_jsonb(a); end if;
  q := public.quote_discount(p_input->>'discount_code', p_subtotal, p_input->>'booking_type', p_input->>'customer_email');
  if (p_input->>'total_amount')::numeric is distinct from (q->>'totalAmount')::numeric then
    raise exception 'The discount changed. Please apply the code again to review the updated total.';
  end if;
  insert into public.payment_attempts(payment_reference,request_key,booking_payload,quoted_amount,currency,
    discount_code_id,discount_code,original_subtotal,discount_amount)
  values(p_reference,p_request_key,p_input,(q->>'totalAmount')::numeric,'NGN',
    (q->>'id')::uuid,q->>'code',p_subtotal,(q->>'discountAmount')::numeric) returning * into a;
  return to_jsonb(a);
end;
$$;
revoke all on function public.reserve_discount_checkout(text,text,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.reserve_discount_checkout(text,text,jsonb,numeric) to service_role;

create function public.discount_code_usage()
returns table(discount_code_id uuid, reserved bigint, redeemed bigint)
language sql security definer set search_path = public as $$
  select a.discount_code_id, count(*) filter (where a.status <> 'abandoned'),
    count(*) filter (where a.status = 'confirmed')
  from public.payment_attempts a
  where exists (select 1 from public.profiles where id = auth.uid() and role = 'Admin')
  group by a.discount_code_id;
$$;
revoke all on function public.discount_code_usage() from public,anon;
grant execute on function public.discount_code_usage() to authenticated;

create or replace function public.apply_web_booking_vat()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.payment_attempts%rowtype;
begin
  if new.source is distinct from 'web' then return new; end if;
  new.subtotal_amount := round(coalesce(new.subtotal_amount,new.total_amount),2);
  new.original_subtotal := new.subtotal_amount;
  -- The context is set only inside service-role payment confirmation RPCs.
  select * into a from public.payment_attempts
    where payment_reference = current_setting('app.confirming_payment',true);
  if a.discount_code_id is not null then
    if a.status not in ('paid','confirmed') or a.original_subtotal is distinct from new.subtotal_amount
      or lower(trim(a.booking_payload->>'customer_email')) is distinct from lower(trim(new.customer_email)) then
      raise exception 'The discounted payment does not match this booking.';
    end if;
    new.discount_code_id := a.discount_code_id;
    new.discount_code := a.discount_code;
    new.discount_amount := a.discount_amount;
    new.subtotal_amount := new.subtotal_amount - a.discount_amount;
  end if;
  new.vat_rate := 0.075;
  new.vat_amount := round(new.subtotal_amount * new.vat_rate,2);
  new.total_amount := new.subtotal_amount + new.vat_amount;
  return new;
end;
$$;

create or replace function public.confirm_public_booking_payment(
  p_payment_reference text,
  p_expected_total numeric,
  p_currency text,
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
  v_existing public.bookings%rowtype;
  v_created jsonb;
  v_booking_id uuid;
  v_total numeric;
begin
  perform set_config('app.confirming_payment', trim(p_payment_reference), true);
  if nullif(trim(p_payment_reference), '') is null then
    raise exception 'Payment reference is required.';
  end if;

  -- Serialize the browser redirect and Paystack webhook for this transaction.
  perform pg_advisory_xact_lock(hashtextextended(trim(p_payment_reference), 0));

  select *
  into v_existing
  from public.bookings
  where payment_reference = trim(p_payment_reference)
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'reference_code', v_existing.reference_code,
      'status', v_existing.status,
      'payment_status', v_existing.payment_status,
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency
    );
  end if;

  v_created := public.submit_public_booking_request(
    p_booking_type,
    p_asset_id,
    p_booking_mode,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_guest_count,
    p_start_date,
    p_end_date,
    p_start_time,
    p_end_time,
    p_hours,
    p_rental_type,
    p_rental_route_id,
    p_parent_beach_house_booking_reference,
    p_notes,
    p_pickup_location_id
  );

  perform set_config('app.confirming_payment', '', true);
  v_booking_id := (v_created->>'id')::uuid;
  select total_amount into v_total from public.bookings where id = v_booking_id;

  if v_total is distinct from p_expected_total then
    raise exception 'The booking price changed after payment was initialized.';
  end if;

  update public.bookings
  set payment_reference = trim(p_payment_reference),
      payment_status = 'paid',
      status = 'confirmed',
      currency = upper(trim(p_currency))
  where id = v_booking_id
  returning * into v_existing;

  return jsonb_build_object(
    'id', v_existing.id,
    'reference_code', v_existing.reference_code,
    'status', v_existing.status,
    'payment_status', v_existing.payment_status,
    'total_amount', v_existing.total_amount,
    'currency', v_existing.currency
  );
end;
$$;

create or replace function public.confirm_public_beach_house_payment(
  p_payment_reference text,
  p_expected_total numeric,
  p_currency text,
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
  v_existing public.bookings%rowtype;
  v_created jsonb;
  v_booking_id uuid;
  v_total numeric;
begin
  perform set_config('app.confirming_payment', trim(p_payment_reference), true);
  if nullif(trim(p_payment_reference), '') is null then
    raise exception 'Payment reference is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(trim(p_payment_reference), 0));

  select * into v_existing
  from public.bookings
  where payment_reference = trim(p_payment_reference)
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'reference_code', v_existing.reference_code,
      'status', v_existing.status,
      'payment_status', v_existing.payment_status,
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency
    );
  end if;

  v_created := public.submit_public_beach_house_request(
    p_asset_id, p_booking_mode, p_customer_name, p_customer_email,
    p_customer_phone, p_guest_count, p_start_date, p_end_date, p_notes
  );
  perform set_config('app.confirming_payment', '', true);
  v_booking_id := (v_created->>'id')::uuid;
  select total_amount into v_total from public.bookings where id = v_booking_id;

  if v_total is distinct from p_expected_total then
    raise exception 'The booking price changed after payment was initialized.';
  end if;

  update public.bookings
  set payment_reference = trim(p_payment_reference),
      payment_status = 'paid',
      status = 'confirmed',
      currency = upper(trim(p_currency))
  where id = v_booking_id
  returning * into v_existing;

  return jsonb_build_object(
    'id', v_existing.id,
    'reference_code', v_existing.reference_code,
    'status', v_existing.status,
    'payment_status', v_existing.payment_status,
    'total_amount', v_existing.total_amount,
    'currency', v_existing.currency
  );
end;
$$;

create or replace function public.confirm_public_boat_transfer_payment(
  p_payment_reference text,
  p_expected_total numeric,
  p_currency text,
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
  v_existing public.bookings%rowtype;
  v_created jsonb;
  v_booking_id uuid;
  v_total numeric;
begin
  perform set_config('app.confirming_payment', trim(p_payment_reference), true);
  if nullif(trim(p_payment_reference), '') is null then
    raise exception 'Payment reference is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(trim(p_payment_reference), 0));

  select * into v_existing
  from public.bookings
  where payment_reference = trim(p_payment_reference)
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'reference_code', v_existing.reference_code,
      'status', v_existing.status,
      'payment_status', v_existing.payment_status,
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency
    );
  end if;

  v_created := public.submit_public_boat_transfer_request(
    p_asset_id, p_customer_name, p_customer_email, p_customer_phone,
    p_guest_count, p_start_date, p_start_time, p_rental_type,
    p_rental_route_id, p_parent_beach_house_booking_reference, p_notes
  );

  perform set_config('app.confirming_payment', '', true);
  v_booking_id := (v_created->>'id')::uuid;
  select total_amount into v_total from public.bookings where id = v_booking_id;

  if v_total is distinct from p_expected_total then
    raise exception 'The booking price changed after payment was initialized.';
  end if;

  update public.bookings
  set payment_reference = trim(p_payment_reference),
      payment_status = 'paid',
      status = 'confirmed',
      currency = upper(trim(p_currency))
  where id = v_booking_id
  returning * into v_existing;

  return jsonb_build_object(
    'id', v_existing.id,
    'reference_code', v_existing.reference_code,
    'status', v_existing.status,
    'payment_status', v_existing.payment_status,
    'total_amount', v_existing.total_amount,
    'currency', v_existing.currency
  );
end;
$$;

notify pgrst, 'reload schema';

revoke all on function public.confirm_public_booking_payment(
  text, numeric, text, text, uuid, text, text, text, text, integer,
  date, date, time, time, numeric, text, uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.confirm_public_booking_payment(
  text, numeric, text, text, uuid, text, text, text, text, integer,
  date, date, time, time, numeric, text, uuid, text, text, uuid
) to service_role;
revoke all on function public.confirm_public_beach_house_payment(
  text, numeric, text, uuid, text, text, text, text, integer, date, date, text
) from public, anon, authenticated;
grant execute on function public.confirm_public_beach_house_payment(
  text, numeric, text, uuid, text, text, text, text, integer, date, date, text
) to service_role;
revoke all on function public.confirm_public_boat_transfer_payment(
  text, numeric, text, uuid, text, text, text, integer, date, time,
  text, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.confirm_public_boat_transfer_payment(
  text, numeric, text, uuid, text, text, text, integer, date, time,
  text, uuid, text, text
) to service_role;
