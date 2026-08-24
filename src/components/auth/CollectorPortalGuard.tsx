import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '@/components/ui/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import { isCollectorScopedUser } from '@/lib/collectorAccess';

export function CollectorPortalGuard({ children }: { children: ReactNode }) {
  const { user, session, loading, initialized, profileLoading } = useAuth();
  const { workspace, loading: workspaceLoading } = useCollectorWorkspace();
  const location = useLocation();

  if (loading || !initialized || (session && profileLoading) || workspaceLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center" aria-label="Vérification du collecteur"><Loading size="lg" /></div>;
  }
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isCollectorScopedUser(user)) return <Navigate to="/dashboard" replace />;
  if (!workspace) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <section className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm" role="alert">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">Périmètre sécurisé</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Collecteur non rattaché</h1>
          <p className="mt-3 text-slate-600">La capacité Collecteur est active, mais aucun profil collecteur et comptoir de rattachement valides ne sont disponibles.</p>
        </section>
      </main>
    );
  }
  return <>{children}</>;
}
