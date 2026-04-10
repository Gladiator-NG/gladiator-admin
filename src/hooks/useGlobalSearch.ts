import { useQuery } from '@tanstack/react-query';
import { globalSearch } from '../services/apiSearch';

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ['global-search', query],
    queryFn: () => globalSearch(query),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}
