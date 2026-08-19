import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Loader2,
  Lock,
  LogIn,
  PencilLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader } from '@/components/ui/sn';
import UserStatsCard from '@/components/admin/UserStatsCard';
import LoginSessionsTab from '@/components/admin/LoginSessionsTab';
import ActivityHistoryTab from '@/components/admin/ActivityHistoryTab';
import SiteAccessTab from '@/components/admin/SiteAccessTab';
import UserPermissionsTab from '@/components/admin/UserPermissionsTab';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { roleLabel, roleTone } from '@/lib/roleLabels';
import './admin.css';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  job_title: string | null;
  department: string | null;
  is_active: boolean;
  account_locked: boolean;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  timezone: string;
  language_preference: string;
  profile_picture_url: string | null;
  failed_login_attempts: number;
}

type OngletId = 'apercu' | 'sessions' | 'activite' | 'permissions' | 'sites';

const ONGLETS: Array<{ id: OngletId; label: string; icon: typeof UserRound }> = [
  { id: 'apercu', label: 'Vue d’ensemble', icon: UserRound },
  { id: 'sessions', label: 'Connexions', icon: LogIn },
  { id: 'activite', label: 'Journal d’activité', icon: Activity },
  { id: 'permissions', label: 'Permissions', icon: Lock },
  { id: 'sites', label: 'Accès aux sites', icon: Building2 },
];

export default function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<OngletId>('apercu');

  const charger = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErreur(null);
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      setUser(data);
      // Un compte absent et une base injoignable donnaient le même écran muet.
      if (!data) setErreur('Ce compte est introuvable ou a été supprimé.');
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger ce compte.'));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page admin-page">
          <div className="admin-page__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du compte…
          </div>
        </div>
      </NationalDashboardLayout>
    );
  }

  if (!user) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page admin-page">
          <PageHeader
            icon={UserRound}
            title="Compte introuvable"
            subtitle="Ce compte a été supprimé ou la référence est erronée."
            breadcrumb={[{ label: 'Administration' }, { label: 'Utilisateurs', to: '/admin/users' }, { label: 'Compte' }]}
          />
          {erreur && (
            <Note tone="danger" icon={AlertTriangle}>
              {erreur}
            </Note>
          )}
          <EmptyState
            title="Aucun compte à afficher"
            description="Revenez à la liste pour retrouver le compte concerné."
            action={
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/admin/users')}>
                <ArrowLeft aria-hidden="true" /> Retour à la liste
              </button>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  const ongletActif = ONGLETS.find((item) => item.id === onglet) || ONGLETS[0];

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page user-detail">
        <PageHeader
          icon={UserRound}
          title={user.full_name || 'Nom non renseigné'}
          subtitle={`${user.email}${user.job_title ? ` · ${user.job_title}` : ''}`}
          breadcrumb={[
            { label: 'Administration' },
            { label: 'Utilisateurs', to: '/admin/users' },
            { label: user.full_name || user.email },
          ]}
          aside={
            <div className="user-detail__badges">
              <Badge tone={roleTone(user.role)} icon={ShieldCheck}>
                {roleLabel(user.role)}
              </Badge>
              <Badge tone={user.is_active ? 'success' : 'danger'}>{user.is_active ? 'Actif' : 'Désactivé'}</Badge>
              {user.account_locked && (
                <Badge tone="danger" icon={Lock}>
                  Compte verrouillé
                </Badge>
              )}
            </div>
          }
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/admin/users')}>
                <ArrowLeft aria-hidden="true" /> Liste des comptes
              </button>
              {/* La page ne proposait aucune action : c'était un cul-de-sac. */}
              <button
                type="button"
                className="sn-btn"
                onClick={() => navigate(`/admin/users/${user.id}/permissions`)}
              >
                <Lock aria-hidden="true" /> Permissions
              </button>
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate(`/users/edit?userId=${user.id}`)}
              >
                <PencilLine aria-hidden="true" /> Modifier le compte
              </button>
            </>
          }
        />

        {user.failed_login_attempts > 0 && (
          <Note tone="warning" icon={AlertTriangle}>
            {user.failed_login_attempts} tentative(s) de connexion échouée(s) depuis la dernière
            connexion réussie.
          </Note>
        )}

        <section className="sn-card user-detail__facts" aria-label="Informations du compte">
          <dl>
            <div>
              <dt>Rôle</dt>
              <dd>{roleLabel(user.role)}</dd>
            </div>
            <div>
              <dt>Fonction</dt>
              <dd>{user.job_title || 'Non renseignée'}</dd>
            </div>
            <div>
              <dt>Direction</dt>
              <dd>{user.department || 'Non renseignée'}</dd>
            </div>
            <div>
              <dt>Téléphone</dt>
              <dd>{user.phone || 'Non renseigné'}</dd>
            </div>
            <div>
              <dt>Langue</dt>
              <dd>{(user.language_preference || 'fr').toUpperCase()}</dd>
            </div>
          </dl>
        </section>

        <div className="user-detail__tabs" role="tablist" aria-label="Sections du compte">
          {ONGLETS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={onglet === item.id}
                className={onglet === item.id ? 'is-active' : ''}
                onClick={() => setOnglet(item.id)}
              >
                <Icon aria-hidden="true" /> {item.label}
              </button>
            );
          })}
        </div>

        <div className="user-detail__panel" role="tabpanel" aria-label={ongletActif.label}>
          {onglet === 'apercu' && <UserStatsCard userId={user.id} userProfile={user} />}
          {onglet === 'sessions' && <LoginSessionsTab userId={user.id} />}
          {onglet === 'activite' && <ActivityHistoryTab userId={user.id} />}
          {onglet === 'permissions' && <UserPermissionsTab userId={user.id} userRole={user.role} />}
          {onglet === 'sites' && <SiteAccessTab userId={user.id} />}
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
