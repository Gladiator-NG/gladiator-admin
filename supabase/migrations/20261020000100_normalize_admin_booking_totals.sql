-- Older manual bookings could store the subtotal as total_amount while still
-- having a VAT snapshot. Correct those records and enforce the invariant for
-- future admin edits/status updates.
update public.bookings
set total_amount = round(coalesce(subtotal_amount, total_amount) - coalesce(discount_amount, 0) + coalesce(vat_amount, 0), 2)
where source = 'admin'
  and subtotal_amount is not null
  and vat_amount is not null
  and vat_amount > 0
  and total_amount = subtotal_amount;

create or replace function public.normalize_admin_booking_total()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'admin'
     and new.subtotal_amount is not null
     and new.vat_amount is not null then
    new.total_amount := round(
      new.subtotal_amount - coalesce(new.discount_amount, 0) + new.vat_amount, 2
    );
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_normalize_admin_total on public.bookings;
create trigger bookings_normalize_admin_total
before insert or update on public.bookings
for each row execute function public.normalize_admin_booking_total();
