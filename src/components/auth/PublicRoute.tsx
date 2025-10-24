import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute } from '@/lib/permissions';
import { Loading } from '@/components/ui/Loading';

interface PublicRouteProps {
  children: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { user, loading, initialized } = useAuth();

  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  if (user && user.is_active) {
    const defaultRoute = getDefaultRoute(user.role);
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
}
