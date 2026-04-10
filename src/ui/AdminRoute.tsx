import { Navigate } from 'react-router-dom';
import { useIsAdmin } from '../features/authentication/useIsAdmin';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useIsAdmin();

  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

export default AdminRoute;
