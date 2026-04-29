import { useAuthContext } from '../../context/useAuthContext';

export function useUser() {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  return { user, isAuthenticated, isLoading };
}
