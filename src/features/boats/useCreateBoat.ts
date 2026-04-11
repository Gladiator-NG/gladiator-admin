import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createBoat } from '../../services/apiBoat';
import type { Boat } from '../../services/apiBoat';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';

export function useCreateBoat() {
  const queryClient = useQueryClient();
  const {
    mutate: create,
    isPending,
    error,
  } = useMutation({
    mutationFn: createBoat,
    onSuccess: async (data: Boat) => {
      queryClient.invalidateQueries({ queryKey: ['boats'] });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'new_boat',
        title: 'New Boat Added',
        message: `${actor} added a new boat: "${data.name}"`,
        entity_id: data.id,
        entity_type: 'boat',
        actor_name: actor,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return { create, isPending, error };
}
