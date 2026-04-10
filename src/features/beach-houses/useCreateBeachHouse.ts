import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createBeachHouse } from '../../services/apiBeachHouse';

export function useCreateBeachHouse() {
  const queryClient = useQueryClient();

  const {
    mutate: create,
    isPending,
    error,
  } = useMutation({
    mutationFn: createBeachHouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { create, isPending, error };
}
