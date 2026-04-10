import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../features/authentication/useUser';

function ProtectedRoutes({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useUser();

  useEffect(
    function () {
      if (!isAuthenticated && !isLoading) navigate('/signin');
    },
    [isAuthenticated, isLoading, navigate],
  );

  if (isLoading) return <p>Loading...</p>;

  if (isAuthenticated) return <>{children}</>;

  return null;
}

export default ProtectedRoutes;
