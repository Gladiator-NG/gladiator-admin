-- Overnight return transfers are not sold online: the boat does not stay at
-- the destination, so the return leg is a separate operational run that needs
-- confirmation. Operations log them as two ordinary transfer bookings — an
-- outbound and a return on the later date — and this column records the link
-- between them.
--
-- Deliberately NOT reusing parent_beach_house_booking_id: that column means
-- "this transfer serves this beach-house stay" and a return transfer may exist
-- without any beach-house booking at all. `rental_type` ('outbound' / 'return')
-- already distinguishes the legs; this only records which outbound a return
-- belongs to.

alter table public.bookings
  add column if not exists return_of_booking_id uuid
    references public.bookings(id) on delete set null;

create index if not exists bookings_return_of_booking_idx
  on public.bookings (return_of_booking_id)
  where return_of_booking_id is not null;

-- A booking cannot be its own return leg.
alter table public.bookings
  drop constraint if exists bookings_return_of_booking_not_self;

alter table public.bookings
  add constraint bookings_return_of_booking_not_self
  check (return_of_booking_id is null or return_of_booking_id <> id);

notify pgrst, 'reload schema';
