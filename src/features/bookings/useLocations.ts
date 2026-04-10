import { useQuery } from '@tanstack/react-query';
import { getLocations } from '../../services/apiTransport';

export function useLocations() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
  });
  return { locations: data, isLoading, error };
}
