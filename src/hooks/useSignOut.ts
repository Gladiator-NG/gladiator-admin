import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signOut } from '../services/apiAuth';

export function useSignOut() {
  const navigate = useNavigate();

  const { mutate: logout, isPending } = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      navigate('/signin', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not sign out');
    },
  });

  return { logout, isPending };
}
