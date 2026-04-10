import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signInWithEmail } from '../../services/apiAuth';

export function useSignIn() {
  const navigate = useNavigate();

  const { mutate: signIn, isPending } = useMutation({
    mutationFn: signInWithEmail,
    onSuccess: () => {
      navigate('/dashboard', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Invalid email or password');
    },
  });

  return { signIn, isPending };
}
