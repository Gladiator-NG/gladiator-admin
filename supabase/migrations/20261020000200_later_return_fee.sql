-- Later-day return pickups on boat transfers.
--
-- A transfer price already covers taking the customer out and collecting them
-- the same day. When the customer wants collecting on a later day instead, the
-- team agrees that run and its extra cost with them directly, so staff record
-- it against the booking they already have: the date it was agreed for, and
-- the amount negotiated.
--
-- The fee is stored apart from total_amount so it stays visible on the booking
-- and can be reported on, rather than disappearing into a changed total.
--
-- Note the booking's own date range is deliberately left alone. Stretching it
-- to the later date would mark the boat busy for every day in between, when it
-- is only out for two short runs.

alter table public.bookings
  add column if not exists later_return_date date;

alter table public.bookings
  add column if not exists later_return_fee numeric(12, 2) not null default 0;

alter table public.bookings
  drop constraint if exists bookings_later_return_fee_non_negative;

alter table public.bookings
  add constraint bookings_later_return_fee_non_negative
  check (later_return_fee >= 0);

create index if not exists bookings_later_return_date_idx
  on public.bookings (later_return_date)
  where later_return_date is not null;

notify pgrst, 'reload schema';
