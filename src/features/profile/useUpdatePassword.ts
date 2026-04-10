import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { verifyAndUpdatePassword } from '../../services/apiAuth';

export function useUpdatePassword() {
  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: verifyAndUpdatePassword,
    onSuccess: () => toast.success('Password updated successfully'),
    onError: (err: Error) => toast.error(err.message),
  });

  return { changePassword, isPending };
}
