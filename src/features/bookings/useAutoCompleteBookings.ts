import { useMutation, useQueryClient } from '@tanstack/react-query';
import { autoCompleteBookings } from '../../services/apiBooking';

/**
 * Silently marks past bookings as 'completed' and refreshes the list.
 * Fire-and-forget on mount — errors are swallowed so they never surface in UI.
 */
export function useAutoCompleteBookings() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: autoCompleteBookings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
    onError: () => {
      // Silent fail — this is a background housekeeping operation
    },
  });

  return { autoComplete: mutate };
}
