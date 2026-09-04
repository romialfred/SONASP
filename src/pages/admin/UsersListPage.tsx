import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Eye,
  Loader2,
  Lock,
  MailPlus,
  PencilLine,
  Trash2,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section } from '@/components/ui/sn';
import { useConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { safeFetch } from '@/lib/apiClient';
import { ALL_ROLES, roleLabel } from '@/lib/roleLabels';
import type { UserRole } from '@/types/auth';
import { resendWelcomeEmail, requiresWelcomeRecovery } from '@/services/userManagementService';
import './admin.css';

export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  account_type?: 'comptoir' | null;
  phone?: string | null;
  actor_category_code?: string | null;
  portal_code?: string | null;
  portal_name?: string | null;
  access_role_code?: string | null;
  access_role_name?: string | null;
  mining_company_names: string[];
  is_active: boolean;
  mfa_enrolled_at?: string | null;
  must_change_password?: boolean;
  password_changed_at?: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface UserFilters {
  recherche: string;
  role: 'all' | UserRole | 'comptoir';
  statut: 'all' | 'actif' | 'inactif';
}

export const EMPTY_USER_FILTERS: UserFilters = { recherche: '', role: 'all', statut: 'all' };

const displayRole = (user: Pick<AdminUser, 'role' | 'account_type'>): UserRole | 'comptoir' =>
  user.account_type === 'comptoir' ? 'comptoir' : user.role;

const displayRoleLabel = (role: UserRole | 'comptoir'): string =>
  role === 'comptoir' ? 'Comptoir d’achat' : roleLabel(role);

const STATUS_TABS: Array<{ value: UserFilters['statut']; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'actif', label: 'Actifs' },
  { value: 'inactif', label: 'Désactivés' },
];

/** Filtre la liste sur la recherche libre, le rôle et l'état du compte. */
export function filterUsers(users: AdminUser[], filters: UserFilters): AdminUser[] {
  const recherche = filters.recherche.trim().toLowerCase();
  return users.filter((user) => {
    const correspond =
      !recherche ||
      user.full_name?.toLowerCase().includes(recherche) ||
      user.email.toLowerCase().includes(recherche) ||
      user.portal_name?.toLowerCase().includes(recherche) ||
      user.access_role_name?.toLowerCase().includes(recherche) ||
      user.mining_company_names.some((nom) => nom.toLowerCase().includes(recherche));
    const roleOk = filters.role === 'all' || displayRole(user) === filters.role;
    const statutOk =
      filters.statut === 'all' ||
      (filters.statut === 'actif' && user.is_active) ||
      (filters.statut === 'inactif' && !user.is_active);
    return correspond && roleOk && statutOk;
  });
}

export const formatConnexion = (valeur: string | null): string => {
  if (!valeur) return 'Jamais connecté';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime())
    ? 'Jamais connecté'
    : new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Africa/Ouagadougou',
      }).format(date);
};

interface StatusMutationResponse {
  success?: boolean;
  user_id?: string;
  is_active?: boolean;
  message?: string;
}

interface DeleteMutationResponse {
  success?: boolean;
  deleted_user_id?: string;
  email_reusable?: boolean;
  message?: string;
}

export function UsersListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user: utilisateurCourant } = useAuth();
  const { open: demanderConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!session?.access_token || !anonKey) {
        throw new Error('Votre session d’administration n’est pas disponible.');
      }

      // La liste complète ne retombe jamais sur une lecture directe du profil :
      // l'autorisation d'administration et l'AAL2 sont vérifiés côté serveur.
      const viaFonction = await safeFetch<{ users?: Record<string, unknown>[] }>(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
        },
      );
      if (!viaFonction.ok) throw new Error(viaFonction.error.message);
      const comptes = viaFonction.data.users ?? [];

      const companyIds = Array.from(new Set(
        comptes
          .map((compte) => compte.mining_company_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ));

      const [compagniesResult, affectationsResult] = await Promise.all([
        companyIds.length > 0
          ? supabase
              .from('mining_companies')
              .select('id, name, abbreviation')
              .in('id', companyIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('user_site_assignments')
          .select('user_id, site_id, sites:site_id(name)'),
      ]);

      if (compagniesResult.error) throw compagniesResult.error;
      if (affectationsResult.error) throw affectationsResult.error;

      const compagnieParId = new Map<string, string>();
      (compagniesResult.data || []).forEach((compagnie: Record<string, unknown>) => {
        const nom = String(compagnie.abbreviation || compagnie.name || '').trim();
        if (nom) compagnieParId.set(String(compagnie.id), nom);
      });

      const parUtilisateur = new Map<string, string[]>();
      (affectationsResult.data || []).forEach((affectation: Record<string, unknown>) => {
        const site = affectation.sites as { name?: string } | null;
        const nom = site?.name;
        if (!nom) return;
        const identifiant = String(affectation.user_id);
        parUtilisateur.set(identifiant, [...(parUtilisateur.get(identifiant) || []), nom]);
      });

      setUsers(
        comptes
          .filter((compte) => compte && compte.id && compte.email)
          .map((compte) => ({
            id: String(compte.id),
            full_name: (compte.full_name as string) || null,
            email: String(compte.email),
            role: compte.role as UserRole,
            account_type: compte.account_type === 'comptoir' ? 'comptoir' : null,
            phone: (compte.phone as string) || null,
            actor_category_code: (compte.actor_category_code as string) || null,
            portal_code: (compte.portal_code as string) || null,
            portal_name: (compte.portal_name as string) || null,
            access_role_code: (compte.access_role_code as string) || null,
            access_role_name: (compte.access_role_name as string) || null,
            mining_company_names: Array.from(new Set([
              ...(typeof compte.mining_company_id === 'string'
                ? [compagnieParId.get(compte.mining_company_id)]
                : []),
              ...(parUtilisateur.get(String(compte.id)) || []),
              ...(
                compte.account_type === 'comptoir'
                && compte.organization
                && typeof compte.organization === 'object'
                && 'code' in compte.organization
                  ? [String((compte.organization as { code: unknown }).code)]
                  : []
              ),
            ].filter((nom): nom is string => Boolean(nom)))),
            is_active: compte.is_active !== false,
            mfa_enrolled_at: (compte.mfa_enrolled_at as string) || null,
            must_change_password: compte.must_change_password === true,
            password_changed_at: (compte.password_changed_at as string) || null,
            last_login_at: (compte.last_login_at as string) || null,
            created_at: (compte.created_at as string) || '',
          }))
      );
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger les comptes utilisateurs.'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const visibles = useMemo(() => filterUsers(users, filters), [users, filters]);
  const actifs = users.filter((user) => user.is_active).length;

  const basculerStatut = async (user: AdminUser) => {
    // Un administrateur ne doit pas pouvoir se verrouiller lui-même hors de la plateforme.
    if (utilisateurCourant?.id === user.id) {
      addToast('Vous ne pouvez pas désactiver votre propre compte.', 'error');
      return;
    }
    if (user.role === 'owner') {
      addToast('Le statut du compte propriétaire est protégé.', 'error');
      return;
    }

    const decision = await demanderConfirmation({
      title: user.is_active ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?',
      message: user.is_active
        ? `${user.full_name || user.email} perdra immédiatement l’accès à la plateforme.`
        : `${user.full_name || user.email} pourra de nouveau se connecter.`,
      confirmText: user.is_active ? 'Désactiver' : 'Réactiver',
      cancelText: 'Annuler',
      severity: user.is_active ? 'danger' : 'info',
      requireComment: true,
      commentPlaceholder: user.is_active
        ? 'Motif de la désactivation…'
        : 'Motif de la réactivation…',
    });
    if (typeof decision !== 'string' || decision.trim().length < 5) return;

    setEnCours(user.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!session?.access_token || !anonKey) {
        throw new Error('Votre session d’administration n’est pas disponible.');
      }

      // Le changement d'état passe par une frontière serveur vérifiant AAL2,
      // hiérarchie, capacité et audit. La page ne dépend plus d'un RPC absent
      // du cache PostgREST de certaines instances déployées.
      const nouvelEtat = !user.is_active;
      const resultat = await safeFetch<StatusMutationResponse>(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user-status`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            is_active: nouvelEtat,
            reason: decision.trim(),
          }),
        },
      );
      if (!resultat.ok) throw new Error(resultat.error.message);
      if (resultat.data.success !== true
        || resultat.data.user_id !== user.id
        || resultat.data.is_active !== nouvelEtat) {
        throw new Error('Le serveur n’a pas confirmé le nouveau statut du compte.');
      }
      addToast(
        resultat.data.message || (user.is_active ? 'Compte désactivé' : 'Compte réactivé'),
        'success',
      );
      await charger();
    } catch (reason) {
      addToast(errorMessage(reason, 'Modification impossible'), 'error');
    } finally {
      setEnCours(null);
    }
  };

  const supprimerCompte = async (user: AdminUser) => {
    if (utilisateurCourant?.id === user.id) {
      addToast('Vous ne pouvez pas supprimer votre propre compte.', 'error');
      return;
    }
    if (user.role === 'owner') {
      addToast('Le compte propriétaire est protégé.', 'error');
      return;
    }
    const decision = await demanderConfirmation({
      title: 'Supprimer définitivement ce compte ?',
      message:
        `${user.full_name || user.email} sera supprimé uniquement si le serveur confirme `
        + 'qu’aucune activité métier ne lui est rattachée. Ses sessions seront fermées automatiquement. '
        + 'Cette action est irréversible.',
      confirmText: 'Supprimer le compte',
      cancelText: 'Annuler',
      severity: 'danger',
      requireComment: true,
      commentPlaceholder: 'Motif de la suppression définitive…',
    });
    if (typeof decision !== 'string' || decision.trim().length < 5) return;

    setEnCours(user.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!session?.access_token || !anonKey) {
        throw new Error('Votre session d’administration n’est pas disponible.');
      }

      const resultat = await safeFetch<DeleteMutationResponse>(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: user.id, motif: decision.trim() }),
        },
      );
      if (!resultat.ok) throw new Error(resultat.error.message);
      if (
        resultat.data.success !== true
        || resultat.data.deleted_user_id !== user.id
        || resultat.data.email_reusable !== true
      ) {
        throw new Error('Le serveur n’a pas confirmé la suppression du compte demandé.');
      }

      setUsers((comptes) => comptes.filter((compte) => compte.id !== user.id));
      addToast(resultat.data.message || 'Compte supprimé définitivement', 'success');
      await charger();
    } catch (reason) {
      addToast(errorMessage(reason, 'Suppression impossible'), 'error');
    } finally {
      setEnCours(null);
    }
  };

  const renvoyerBienvenue = async (user: AdminUser) => {
    const confirme = await demanderConfirmation({
      title: 'Renvoyer le courriel de bienvenue ?',
      message:
        `Un nouveau lien sécurisé sera envoyé à ${user.email}. `
        + 'Le lien précédent sera remplacé et ne pourra plus être utilisé.',
      confirmText: 'Renvoyer le courriel',
      cancelText: 'Annuler',
      severity: 'info',
    });
    if (confirme !== true) return;

    setEnCours(user.id);
    try {
      const resultat = await resendWelcomeEmail(user.id);
      if (!resultat.success) {
        throw new Error(resultat.error || 'Le courriel de bienvenue n’a pas pu être renvoyé.');
      }
      addToast(
        resultat.message || 'Un nouveau courriel de bienvenue a été envoyé.',
        'success',
      );
      await charger();
    } catch (reason) {
      addToast(errorMessage(reason, 'Renvoi impossible'), 'error');
    } finally {
      setEnCours(null);
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page">
        <ConfirmationDialog />

        <PageHeader
          icon={Users}
          title="Comptes utilisateurs"
          subtitle="Comptes, ressources de rattachement, portails et rôles effectifs."
          breadcrumb={[{ label: 'Utilisateurs & Portails' }, { label: 'Utilisateurs' }]}
          actions={
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/users/new')}>
              <UserPlus aria-hidden="true" /> Créer un compte
            </button>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <div className="admin-users__tabs" role="tablist" aria-label="État des comptes">
          {STATUS_TABS.map((onglet) => {
            const nombre = onglet.value === 'all'
              ? users.length
              : onglet.value === 'actif'
                ? actifs
                : users.length - actifs;
            const actif = filters.statut === onglet.value;
            return (
              <button
                key={onglet.value}
                type="button"
                role="tab"
                aria-selected={actif}
                className={actif ? 'is-active' : undefined}
                onClick={() => setFilters((courants) => ({ ...courants, statut: onglet.value }))}
              >
                {onglet.label} <span>({nombre})</span>
              </button>
            );
          })}
        </div>

        <section className="sn-card admin-page__filtres" aria-label="Filtres de la liste">
          <label className="sn-field admin-page__filtre-large">
            <span className="sn-field__label">Rechercher</span>
            <input
              value={filters.recherche}
              onChange={(event) => setFilters((current) => ({ ...current, recherche: event.target.value }))}
              placeholder="Nom, adresse e-mail ou compagnie…"
            />
          </label>
          <label className="sn-field">
            <span className="sn-field__label">Rôle</span>
            {/* Les rôles propriétaire et administrateur étaient absents du filtre. */}
            <select
              value={filters.role}
              onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value as UserFilters['role'] }))}
            >
              <option value="all">Tous les rôles</option>
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
              <option value="comptoir">Comptoir d’achat</option>
            </select>
          </label>
          <button type="button" className="sn-btn" onClick={() => setFilters(EMPTY_USER_FILTERS)}>
            Réinitialiser
          </button>
        </section>

        <Section
          id="comptes"
          icon={Users}
          tone="emerald"
          title={`Comptes (${visibles.length})`}
          description="Sélectionnez un compte pour consulter son historique et ses permissions."
        >
          {loading ? (
            <div className="admin-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des comptes…
            </div>
          ) : erreur ? (
            <EmptyState
              title="Liste des comptes indisponible"
              description="Le chargement n’a pas abouti. Réessayez après vérification de votre session et de vos habilitations."
              action={
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => void charger()}>
                  Réessayer
                </button>
              }
            />
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Aucun compte ne correspond"
              description={users.length === 0 ? 'Aucun compte n’est enregistré.' : 'Ajustez les filtres pour élargir la recherche.'}
              action={
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/users/new')}>
                  Créer un compte
                </button>
              }
            />
          ) : (
            <div className="admin-page__table-wrap">
              <table className="admin-page__table">
                <caption className="sr-only">Comptes utilisateurs</caption>
                <thead>
                  <tr>
                    <th scope="col">Utilisateur</th>
                    <th scope="col">Téléphone</th>
                    <th scope="col">Portail & rôle</th>
                    <th scope="col">Compagnies</th>
                    <th scope="col">État</th>
                    <th scope="col">Dernière connexion</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.full_name || 'Nom non renseigné'}</strong>
                        <small>{user.email}</small>
                      </td>
                      <td>{user.phone || '—'}</td>
                      <td>
                        <strong>{user.portal_name || 'Portail non affecté'}</strong>
                        <small>{user.access_role_name || displayRoleLabel(displayRole(user))}</small>
                      </td>
                      <td>
                        {user.mining_company_names.length === 0 ? (
                          '—'
                        ) : (
                          <span className="admin-page__chips">
                            {user.mining_company_names.map((nom) => (
                              <span key={nom}>
                                <Building2 aria-hidden="true" /> {nom}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="admin-page__status-stack">
                          <Badge tone={user.is_active ? 'success' : 'danger'}>
                            {user.is_active ? 'Actif' : 'Désactivé'}
                          </Badge>
                          {user.is_active && requiresWelcomeRecovery(user) && (
                            <Badge tone="warning">Enrôlement à finaliser</Badge>
                          )}
                        </span>
                      </td>
                      <td>{formatConnexion(user.last_login_at)}</td>
                      <td>
                        <div className="admin-page__actions">
                          <button
                            type="button"
                            className="sn-btn sn-btn--icon"
                            aria-label={`Consulter ${user.full_name || user.email}`}
                            onClick={() => navigate(`/users/${user.id}`)}
                          >
                            <Eye aria-hidden="true" />
                          </button>
                          {user.role !== 'owner' && user.is_active && requiresWelcomeRecovery(user) && (
                            <button
                              type="button"
                              className="sn-btn sn-btn--icon"
                              aria-label={`Renvoyer le courriel de bienvenue à ${user.full_name || user.email}`}
                              title="Générer un nouveau lien et renvoyer le courriel de bienvenue"
                              disabled={enCours === user.id || utilisateurCourant?.id === user.id}
                              onClick={() => void renvoyerBienvenue(user)}
                            >
                              {enCours === user.id ? (
                                <Loader2 className="sn-spin" aria-hidden="true" />
                              ) : (
                                <MailPlus aria-hidden="true" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            className="sn-btn sn-btn--icon"
                            aria-label={`Modifier ${user.full_name || user.email}`}
                            onClick={() => navigate(`/users/edit?userId=${user.id}`)}
                          >
                            <PencilLine aria-hidden="true" />
                          </button>
                          {user.role !== 'owner' && (
                            <button
                              type="button"
                              className="sn-btn sn-btn--icon"
                              aria-label={
                                user.is_active
                                  ? `Désactiver ${user.full_name || user.email}`
                                  : `Réactiver ${user.full_name || user.email}`
                              }
                              disabled={enCours === user.id || utilisateurCourant?.id === user.id}
                              onClick={() => void basculerStatut(user)}
                            >
                              {enCours === user.id ? (
                                <Loader2 className="sn-spin" aria-hidden="true" />
                              ) : user.is_active ? (
                                <Lock aria-hidden="true" />
                              ) : (
                                <Unlock aria-hidden="true" />
                              )}
                            </button>
                          )}
                          {user.role !== 'owner' && (
                            <button
                              type="button"
                              className="sn-btn sn-btn--icon sn-btn--danger"
                              aria-label={`Supprimer ${user.full_name || user.email}`}
                              title="Supprimer le compte si aucune activité métier ne lui est rattachée"
                              disabled={enCours === user.id || utilisateurCourant?.id === user.id}
                              onClick={() => void supprimerCompte(user)}
                            >
                              {enCours === user.id ? (
                                <Loader2 className="sn-spin" aria-hidden="true" />
                              ) : (
                                <Trash2 aria-hidden="true" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
