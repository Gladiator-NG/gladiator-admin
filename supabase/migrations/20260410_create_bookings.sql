-- ═══════════════════════════════════════════════════════════════════════════════
-- Bookings schema
-- ═══════════════════════════════════════════════════════════════════════════════
-- Design notes:
--  • reference_code is auto-generated from a sequence via a BEFORE INSERT
--    trigger — app code never needs to supply it.
--  • booking_range (tsrange) is auto-computed from start_date+start_time and
--    end_date+end_time. A GiST index + EXCLUDE constraint on it prevents
--    double-bookings at the DB level for each resource.
--  • The EXCLUDE constraint is partial (WHERE status <> 'cancelled') so
--    cancelled bookings never block future slots.
--  • customers.email has a unique index so repeated bookers share one record.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable btree_gist so we can combine non-range columns in EXCLUDE constraints.
create extension if not exists btree_gist;

-- ── Reference-code sequence ───────────────────────────────────────────────────

create sequence if not exists public.gld_booking_seq
  start with 10000
  increment by 1
  no cycle;

-- ── Customers ─────────────────────────────────────────────────────────────────

create table if not exists public.customers (
  id               uuid        primary key default gen_random_uuid(),

  user_id          uuid        references auth.users(id) on delete set null,

  full_name        text        not null,
  email            text        not null,
  phone            text        not null default '',

  marketing_opt_in boolean     not null default false,

  total_bookings   integer     not null default 0,
  total_spent      numeric     not null default 0,

  last_booking_at  timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Unique email so repeated bookers share one customer record.
create unique index if not exists customers_email_idx
  on public.customers (lower(email));

create index if not exists customers_phone_idx
  on public.customers (phone);

-- ── Bookings ──────────────────────────────────────────────────────────────────

create table if not exists public.bookings (
  id                              uuid        primary key default gen_random_uuid(),

  booking_type                    text        not null
    check (booking_type in ('boat_cruise', 'beach_house', 'transport')),

  reference_code                  text        not null unique,

  -- Resource FKs (exactly one of boat_id / beach_house_id should be non-null
  -- for non-transport bookings; transport bookings may reference either).
  boat_id                         uuid        references public.boats(id)         on delete set null,
  beach_house_id                  uuid        references public.beach_houses(id)  on delete set null,

  -- Links a transport booking back to the beach-house stay it belongs to.
  parent_beach_house_booking_id   uuid        references public.bookings(id)      on delete set null,

  customer_id                     uuid        references public.customers(id)     on delete set null,

  -- Denormalised customer snapshot so we keep data even if customer is deleted.
  customer_name                   text        not null,
  customer_email                  text        not null,
  customer_phone                  text        not null default '',

  guest_count                     integer     not null default 1
    check (guest_count > 0),

  start_date                      date        not null,
  end_date                        date        not null,
  start_time                      time,
  end_time                        time,

  -- Computed range for overlap detection (kept in sync by trigger below).
  booking_range                   tsrange     not null
    generated always as (
      tsrange(
        (start_date + coalesce(start_time, '00:00:00'))::timestamp,
        (end_date   + coalesce(end_time,   '23:59:59'))::timestamp,
        '[)'
      )
    ) stored,

  transport_type                  text
    check (transport_type in ('outbound', 'return', 'round_trip') or transport_type is null),

  total_amount                    numeric     not null default 0
    check (total_amount >= 0),
  currency                        text        not null default 'NGN',

  status                          text        not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'expired')),

  payment_status                  text        not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  payment_reference               text,

  source                          text        not null default 'admin'
    check (source in ('admin', 'web', 'mobile')),

  notes                           text,

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

-- ── Overlap / double-booking prevention ──────────────────────────────────────
-- Each active (non-cancelled) booking for the same boat must not overlap.
create unique index if not exists bookings_reference_code_idx
  on public.bookings (reference_code);

-- GiST index used by EXCLUDE constraints and availability queries.
create index if not exists bookings_boat_range_idx
  on public.bookings using gist (boat_id, booking_range)
  where boat_id is not null;

create index if not exists bookings_beach_house_range_idx
  on public.bookings using gist (beach_house_id, booking_range)
  where beach_house_id is not null;

-- Prevent overlapping active bookings for the same boat.
alter table public.bookings
  add constraint no_overlapping_boat_bookings
  exclude using gist (
    boat_id         with =,
    booking_range   with &&
  )
  where (status <> 'cancelled' and boat_id is not null);

-- Prevent overlapping active bookings for the same beach house.
alter table public.bookings
  add constraint no_overlapping_beach_house_bookings
  exclude using gist (
    beach_house_id  with =,
    booking_range   with &&
  )
  where (status <> 'cancelled' and beach_house_id is not null);

-- Supporting lookup indexes.
create index if not exists bookings_customer_id_idx
  on public.bookings (customer_id);

create index if not exists bookings_status_idx
  on public.bookings (status);

create index if not exists bookings_start_date_idx
  on public.bookings (start_date);

create index if not exists bookings_booking_type_idx
  on public.bookings (booking_type);

-- ── Reference-code trigger ────────────────────────────────────────────────────
-- Fires BEFORE INSERT so reference_code is set before the unique constraint
-- is checked. Skips if the caller somehow supplies one (admin import).

create or replace function public.set_booking_reference_code()
returns trigger as $$
begin
  if new.reference_code is null or new.reference_code = '' then
    new.reference_code := 'GLD-' || lpad(nextval('public.gld_booking_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger bookings_set_reference_code
  before insert on public.bookings
  for each row execute function public.set_booking_reference_code();

-- ── updated_at triggers ───────────────────────────────────────────────────────

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.handle_updated_at();

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.handle_updated_at();

-- ── Customer stat maintenance ─────────────────────────────────────────────────
-- Keeps total_bookings, total_spent, last_booking_at in sync automatically.

create or replace function public.sync_customer_booking_stats()
returns trigger as $$
declare
  v_customer_id uuid;
begin
  -- Determine which customer_id to refresh (handle INSERT, UPDATE, DELETE).
  if TG_OP = 'DELETE' then
    v_customer_id := old.customer_id;
  else
    v_customer_id := new.customer_id;
  end if;

  if v_customer_id is null then
    return coalesce(new, old);
  end if;

  update public.customers
  set
    total_bookings  = (
      select count(*)
      from   public.bookings
      where  customer_id = v_customer_id
        and  status <> 'cancelled'
    ),
    total_spent     = (
      select coalesce(sum(total_amount), 0)
      from   public.bookings
      where  customer_id   = v_customer_id
        and  payment_status = 'paid'
    ),
    last_booking_at = (
      select max(created_at)
      from   public.bookings
      where  customer_id = v_customer_id
        and  status <> 'cancelled'
    )
  where id = v_customer_id;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger bookings_sync_customer_stats
  after insert or update of status, payment_status, customer_id, total_amount
    or delete
  on public.bookings
  for each row execute function public.sync_customer_booking_stats();

-- ── Row-level security ────────────────────────────────────────────────────────

alter table public.customers enable row level security;
alter table public.bookings  enable row level security;

-- Customers
create policy "Authenticated users can read customers"
  on public.customers for select to authenticated using (true);

create policy "Authenticated users can insert customers"
  on public.customers for insert to authenticated with check (true);

create policy "Authenticated users can update customers"
  on public.customers for update to authenticated using (true);

create policy "Authenticated users can delete customers"
  on public.customers for delete to authenticated using (true);

-- Bookings
create policy "Authenticated users can read bookings"
  on public.bookings for select to authenticated using (true);

create policy "Authenticated users can insert bookings"
  on public.bookings for insert to authenticated with check (true);

create policy "Authenticated users can update bookings"
  on public.bookings for update to authenticated using (true);

create policy "Authenticated users can delete bookings"
  on public.bookings for delete to authenticated using (true);
