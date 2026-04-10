-- Fix notify_new_booking trigger: pg_net lives in the `net` schema, not
-- `extensions`, and its http_post function expects jsonb for the body, not text.
create or replace function notify_new_booking()
returns trigger
language plpgsql
security definer
as $$
declare
  _project_ref  text := 'rmlhtwqwtrkyyyjjlpik';
  _function_url text;
begin
  _function_url := 'https://' || _project_ref || '.supabase.co/functions/v1/notify-new-booking';

  perform net.http_post(
    url     := _function_url,
    body    := row_to_json(new)::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    )
  );

  return new;
end;
$$;
