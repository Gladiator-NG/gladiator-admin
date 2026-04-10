import { useQuery } from '@tanstack/react-query';
import { getProfile } from '../../services/apiProfile';
import { useUser } from '../authentication/useUser';

export function useProfile() {
  const { user } = useUser();

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 5, // 5 min
  });

  return { profile, isLoading, error };
}
