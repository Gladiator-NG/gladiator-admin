import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createBoat } from '../../services/apiBoat';

export function useCreateBoat() {
  const queryClient = useQueryClient();
  const {
    mutate: create,
    isPending,
    error,
  } = useMutation({
    mutationFn: createBoat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boats'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return { create, isPending, error };
}
