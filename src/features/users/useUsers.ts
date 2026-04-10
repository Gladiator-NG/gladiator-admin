import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../../services/apiProfile';

export function useUsers() {
  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 1000 * 60 * 2,
  });

  return { users, isLoading, error };
}
