import { useAuthContext } from '../../context/useAuthContext';

export function useUser() {
  const {
    user,
    isAuthenticated,
    isPasswordReady,
    requiresPasswordSetup,
    isLoading,
  } = useAuthContext();

  return {
    user,
    isAuthenticated,
    isPasswordReady,
    requiresPasswordSetup,
    isLoading,
  };
}
