import { useProfile } from '../profile/useProfile';

export function useIsAdmin() {
  const { profile, isLoading } = useProfile();
  const isAdmin = profile?.role === 'Admin';
  return { isAdmin, isLoading };
}
