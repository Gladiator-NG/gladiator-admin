import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateSetting } from '../../services/apiSettings';
import type { AppSettings } from '../../services/apiSettings';

export function useSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
  });

  return {
    settings: data ?? null,
    isLoading,
  };
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: ({
      key,
      value,
    }: {
      key: keyof AppSettings;
      value: string | boolean;
    }) => updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
    },
  });

  return { updateSetting: mutate, isPending };
}
