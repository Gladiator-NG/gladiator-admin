-- ─────────────────────────────────────────────────────────────────────────────
-- Activity log: add actor_name to notifications, allow admin UI inserts,
-- and drop the DB triggers that the admin UI now handles (with actor info).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add actor_name column (who performed the action)
alter table public.notifications
  add column if not exists actor_name text;

-- 2. Allow authenticated users (admin UI) to insert notifications directly
--    (DB triggers already have a "Postgres can insert" policy from migration 20260501)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'notifications'
      and policyname = 'Authenticated can insert notifications'
  ) then
    create policy "Authenticated can insert notifications"
      on public.notifications
      for insert
      to authenticated
      with check (true);
  end if;
end $$;

-- 3. Drop DB triggers that the admin UI now handles with actor attribution.
--    trg_notif_new_customer and trg_notif_new_user are kept (system events).
drop trigger if exists trg_notif_new_booking     on public.bookings;
drop trigger if exists trg_notif_booking_status  on public.bookings;
drop trigger if exists trg_notif_new_boat        on public.boats;
drop trigger if exists trg_notif_new_beach_house on public.beach_houses;

-- 4. Add per-type preference columns for the new activity types
alter table public.notification_preferences
  add column if not exists notif_delete_booking     boolean not null default true,
  add column if not exists notif_delete_customer    boolean not null default true,
  add column if not exists notif_delete_boat        boolean not null default true,
  add column if not exists notif_delete_beach_house boolean not null default true,
  add column if not exists notif_delete_user        boolean not null default true;
