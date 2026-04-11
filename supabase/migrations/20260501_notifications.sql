-- ── Shared notifications (append-only feed) ───────────────────────────────
create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  type        text        not null,
  -- new_booking | booking_status | new_boat | new_beach_house | new_customer | new_user
  title       text        not null,
  message     text        not null,
  entity_id   uuid,
  entity_type text,       -- booking | boat | beach_house | customer | user
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ── Per-user read state ────────────────────────────────────────────────────
create table if not exists public.notification_reads (
  user_id         uuid references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, notification_id)
);

-- ── Per-user preferences (email stored so edge function can query without auth join) ──
create table if not exists public.notification_preferences (
  user_id             uuid        primary key references auth.users(id) on delete cascade,
  email               text,
  email_notifications boolean     not null default true,
  updated_at          timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.notifications         enable row level security;
alter table public.notification_reads    enable row level security;
alter table public.notification_preferences enable row level security;

create policy "Authenticated can read notifications"
  on public.notifications for select
  to authenticated using (true);

create policy "Service role can insert notifications"
  on public.notifications for insert
  to service_role with check (true);

-- Allow the security definer trigger functions (which run as the table owner)
-- to insert notifications by granting insert to postgres role
grant insert on public.notifications to postgres;

create policy "Users manage own reads"
  on public.notification_reads for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own preferences"
  on public.notification_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Service role reads preferences"
  on public.notification_preferences for select
  to service_role using (true);

-- ── Trigger: new booking ──────────────────────────────────────────────────
create or replace function public.notif_on_new_booking()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (type, title, message, entity_id, entity_type, metadata)
  values (
    'new_booking',
    'New Booking: ' || coalesce(new.reference_code, 'Unknown'),
    coalesce(new.customer_name, 'Unknown') || ' · ' || coalesce(new.booking_type, 'booking'),
    new.id,
    'booking',
    jsonb_build_object(
      'reference_code', new.reference_code,
      'customer_name',  new.customer_name,
      'booking_type',   new.booking_type,
      'total_amount',   new.total_amount,
      'status',         new.status
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notif_new_booking on public.bookings;
create trigger trg_notif_new_booking
  after insert on public.bookings
  for each row execute function public.notif_on_new_booking();

-- ── Trigger: booking status change ───────────────────────────────────────
create or replace function public.notif_on_booking_status()
returns trigger language plpgsql security definer as $$
begin
  if old.status is distinct from new.status then
    insert into public.notifications (type, title, message, entity_id, entity_type, metadata)
    values (
      'booking_status',
      'Booking ' || coalesce(new.reference_code, 'Updated'),
      'Status changed: ' || coalesce(old.status, '?') || ' → ' || coalesce(new.status, '?'),
      new.id,
      'booking',
      jsonb_build_object(
        'reference_code', new.reference_code,
        'customer_name',  new.customer_name,
        'old_status',     old.status,
        'new_status',     new.status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notif_booking_status on public.bookings;
create trigger trg_notif_booking_status
  after update on public.bookings
  for each row execute function public.notif_on_booking_status();

-- ── Trigger: new boat ─────────────────────────────────────────────────────
create or replace function public.notif_on_new_boat()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (type, title, message, entity_id, entity_type, metadata)
  values (
    'new_boat',
    'New Boat Added',
    '"' || coalesce(new.name, 'Unknown') || '" has been added to the fleet',
    new.id,
    'boat',
    jsonb_build_object('name', new.name, 'boat_type', new.boat_type)
  );
  return new;
end;
$$;

drop trigger if exists trg_notif_new_boat on public.boats;
create trigger trg_notif_new_boat
  after insert on public.boats
  for each row execute function public.notif_on_new_boat();

-- ── Trigger: new beach house ──────────────────────────────────────────────
create or replace function public.notif_on_new_beach_house()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (type, title, message, entity_id, entity_type, metadata)
  values (
    'new_beach_house',
    'New Beach House Added',
    '"' || coalesce(new.name, 'Unknown') || '" has been added',
    new.id,
    'beach_house',
    jsonb_build_object('name', new.name)
  );
  return new;
end;
$$;

drop trigger if exists trg_notif_new_beach_house on public.beach_houses;
create trigger trg_notif_new_beach_house
  after insert on public.beach_houses
  for each row execute function public.notif_on_new_beach_house();

-- ── Trigger: new customer ─────────────────────────────────────────────────
create or replace function public.notif_on_new_customer()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (type, title, message, entity_id, entity_type, metadata)
  values (
    'new_customer',
    'New Customer',
    coalesce(new.full_name, 'Unknown') || ' joined',
    new.id,
    'customer',
    jsonb_build_object('full_name', new.full_name, 'email', new.email)
  );
  return new;
end;
$$;

drop trigger if exists trg_notif_new_customer on public.customers;
create trigger trg_notif_new_customer
  after insert on public.customers
  for each row execute function public.notif_on_new_customer();
