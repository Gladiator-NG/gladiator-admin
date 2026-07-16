-- Public website access is intentionally limited to active catalogue entries
-- and a boolean availability check. Customer and booking rows remain private.

drop policy if exists "Website can read active boats" on public.boats;
create policy "Website can read active boats"
  on public.boats for select to anon
  using (is_active = true);

drop policy if exists "Website can read active boat images" on public.boat_images;
create policy "Website can read active boat images"
  on public.boat_images for select to anon
  using (
    exists (
      select 1
      from public.boats
      where boats.id = boat_images.boat_id
        and boats.is_active = true
    )
  );

do $$
begin
  if to_regclass('public.beach_houses') is not null then
    execute 'drop policy if exists "Website can read active beach houses" on public.beach_houses';
    execute $policy$
      create policy "Website can read active beach houses"
        on public.beach_houses for select to anon
        using (is_active = true)
    $policy$;
  end if;

  if to_regclass('public.beach_house_images') is not null then
    execute 'drop policy if exists "Website can read active beach house images" on public.beach_house_images';
    execute $policy$
      create policy "Website can read active beach house images"
        on public.beach_house_images for select to anon
        using (
          exists (
            select 1
            from public.beach_houses
            where beach_houses.id = beach_house_images.beach_house_id
              and beach_houses.is_active = true
          )
        )
    $policy$;
  end if;

  if to_regclass('public.app_settings') is not null then
    execute 'drop policy if exists "Website can read charter operating settings" on public.app_settings';
    execute $policy$
      create policy "Website can read charter operating settings"
        on public.app_settings for select to anon
        using (key in ('boat_curfew_time', 'boat_curfew_enabled'))
    $policy$;
  end if;
end $$;

create or replace function public.check_public_availability(
  p_resource_type text,
  p_resource_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_time time default null,
  p_end_time time default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_range tsrange;
begin
  if p_resource_type not in ('boat', 'beach_house') then
    raise exception 'Unsupported resource type';
  end if;

  if p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date then
    return false;
  end if;

  if p_resource_type = 'boat'
    and not exists (
      select 1 from public.boats
      where id = p_resource_id and is_active = true
    ) then
    return false;
  end if;

  if p_resource_type = 'beach_house'
    and not exists (
      select 1 from public.beach_houses
      where id = p_resource_id and is_active = true
    ) then
    return false;
  end if;

  requested_range := tsrange(
    (p_start_date + coalesce(p_start_time, '00:00:00'))::timestamp,
    (p_end_date + coalesce(p_end_time, '23:59:59'))::timestamp,
    '[)'
  );

  return not exists (
    select 1
    from public.bookings
    where status in ('pending', 'confirmed')
      and (
        (p_resource_type = 'boat' and boat_id = p_resource_id)
        or (
          p_resource_type = 'beach_house'
          and beach_house_id = p_resource_id
          and booking_type <> 'boat_rental'
        )
      )
      and booking_range && requested_range
  );
end;
$$;

revoke all on function public.check_public_availability(
  text, uuid, date, date, time, time
) from public;
grant execute on function public.check_public_availability(
  text, uuid, date, date, time, time
) to anon, authenticated;
