import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createBeachHouse } from '../../services/apiBeachHouse';
import type { BeachHouse } from '../../services/apiBeachHouse';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';

export function useCreateBeachHouse() {
  const queryClient = useQueryClient();

  const {
    mutate: create,
    isPending,
    error,
  } = useMutation({
    mutationFn: createBeachHouse,
    onSuccess: async (data: BeachHouse) => {
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'new_beach_house',
        title: 'New Beach House Added',
        message: `${actor} added a new beach house: "${data.name}"`,
        entity_id: data.id,
        entity_type: 'beach_house',
        actor_name: actor,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { create, isPending, error };
}
