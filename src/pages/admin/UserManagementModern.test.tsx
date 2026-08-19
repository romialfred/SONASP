import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UserManagementModern,
  DESCRIPTIONS_ROLE,
  EMPTY_USER_FORM,
  appliquerGabarit,
  genererMotDePasse,
  validateIdentite,
} from './UserManagementModern';
import { EMPTY_PERMISSION } from '@/services/userPermissionsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: new URLSearchParams(),
  from: vi.fn(),
  listModules: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  createUser: vi.fn(),
  addToast: vi.fn(),
  reponses: {} as Record<string, unknown[] | null>,
  inserts: [] as Array<{ table: string; lignes: unknown }>,
  deletes: [] as string[],
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.params, vi.fn()],
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ addToast: mocks.addToast }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
vi.mock('@/services/userManagementService', () => ({ createUser: mocks.createUser }));

vi.mock('@/services/userPermissionsService', async () => {
  const reel = await vi.importActual<typeof import('@/services/userPermissionsService')>(
    '@/services/userPermissionsService'
  );
  return {
    ...reel,
    userPermissionsService: { listModules: mocks.listModules, load: mocks.load, save: mocks.save },
  };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function stub(table: string) {
  const rows = mocks.reponses[table];
  const enEchec = rows === null;
  const resultat = enEchec ? { data: null, error: { message: 'écriture refusée' } } : { data: rows || [], error: null };
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve(enEchec ? { data: null, error: { message: 'écriture refusée' } } : { data: (rows || [])[0] ?? null, error: null })
  );
  builder.update = vi.fn(() => builder);
  builder.insert = vi.fn((lignes: unknown) => {
    mocks.inserts.push({ table, lignes });
    return builder;
  });
  builder.delete = vi.fn(() => {
    mocks.deletes.push(table);
    return builder;
  });
  builder.then = (resolve: (value: typeof resultat) => unknown) => Promise.resolve(resultat).then(resolve);
  return builder;
}

const modules = [
  { id: 'm1', name: 'sales', display_name: 'Ventes', description: 'Gestion des ventes', category: 'Ventes' },
  { id: 'm2', name: 'audit', display_name: 'Audit', description: null, category: 'Système' },
];

const formValide = {
  ...EMPTY_USER_FORM,
  fullName: 'Awa KABORE',
  email: 'awa@sonasp.bf',
  role: 'admin' as const,
  miningCompanyIds: ['c1'],
  password: 'MotDePasse!234',
};

describe('validation du compte', () => {
  it('exige les mentions obligatoires', () => {
    expect(validateIdentite(EMPTY_USER_FORM, false)).toBe('Le nom complet est obligatoire.');
    expect(validateIdentite({ ...formValide, email: 'pas-un-mail' }, false)).toBe('L’adresse e-mail est invalide.');
    expect(validateIdentite({ ...formValide, role: '' }, false)).toBe('Sélectionnez un rôle.');
    expect(validateIdentite({ ...formValide, miningCompanyIds: [] }, false)).toBe(
      'Rattachez le compte à au moins une compagnie.'
    );
    expect(validateIdentite({ ...formValide, password: 'court' }, false)).toBe(
      'Le mot de passe doit compter au moins 12 caractères.'
    );
    expect(validateIdentite(formValide, false)).toBeNull();
    // En modification, le mot de passe n'est pas redemandé.
    expect(validateIdentite({ ...formValide, password: '' }, true)).toBeNull();
  });

  it('décrit chaque rôle sans référence à un module inexistant', () => {
    expect(DESCRIPTIONS_ROLE.owner).toContain('Accès complet');
    expect(Object.values(DESCRIPTIONS_ROLE).join(' ')).not.toMatch(/batch/i);
  });

  it('génère un mot de passe conforme', () => {
    const motDePasse = genererMotDePasse();
    expect(motDePasse.length).toBeGreaterThanOrEqual(12);
    expect(motDePasse).toMatch(/[A-Z]/);
    expect(motDePasse).toMatch(/[a-z]/);
    expect(motDePasse).toMatch(/[0-9]/);
    expect(motDePasse).toMatch(/[!@#$%*?]/);
  });

  it('applique un gabarit d’habilitations', () => {
    const base = { m1: EMPTY_PERMISSION('m1'), m2: EMPTY_PERMISSION('m2') };
    expect(appliquerGabarit(base, 'complet').m1).toMatchObject({ can_view: true, can_approve: true });
    expect(appliquerGabarit(base, 'consultation').m1).toMatchObject({ can_view: true, can_create: false });
    expect(appliquerGabarit(base, 'aucun').m1).toMatchObject({ can_view: false });
  });
});

describe('UserManagementModern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = new URLSearchParams();
    mocks.inserts = [];
    mocks.deletes = [];
    mocks.listModules.mockResolvedValue({ modules });
    mocks.load.mockResolvedValue({ permissions: {} });
    mocks.save.mockResolvedValue({ success: true });
    mocks.createUser.mockResolvedValue({ success: true, user: { id: 'nouveau' } });
    mocks.reponses = {
      mining_companies: [{ id: 'c1', name: 'Essakane SA', abbreviation: 'ESK' }],
      user_profiles: [],
      user_site_assignments: [],
    };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  const remplirIdentite = () => {
    fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: 'Awa KABORE' } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'awa@sonasp.bf' } });
    fireEvent.click(screen.getByRole('radio', { name: /Administrateur/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Essakane SA/ }));
    fireEvent.change(screen.getByLabelText('Mot de passe', { exact: false, selector: '#mot-de-passe' }), { target: { value: 'MotDePasse!234' } });
  };

  it('propose les sept rôles, propriétaire et administrateur compris', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    // La liste s'arrêtait à cinq rôles : impossible de créer un administrateur.
    expect(screen.getByRole('radio', { name: /Propriétaire/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Administrateur/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Direction/ })).toBeInTheDocument();
    expect(screen.queryByText('Add New User')).not.toBeInTheDocument();
  });

  it('bloque le passage aux habilitations tant que l’identité est incomplète', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Habilitations/ })).toBeDisabled();
    expect(screen.getByText('Le nom complet est obligatoire.')).toBeInTheDocument();

    remplirIdentite();
    expect(screen.getByRole('button', { name: /Habilitations/ })).not.toBeDisabled();
  });

  it('génère un mot de passe à la demande', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText('Mot de passe', { exact: false, selector: '#mot-de-passe' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Générer un mot de passe/ }));
    expect((screen.getByLabelText('Mot de passe', { exact: false, selector: '#mot-de-passe' }) as HTMLInputElement).value.length).toBeGreaterThanOrEqual(12);
  });

  it('crée le compte, ses rattachements et ses habilitations', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    remplirIdentite();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Consultation seule' }));
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }));

    await waitFor(() => expect(mocks.createUser).toHaveBeenCalled());
    expect(mocks.createUser.mock.calls[0][0]).toMatchObject({ email: 'awa@sonasp.bf', role: 'admin' });
    await waitFor(() =>
      expect(mocks.inserts).toContainEqual({
        table: 'user_site_assignments',
        lignes: [{ user_id: 'nouveau', site_id: 'c1' }],
      })
    );
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.navigate).toHaveBeenCalledWith('/users');
  });

  it('impose la consultation aux autres droits', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    remplirIdentite();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));

    fireEvent.click(screen.getByLabelText('Supprimer — Ventes'));
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();

    fireEvent.click(screen.getByLabelText('Consulter — Ventes'));
    expect(screen.getByLabelText('Supprimer — Ventes')).not.toBeChecked();
  });

  it('signale l’échec d’écriture des rattachements au lieu de l’ignorer', async () => {
    mocks.reponses.user_site_assignments = null;
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    remplirIdentite();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }));

    // L'issue des écritures de rattachement n'était jamais vérifiée.
    await waitFor(() => expect(screen.getByText('écriture refusée')).toBeInTheDocument());
    expect(mocks.navigate).not.toHaveBeenCalledWith('/users');
  });

  it('restitue un échec de création', async () => {
    mocks.createUser.mockResolvedValue({ success: false, error: 'adresse déjà utilisée' });
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());

    remplirIdentite();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }));

    await waitFor(() => expect(screen.getByText('adresse déjà utilisée')).toBeInTheDocument());
  });

  it('charge un compte existant en modification', async () => {
    mocks.params = new URLSearchParams('userId=u1');
    mocks.reponses.user_profiles = [
      { id: 'u1', full_name: 'Moussa OUEDRAOGO', email: 'moussa@sonasp.bf', phone: '+226 70', role: 'factory', is_active: false },
    ];
    mocks.reponses.user_site_assignments = [{ site_id: 'c1' }];
    mocks.load.mockResolvedValue({ permissions: { m1: { ...EMPTY_PERMISSION('m1'), can_view: true } } });

    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Moussa OUEDRAOGO'));

    expect(screen.getByLabelText(/Adresse e-mail/)).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Usine/ })).toBeChecked();
    expect(screen.queryByLabelText('Mot de passe', { exact: false, selector: '#mot-de-passe' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();
  });
});
