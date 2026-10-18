-- Include the full pricing breakdown in queued customer confirmation receipts.
create or replace function public.queue_booking_confirmation_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare snapshot jsonb;
begin
  if new.status <> 'confirmed' or new.payment_status <> 'paid' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' and old.payment_status = 'paid' then return new; end if;
  snapshot := jsonb_build_object(
    'reference_code', new.reference_code, 'customer_name', new.customer_name,
    'customer_email', new.customer_email, 'booking_type', new.booking_type,
    'start_date', new.start_date, 'end_date', new.end_date,
    'start_time', new.start_time, 'end_time', new.end_time,
    'guest_count', new.guest_count, 'pickup_location', new.pickup_location,
    'dropoff_location', new.dropoff_location, 'total_amount', new.total_amount,
    'subtotal_amount', new.subtotal_amount, 'vat_amount', new.vat_amount,
    'discount_code', new.discount_code, 'discount_amount', new.discount_amount,
    'currency', new.currency,
    'asset_name', coalesce((select name from public.boats where id = new.boat_id),
      (select name from public.beach_houses where id = new.beach_house_id))
  );
  insert into public.booking_confirmation_emails (booking_id, booking_snapshot)
    values (new.id, snapshot) on conflict (booking_id) do nothing;
  return new;
end;
$$;
