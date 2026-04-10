-- Re-create the trigger function without the webhook secret requirement
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
