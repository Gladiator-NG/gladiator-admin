import { useQuery } from '@tanstack/react-query';
import { getDashboardData } from '../../services/apiDashboard';

export function useDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
    staleTime: 60_000, // 1 min — dashboard doesn't need sub-second freshness
  });

  return { data, isLoading, error: error as Error | null };
}
