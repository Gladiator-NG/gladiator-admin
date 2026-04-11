import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteBooking } from '../../services/apiBooking';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';
import toast from 'react-hot-toast';

type DeleteBookingInput = { id: string; label?: string };

export function useDeleteBooking() {
  const queryClient = useQueryClient();

  const { mutate: remove, isPending } = useMutation<
    void,
    Error,
    DeleteBookingInput
  >({
    mutationFn: ({ id }) => deleteBooking(id),
    onSuccess: async (_, { label }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking deleted');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'delete_booking',
        title: 'Booking Deleted',
        message: label
          ? `${actor} deleted a booking for ${label}`
          : `${actor} deleted a booking`,
        entity_type: 'booking',
        actor_name: actor,
      });
    },
    onError: (err) => toast.error(err.message),
  });

  return { remove, isPending };
}
