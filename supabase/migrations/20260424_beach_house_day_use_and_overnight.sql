-- Add daytime/overnight pricing fields for beach houses and explicit
-- booking-mode data for beach house bookings.

ALTER TABLE public.beach_houses
  ADD COLUMN IF NOT EXISTS day_use_price_per_hour numeric,
  ADD COLUMN IF NOT EXISTS day_use_min_hours integer,
  ADD COLUMN IF NOT EXISTS day_use_max_hours integer,
  ADD COLUMN IF NOT EXISTS late_checkout_price_per_hour numeric;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS beach_house_booking_mode text,
  ADD COLUMN IF NOT EXISTS late_checkout_hours numeric not null default 0;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_beach_house_booking_mode_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_beach_house_booking_mode_check
  CHECK (
    beach_house_booking_mode IN ('day_use', 'overnight')
    OR beach_house_booking_mode IS NULL
  );

UPDATE public.bookings
SET beach_house_booking_mode = 'overnight'
WHERE booking_type = 'beach_house'
  AND beach_house_booking_mode IS NULL;
