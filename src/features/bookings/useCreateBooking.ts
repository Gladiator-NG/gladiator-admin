import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBooking } from '../../services/apiBooking';
import type { CreateBookingInput, Booking } from '../../services/apiBooking';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';

export function useCreateBooking() {
  const queryClient = useQueryClient();

  const { mutate: create, isPending } = useMutation<
    Booking,
    Error,
    CreateBookingInput
  >({
    mutationFn: createBooking,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'new_booking',
        title: 'New Booking Created',
        message: `${actor} created a new booking for ${data.customer_name}`,
        entity_id: data.id,
        entity_type: 'booking',
        actor_name: actor,
        metadata: {
          customer_name: data.customer_name,
          reference_code: data.reference_code,
        },
      });
    },
  });

  return { create, isPending };
}
