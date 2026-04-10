import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '../../services/apiBooking';
import type { Customer } from '../../services/apiBooking';

export function useCustomers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  return {
    customers: (data ?? []) as Customer[],
    isLoading,
    error: error as Error | null,
  };
}
