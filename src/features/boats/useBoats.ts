import { useQuery } from '@tanstack/react-query';
import { getBoats } from '../../services/apiBoat';

export function useBoats() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['boats'],
    queryFn: getBoats,
  });
  return { boats: data, isLoading, error };
}
