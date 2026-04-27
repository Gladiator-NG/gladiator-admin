import { useMemo } from 'react';
import { useBookings } from '../bookings/useBookings';

// Returns the number of beach house bookings with check-in today
export function useTodayCheckins() {
  const { bookings, isLoading } = useBookings();
  const today = new Date().toISOString().slice(0, 10);

  const checkins = useMemo(() => {
    if (!bookings) return 0;
    return bookings.filter(
      (b) =>
        b.booking_type === 'beach_house' &&
        b.start_date === today &&
        b.status !== 'cancelled' &&
        b.status !== 'expired',
    ).length;
  }, [bookings, today]);

  return { checkins, isLoading };
}
