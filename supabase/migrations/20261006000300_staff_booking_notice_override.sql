-- Let every authenticated operations user log an agreed exception.
-- Public website and service-role inserts still receive the normal notice rules.
create or replace function public.enforce_booking_minimum_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notice interval;
begin
  if exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('Admin', 'Staff')
  ) then
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if new.start_date is not distinct from old.start_date
      and new.start_time is not distinct from old.start_time then
      return new;
    end if;
  end if;

  v_notice := case
    when new.booking_type = 'beach_house' then interval '24 hours'
    else interval '2 hours'
  end;

  if ((new.start_date + coalesce(new.start_time, time '00:00'))
      at time zone 'Africa/Lagos') < statement_timestamp() + v_notice then
    if new.booking_type = 'beach_house' then
      raise exception 'Beach house bookings require at least 24 hours notice. For same-day bookings, please contact the Gladiator team on WhatsApp.'
        using errcode = '23514';
    end if;

    raise exception 'Bookings require at least 2 hours notice. Please choose a later start time (Lagos time).'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
