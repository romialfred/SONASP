import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute } from '@/lib/permissions';
import { Loading } from '@/components/ui/Loading';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';
import { isCollectorRouteAllowed, isCollectorScopedUser } from '@/lib/collectorAccess';

interface PublicRouteProps {
  children: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { user, session, loading, initialized, profileLoading, profileError, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  if (loading || !initialized || (session && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  if (user && user.is_active) {
    const defaultRoute = getDefaultRoute(user.role, user.mining_company_id);
    const requestedPath = safeReturnPath((location.state as { from?: { pathname?: unknown } } | null)?.from?.pathname);
    // Un représentant de mine ne revient jamais vers le back-office national à
    // partir d'un ancien `state.from`. Son seul périmètre privé est le portail.
    const destination = isCollectorScopedUser(user)
      ? (requestedPath && isCollectorRouteAllowed(requestedPath) ? requestedPath : '/portail-collecteur')
      : isComptoirScopedUser(user)
        ? (requestedPath?.startsWith('/portail-comptoir') ? requestedPath : '/portail-comptoir')
        : user.mining_company_id
          ? (requestedPath?.startsWith('/portail-mine') ? requestedPath : defaultRoute)
          : requestedPath || defaultRoute;
    return <Navigate to={destination} replace />;
  }

  if (session && !user) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm" role="alert">
          <h1 className="text-2xl font-bold text-slate-900">Accès temporairement indisponible</h1>
          <p className="mt-3 text-slate-600">
            {profileError || 'Votre profil autorisé n’a pas pu être vérifié. Aucun accès privé n’est accordé.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => void refreshProfile()} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">
              Réessayer
            </button>
            <button type="button" onClick={() => void signOut()} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700">
              Fermer la session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (['/login', '/activate-account', '/auth/callback'].includes(value)) return null;
  return value;
}
