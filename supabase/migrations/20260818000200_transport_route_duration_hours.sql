-- `transport_routes.duration_hours` has been live in production and read by
-- booking functions since the public-booking migrations, but it was never
-- added through a tracked migration — a fresh database bootstrap could not
-- reproduce it. This makes the column reproducible and documents its role:
-- it is how long the boat is blocked out of service for a boat_rental
-- booking on this route (however that plays out for the route — outbound
-- only, with a return leg, turnaround time, etc.), used to compute the
-- booking's occupied time range for availability checks and the
-- no_overlapping_boat_bookings exclusion constraint. Every booking function
-- already falls back to `coalesce(duration_hours, 1)`, so this add is safe
-- for existing rows.

alter table public.transport_routes
  add column if not exists duration_hours numeric;

alter table public.transport_routes
  drop constraint if exists transport_routes_duration_hours_check;

alter table public.transport_routes
  add constraint transport_routes_duration_hours_check
  check (duration_hours is null or duration_hours > 0);

notify pgrst, 'reload schema';
