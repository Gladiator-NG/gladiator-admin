import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser } from '../../services/apiProfile';

export function useCreateUser() {
  const queryClient = useQueryClient();

  const {
    mutate: create,
    isPending,
    error,
  } = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return { create, isPending, error };
}
