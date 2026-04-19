import supabase from './supabase';
import { buildAppUrl } from '../config/app';

export interface Profile {
  id: string;
  email?: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
  last_logged_in_at?: string | null;
}

export async function getUsers(): Promise<Profile[]> {
  const { data, error } = await supabase.functions.invoke('list-users');

  if (!error && !data?.error) {
    return (data?.users ?? []) as Profile[];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (fallbackError) throw new Error(fallbackError.message);
  return (fallbackData ?? []) as Profile[];
}

export async function updateUser({
  userId,
  role,
}: {
  userId: string;
  role: string;
}): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function deleteUser(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-user', {
    body: { userId },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

export async function createUser({
  email,
  fullName,
  role,
}: {
  email: string;
  fullName: string;
  role: string;
}): Promise<Profile> {
  const redirectTo = buildAppUrl('/signin');

  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { email, fullName, role, redirectTo },
  });

  if (error) {
    let message = error.message;
    const maybeResponse = (error as { context?: unknown }).context;

    if (maybeResponse instanceof Response) {
      try {
        const payload = (await maybeResponse.clone().json()) as {
          error?: string;
        };
        if (payload?.error) message = payload.error;
      } catch {
        // Fall back to the original error message.
      }
    }

    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);

  return (data?.user ?? null) as Profile;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // PGRST116 = row not found — not an error, just no profile yet
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data;
}

export async function upsertProfile({
  userId,
  firstName,
  lastName,
}: {
  userId: string;
  firstName: string;
  lastName: string;
}): Promise<Profile> {
  const fullName = `${firstName} ${lastName}`.trim();

  // Write to profiles table
  const { data, error: dbError } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, full_name: fullName, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
    .select()
    .single();

  if (dbError) throw new Error(dbError.message);

  // Keep auth user_metadata in sync for display across the app
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
    },
  });

  if (authError) throw new Error(authError.message);

  return data as Profile;
}
