-- Backfill auth metadata used by the admin app's password setup gate.
--
-- These flags live in auth.users.raw_user_meta_data JSONB, so there is no
-- schema column to add. Existing password-based users are considered ready;
-- invited users without an encrypted password must complete password setup.

update auth.users
set
  raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
      'password_changed', true,
      'invite_pending', false
    ),
  updated_at = now()
where encrypted_password is not null
  and (
    raw_user_meta_data ->> 'password_changed' is distinct from 'true'
    or raw_user_meta_data ->> 'invite_pending' is distinct from 'false'
  );

update auth.users
set
  raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
      'password_changed', false,
      'invite_pending', true
    ),
  updated_at = now()
where encrypted_password is null
  and invited_at is not null
  and (
    raw_user_meta_data ->> 'password_changed' is distinct from 'false'
    or raw_user_meta_data ->> 'invite_pending' is distinct from 'true'
  );
