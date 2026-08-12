-- Separate customer-facing waterfront destinations from operational jetties.
-- `locations` remains the source of truth for boat boarding and transfer routes.

create table if not exists public.experience_locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists experience_locations_name_idx
  on public.experience_locations (lower(trim(name)));

create index if not exists experience_locations_active_order_idx
  on public.experience_locations (is_active, sort_order, name);

drop trigger if exists experience_locations_updated_at
  on public.experience_locations;
create trigger experience_locations_updated_at
  before update on public.experience_locations
  for each row execute function public.handle_updated_at();

alter table public.experience_locations enable row level security;

drop policy if exists "Admins can manage experience locations"
  on public.experience_locations;
create policy "Admins can manage experience locations"
  on public.experience_locations for all
  to authenticated using (true) with check (true);

drop policy if exists "Anyone can read active experience locations"
  on public.experience_locations;
create policy "Anyone can read active experience locations"
  on public.experience_locations for select
  to anon using (is_active = true);

alter table public.beach_houses
  add column if not exists experience_location_id uuid,
  add column if not exists arrival_jetty_location_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'beach_houses_experience_location_id_fkey'
  ) then
    alter table public.beach_houses
      add constraint beach_houses_experience_location_id_fkey
      foreign key (experience_location_id)
      references public.experience_locations(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'beach_houses_arrival_jetty_location_id_fkey'
  ) then
    alter table public.beach_houses
      add constraint beach_houses_arrival_jetty_location_id_fkey
      foreign key (arrival_jetty_location_id)
      references public.locations(id)
      on delete set null;
  end if;
end $$;

create index if not exists beach_houses_experience_location_idx
  on public.beach_houses (experience_location_id)
  where experience_location_id is not null;

create index if not exists beach_houses_arrival_jetty_idx
  on public.beach_houses (arrival_jetty_location_id)
  where arrival_jetty_location_id is not null;

-- Preserve any existing beach-house location values as experience destinations.
insert into public.experience_locations (name, sort_order)
select distinct trim(h.location),
       dense_rank() over (order by lower(trim(h.location)))
from public.beach_houses h
where nullif(trim(h.location), '') is not null
on conflict do nothing;

update public.beach_houses h
set experience_location_id = e.id
from public.experience_locations e
where h.experience_location_id is null
  and nullif(trim(h.location), '') is not null
  and lower(trim(e.name)) = lower(trim(h.location));

-- If a former location value exactly matched a jetty, retain that logistical
-- relationship too. Admins can change it independently after the migration.
update public.beach_houses h
set arrival_jetty_location_id = l.id
from public.locations l
where h.arrival_jetty_location_id is null
  and nullif(trim(h.location), '') is not null
  and lower(trim(l.name)) = lower(trim(h.location));

-- Keep the legacy location text populated for reports and booking snapshots
-- while the apps transition to the normalized experience location relation.
create or replace function public.sync_beach_house_experience_location_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.experience_location_id is null then
    new.location := null;
  else
    select name into new.location
    from public.experience_locations
    where id = new.experience_location_id;
  end if;
  return new;
end;
$$;

drop trigger if exists beach_houses_sync_experience_location
  on public.beach_houses;
create trigger beach_houses_sync_experience_location
  before insert or update of experience_location_id on public.beach_houses
  for each row execute function public.sync_beach_house_experience_location_name();

-- Enforce the 12-photo catalogue limit at the data layer as well as in admin.
create or replace function public.enforce_boat_image_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.boat_images where boat_id = new.boat_id) >= 12 then
    raise exception 'A boat can have at most 12 photos.';
  end if;
  return new;
end;
$$;

drop trigger if exists boat_images_limit
  on public.boat_images;
create trigger boat_images_limit
  before insert on public.boat_images
  for each row execute function public.enforce_boat_image_limit();

create or replace function public.enforce_beach_house_image_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.beach_house_images
    where beach_house_id = new.beach_house_id
  ) >= 12 then
    raise exception 'A beach house can have at most 12 photos.';
  end if;
  return new;
end;
$$;

drop trigger if exists beach_house_images_limit
  on public.beach_house_images;
create trigger beach_house_images_limit
  before insert on public.beach_house_images
  for each row execute function public.enforce_beach_house_image_limit();

