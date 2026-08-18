-- Intentionally disabled.
--
-- This historical migration previously deleted all operational records
-- (bookings, customers, boats, beach houses, images, locations, and routes).
-- Operational data must never be removed as part of schema deployment.
-- Any future data cleanup must be a separately reviewed, explicitly executed
-- administrative operation with a verified backup and narrowly scoped targets.

select 1;
