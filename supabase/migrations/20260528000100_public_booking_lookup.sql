-- Public booking lookup for the customer website.
-- Customers must provide both their reference code and the email or phone used
-- for the booking. This avoids granting direct public read access to bookings.

create or replace function public.lookup_public_booking(
  p_reference_code text,
  p_customer_contact text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact text := nullif(trim(p_customer_contact), '');
  v_contact_phone text := regexp_replace(coalesce(p_customer_contact, ''), '\D', '', 'g');
  v_result jsonb;
begin
  if nullif(trim(p_reference_code), '') is null or v_contact is null then
    return null;
  end if;

  select jsonb_build_object(
    'reference_code', b.reference_code,
    'booking_type', b.booking_type,
    'asset_label', coalesce(boat.name, house.name),
    'status', b.status,
    'payment_status', b.payment_status,
    'guest_count', b.guest_count,
    'start_date', b.start_date,
    'end_date', b.end_date,
    'start_time', b.start_time,
    'end_time', b.end_time,
    'total_amount', b.total_amount,
    'currency', b.currency
  )
  into v_result
  from public.bookings b
  left join public.boats boat on boat.id = b.boat_id
  left join public.beach_houses house on house.id = b.beach_house_id
  where upper(b.reference_code) = upper(trim(p_reference_code))
    and (
      lower(b.customer_email) = lower(v_contact)
      or (
        v_contact_phone <> ''
        and regexp_replace(coalesce(b.customer_phone, ''), '\D', '', 'g') = v_contact_phone
      )
    )
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.lookup_public_booking(text, text) from public;
grant execute on function public.lookup_public_booking(text, text) to anon, authenticated;
