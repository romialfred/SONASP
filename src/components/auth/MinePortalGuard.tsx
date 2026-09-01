import { createContext, ReactNode, useContext } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types/auth';
import { Loading } from '@/components/ui/Loading';
import { isMineScopedUser, isMineTenantProfile } from '@/lib/mineAccess';
import { hasGlobalPlatformAccess } from '@/lib/permissions';

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

  // Les anciens liens publics menaient aussi Owner au portail Mine. Ses droits
  // nationaux s'exercent dans SONASP, sans exiger ni emprunter l'identité d'une
  // mine. Ne monter aucun contexte Mine et ne jamais déduire un tenant de l'URL.
  if (hasGlobalPlatformAccess(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const canChooseCompany = false;

  if (!canChooseCompany && isMineTenantProfile(user) && !isMineScopedUser(user)) {
    return (
      <GuardMessage
        title="Habilitation Société minière requise"
        description="Votre société est rattachée, mais la capacité mine.operate n’est pas active sur ce compte."
      />
    );
  }

  if (!user.mining_company_id && !canChooseCompany) {
    return (
      <GuardMessage
        title="Portail Mine non attribué"
        description="Votre compte n’est rattaché à aucune société minière. Aucun périmètre de données ne peut être ouvert."
      />
    );
  }

  // Tout paramètre d'URL est ignoré : seule la société du profil autoritatif
  // du représentant minier peut ouvrir ce portail.
  const companyId = user.mining_company_id;
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
