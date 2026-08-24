import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '@/components/ui/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { useComptoirWorkspace } from '@/hooks/useComptoirWorkspace';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';

export function ComptoirPortalGuard({ children }: { children: ReactNode }) {
  const { user, session, loading, initialized, profileLoading } = useAuth();
  const { workspace, loading: workspaceLoading } = useComptoirWorkspace();
  const location = useLocation();

  if (loading || !initialized || (session && profileLoading) || workspaceLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-label="Vérification du comptoir">
        <Loading size="lg" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isComptoirScopedUser(user)) return <Navigate to="/dashboard" replace />;

  if (!workspace) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <section className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm" role="alert">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">Périmètre sécurisé</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Comptoir non attribué</h1>
          <p className="mt-3 text-slate-600">
            Ce compte possède l’habilitation Comptoir, mais aucun établissement actif ne lui est rattaché.
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
