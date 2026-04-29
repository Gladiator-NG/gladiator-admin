import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../features/authentication/useUser';
import {
  isInviteCallbackUrl,
  isPasswordSetupRequired,
  markPasswordSetupRequired,
} from '../services/apiAuth';

function ProtectedRoutes({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, isAuthenticated } = useUser();

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

      if (isPasswordSetupRequired(user)) {
        navigate('/signin?setup=password', { replace: true });
      }
    },
    [isAuthenticated, isLoading, location.hash, navigate, user],
  );

  if (isLoading) return <p>Loading...</p>;

  if (isInviteCallbackUrl()) return null;

  if (isPasswordSetupRequired(user)) return null;

  if (isAuthenticated) return <>{children}</>;

  return null;
}

export default ProtectedRoutes;
