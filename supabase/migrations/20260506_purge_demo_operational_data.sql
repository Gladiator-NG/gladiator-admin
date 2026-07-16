-- Purge demo/operational data so the client can start entering real records.
--
-- Intentionally preserved:
--   - auth.users
--   - public.profiles
--   - public.notification_preferences
--   - app/settings tables
--
-- Intentionally cleared:
--   - bookings and customers
--   - boats, beach houses, their image rows, and uploaded storage objects
--   - transport/boat-rental locations and route pricing
--   - activity notifications tied to the cleared operational records

begin;

-- Storage objects are not removed by truncating the image metadata tables.
delete from storage.objects
where bucket_id in ('boat-images', 'beach-house-images');

-- Activity feed rows tied to demo operational entities.
delete from public.notifications
where entity_type in ('booking', 'customer', 'boat', 'beach_house')
   or type in (
    'new_booking',
    'booking_status',
    'delete_booking',
    'new_customer',
    'delete_customer',
    'new_boat',
    'delete_boat',
    'new_beach_house',
    'delete_beach_house'
  );

-- Bookings reference boats, beach houses, customers, and themselves, so clear
-- them first. Customer stat triggers will fire, then customers are removed.
truncate table public.bookings restart identity cascade;
truncate table public.customers restart identity cascade;

-- Asset image tables are listed explicitly for older schemas; truncating the
-- parent tables with cascade would also clear them.
truncate table public.boat_images restart identity cascade;
truncate table public.boats restart identity cascade;

do $$
begin
  if to_regclass('public.beach_house_images') is not null then
    truncate table public.beach_house_images restart identity cascade;
  end if;
end $$;

truncate table public.beach_houses restart identity cascade;

-- Locations cascade into transport_routes, but both are listed for clarity.
truncate table public.transport_routes restart identity cascade;
truncate table public.locations restart identity cascade;

-- Keep the first real booking reference tidy after the purge.
alter sequence if exists public.gld_booking_seq restart with 10000;

commit;
