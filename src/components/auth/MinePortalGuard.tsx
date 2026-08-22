import { createContext, ReactNode, useContext } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasGlobalPlatformAccess } from '@/lib/permissions';
import type { UserProfile } from '@/types/auth';
import { Loading } from '@/components/ui/Loading';

type MinePortalAccess = {
  companyId: string;
  canChooseCompany: boolean;
  user: UserProfile;
};

const MinePortalAccessContext = createContext<MinePortalAccess | null>(null);

export function useMinePortalAccess(): MinePortalAccess {
  const value = useContext(MinePortalAccessContext);
  if (!value) throw new Error('useMinePortalAccess must be used within MinePortalGuard');
  return value;
}

export function MinePortalGuard({ children }: { children: ReactNode }) {
  const { user, session, loading, initialized, profileLoading, profileError, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading || !initialized || (session && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" aria-label="Vérification de votre accès">
        <Loading size="lg" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || profileError) {
    return (
      <GuardMessage
        title="Profil non vérifié"
        description={profileError || 'Votre profil autorisé est indisponible. Aucun accès aux données de mine n’est accordé.'}
        action={<button type="button" onClick={() => void refreshProfile()} className={primaryButton}>Réessayer</button>}
      />
    );
  }

  if (!user.is_active) {
    return <GuardMessage title="Compte désactivé" description="Ce compte ne peut plus accéder au Portail Mine. Contactez l’administrateur SONASP." />;
  }

  const canChooseCompany = hasGlobalPlatformAccess(user);
  const requestedCompanyId = new URLSearchParams(location.search).get('mine')?.trim() || null;

  if (!user.mining_company_id && !canChooseCompany) {
    return (
      <GuardMessage
        title="Portail Mine non attribué"
        description="Votre compte n’est rattaché à aucune société minière. Aucun périmètre de données ne peut être ouvert."
      />
    );
  }

  // L'Owner choisit le périmètre depuis l'en-tête national. Une ouverture
  // directe de l'ancienne page de supervision n'a plus de raison d'être.
  if (canChooseCompany && !requestedCompanyId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Pour un compte de mine, tout paramètre d'URL est volontairement ignoré :
  // la société du profil autoritatif demeure son unique périmètre.
  const companyId = canChooseCompany ? requestedCompanyId : user.mining_company_id;
  if (!companyId) {
    return (
      <GuardMessage
        title="Portail Mine non attribué"
        description="Votre compte n’est rattaché à aucune société minière. Aucun périmètre de données ne peut être ouvert."
      />
    );
  }

  return (
    <MinePortalAccessContext.Provider value={{
      companyId,
      canChooseCompany,
      user,
    }}>
      {children}
    </MinePortalAccessContext.Provider>
  );
}

const primaryButton = 'rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

function GuardMessage({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm" aria-labelledby="mine-guard-title">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">Accès sécurisé</p>
        <h1 id="mine-guard-title" className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-slate-600">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {action}
          <Link to="/" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
            Retour à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
