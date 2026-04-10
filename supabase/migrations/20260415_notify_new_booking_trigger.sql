-- Enable pg_net for making HTTP requests from PostgreSQL
create extension if not exists pg_net with schema extensions;

-- Trigger function: fires the notify-new-booking edge function on every INSERT
create or replace function notify_new_booking()
returns trigger
language plpgsql
security definer
as $$
declare
  _project_ref  text := 'rmlhtwqwtrkyyyjjlpik';
  _function_url text;
  _anon_key     text := current_setting('app.supabase_anon_key', true);
begin
  _function_url := 'https://' || _project_ref || '.supabase.co/functions/v1/notify-new-booking';

  perform extensions.http_post(
    url     := _function_url,
    body    := row_to_json(new)::text,
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
