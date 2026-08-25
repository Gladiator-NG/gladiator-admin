-- Record and apply Nigeria's 7.5% VAT to new customer-facing web bookings.
-- Existing bookings are intentionally left unchanged because their historical
-- totals represent amounts already quoted or collected.

alter table public.bookings
  add column if not exists subtotal_amount numeric,
  add column if not exists vat_rate numeric,
  add column if not exists vat_amount numeric;

alter table public.bookings
  drop constraint if exists bookings_subtotal_amount_nonnegative,
  drop constraint if exists bookings_vat_rate_nonnegative,
  drop constraint if exists bookings_vat_amount_nonnegative;

alter table public.bookings
  add constraint bookings_subtotal_amount_nonnegative
    check (subtotal_amount is null or subtotal_amount >= 0),
  add constraint bookings_vat_rate_nonnegative
    check (vat_rate is null or vat_rate >= 0),
  add constraint bookings_vat_amount_nonnegative
    check (vat_amount is null or vat_amount >= 0);

create or replace function public.apply_web_booking_vat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vat_rate constant numeric := 0.075;
begin
  if new.source is distinct from 'web' then
    return new;
  end if;

  new.subtotal_amount := round(coalesce(new.subtotal_amount, new.total_amount), 2);
  new.vat_rate := v_vat_rate;
  new.vat_amount := round(new.subtotal_amount * v_vat_rate, 2);
  new.total_amount := round(new.subtotal_amount + new.vat_amount, 2);

  return new;
end;
$$;

drop trigger if exists zz_apply_web_booking_vat on public.bookings;
create trigger zz_apply_web_booking_vat
  before insert on public.bookings
  for each row execute function public.apply_web_booking_vat();

comment on column public.bookings.subtotal_amount is
  'Booking price before VAT. Populated for new web bookings from 2026-08-25.';
comment on column public.bookings.vat_rate is
  'VAT rate stored as a decimal, for example 0.075 for 7.5%.';
comment on column public.bookings.vat_amount is
  'VAT charged for this booking in the booking currency.';

notify pgrst, 'reload schema';
