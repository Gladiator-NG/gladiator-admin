import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { deleteUser } from '../../services/apiProfile';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';

type DeleteUserInput = { id: string; label?: string };

export function useDeleteUser() {
  const queryClient = useQueryClient();

  const { mutate: remove, isPending } = useMutation<
    void,
    Error,
    DeleteUserInput
  >({
    mutationFn: ({ id }) => deleteUser(id),
    onSuccess: async (_, { label }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'delete_user',
        title: 'Staff Account Removed',
        message: label
          ? `${actor} removed staff account for ${label}`
          : `${actor} removed a staff account`,
        entity_type: 'user',
        actor_name: actor,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { remove, isPending };
}
