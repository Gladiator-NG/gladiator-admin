import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { deleteBoat } from '../../services/apiBoat';

export function useDeleteBoat() {
  const queryClient = useQueryClient();
  const { mutate: remove, isPending } = useMutation({
    mutationFn: deleteBoat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boats'] });
      toast.success('Boat deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return { remove, isPending };
}
