-- Add per-type notification preference columns
alter table public.notification_preferences
  add column if not exists notif_new_booking     boolean not null default true,
  add column if not exists notif_booking_status  boolean not null default true,
  add column if not exists notif_new_boat        boolean not null default true,
  add column if not exists notif_new_beach_house boolean not null default true,
  add column if not exists notif_new_customer    boolean not null default true,
  add column if not exists notif_new_user        boolean not null default true;
