-- ── Fix overlap constraints to only block pending/confirmed bookings ──────────
--
-- The original constraints used `WHERE status <> 'cancelled'`, which means
-- completed and expired bookings would still block the same date range for
-- new bookings. This replaces them with `status IN ('pending', 'confirmed')`
-- so only truly active bookings occupy a slot.
--
-- Run manually in the Supabase SQL Editor if the CLI cannot reach the DB.
-- ─────────────────────────────────────────────────────────────────────────────

-- Boat bookings
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_overlapping_boat_bookings;

ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_boat_bookings
  EXCLUDE USING GIST (
    boat_id       WITH =,
    booking_range WITH &&
  )
  WHERE (status IN ('pending', 'confirmed') AND boat_id IS NOT NULL);

-- Beach house bookings
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_overlapping_beach_house_bookings;

ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlapping_beach_house_bookings
  EXCLUDE USING GIST (
    beach_house_id WITH =,
    booking_range  WITH &&
  )
  WHERE (status IN ('pending', 'confirmed') AND beach_house_id IS NOT NULL);
