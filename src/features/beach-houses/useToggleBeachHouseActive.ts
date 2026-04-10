import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBeachHouse } from '../../services/apiBeachHouse';

export function useToggleBeachHouseActive() {
  const queryClient = useQueryClient();

  const { mutate: toggle, isPending } = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateBeachHouse({ id, is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
    },
  });

  return { toggle, isPending };
}
