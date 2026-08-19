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
import UserDetailsPage from './UserDetailsPage';
import { ALL_ROLES, roleLabel, roleTone } from '@/lib/roleLabels';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { userId: 'u1' as string | undefined },
  from: vi.fn(),
  getSession: vi.fn(),
  safeFetch: vi.fn(),
  addToast: vi.fn(),
  confirmer: vi.fn(),
  currentUser: { id: 'moi' } as { id: string } | null,
  reponses: {} as Record<string, unknown[] | null>,
  updates: [] as Array<Record<string, unknown>>,
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

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, auth: { getSession: mocks.getSession } },
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
  ['select', 'eq', 'order', 'gte', 'lte', 'in'].forEach((methode) => {
    builder[methode] = vi.fn(() => builder);
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
    mocks.currentUser = { id: 'moi' };
    mocks.confirmer.mockResolvedValue(true);
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.safeFetch.mockResolvedValue({ ok: false });
    mocks.reponses = {
      user_profiles: [
        { id: 'u1', full_name: 'Awa KABORE', email: 'awa@sonasp.bf', role: 'admin', phone: '+226 70 00 00 01', is_active: true, last_login_at: '2026-08-10T09:00:00Z', created_at: '2026-01-01' },
        { id: 'u2', full_name: 'Moussa OUEDRAOGO', email: 'moussa@sonasp.bf', role: 'factory', phone: null, is_active: false, last_login_at: null, created_at: '2026-02-01' },
      ],
      user_site_assignments: [{ user_id: 'u1', site_id: 's1', mining_companies: { name: 'Essakane SA', abbreviation: 'ESK' } }],
    };
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

  it('demande confirmation avant de désactiver un compte', async () => {
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver Awa KABORE' }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.confirmer.mock.calls[0][0]).toMatchObject({ severity: 'danger' });
    await waitFor(() => expect(mocks.updates).toContainEqual({ is_active: false }));
  });

  it('n’enregistre rien si la confirmation est refusée', async () => {
    mocks.confirmer.mockResolvedValue(false);
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver Awa KABORE' }));

    await waitFor(() => expect(mocks.confirmer).toHaveBeenCalled());
    expect(mocks.updates).toHaveLength(0);
  });

  it('empêche un administrateur de désactiver son propre compte', async () => {
    mocks.currentUser = { id: 'u1' };
    render(<UsersListPage />);
    await waitFor(() => expect(screen.getByText('Awa KABORE')).toBeInTheDocument());

    // Rien n'empêchait un administrateur de se verrouiller lui-même hors de la plateforme.
    expect(screen.getByRole('button', { name: 'Désactiver Awa KABORE' })).toBeDisabled();
  });

  it('signale un échec de chargement', async () => {
    mocks.reponses.user_profiles = null;
    render(<UsersListPage />);

    await waitFor(() => expect(screen.getByText('offline')).toBeInTheDocument());
    expect(screen.getByText('Aucun compte ne correspond')).toBeInTheDocument();
  });
});

describe('UserDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params.userId = 'u1';
    mocks.reponses = {
      user_profiles: [
        {
          id: 'u1',
          email: 'awa@sonasp.bf',
          full_name: 'Awa KABORE',
          phone: '+226 70 00 00 01',
          role: 'admin',
          job_title: 'Cheffe de service',
          department: 'Contrôle',
          is_active: true,
          account_locked: false,
          two_factor_enabled: false,
          last_login_at: '2026-08-10T09:00:00Z',
          last_activity_at: null,
          created_at: '2026-01-01',
          timezone: 'Africa/Ouagadougou',
          language_preference: 'fr',
          profile_picture_url: null,
          failed_login_attempts: 2,
        },
      ],
    };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  it('présente le compte et ses sections', async () => {
    render(<UserDetailsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Awa KABORE' })).toBeInTheDocument());

    expect(screen.getAllByText('Administrateur').length).toBeGreaterThan(0);
    expect(screen.getByText('Cheffe de service')).toBeInTheDocument();
    expect(screen.getByText(/2 tentative\(s\) de connexion échouée/)).toBeInTheDocument();
    expect(screen.getByText('Statistiques du compte')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Permissions/ }));
    expect(screen.getByText('Permissions détaillées')).toBeInTheDocument();
  });

  it('propose des actions au lieu d’un cul-de-sac', async () => {
    render(<UserDetailsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Awa KABORE' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Modifier le compte/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/users/edit?userId=u1');
  });

  it('distingue un compte absent d’une base injoignable', async () => {
    mocks.reponses.user_profiles = null;
    render(<UserDetailsPage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Compte introuvable' })).toBeInTheDocument());
    expect(screen.getByText('offline')).toBeInTheDocument();
  });
});
