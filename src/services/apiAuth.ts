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

  const signedInUser = data.user;
  if (signedInUser?.id) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        last_logged_in_at:
          signedInUser.last_sign_in_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', signedInUser.id);

    if (profileError) {
      console.warn(
        'Unable to sync last login timestamp:',
        profileError.message,
      );
    }
  }

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

export async function ensureRecoverySessionFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const type = hashParams.get('type');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (type === 'recovery' && accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw new Error(error.message);

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
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
