import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { deleteBeachHouse } from '../../services/apiBeachHouse';

export function useDeleteBeachHouse() {
  const queryClient = useQueryClient();

  const { mutate: remove, isPending } = useMutation({
    mutationFn: deleteBeachHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
      toast.success('Beach house deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { remove, isPending };
}
