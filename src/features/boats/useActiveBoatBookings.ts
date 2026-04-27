import { useMemo } from 'react';
import { useBookings } from '../bookings/useBookings';

// Returns the number of active (upcoming or ongoing) boat bookings
export function useActiveBoatBookings() {
  const { bookings, isLoading } = useBookings();
  const today = new Date().toLocaleDateString('en-CA');

  const active = useMemo(() => {
    if (!bookings) return 0;
    return bookings.filter(
      (b) =>
        b.booking_type === 'boat_cruise' &&
        b.status !== 'cancelled' &&
        b.status !== 'expired' &&
        b.end_date >= today,
    ).length;
  }, [bookings, today]);

  return { active, isLoading };
}
