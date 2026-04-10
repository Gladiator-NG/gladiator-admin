-- ── Locations ────────────────────────────────────────────────────────────────
-- A curated list of pickup / drop-off points used for transport bookings.
create table if not exists public.locations (
  id          uuid    primary key default gen_random_uuid(),
  name        text    not null unique,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed with initial locations
insert into public.locations (name, sort_order) values
  ('Gladiator Beach Resort', 1),
  ('Victoria Island', 2),
  ('Lekki Phase 1', 3),
  ('Lekki Phase 2', 4),
  ('Ajah', 5),
  ('Ikoyi', 6),
  ('Banana Island', 7),
  ('Lagos Island (CMS)', 8),
  ('Epe', 9)
on conflict (name) do nothing;

-- ── Transport Routes ──────────────────────────────────────────────────────────
-- Defines a fixed price for a given pickup → drop-off location pair.
-- Prices are directional — from_location → to_location may differ from the
-- reverse. A null price means the route is not yet configured.
create table if not exists public.transport_routes (
  id               uuid    primary key default gen_random_uuid(),
  from_location_id uuid    not null references public.locations(id) on delete cascade,
  to_location_id   uuid    not null references public.locations(id) on delete cascade,
  price_per_trip   numeric check (price_per_trip >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- A route pair must be unique per direction
  unique (from_location_id, to_location_id)
);

create index if not exists transport_routes_from_idx on public.transport_routes (from_location_id);
create index if not exists transport_routes_to_idx   on public.transport_routes (to_location_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.locations       enable row level security;
alter table public.transport_routes enable row level security;

-- Allow authenticated users (admins) full access
create policy "Admins can manage locations"
  on public.locations for all
  to authenticated using (true) with check (true);

create policy "Admins can manage transport routes"
  on public.transport_routes for all
  to authenticated using (true) with check (true);

-- Allow anonymous read (so the web booking form can list them)
create policy "Anyone can read active locations"
  on public.locations for select
  to anon using (is_active = true);

create policy "Anyone can read active routes"
  on public.transport_routes for select
  to anon using (is_active = true);
