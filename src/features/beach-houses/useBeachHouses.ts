import { useQuery } from '@tanstack/react-query';
import { getBeachHouses } from '../../services/apiBeachHouse';

export function useBeachHouses() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['beach_houses'],
    queryFn: getBeachHouses,
  });

  return { beachHouses: data, isLoading, error };
}
