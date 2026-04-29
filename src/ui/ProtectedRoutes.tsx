import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../features/authentication/useUser';
import {
  isInviteCallbackUrl,
  markPasswordSetupRequired,
} from '../services/apiAuth';

function ProtectedRoutes({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isLoading,
    isAuthenticated,
    isPasswordReady,
    requiresPasswordSetup,
  } = useUser();

  useEffect(
    function () {
      if (isLoading) return;

      if (!isAuthenticated) {
        navigate('/signin');
        return;
      }

      if (user && isInviteCallbackUrl()) {
        markPasswordSetupRequired(user.id);
        navigate(
          { pathname: '/signin', search: '?setup=password', hash: location.hash },
          { replace: true },
        );
        return;
      }

      if (requiresPasswordSetup) {
        navigate('/signin?setup=password', { replace: true });
      }
    },
    [
      isAuthenticated,
      isLoading,
      isPasswordReady,
      location.hash,
      navigate,
      requiresPasswordSetup,
      user,
    ],
  );

  if (isLoading) return <p>Loading...</p>;

  if (isInviteCallbackUrl()) return null;

  if (requiresPasswordSetup) return null;

  if (isAuthenticated && isPasswordReady) return <>{children}</>;

  return null;
}

export default ProtectedRoutes;
