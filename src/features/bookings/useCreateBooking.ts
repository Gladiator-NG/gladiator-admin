import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBooking } from '../../services/apiBooking';
import type { CreateBookingInput, Booking } from '../../services/apiBooking';

export function useCreateBooking() {
  const queryClient = useQueryClient();

  const { mutate: create, isPending } = useMutation<
    Booking,
    Error,
    CreateBookingInput
  >({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  return { create, isPending };
}
