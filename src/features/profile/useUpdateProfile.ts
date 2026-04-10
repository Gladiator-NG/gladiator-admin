import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { upsertProfile } from '../../services/apiProfile';
import { useUser } from '../authentication/useUser';

export function useUpdateProfile() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { mutate: update, isPending } = useMutation({
    mutationFn: (data: { firstName: string; lastName: string }) =>
      upsertProfile({ userId: user!.id, ...data }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['profile', user?.id], updatedProfile);
      toast.success('Profile updated successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { update, isPending };
}
