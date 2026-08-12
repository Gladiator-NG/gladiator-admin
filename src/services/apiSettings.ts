import supabase from './supabase';

export interface AppSettings {
  boat_curfew_time: string | null; // HH:MM, e.g. "20:00"
  boat_curfew_enabled: boolean; // true = curfew enforced, false = disabled
  boat_curfew_reopen_time: string;
  booking_whatsapp_number: string;
}

const DEFAULTS: AppSettings = {
  boat_curfew_time: null,
  boat_curfew_enabled: true,
  boat_curfew_reopen_time: '08:00',
  booking_whatsapp_number: '2348000000000',
};

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value');

  // Return defaults if the table doesn't exist yet or access is blocked
  if (error) return { ...DEFAULTS };

  const result = { ...DEFAULTS };
  for (const row of data ?? []) {
    if (row.key === 'boat_curfew_time') {
      result.boat_curfew_time = row.value || null;
    }
    if (row.key === 'boat_curfew_enabled') {
      result.boat_curfew_enabled = row.value === 'true';
    }
    if (row.key === 'boat_curfew_reopen_time') {
      result.boat_curfew_reopen_time = row.value || DEFAULTS.boat_curfew_reopen_time;
    }
    if (row.key === 'booking_whatsapp_number') {
      result.booking_whatsapp_number =
        row.value || DEFAULTS.booking_whatsapp_number;
    }
  }
  return result;
}

export async function updateSetting(
  key: keyof AppSettings,
  value: string | boolean,
): Promise<void> {
  // Store booleans as strings for consistency
  const storeValue = typeof value === 'boolean' ? String(value) : value;
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: storeValue, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
}
