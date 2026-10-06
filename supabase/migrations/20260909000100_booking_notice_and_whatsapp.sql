-- Apply to every booking source, including direct admin inserts and public RPCs.
create or replace function public.enforce_booking_minimum_notice()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Routine payment/status updates must still work for existing bookings.
  if TG_OP = 'UPDATE' then
    if new.start_date is not distinct from old.start_date
      and new.start_time is not distinct from old.start_time then
      return new;
    end if;
  end if;

  if ((new.start_date + coalesce(new.start_time, time '00:00'))
      at time zone 'Africa/Lagos') < statement_timestamp() + interval '2 hours' then
    raise exception 'Bookings require at least 2 hours notice. Please choose a later start time (Lagos time).'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger bookings_enforce_minimum_notice
before insert or update of start_date, start_time on public.bookings
for each row execute function public.enforce_booking_minimum_notice();

insert into public.app_settings (key, value)
values ('booking_whatsapp_number', '2349165063000')
on conflict (key) do update set value = excluded.value;
