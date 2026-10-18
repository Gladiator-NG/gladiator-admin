-- Keep manual redemptions separate from online payment attempts.
create table public.admin_discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.bookings(id) on delete set null,
  discount_code_id uuid not null references public.discount_codes(id),
  customer_email text not null,
  redeemed boolean not null default false,
  created_at timestamptz not null default now()
);
create index admin_discount_redemptions_code_idx on public.admin_discount_redemptions(discount_code_id);
alter table public.admin_discount_redemptions enable row level security;
revoke all on public.admin_discount_redemptions from anon, authenticated;

create or replace function public.quote_discount(p_code text, p_subtotal numeric, p_booking_type text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.discount_codes%rowtype; amount numeric; used integer; personal integer;
begin
  if p_subtotal is null or p_subtotal <= 0 or p_subtotal = 'NaN'::numeric then
    raise exception 'Invalid booking subtotal.';
  end if;
  p_subtotal := round(p_subtotal, 2);
  select * into d from public.discount_codes where code = upper(trim(p_code)) for update;
  if not found or not d.is_active or d.starts_at > now() or d.expires_at <= now() then
    raise exception 'This discount code is invalid or no longer active.';
  end if;
  if d.booking_type is not null and d.booking_type <> p_booking_type then
    raise exception 'This code does not apply to this experience.';
  end if;
  if p_subtotal < d.minimum_subtotal then
    raise exception 'The booking does not meet this code''s minimum spend.';
  end if;
  select count(*), count(*) filter (where lower(trim(email)) = lower(trim(p_email))) into used, personal
  from (
    select booking_payload->>'customer_email' as email from public.payment_attempts
      where discount_code_id = d.id and status <> 'abandoned'
    union all
    select customer_email from public.admin_discount_redemptions where discount_code_id = d.id
  ) uses;
  if used >= d.max_uses or personal >= d.max_uses_per_customer then
    raise exception 'This discount code has reached its usage limit.';
  end if;
  amount := round(case when d.discount_type = 'percentage' then p_subtotal * d.value / 100 else d.value end, 2);
  if amount >= p_subtotal then raise exception 'This code requires a booking subtotal greater than the discount.'; end if;
  return jsonb_build_object('id', d.id, 'code', d.code, 'discountAmount', amount,
    'subtotal', p_subtotal - amount, 'vatAmount', round((p_subtotal - amount) * 0.075, 2),
    'totalAmount', p_subtotal - amount + round((p_subtotal - amount) * 0.075, 2));
end;
$$;

create function public.quote_admin_discount(p_code text, p_subtotal numeric, p_booking_type text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('Admin','Staff')) then
    raise exception 'Only Admin and Staff users can apply booking discounts.' using errcode = '42501';
  end if;
  if nullif(trim(p_email), '') is null then raise exception 'Enter the customer email before applying a code.'; end if;
  return public.quote_discount(p_code, p_subtotal, p_booking_type, p_email);
end;
$$;
revoke all on function public.quote_admin_discount(text,numeric,text,text) from public,anon;
grant execute on function public.quote_admin_discount(text,numeric,text,text) to authenticated;

create function public.apply_admin_booking_discount()
returns trigger language plpgsql security definer set search_path = public as $$
declare q jsonb; subtotal numeric; vat numeric; total numeric;
begin
  if new.source <> 'admin' then return new; end if;
  if nullif(trim(new.discount_code), '') is null then
    new.discount_code := null;
    new.discount_code_id := null;
    new.discount_amount := 0;
    return new;
  end if;
  q := public.quote_admin_discount(new.discount_code, new.original_subtotal, new.booking_type, new.customer_email);
  subtotal := (q->>'subtotal')::numeric;
  if new.vat_rate is null or new.vat_rate not in (0, 0.075) then raise exception 'Invalid VAT selection.'; end if;
  vat := round(subtotal * new.vat_rate, 2);
  total := subtotal + vat;
  if new.total_amount is distinct from total then
    raise exception 'The discount changed. Please apply the code again to review the updated total.';
  end if;
  new.discount_code_id := (q->>'id')::uuid;
  new.discount_code := q->>'code';
  new.discount_amount := (q->>'discountAmount')::numeric;
  new.original_subtotal := round(new.original_subtotal, 2);
  new.subtotal_amount := subtotal;
  new.vat_amount := vat;
  new.total_amount := total;
  return new;
end;
$$;
create trigger bookings_apply_admin_discount before insert on public.bookings
for each row execute function public.apply_admin_booking_discount();

create function public.record_admin_discount_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' and new.source = 'admin' and new.discount_code_id is not null then
    insert into public.admin_discount_redemptions(booking_id,discount_code_id,customer_email,redeemed)
      values(new.id,new.discount_code_id,lower(trim(new.customer_email)),new.status in ('confirmed','completed'));
  elsif TG_OP = 'UPDATE' then
    update public.admin_discount_redemptions
      set redeemed = redeemed or new.status in ('confirmed','completed') where booking_id = new.id;
  end if;
  return new;
end;
$$;
create trigger bookings_record_admin_discount after insert or update on public.bookings
for each row execute function public.record_admin_discount_redemption();

create or replace function public.discount_code_usage()
returns table(discount_code_id uuid, reserved bigint, redeemed bigint)
language sql security definer set search_path = public as $$
  select uses.discount_code_id, count(*), count(*) filter (where uses.redeemed)
  from (
    select a.discount_code_id, a.status = 'confirmed' as redeemed from public.payment_attempts a
      where a.discount_code_id is not null and a.status <> 'abandoned'
    union all
    select a.discount_code_id, a.redeemed from public.admin_discount_redemptions a
  ) uses
  where exists (select 1 from public.profiles where id = auth.uid() and role = 'Admin')
  group by uses.discount_code_id;
$$;
notify pgrst, 'reload schema';
