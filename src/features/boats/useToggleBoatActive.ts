import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBoat } from '../../services/apiBoat';

export function useToggleBoatActive() {
  const queryClient = useQueryClient();
  const { mutate: toggle, isPending } = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateBoat({ id, is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boats'] });
    },
  });
  return { toggle, isPending };
}
