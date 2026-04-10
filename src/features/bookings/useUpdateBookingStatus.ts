import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBooking } from '../../services/apiBooking';
import type { BookingStatus, Booking } from '../../services/apiBooking';

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  const { mutate: updateStatus, isPending } = useMutation<
    Booking,
    Error,
    { id: string; status: BookingStatus }
  >({
    mutationFn: ({ id, status }) => updateBooking({ id, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  return { updateStatus, isPending };
}
