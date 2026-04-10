import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBooking } from '../../services/apiBooking';
import type { UpdateBookingInput, Booking } from '../../services/apiBooking';

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  const { mutate: update, isPending } = useMutation<
    Booking,
    Error,
    UpdateBookingInput
  >({
    mutationFn: updateBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });

  return { update, isPending };
}
