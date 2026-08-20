-- A 15-argument `submit_public_booking_request` (predating
-- p_parent_beach_house_booking_reference) is still present in the live
-- database even though 20260605000100 intended to drop it. With the
-- 17-argument version added in 20260819000100, PostgREST can no longer pick a
-- candidate for calls that omit p_pickup_location_id and fails with PGRST203:
--
--   Could not choose the best candidate function between: ...
--
-- That breaks the deliberate backward compatibility of the 17-argument
-- version, whose p_pickup_location_id defaults to null. Drop the stale
-- overload so exactly one candidate remains.

drop function if exists public.submit_public_booking_request(
  text, uuid, text, text, text, text, integer, date, date, time, time,
  numeric, text, uuid, text
);

notify pgrst, 'reload schema';
