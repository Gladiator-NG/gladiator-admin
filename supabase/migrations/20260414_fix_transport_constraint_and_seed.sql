-- ── Fix 1: beach house exclusion constraint ───────────────────────────────────
-- Transport bookings reference a destination beach house but do NOT "occupy" it
-- (the actual stay is captured by the parent beach_house booking).
-- Excluding transport from the overlap check lets both records coexist.

ALTER TABLE public.bookings DROP CONSTRAINT no_overlapping_beach_house_bookings;

ALTER TABLE public.bookings ADD CONSTRAINT no_overlapping_beach_house_bookings
  EXCLUDE USING gist (
    beach_house_id WITH =,
    booking_range WITH &&
  )
  WHERE (
    status <> 'cancelled'
    AND beach_house_id IS NOT NULL
    AND booking_type <> 'transport'
  );

-- ── Fix 2: insert the missing linked transport booking ────────────────────────
-- GLD-10040 (Adaeze Okonkwo, Coral Cove Villa, 25-Apr → 28-Apr) had no boat
-- transport sub-booking because the previous seed was blocked by the constraint
-- above.  Insert it now with the correct parent reference.

INSERT INTO public.bookings (
  id,
  booking_type,
  boat_id,
  beach_house_id,
  parent_beach_house_booking_id,
  customer_id,
  customer_name,
  customer_email,
  customer_phone,
  guest_count,
  start_date,
  end_date,
  start_time,
  end_time,
  transport_type,
  total_amount,
  status,
  payment_status,
  source,
  notes
)
SELECT
  gen_random_uuid(),
  'transport',
  'afb77155-f1f2-4e2d-88e1-22c4783f7421',   -- Azure Wave
  'c18b7821-1eb8-485c-a4c6-1ffac22169ee',   -- Coral Cove Villa (destination)
  '38a720cf-3f02-423f-95c1-00bfb7e9ff88',   -- GLD-10040 parent stay
  c.id,
  'Adaeze Okonkwo',
  'adaeze.okonkwo@gmail.com',
  '+2348012345678',
  4,
  '2026-04-25',
  '2026-04-28',
  '07:00'::time without time zone,
  '09:00'::time without time zone,
  'round_trip',
  80000,
  'confirmed',
  'paid',
  'web',
  'Boat shuttle linked to beach house stay GLD-10040 — Azure Wave, round trip'
FROM public.customers c
WHERE lower(c.email) = 'adaeze.okonkwo@gmail.com'
LIMIT 1
ON CONFLICT DO NOTHING;
