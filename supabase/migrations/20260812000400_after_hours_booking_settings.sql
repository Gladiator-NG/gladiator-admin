-- Define a complete daily online-booking window and a public WhatsApp handoff.

insert into public.app_settings (key, value)
values
  ('boat_curfew_reopen_time', '08:00'),
  ('booking_whatsapp_number', '2348000000000')
on conflict (key) do nothing;

drop policy if exists "Website can read charter operating settings"
  on public.app_settings;
create policy "Website can read charter operating settings"
  on public.app_settings for select to anon
  using (
    key in (
      'boat_curfew_time',
      'boat_curfew_enabled',
      'boat_curfew_reopen_time',
      'booking_whatsapp_number'
    )
  );

