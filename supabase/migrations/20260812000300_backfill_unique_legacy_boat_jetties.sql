-- Backfill legacy area-only boat locations when exactly one curated jetty
-- contains that area name. Ambiguous areas remain unset for an admin to choose.

update public.boats b
set jetty_location_id = (
  select l.id
  from public.locations l
  where lower(trim(l.name)) like '%' || lower(trim(b.pickup_location)) || '%'
  limit 1
)
where b.jetty_location_id is null
  and nullif(trim(b.pickup_location), '') is not null
  and (
    select count(*)
    from public.locations l
    where lower(trim(l.name)) like '%' || lower(trim(b.pickup_location)) || '%'
  ) = 1;

