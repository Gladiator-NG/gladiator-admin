-- Normalize each boat's home/boarding jetty while retaining legacy text fields
-- for booking snapshots and older reports.

alter table public.boats
  add column if not exists jetty_location_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'boats_jetty_location_id_fkey'
  ) then
    alter table public.boats
      add constraint boats_jetty_location_id_fkey
      foreign key (jetty_location_id)
      references public.locations(id)
      on delete set null;
  end if;
end $$;

create index if not exists boats_jetty_location_idx
  on public.boats (jetty_location_id)
  where jetty_location_id is not null;

update public.boats b
set jetty_location_id = l.id
from public.locations l
where b.jetty_location_id is null
  and (
    lower(trim(l.name)) = lower(trim(b.pickup_location))
    or lower(trim(l.name)) = lower(trim(b.location))
  );

create or replace function public.sync_boat_jetty_location_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.jetty_location_id is null then
    new.pickup_location := null;
    new.location := null;
  else
    select name into new.pickup_location
    from public.locations
    where id = new.jetty_location_id;
    new.location := new.pickup_location;
  end if;
  return new;
end;
$$;

drop trigger if exists boats_sync_jetty_location on public.boats;
create trigger boats_sync_jetty_location
  before insert or update of jetty_location_id on public.boats
  for each row execute function public.sync_boat_jetty_location_name();

create or replace function public.propagate_location_name_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.boats
    set pickup_location = new.name, location = new.name
    where jetty_location_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists locations_propagate_name on public.locations;
create trigger locations_propagate_name
  after update of name on public.locations
  for each row execute function public.propagate_location_name_changes();

create or replace function public.propagate_experience_location_name_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.beach_houses
    set location = new.name
    where experience_location_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists experience_locations_propagate_name
  on public.experience_locations;
create trigger experience_locations_propagate_name
  after update of name on public.experience_locations
  for each row execute function public.propagate_experience_location_name_changes();

