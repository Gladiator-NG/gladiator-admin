-- `source` records the technical origin of a booking (admin/web/mobile) and is
-- set programmatically — it stays as-is. Operations also need to know which
-- marketing channel actually produced a booking (a DM on Instagram, a WhatsApp
-- enquiry, a walk-in) so the team can measure conversion per channel. That is a
-- separate dimension: an admin-entered booking always has source 'admin'
-- regardless of whether the lead came from TikTok or a phone call.
--
-- Nullable: historical bookings have no known channel, and web checkouts do not
-- collect one.

alter table public.bookings
  add column if not exists booking_channel text;

alter table public.bookings
  drop constraint if exists bookings_booking_channel_check;

alter table public.bookings
  add constraint bookings_booking_channel_check
  check (
    booking_channel is null
    or booking_channel in (
      'instagram',
      'tiktok',
      'facebook',
      'whatsapp',
      'x',
      'phone_call',
      'email',
      'walk_in',
      'referral',
      'returning_customer',
      'website',
      'other'
    )
  );

-- Reporting groups bookings by channel over a date range.
create index if not exists bookings_booking_channel_idx
  on public.bookings (booking_channel)
  where booking_channel is not null;

notify pgrst, 'reload schema';
