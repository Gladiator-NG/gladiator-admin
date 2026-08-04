-- Make paid website checkouts durable and idempotent.

create table if not exists public.payment_attempts (
  payment_reference text primary key,
  request_key text not null,
  booking_payload jsonb not null,
  quoted_amount numeric not null check (quoted_amount > 0),
  currency text not null default 'NGN',
  authorization_url text,
  provider_status text,
  status text not null default 'initialized'
    check (status in ('initialized', 'abandoned', 'paid', 'confirmed', 'requires_attention')),
  booking_id uuid references public.bookings(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_attempts_request_key_idx
  on public.payment_attempts (request_key, created_at desc);

create unique index if not exists payment_attempts_active_request_key_idx
  on public.payment_attempts (request_key)
  where status = 'initialized';

create unique index if not exists bookings_payment_reference_idx
  on public.bookings (payment_reference)
  where payment_reference is not null;

alter table public.payment_attempts enable row level security;
revoke all on table public.payment_attempts from anon, authenticated;

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

  if to_regprocedure(
    'public.submit_public_booking_request(text,uuid,text,text,text,text,integer,date,date,time,time,numeric,text,uuid,text,text)'
  ) is not null then
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
      p_notes
    );
  else
    if nullif(trim(p_parent_beach_house_booking_reference), '') is not null then
      raise exception 'Linked waterfront transfers are not available yet.';
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
      p_notes
    );
  end if;

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

revoke all on function public.confirm_public_booking_payment(
  text, numeric, text, text, uuid, text, text, text, text, integer,
  date, date, time, time, numeric, text, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.confirm_public_booking_payment(
  text, numeric, text, text, uuid, text, text, text, text, integer,
  date, date, time, time, numeric, text, uuid, text, text
) to service_role;

notify pgrst, 'reload schema';
