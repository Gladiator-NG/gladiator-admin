import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import supabase from '../services/supabase';
import { AuthContext } from './authContextValue';
import { isPasswordReady, isPasswordSetupRequired } from '../services/apiAuth';

const SESSION_VALIDATION_INTERVAL_MS = 15000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const requiresPasswordSetup = isPasswordSetupRequired(user);
  const passwordReady = isPasswordReady(user);

  useEffect(() => {
    // Hydrate session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Keep in sync with Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const activeUser = user;
    let isActive = true;
    let isSigningOut = false;

    async function terminateLocalSession() {
      if (isSigningOut) return;
      isSigningOut = true;

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } finally {
        if (isActive) setUser(null);
      }
    }

    async function validateSessionUser() {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (!isActive) return;

      if (error || !currentUser || currentUser.id !== activeUser.id) {
        await terminateLocalSession();
        return;
      }

      setUser((previousUser) => {
        const previousMetadata = JSON.stringify(
          previousUser?.user_metadata ?? {},
        );
        const currentMetadata = JSON.stringify(currentUser.user_metadata ?? {});

        if (
          previousUser?.id === currentUser.id &&
          previousUser.email === currentUser.email &&
          previousMetadata === currentMetadata
        ) {
          return previousUser;
        }

        return currentUser;
      });
    }

    async function subscribeToRevocations() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isActive || !session?.access_token) return null;

      supabase.realtime.setAuth(session.access_token);

      const channel = supabase
        .channel(`user:${activeUser.id}`)
        .on('broadcast', { event: 'session_revoked' }, () => {
          void validateSessionUser();
        })
        .subscribe();

      return channel;
    }

    const channelPromise = subscribeToRevocations();
    void validateSessionUser();

    const intervalId = window.setInterval(
      () => void validateSessionUser(),
      SESSION_VALIDATION_INTERVAL_MS,
    );

    const handleVisibilityCheck = () => {
      if (document.visibilityState === 'visible') {
        void validateSessionUser();
      }
    };

    window.addEventListener('focus', validateSessionUser);
    document.addEventListener('visibilitychange', handleVisibilityCheck);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', validateSessionUser);
      document.removeEventListener('visibilitychange', handleVisibilityCheck);

      void channelPromise.then((channel) => {
        if (channel) void supabase.removeChannel(channel);
      });
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isPasswordReady: passwordReady,
        requiresPasswordSetup,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
