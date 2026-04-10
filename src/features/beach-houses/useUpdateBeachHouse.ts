import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { updateBeachHouse } from '../../services/apiBeachHouse';

export function useUpdateBeachHouse() {
  const queryClient = useQueryClient();

  const { mutate: update, isPending } = useMutation({
    mutationFn: updateBeachHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { update, isPending };
}
