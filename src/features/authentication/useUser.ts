import { useAuthContext } from '../../context/AuthContext';

export function useUser() {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  return { user, isAuthenticated, isLoading };
}
