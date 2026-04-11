import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import FormInput from '../../ui/formElements/FormInput';
import Button from '../../ui/Button';
import { useUser } from '../authentication/useUser';
import { useProfile } from './useProfile';
import { useUpdateProfile } from './useUpdateProfile';
import { useUpdatePassword } from './useUpdatePassword';
import { useNotificationPreferences } from '../notifications/useNotifications';
import styles from './ProfileHome.module.css';

// ── Details form ──────────────────────────────────────
interface DetailsFields {
  firstName: string;
  lastName: string;
}

// ── Password form ─────────────────────────────────────
interface PasswordFields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function ProfileHome() {
  const { user } = useUser();
  const { profile, isLoading: isLoadingProfile } = useProfile();
  const { update, isPending: isUpdating } = useUpdateProfile();
  const { changePassword, isPending: isChangingPw } = useUpdatePassword();
  const {
    preferences,
    savePreferences,
    isSaving: isSavingPrefs,
  } = useNotificationPreferences();

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const role = profile?.role ?? (user?.user_metadata?.role as string) ?? '';

  // Parse first/last from full_name stored in DB, fall back to auth metadata
  const storedFullName =
    profile?.full_name ?? (user?.user_metadata?.full_name as string) ?? '';
  const [storedFirst = '', storedLast = ''] = storedFullName.split(' ');
  const displayName = storedFullName || user?.email || 'Admin User';
  const initial = displayName.charAt(0).toUpperCase();

  const joinedAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const badgeClass =
    role.toLowerCase() === 'admin' ? styles.badgeAdmin : styles.badgeStaff;

  // ── Details form ──────────────────────────────────
  const {
    register: detailsRegister,
    handleSubmit: handleDetailsSubmit_,
    formState: { errors: detailsErrors },
    reset: resetDetails,
  } = useForm<DetailsFields>({
    defaultValues: { firstName: '', lastName: '' },
  });
  const detailsFormActions = {
    register: detailsRegister,
    errors: detailsErrors,
  };

  // Pre-fill form once profile data arrives from DB
  useEffect(() => {
    if (!isLoadingProfile) {
      resetDetails({ firstName: storedFirst, lastName: storedLast });
    }
  }, [isLoadingProfile, storedFirst, storedLast, resetDetails]);

  function handleDetailsSubmit(data: DetailsFields) {
    update({ firstName: data.firstName, lastName: data.lastName });
  }

  // ── Password form ─────────────────────────────────
  const {
    register: passwordRegister,
    handleSubmit: handlePasswordSubmit_,
    formState: { errors: passwordErrors },
    setError: setPasswordError,
    reset: resetPassword,
  } = useForm<PasswordFields>();
  const passwordFormActions = {
    register: passwordRegister,
    errors: passwordErrors,
  };

  function handlePasswordSubmit(data: PasswordFields) {
    if (data.newPassword !== data.confirmPassword) {
      setPasswordError('confirmPassword', {
        message: 'Passwords do not match',
      });
      return;
    }
    changePassword(
      {
        email: user!.email!,
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
      { onSuccess: () => resetPassword() },
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Profile</h1>

      {/* ── Security reminder ── */}
      {user?.user_metadata?.password_changed === false && (
        <div className={styles.securityReminder}>
          <AlertTriangle size={18} />
          <span>
            You’re using the default password. Please{' '}
            <strong>update your password</strong> below to secure your account.
          </span>
        </div>
      )}

      {/* ── Banner ── */}
      <div className={styles.banner}>
        <div className={styles.bannerAvatar}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile avatar" />
          ) : (
            <span>{initial}</span>
          )}
        </div>

        <div className={styles.bannerInfo}>
          <span className={styles.bannerName}>{displayName}</span>
          <span className={styles.bannerEmail}>{user?.email}</span>
          <div className={styles.bannerMeta}>
            <span className={`${styles.badge} ${badgeClass}`}>{role}</span>
            {joinedAt && (
              <span className={styles.joinedDate}>Joined {joinedAt}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Forms row ── */}
      <div className={styles.formsRow}>
        {/* Update details */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Personal Details</h2>
          <form
            className={styles.form}
            onSubmit={handleDetailsSubmit_(handleDetailsSubmit)}
          >
            <FormInput
              id="firstName"
              label="First Name"
              formActions={detailsFormActions}
              disabled={isUpdating}
            />
            <FormInput
              id="lastName"
              label="Last Name"
              formActions={detailsFormActions}
              disabled={isUpdating}
            />
            <div className={styles.formActions}>
              <Button type="submit" variant="primary" disabled={isUpdating}>
                {isUpdating ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>

        {/* Change password */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Change Password</h2>
          <form
            className={styles.form}
            onSubmit={handlePasswordSubmit_(handlePasswordSubmit)}
          >
            <FormInput
              id="currentPassword"
              type="password"
              label="Current Password"
              formActions={passwordFormActions}
              disabled={isChangingPw}
            />
            <FormInput
              id="newPassword"
              type="password"
              label="New Password"
              placeholder="Min. 8 characters"
              formActions={passwordFormActions}
              disabled={isChangingPw}
              validation={{
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
              }}
            />
            <FormInput
              id="confirmPassword"
              type="password"
              label="Confirm New Password"
              formActions={passwordFormActions}
              disabled={isChangingPw}
            />
            <div className={styles.formActions}>
              <Button type="submit" variant="primary" disabled={isChangingPw}>
                {isChangingPw ? 'Updating…' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Notification preferences ── */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Notification Preferences</h2>
        <div className={styles.notifPrefRow}>
          <div className={styles.notifPrefInfo}>
            <p className={styles.notifPrefLabel}>Email notifications</p>
            <p className={styles.notifPrefHint}>
              Receive an email whenever a new booking is created.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={preferences?.email_notifications ?? true}
            className={`${styles.toggle} ${(preferences?.email_notifications ?? true) ? styles.toggleOn : styles.toggleOff}`}
            onClick={() =>
              savePreferences({
                email_notifications: !(
                  preferences?.email_notifications ?? true
                ),
              } as Parameters<typeof savePreferences>[0])
            }
            disabled={isSavingPrefs}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileHome;
