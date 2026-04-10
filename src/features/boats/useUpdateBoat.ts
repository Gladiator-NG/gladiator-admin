import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { updateBoat } from '../../services/apiBoat';

export function useUpdateBoat() {
  const queryClient = useQueryClient();
  const { mutate: update, isPending } = useMutation({
    mutationFn: updateBoat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boats'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return { update, isPending };
}
