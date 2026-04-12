import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../ui/Button';
import FormInput from '../../ui/formElements/FormInput';
import { useSignIn } from './useSignIn';
import supabase from '../../services/supabase';
import {
  completePasswordRecovery,
  requestPasswordReset,
} from '../../services/apiAuth';
import styles from './styles/SignInForm.module.css';

interface SignInFormData {
  email: string;
  password: string;
}

interface ForgotPasswordFormData {
  email: string;
}

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

type AuthView = 'signin' | 'forgot-password' | 'reset-password';

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 18,
    },
  },
};

function SignInForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, isPending } = useSignIn();
  const [view, setView] = useState<AuthView>('signin');
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>();

  const {
    register: forgotRegister,
    handleSubmit: handleForgotSubmit,
    watch: watchForgotEmail,
    formState: { errors: forgotErrors },
  } = useForm<ForgotPasswordFormData>();

  const {
    register: resetRegister,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm<ResetPasswordFormData>();

  const { mutate: sendResetEmail, isPending: isSendingResetEmail } =
    useMutation({
      mutationFn: requestPasswordReset,
      onSuccess: () => {
        setRecoveryEmail(watchForgotEmail('email') ?? recoveryEmail);
        toast.success('Password reset link sent. Check your email.');
        setView('signin');
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Unable to send reset email');
      },
    });

  const { mutate: resetPassword, isPending: isResettingPassword } = useMutation(
    {
      mutationFn: completePasswordRecovery,
      onSuccess: () => {
        toast.success('Password updated successfully');
        navigate('/dashboard', { replace: true });
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Unable to reset password');
      },
    },
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (
      searchParams.get('reset') === 'password' ||
      hashParams.get('type') === 'recovery'
    ) {
      setView('reset-password');
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryEmail(session?.user?.email ?? '');
        setView('reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, [location.search]);

  function onSubmit(data: SignInFormData) {
    signIn(data);
  }

  function onForgotPasswordSubmit(data: ForgotPasswordFormData) {
    setRecoveryEmail(data.email);
    sendResetEmail(data.email);
  }

  function onResetPasswordSubmit(data: ResetPasswordFormData) {
    resetPassword(data.password);
  }

  const isBusy = isPending || isSendingResetEmail || isResettingPassword;
  const heading =
    view === 'forgot-password'
      ? 'Reset your password'
      : view === 'reset-password'
        ? 'Create a new password'
        : 'Sign in with your email';

  const subheading =
    view === 'forgot-password'
      ? 'Enter your email and we will send you a secure reset link.'
      : view === 'reset-password'
        ? 'Choose a new password for your account.'
        : null;

  return (
    <motion.div
      className={styles.card}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <img
        src="/gladiator_icon.png"
        alt="Gladiator logo"
        className={styles.logo}
      />

      <div className={styles.headerBlock}>
        <h2 className={styles.heading}>{heading}</h2>
        {subheading && <p className={styles.subheading}>{subheading}</p>}
      </div>

      {view === 'signin' && (
        <>
          {recoveryEmail && (
            <p className={styles.infoMessage}>
              Reset email sent to {recoveryEmail}. Open the link in your inbox
              to choose a new password.
            </p>
          )}

          <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
            <FormInput
              id="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              formActions={{ register, errors }}
              disabled={isBusy}
            />

            <FormInput
              id="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              formActions={{ register, errors }}
              disabled={isBusy}
            />

            <Button
              variant="primary"
              type="submit"
              className={styles.submitBtn}
              disabled={isBusy}
            >
              {isPending ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <Button
            variant="link-dark"
            type="button"
            onClick={() => setView('forgot-password')}
            disabled={isBusy}
          >
            Forgot Password?
          </Button>
        </>
      )}

      {view === 'forgot-password' && (
        <>
          <form
            className={styles.form}
            onSubmit={handleForgotSubmit(onForgotPasswordSubmit)}
          >
            <FormInput
              id="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              formActions={{ register: forgotRegister, errors: forgotErrors }}
              disabled={isBusy}
            />

            <Button
              variant="primary"
              type="submit"
              className={styles.submitBtn}
              disabled={isBusy}
            >
              {isSendingResetEmail ? 'Sending reset link…' : 'Send Reset Link'}
            </Button>
          </form>

          <Button
            variant="link-dark"
            type="button"
            onClick={() => setView('signin')}
            disabled={isBusy}
          >
            Back to Sign In
          </Button>
        </>
      )}

      {view === 'reset-password' && (
        <>
          {recoveryEmail && (
            <p className={styles.infoMessage}>
              Resetting password for {recoveryEmail}
            </p>
          )}

          <form
            className={styles.form}
            onSubmit={handleResetSubmit(onResetPasswordSubmit)}
          >
            <FormInput
              id="password"
              type="password"
              label="New Password"
              placeholder="At least 8 characters"
              formActions={{ register: resetRegister, errors: resetErrors }}
              disabled={isBusy}
              validation={{
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters long',
                },
              }}
            />

            <FormInput
              id="confirmPassword"
              type="password"
              label="Confirm New Password"
              placeholder="Re-enter your new password"
              formActions={{ register: resetRegister, errors: resetErrors }}
              disabled={isBusy}
              validation={{
                validate: (value, formValues) =>
                  value === formValues.password || 'Passwords do not match',
              }}
            />

            <Button
              variant="primary"
              type="submit"
              className={styles.submitBtn}
              disabled={isBusy}
            >
              {isResettingPassword ? 'Updating password…' : 'Update Password'}
            </Button>
          </form>
        </>
      )}
    </motion.div>
  );
}

export default SignInForm;
