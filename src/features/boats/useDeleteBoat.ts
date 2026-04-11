import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { deleteBoat } from '../../services/apiBoat';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';

type DeleteBoatInput = { id: string; label?: string };

export function useDeleteBoat() {
  const queryClient = useQueryClient();
  const { mutate: remove, isPending } = useMutation<
    void,
    Error,
    DeleteBoatInput
  >({
    mutationFn: ({ id }) => deleteBoat(id),
    onSuccess: async (_, { label }) => {
      queryClient.invalidateQueries({ queryKey: ['boats'] });
      toast.success('Boat deleted');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'delete_boat',
        title: 'Boat Deleted',
        message: label
          ? `${actor} deleted boat "${label}"`
          : `${actor} deleted a boat`,
        entity_type: 'boat',
        actor_name: actor,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return { remove, isPending };
}
