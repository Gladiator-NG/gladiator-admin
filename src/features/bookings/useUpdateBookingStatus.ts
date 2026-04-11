import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBooking } from '../../services/apiBooking';
import type { BookingStatus, Booking } from '../../services/apiBooking';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  const { mutate: updateStatus, isPending } = useMutation<
    Booking,
    Error,
    { id: string; status: BookingStatus }
  >({
    mutationFn: ({ id, status }) => updateBooking({ id, status }),
    onSuccess: async (data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      const label =
        status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
      await insertActivityLog({
        type: 'booking_status',
        title: 'Booking Status Updated',
        message: `${actor} updated booking for ${data.customer_name} to "${label}"`,
        entity_id: data.id,
        entity_type: 'booking',
        actor_name: actor,
        metadata: { customer_name: data.customer_name, status },
      });
    },
  });

  return { updateStatus, isPending };
}
