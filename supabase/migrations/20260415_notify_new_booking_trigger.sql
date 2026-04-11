-- Enable pg_net for making HTTP requests from PostgreSQL
create extension if not exists pg_net with schema extensions;

-- Trigger function: fires the notify-new-booking edge function on every INSERT
create or replace function notify_new_booking()
returns trigger
language plpgsql
security definer
as $$
declare
  _project_ref     text := 'rmlhtwqwtrkyyyjjlpik';
  _function_url    text;
  _boat_name       text;
  _beach_house_name text;
  _record          jsonb;
begin
  _function_url := 'https://' || _project_ref || '.supabase.co/functions/v1/notify-new-booking';

  -- Look up the asset name so the email can display it
  if new.boat_id is not null then
    select name into _boat_name from public.boats where id = new.boat_id;
  end if;

  if new.beach_house_id is not null then
    select name into _beach_house_name from public.beach_houses where id = new.beach_house_id;
  end if;

  -- Merge the looked-up names into the booking record
  _record := row_to_json(new)::jsonb
    || jsonb_build_object(
         'boat_name',        _boat_name,
         'beach_house_name', _beach_house_name
       );

  -- Wrap in the standard Supabase webhook payload shape
  perform net.http_post(
    url     := _function_url,
    body    := json_build_object(
                 'type',       'INSERT',
                 'table',      'bookings',
                 'schema',     'public',
                 'record',     _record,
                 'old_record', null
               )::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    )
  );

  return new;
end;
$$;

-- Attach the trigger to the bookings table
drop trigger if exists on_booking_inserted on public.bookings;

create trigger on_booking_inserted
  after insert on public.bookings
  for each row
  execute function notify_new_booking();
