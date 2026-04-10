import { useQuery } from '@tanstack/react-query';
import { getBookings } from '../../services/apiBooking';
import type { Booking } from '../../services/apiBooking';

export function useBookings() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bookings'],
    queryFn: getBookings,
  });

  return {
    bookings: (data ?? []) as Booking[],
    isLoading,
    error: error as Error | null,
  };
}
