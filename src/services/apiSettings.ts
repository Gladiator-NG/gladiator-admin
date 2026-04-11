import supabase from './supabase';

export interface AppSettings {
  boat_curfew_time: string | null; // HH:MM, e.g. "20:00"
}

const DEFAULTS: AppSettings = {
  boat_curfew_time: null,
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
  }
  return result;
}

export async function updateSetting(
  key: keyof AppSettings,
  value: string,
): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
}
