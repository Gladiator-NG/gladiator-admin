import supabase from './supabase';
import { buildAppUrl } from '../config/app';

export async function signInWithEmail({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string) {
  const redirectTo = buildAppUrl('/signin?reset=password');

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfile({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
    },
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function verifyAndUpdatePassword({
  email,
  currentPassword,
  newPassword,
}: {
  email: string;
  currentPassword: string;
  newPassword: string;
}) {
  // Re-authenticate with current password to verify identity
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (signInError) throw new Error('Current password is incorrect');

  // Current password verified — now update to the new one and mark changed
  const { data, error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
    data: { password_changed: true },
  });

  if (updateError) throw new Error(updateError.message);
  return data;
}

export async function completePasswordRecovery(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { password_changed: true },
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function getUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);

  return user;
}
