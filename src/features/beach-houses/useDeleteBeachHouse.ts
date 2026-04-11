import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { deleteBeachHouse } from '../../services/apiBeachHouse';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';

type DeleteBeachHouseInput = { id: string; label?: string };

export function useDeleteBeachHouse() {
  const queryClient = useQueryClient();

  const { mutate: remove, isPending } = useMutation<
    void,
    Error,
    DeleteBeachHouseInput
  >({
    mutationFn: ({ id }) => deleteBeachHouse(id),
    onSuccess: async (_, { label }) => {
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
      toast.success('Beach house deleted');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'delete_beach_house',
        title: 'Beach House Deleted',
        message: label
          ? `${actor} deleted beach house "${label}"`
          : `${actor} deleted a beach house`,
        entity_type: 'beach_house',
        actor_name: actor,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { remove, isPending };
}
