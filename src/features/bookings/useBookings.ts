import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBookings, autoCompleteBookings } from '../../services/apiBooking';
import type { Booking } from '../../services/apiBooking';

// Poll every 2 minutes — keeps the UI in sync with the pg_cron DB updates
// without the admin having to manually refresh.
const POLL_INTERVAL = 2 * 60 * 1000;

export function useBookings() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      // Run the auto-complete sweep on every fetch so status is always up to date
      // even if the DB-side pg_cron hasn't fired yet this hour.
      await autoCompleteBookings().catch(() => undefined);
      const bookings = await getBookings();
      return bookings;
    },
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false, // pause polling when tab is hidden
  });

  void queryClient; // keep import used

  return {
    bookings: (data ?? []) as Booking[],
    isLoading,
    error: error as Error | null,
  };
}
