-- The transfer-price trigger runs after bookings_normalize_admin_total and
-- used to overwrite the final total with the bare route price on INSERT.
create or replace function public.enforce_new_boat_transfer_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price numeric;
begin
  if new.booking_type <> 'boat_rental' then
    return new;
  end if;

  if new.rental_type = 'round_trip' then
    raise exception 'Round-trip transfers are no longer offered. Book each direction separately.';
  end if;

  select price
  into v_price
  from public.boat_transfer_prices
  where boat_id = new.boat_id
    and route_id = new.rental_route_id
    and is_active = true;

  if not found then
    raise exception 'That vessel is not priced for the selected transfer route.';
  end if;

  -- Admin subtotal snapshots already include any applied discount and agreed
  -- later-return fee. Do not replace that VAT-inclusive total with route price.
  if new.source = 'admin' then
    new.total_amount := round(
      coalesce(new.subtotal_amount, v_price + coalesce(new.later_return_fee, 0))
      + coalesce(new.vat_amount, 0), 2
    );
  else
    new.total_amount := v_price;
  end if;
  new.hours := null;
  new.rental_type := coalesce(new.rental_type, 'outbound');
  return new;
end;
$$;

-- subtotal_amount is the net subtotal: discounts have already been deducted
-- by apply_admin_booking_discount. Subtracting them again undercharges VAT rows.
create or replace function public.normalize_admin_booking_total()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'admin'
     and new.subtotal_amount is not null
     and new.vat_amount is not null then
    new.total_amount := round(new.subtotal_amount + new.vat_amount, 2);
  end if;
  return new;
end;
$$;

-- Repair the reported booking only when its snapshots still match the exact
-- known failure; do not alter a subsequently edited price or payment status.
update public.bookings
set total_amount = subtotal_amount + vat_amount
where reference_code = 'GLD-10138'
  and source = 'admin'
  and subtotal_amount = 920000
  and vat_amount = 69000
  and coalesce(discount_amount, 0) = 0
  and total_amount = 920000;
