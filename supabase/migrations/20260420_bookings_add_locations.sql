-- Add pickup and drop-off location columns to bookings.
-- These reference human-readable location names (denormalised for resilience —
-- if a location is deleted the booking still shows where it was).
alter table public.bookings
  add column if not exists pickup_location    text,
  add column if not exists dropoff_location   text;
