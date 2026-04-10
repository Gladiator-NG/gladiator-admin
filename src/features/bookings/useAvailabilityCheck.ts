import { useQuery } from '@tanstack/react-query';
import { checkAvailability } from '../../services/apiBooking';

export interface AvailabilityParams {
  resourceType: 'boat' | 'beach_house';
  resourceId: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  excludeBookingId?: string;
}

export type AvailabilityState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'unavailable'; conflictRef?: string; conflictCustomer?: string };

export function useAvailabilityCheck(
  params: AvailabilityParams | null,
): AvailabilityState {
  const enabled = Boolean(
    params &&
    params.resourceId &&
    params.startDate &&
    params.endDate &&
    params.startDate <= params.endDate,
  );

  const { data, isFetching, isError } = useQuery({
    queryKey: ['availability', params],
    queryFn: () => checkAvailability(params!),
    enabled,
    staleTime: 60_000, // treat result as fresh for 1 min
    gcTime: 2 * 60_000, // keep in cache 2 min
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!enabled) return { status: 'idle' };
  if (isFetching) return { status: 'checking' };
  if (isError || !data) return { status: 'idle' };

  if (data.available) return { status: 'available' };

  return {
    status: 'unavailable',
    conflictRef: data.conflictingBooking?.reference_code,
    conflictCustomer: data.conflictingBooking?.customer_name,
  };
}
