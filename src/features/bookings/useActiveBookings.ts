import { useMemo } from 'react';
import { useBookings } from './useBookings';

// Returns the number of active (upcoming or ongoing) bookings
export function useActiveBookings() {
  const { bookings, isLoading } = useBookings();
  const today = new Date().toISOString().slice(0, 10);

  const active = useMemo(() => {
    if (!bookings) return 0;
    return bookings.filter(
      (b) =>
        b.status !== 'cancelled' &&
        b.status !== 'expired' &&
        b.end_date >= today,
    ).length;
  }, [bookings, today]);

  return { active, isLoading };
}
