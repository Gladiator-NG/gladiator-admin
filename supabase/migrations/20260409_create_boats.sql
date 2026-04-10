-- ── Boats table ───────────────────────────────────────────────────────────────

create table if not exists public.boats (
  id                        uuid        primary key default gen_random_uuid(),
  name                      text        not null,
  slug                      text        not null unique,
  cover_image_id            uuid,                          -- soft FK added below
  description               text,
  location                  text,
  pickup_location           text,
  max_guests                integer,
  cabins                    integer,
  boat_type                 text,
  price_per_hour            numeric,
  is_active                 boolean     not null default true,
  min_booking_hours         integer,
  max_booking_hours         integer,
  is_available_for_transport boolean    not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ── Boat images table ─────────────────────────────────────────────────────────

create table if not exists public.boat_images (
  id         uuid        primary key default gen_random_uuid(),
  boat_id    uuid        not null references public.boats(id) on delete cascade,
  image_url  text        not null,
  position   integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Deferred FK: boats.cover_image_id → boat_images.id ───────────────────────
-- Deferrable to avoid circular insert ordering issues.

alter table public.boats
  add constraint boats_cover_image_id_fkey
  foreign key (cover_image_id)
  references public.boat_images(id)
  on delete set null
  deferrable initially deferred;

-- ── updated_at trigger function (idempotent) ─────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger boats_updated_at
  before update on public.boats
  for each row execute function public.handle_updated_at();

create trigger boat_images_updated_at
  before update on public.boat_images
  for each row execute function public.handle_updated_at();

-- ── Row-level security ────────────────────────────────────────────────────────

alter table public.boats       enable row level security;
alter table public.boat_images enable row level security;

create policy "Authenticated users can read boats"
  on public.boats for select to authenticated using (true);

create policy "Authenticated users can insert boats"
  on public.boats for insert to authenticated with check (true);

create policy "Authenticated users can update boats"
  on public.boats for update to authenticated using (true);

create policy "Authenticated users can delete boats"
  on public.boats for delete to authenticated using (true);

create policy "Authenticated users can read boat_images"
  on public.boat_images for select to authenticated using (true);

create policy "Authenticated users can insert boat_images"
  on public.boat_images for insert to authenticated with check (true);

create policy "Authenticated users can update boat_images"
  on public.boat_images for update to authenticated using (true);

create policy "Authenticated users can delete boat_images"
  on public.boat_images for delete to authenticated using (true);

-- ── Storage bucket ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('boat-images', 'boat-images', true)
on conflict (id) do nothing;

create policy "Public read access to boat images"
  on storage.objects for select
  using (bucket_id = 'boat-images');

create policy "Authenticated users can upload boat images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'boat-images');

create policy "Authenticated users can update boat images"
  on storage.objects for update to authenticated
  using (bucket_id = 'boat-images');

create policy "Authenticated users can delete boat images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'boat-images');
