import { useQuery } from '@tanstack/react-query';
import { getTransportRoutes } from '../../services/apiTransport';

export function useTransportRoutes() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['transport_routes'],
    queryFn: getTransportRoutes,
  });
  return { routes: data, isLoading, error };
}
