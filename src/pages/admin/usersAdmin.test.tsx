import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UsersListPage,
  EMPTY_USER_FILTERS,
  filterUsers,
  formatConnexion,
  type AdminUser,
} from './UsersListPage';
import UserDetailsPage, { csvCell } from './UserDetailsPage';
import { ALL_ROLES, roleLabel, roleTone } from '@/lib/roleLabels';
import type { AdministrationUserDetails } from '@/services/userAdministrationDetailsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { userId: 'u1' as string | undefined },
  from: vi.fn(),
  getSession: vi.fn(),
  safeFetch: vi.fn(),
  getUserDetails: vi.fn(),
  rpc: vi.fn(),
  addToast: vi.fn(),
  confirmer: vi.fn(),
  currentUser: { id: 'moi' } as { id: string } | null,
  reponses: {} as Record<string, unknown[] | null>,
  updates: [] as Array<Record<string, unknown>>,
  selects: [] as Array<{ table: string; value: string }>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ addToast: mocks.addToast }) }));

vi.mock('@/components/ui/ConfirmationDialog', () => ({
  useConfirmationDialog: () => ({ open: mocks.confirmer, ConfirmationDialog: () => null }),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.currentUser }) }));

vi.mock('@/lib/apiClient', () => ({ safeFetch: mocks.safeFetch }));

vi.mock('@/services/userAdministrationDetailsService', () => ({
  getAdministrationUserDetails: mocks.getUserDetails,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc, auth: { getSession: mocks.getSession } },
}));

vi.mock('@/components/admin/UserStatsCard', () => ({ default: () => <div>Statistiques du compte</div> }));
vi.mock('@/components/admin/LoginSessionsTab', () => ({ default: () => <div>Sessions de connexion</div> }));
vi.mock('@/components/admin/ActivityHistoryTab', () => ({ default: () => <div>Journal des actions</div> }));
vi.mock('@/components/admin/SiteAccessTab', () => ({ default: () => <div>Sites accessibles</div> }));
vi.mock('@/components/admin/UserPermissionsTab', () => ({ default: () => <div>Permissions détaillées</div> }));

function stub(table: string) {
  const rows = mocks.reponses[table];
  const resultat = rows === null ? { data: null, error: { message: 'offline' } } : { data: rows || [], error: null };
  const unique = Array.isArray(rows) ? rows[0] ?? null : null;
  const builder: Record<string, unknown> = {};
  ['eq', 'order', 'gte', 'lte', 'in'].forEach((methode) => {
    builder[methode] = vi.fn(() => builder);
  });
  builder.select = vi.fn((value: string) => {
    mocks.selects.push({ table, value });
    return builder;
  });
  builder.update = vi.fn((valeurs: Record<string, unknown>) => {
    mocks.updates.push(valeurs);
    return builder;
  });
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve(rows === null ? { data: null, error: { message: 'offline' } } : { data: unique, error: null })
  );
  builder.then = (resolve: (value: typeof resultat) => unknown) => Promise.resolve(resultat).then(resolve);
  return builder;
}

const comptes: AdminUser[] = [
  {
    id: 'u1',
    full_name: 'Awa KABORE',
    email: 'awa@sonasp.bf',
    role: 'admin',
    phone: '+226 70 00 00 01',
    mining_company_names: ['ESK'],
    is_active: true,
    last_login_at: '2026-08-10T09:00:00Z',
    created_at: '2026-01-01',
  },
  {
    id: 'u2',
    full_name: 'Moussa OUEDRAOGO',
    email: 'moussa@sonasp.bf',
    role: 'factory',
    phone: null,
    mining_company_names: [],
    is_active: false,
    last_login_at: null,
    created_at: '2026-02-01',
  },
];

function ficheUtilisateur(
  id = 'u1',
  fullName = 'Awa KABORE',
  email = 'awa@sonasp.bf',
): AdministrationUserDetails {
  return {
    success: true,
    profile: {
      id,
      email,
      full_name: fullName,
      phone: '+226 70 00 00 01',
      role: 'admin',
      job_title: 'Cheffe de service',
      department: 'Contrôle',
      is_active: true,
      account_locked: false,
      account_locked_until: null,
      failed_login_attempts: 2,
      two_factor_enabled: false,
      mfa_enrolled_at: null,
      last_login_at: '2026-08-10T09:00:00Z',
      last_login_ip: null,
      last_activity_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-08-10T09:00:00Z',
      activation_completed_at: null,
      must_change_password: false,
      password_changed_at: null,
      timezone: 'Africa/Ouagadougou',
      language_preference: 'fr',
      language: 'fr',
      mining_company_id: null,
      mining_company: null,
    },
    statistics: {
      connection_events: 1,
      connection_events_30d: 1,
      rejected_connections: 0,
      activity_events: 2,
      activity_events_30d: 2,
      permissions_count: 0,
      sites_count: 0,
    },
    connections: [],
    activities: [],
    permissions: [],
    sites: [],
    account_changes: [],
    sources_unavailable: [],
  };
}

describe('référentiel des rôles', () => {
  it('nomme les rôles en français', () => {
    // Les écrans d'administration affichaient « Owner », « Factory »…
    expect(roleLabel('owner')).toBe('Propriétaire');
    expect(roleLabel('factory')).toBe('Usine');
    expect(roleLabel(null)).toBe('Rôle non défini');
    expect(roleTone('admin')).toBe('danger');
    expect(ALL_ROLES).toContain('owner');
    expect(ALL_ROLES).toContain('admin');
  });
});

describe('filtrage des comptes', () => {
  it('croise recherche, rôle et état', () => {
    expect(filterUsers(comptes, EMPTY_USER_FILTERS)).toHaveLength(2);
    expect(filterUsers(comptes, { ...EMPTY_USER_FILTERS, recherche: 'ESK' })).toHaveLength(1);
    expect(filterUsers(comptes, { ...EMPTY_USER_FILTERS, recherche: 'moussa@' })[0].id).toBe('u2');
    expect(filterUsers(comptes, { ...EMPTY_USER_FILTERS, role: 'admin' })).toHaveLength(1);
    expect(filterUsers(comptes, { ...EMPTY_USER_FILTERS, statut: 'inactif' })[0].id).toBe('u2');
  });

  it('formate la dernière connexion en français', () => {
    expect(formatConnexion(null)).toBe('Jamais connecté');
    expect(formatConnexion('pas-une-date')).toBe('Jamais connecté');
    expect(formatConnexion('2026-08-10T09:00:00Z')).toBe('10/08/2026');
  });
});

describe('UsersListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updates = [];
    mocks.selects = [];
    mocks.currentUser = { id: 'moi' };
    mocks.confirmer.mockResolvedValue('Compte de test clôturé');
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-aal2' } } });
    mocks.reponses = {
      user_profiles: [
        { id: 'u1', full_name: 'Awa KABORE', email: 'awa@sonasp.bf', role: 'admin', phone: '+226 70 00 00 01', mining_company_id: 'c1', is_active: true, last_login_at: '2026-08-10T09:00:00Z', created_at: '2026-01-01' },
        { id: 'u2', full_name: 'Moussa OUEDRAOGO', email: 'moussa@sonasp.bf', role: 'factory', phone: null, is_active: false, last_login_at: null, created_at: '2026-02-01' },
      ],
      mining_companies: [{ id: 'c1', name: 'Essakane SA', abbreviation: 'ESK' }],
      user_site_assignments: [{ user_id: 'u1', site_id: 's1', sites: { name: 'Site Essakane' } }],
    };
    mocks.safeFetch.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).includes('/delete-user')
        ? {
            ok: true,
            status: 200,
            data: { success: true, deleted_user_id: 'u2', message: 'Compte supprimé définitivement' },
          }
        : String(input).includes('/manage-user-status')
          ? {
              ok: true,
              status: 200,
              data: { success: true, user_id: 'u1', is_active: false, message: 'Compte désactivé et sessions fermées.' },
            }
        : {
            ok: true,
            status: 200,
            data: { users: mocks.reponses.user_profiles || [] },
          }
    );
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('affiche les comptes avec des libellés français', async () => {
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    const tableau = within(screen.getByRole('table'));
    expect(tableau.getByText('Administrateur')).toBeInTheDocument();
    expect(tableau.getByText('Usine')).toBeInTheDocument();
    expect(screen.getByText('Jamais connecté')).toBeInTheDocument();
    expect(screen.getByText('ESK')).toBeInTheDocument();
    expect(screen.getByText('Site Essakane')).toBeInTheDocument();
    expect(mocks.selects).toContainEqual({
      table: 'user_site_assignments',
      value: 'user_id, site_id, sites:site_id(name)',
    });
    expect(mocks.selects.some(({ value }) => value.includes('mining_companies:site_id'))).toBe(false);
    expect(screen.queryByText('Users Management')).not.toBeInTheDocument();
  });

  it('offre les sept rôles au filtre', async () => {
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByLabelText('Rôle')).toBeInTheDocument());

    // Propriétaire et administrateur manquaient à la liste déroulante.
    const options = within(screen.getByLabelText('Rôle')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(
      expect.arrayContaining(['Propriétaire', 'Administrateur', 'Direction', 'Client'])
    );
  });

  it('filtre la liste sur la recherche saisie', async () => {
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'moussa' } });

    expect(screen.queryByText('Awa KABORE')).not.toBeInTheDocument();
    expect(screen.getByText('Moussa OUEDRAOGO')).toBeInTheDocument();
  });

  it('organise les comptes en onglets avec leurs décomptes', async () => {
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    expect(screen.getByRole('tab', { name: 'Tous (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Actifs (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Désactivés (1)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Désactivés (1)' }));
    expect(screen.queryByText('Awa KABORE')).not.toBeInTheDocument();
    expect(screen.getByText('Moussa OUEDRAOGO')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Désactivés (1)' })).toHaveAttribute('aria-selected', 'true');
  });

  it('demande confirmation avant de désactiver un compte', async () => {
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver Awa KABORE' }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.confirmer.mock.calls[0][0]).toMatchObject({ severity: 'danger' });
    await waitFor(() => expect(mocks.safeFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/manage-user-status'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          user_id: 'u1',
          is_active: false,
          reason: 'Compte de test clôturé',
        }),
      }),
    ));
  });

  it('n’enregistre rien si la confirmation est refusée', async () => {
    mocks.confirmer.mockResolvedValue(false);
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver Awa KABORE' }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.safeFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/manage-user-status'),
      expect.anything(),
    );
  });

  it('empêche un administrateur de désactiver son propre compte', async () => {
    mocks.currentUser = { id: 'u1' };
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    // Rien n'empêchait un administrateur de se verrouiller lui-même hors de la plateforme.
    expect(screen.getByRole('button', { name: 'Désactiver Awa KABORE' })).toBeDisabled();
  });

  it('supprime un compte seulement après confirmation motivée', async () => {
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Moussa OUEDRAOGO')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Moussa OUEDRAOGO' }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.confirmer.mock.calls[0][0]).toMatchObject({
      severity: 'danger',
      requireComment: true,
    });
    await waitFor(() => expect(mocks.safeFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/delete-user'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 'u2', motif: 'Compte de test clôturé' }),
      }),
    ));
    expect(mocks.addToast).toHaveBeenCalledWith('Compte supprimé définitivement', 'success');
  });

  it('ne propose jamais la suppression d’un compte encore actif', async () => {
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Supprimer Awa KABORE' })).not.toBeInTheDocument();
  });

  it('ne propose jamais la suppression du propriétaire', async () => {
    mocks.reponses.user_profiles = [
      {
        id: 'proprietaire',
        full_name: 'Compte propriétaire',
        email: 'owner@sonasp.bf',
        role: 'owner',
        phone: null,
        is_active: true,
        last_login_at: null,
        created_at: '2026-01-01',
      },
    ];
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Compte propriétaire')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Supprimer Compte propriétaire' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Désactiver Compte propriétaire' })).not.toBeInTheDocument();
  });

  it('refuse une confirmation de statut incohérente', async () => {
    mocks.safeFetch.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).includes('/manage-user-status')
        ? { ok: true, status: 200, data: { success: true, user_id: 'autre', is_active: false } }
        : { ok: true, status: 200, data: { users: mocks.reponses.user_profiles || [] } },
    );
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver Awa KABORE' }));

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalledWith(
      'Le serveur n’a pas confirmé le nouveau statut du compte.',
      'error',
    ));
    expect(mocks.addToast).not.toHaveBeenCalledWith(expect.anything(), 'success');
  });

  it('refuse une confirmation de suppression pour une autre cible', async () => {
    mocks.safeFetch.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).includes('/delete-user')
        ? { ok: true, status: 200, data: { success: true, deleted_user_id: 'autre' } }
        : { ok: true, status: 200, data: { users: mocks.reponses.user_profiles || [] } },
    );
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Moussa OUEDRAOGO')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Moussa OUEDRAOGO' }));

    await waitFor(() => expect(mocks.addToast).toHaveBeenCalledWith(
      'Le serveur n’a pas confirmé la suppression du compte demandé.',
      'error',
    ));
    expect(screen.getByText('Moussa OUEDRAOGO')).toBeInTheDocument();
  });

  it('ferme la liste si les affectations ne peuvent pas être chargées', async () => {
    mocks.reponses.user_site_assignments = null;
    render(<UsersListPage />);

    await waitFor(() => expect(screen.getByText('offline')).toBeInTheDocument());
    expect(screen.getByText('Liste des comptes indisponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.queryByText('Aucun compte n’est enregistré.')).not.toBeInTheDocument();
  });

  it('signale un échec de chargement', async () => {
    mocks.safeFetch.mockResolvedValue({ ok: false, error: { message: 'offline' } });
    render(<UsersListPage />);

    await waitFor(() => expect(screen.getByText('offline')).toBeInTheDocument());
    expect(screen.getByText('Liste des comptes indisponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.queryByText('Aucun compte n’est enregistré.')).not.toBeInTheDocument();
  });
});

describe('UserDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.userId = 'u1';
    mocks.reponses = {};
    mocks.getUserDetails.mockResolvedValue(ficheUtilisateur());
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('présente le compte et ses sections', async () => {
    render(<UserDetailsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Awa KABORE' })).toBeInTheDocument());

    expect(screen.getAllByText('Administrateur').length).toBeGreaterThan(0);
    expect(screen.getByText('Cheffe de service')).toBeInTheDocument();
    expect(screen.getByText(/2 tentative\(s\) échouée\(s\)/)).toBeInTheDocument();
    expect(screen.getByText('Connexions consignées')).toBeInTheDocument();
    expect(screen.getByText('Cycle de vie du compte')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Permissions/ }));
    expect(screen.getByText('Permissions individuelles')).toBeInTheDocument();
  });

  it('propose des actions au lieu d’un cul-de-sac', async () => {
    render(<UserDetailsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Awa KABORE' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Modifier le compte/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/users/edit?userId=u1');
  });

  it('distingue un compte absent d’une base injoignable', async () => {
    mocks.getUserDetails.mockRejectedValue(new Error('offline'));
    render(<UserDetailsPage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Compte indisponible' })).toBeInTheDocument());
    expect(screen.getByText('offline')).toBeInTheDocument();
  });

  it('rend une source partielle indisponible et bloque son export', async () => {
    const fiche = ficheUtilisateur();
    fiche.statistics.connection_events = null;
    fiche.statistics.connection_events_30d = null;
    fiche.statistics.rejected_connections = null;
    fiche.sources_unavailable = ['journal des connexions'];
    mocks.getUserDetails.mockResolvedValue(fiche);
    render(<UserDetailsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Awa KABORE' })).toBeInTheDocument());

    expect(screen.getAllByText('Indisponible').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /Connexions/ }));

    expect(screen.getByRole('button', { name: 'Exporter en CSV' })).toBeDisabled();
    expect(screen.getByText('Journal des connexions partiellement indisponible.')).toBeInTheDocument();
    expect(screen.queryByText('Ce compte ne s’est jamais connecté.')).not.toBeInTheDocument();
  });

  it('ignore une réponse tardive après changement de compte', async () => {
    let resolvePremier!: (value: ReturnType<typeof ficheUtilisateur>) => void;
    let resolveSecond!: (value: ReturnType<typeof ficheUtilisateur>) => void;
    mocks.getUserDetails.mockImplementation((id: string) => new Promise((resolve) => {
      if (id === 'u1') resolvePremier = resolve;
      else resolveSecond = resolve;
    }));

    const { rerender } = render(<UserDetailsPage />);
    await waitFor(() => expect(mocks.getUserDetails).toHaveBeenCalledWith('u1', expect.any(AbortSignal)));

    mocks.params.userId = 'u2';
    rerender(<UserDetailsPage />);
    await waitFor(() => expect(mocks.getUserDetails).toHaveBeenCalledWith('u2', expect.any(AbortSignal)));

    resolveSecond(ficheUtilisateur('u2', 'Moussa OUEDRAOGO', 'moussa@sonasp.bf'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Moussa OUEDRAOGO' })).toBeInTheDocument());

    resolvePremier(ficheUtilisateur('u1', 'Awa KABORE', 'awa@sonasp.bf'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Awa KABORE' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Moussa OUEDRAOGO' })).toBeInTheDocument();
  });

  it('refuse d’afficher une fiche qui ne correspond pas à la route', async () => {
    mocks.getUserDetails.mockResolvedValue(ficheUtilisateur('u2', 'Moussa OUEDRAOGO'));
    render(<UserDetailsPage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Compte indisponible' })).toBeInTheDocument());
    expect(screen.getByText('La fiche reçue ne correspond pas au compte demandé.')).toBeInTheDocument();
  });
});

describe('export CSV administratif', () => {
  it.each(['=1+1', '+cmd', '-10+20', '@SUM(A1)', '\t=cmd', ' =cmd'])(
    'neutralise une formule commençant par %s',
    (valeur) => {
      expect(csvCell(valeur)).toMatch(/^"'/);
    },
  );

  it('échappe les guillemets sans modifier une valeur ordinaire', () => {
    expect(csvCell('Compte "test"')).toBe('"Compte ""test"""');
  });
});
