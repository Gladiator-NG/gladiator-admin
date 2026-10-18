-- A durable queue: new confirmations only, never a backfill of old customers.
create table public.booking_confirmation_emails (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  booking_snapshot jsonb not null,
  email_payload jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  provider_email_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.booking_confirmation_emails enable row level security;
revoke all on public.booking_confirmation_emails from anon, authenticated;
grant all on public.booking_confirmation_emails to service_role;
create index booking_confirmation_emails_due
  on public.booking_confirmation_emails (available_at)
  where status in ('pending', 'sending');

create or replace function public.queue_booking_confirmation_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare snapshot jsonb;
begin
  if new.status <> 'confirmed' or new.payment_status <> 'paid' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'confirmed' and old.payment_status = 'paid' then
      return new;
    end if;
  end if;
  snapshot := jsonb_build_object(
    'reference_code', new.reference_code, 'customer_name', new.customer_name,
    'customer_email', new.customer_email, 'booking_type', new.booking_type,
    'start_date', new.start_date, 'end_date', new.end_date,
    'start_time', new.start_time, 'end_time', new.end_time,
    'guest_count', new.guest_count, 'pickup_location', new.pickup_location,
    'dropoff_location', new.dropoff_location, 'total_amount', new.total_amount,
    'subtotal_amount', new.subtotal_amount, 'vat_amount', new.vat_amount,
    'currency', new.currency,
    'asset_name', coalesce(
      (select name from public.boats where id = new.boat_id),
      (select name from public.beach_houses where id = new.beach_house_id)
    )
  );
  insert into public.booking_confirmation_emails (booking_id, booking_snapshot)
    values (new.id, snapshot) on conflict (booking_id) do nothing;
  return new;
end;
$$;
create trigger booking_confirmation_email_queued
  after insert or update of status, payment_status on public.bookings
  for each row execute function public.queue_booking_confirmation_email();

-- Claim one job at a time, so overlapping cron runs cannot send it twice.
create or replace function public.claim_booking_confirmation_email()
returns setof public.booking_confirmation_emails
language plpgsql security definer set search_path = public as $$
begin
  -- Resend retains idempotency keys for 24h. Never blindly retry beyond that.
  update public.booking_confirmation_emails
  set status = 'failed', last_error = 'Retry limit reached; check provider logs before resending.'
  where status in ('pending', 'sending')
    and (lease_until is null or lease_until < now())
    and (attempts >= 8 or first_attempt_at < now() - interval '23 hours');

  update public.booking_confirmation_emails q
  set status = 'cancelled', last_error = 'Booking is no longer confirmed and paid.'
  from public.bookings b
  where b.id = q.booking_id and q.status in ('pending', 'sending')
    and (q.lease_until is null or q.lease_until < now())
    and (b.status not in ('confirmed', 'completed') or b.payment_status <> 'paid');

  return query
  update public.booking_confirmation_emails q
  set status = 'sending', attempts = q.attempts + 1,
      first_attempt_at = coalesce(q.first_attempt_at, now()),
      lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes'
  where q.id = (
    select j.id from public.booking_confirmation_emails j
    where j.status in ('pending', 'sending') and j.available_at <= now()
      and (j.lease_until is null or j.lease_until < now())
    order by j.created_at for update skip locked limit 1
  ) returning q.*;
end;
$$;
revoke all on function public.claim_booking_confirmation_email() from public, anon, authenticated;
grant execute on function public.claim_booking_confirmation_email() to service_role;

-- The scheduler's credential stays in Vault; only service-role callers can check it.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'booking_email_worker_token') then
    perform vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text,
      'booking_email_worker_token', 'Authenticates booking email cron calls');
  end if;
end $$;
create or replace function public.authorize_booking_email_worker(p_token text)
returns boolean language sql security definer set search_path = public as $$
  select coalesce(length(p_token) >= 64 and exists (
    select 1 from vault.decrypted_secrets
    where name = 'booking_email_worker_token' and decrypted_secret = p_token
  ), false);
$$;
revoke all on function public.authorize_booking_email_worker(text) from public, anon, authenticated;
grant execute on function public.authorize_booking_email_worker(text) to service_role;

create or replace function public.dispatch_booking_confirmation_emails()
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.booking_confirmation_emails where status in ('pending', 'sending')) then
    perform net.http_post(
      url := 'https://rmlhtwqwtrkyyyjjlpik.supabase.co/functions/v1/send-booking-confirmations',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-booking-email-token', (select decrypted_secret from vault.decrypted_secrets
          where name = 'booking_email_worker_token')),
      body := '{}'::jsonb, timeout_milliseconds := 120000
    );
  end if;
end;
$$;
revoke all on function public.dispatch_booking_confirmation_emails() from public, anon, authenticated;
select cron.schedule('send-booking-confirmations', '* * * * *',
  'select public.dispatch_booking_confirmation_emails()');

-- Restore the event envelope expected by the internal notification function.
create or replace function public.notify_new_booking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://rmlhtwqwtrkyyyjjlpik.supabase.co/functions/v1/notify-new-booking',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-booking-email-token', (select decrypted_secret from vault.decrypted_secrets
        where name = 'booking_email_worker_token')),
    body := jsonb_build_object('type', 'INSERT', 'table', 'bookings', 'schema', 'public',
      'record', to_jsonb(new) || jsonb_build_object(
        'boat_name', (select name from public.boats where id = new.boat_id),
        'beach_house_name', (select name from public.beach_houses where id = new.beach_house_id)),
      'old_record', null)
  );
  return new;
end;
$$;
notify pgrst, 'reload schema';
