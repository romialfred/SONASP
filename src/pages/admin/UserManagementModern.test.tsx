import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UserManagementModern,
  DESCRIPTIONS_ROLE,
  EMPTY_USER_FORM,
  appliquerGabarit,
  validateIdentite,
} from './UserManagementModern';
import { EMPTY_PERMISSION } from '@/services/userPermissionsService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: new URLSearchParams(),
  from: vi.fn(),
  rpc: vi.fn(),
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

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));

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
};

describe('validation du compte', () => {
  it('exige les mentions obligatoires', () => {
    expect(validateIdentite(EMPTY_USER_FORM, false)).toBe('Le nom complet est obligatoire.');
    expect(validateIdentite({ ...formValide, email: 'pas-un-mail' }, false)).toBe('L’adresse e-mail est invalide.');
    expect(validateIdentite({ ...formValide, role: '' }, false)).toBe('Sélectionnez un rôle.');
    expect(validateIdentite({ ...formValide, role: 'mine', miningCompanyIds: [] }, false)).toBe(
      'Rattachez le compte Société minière à une compagnie unique.'
    );
    expect(validateIdentite({ ...formValide, role: 'mine', miningCompanyIds: ['c1', 'c2'] }, false)).toBe(
      'Rattachez le compte Société minière à une compagnie unique.'
    );
    expect(validateIdentite({ ...formValide, role: 'mine', miningCompanyIds: ['c1'] }, false)).toBeNull();
    expect(validateIdentite(formValide, false)).toBeNull();
    expect(validateIdentite({ ...formValide, role: 'manager', miningCompanyIds: [] }, false)).toBeNull();
    expect(validateIdentite(formValide, true)).toBeNull();
  });

  it('décrit chaque rôle sans référence à un module inexistant', () => {
    expect(DESCRIPTIONS_ROLE.owner).toContain('Accès complet');
    expect(Object.values(DESCRIPTIONS_ROLE).join(' ')).not.toMatch(/batch/i);
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
    mocks.rpc.mockResolvedValue({ data: null, error: null });
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
  };

  it('propose les rôles de portail, propriétaire et administrateur compris', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    // La liste s'arrêtait à cinq rôles : impossible de créer un administrateur.
    expect(screen.getByRole('radio', { name: /Propriétaire/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Administrateur/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Direction/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Société minière/ })).toBeInTheDocument();
    expect(screen.queryByText('Add New User')).not.toBeInTheDocument();
  });

  it('bloque le passage aux habilitations tant que l’identité est incomplète', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Habilitations/ })).toBeDisabled();
    expect(screen.getByText('Le nom complet est obligatoire.')).toBeInTheDocument();

    remplirIdentite();
    expect(screen.getByRole('button', { name: /Habilitations/ })).not.toBeDisabled();
  });

  it('annonce le parcours sécurisé sans exposer de mot de passe provisoire', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByText('Activation sécurisée')).toBeInTheDocument());

    expect(screen.getByText(/lien à usage unique/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Mot de passe/)).not.toBeInTheDocument();
  });

  it('crée un compte interne sans lui attribuer un faux site minier', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    remplirIdentite();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Consultation seule' }));
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }));

    await waitFor(() => expect(mocks.createUser).toHaveBeenCalled());
    expect(mocks.createUser.mock.calls[0][0]).toMatchObject({ email: 'awa@sonasp.bf', role: 'admin' });
    expect(mocks.createUser.mock.calls[0][0]).toMatchObject({ mining_company_id: null });
    expect(mocks.inserts).not.toContainEqual(expect.objectContaining({ table: 'user_site_assignments' }));
    expect(mocks.createUser.mock.calls[0][0].permissions.m1).toMatchObject({ can_view: true });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/users');
  });

  it('impose la consultation aux autres droits', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    remplirIdentite();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));

    fireEvent.click(screen.getByLabelText('Supprimer — Ventes'));
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();

    fireEvent.click(screen.getByLabelText('Consulter — Ventes'));
    expect(screen.getByLabelText('Supprimer — Ventes')).not.toBeChecked();
  });

  it('crée un compte Société minière rattaché à une seule compagnie', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: 'Awa KABORE' } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'awa@mine.bf' } });
    fireEvent.click(screen.getByRole('radio', { name: /Société minière/ }));
    await waitFor(() => expect(screen.getByText('Essakane SA')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: /Essakane SA/ }));
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }));

    await waitFor(() => expect(mocks.createUser).toHaveBeenCalled());
    expect(mocks.createUser.mock.calls[0][0]).toMatchObject({
      email: 'awa@mine.bf',
      role: 'mine',
      mining_company_id: 'c1',
    });
    expect(mocks.inserts).not.toContainEqual(expect.objectContaining({ table: 'user_site_assignments' }));
  });

  it('restitue un échec de création', async () => {
    mocks.createUser.mockResolvedValue({ success: false, error: 'adresse déjà utilisée' });
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    remplirIdentite();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    fireEvent.click(screen.getByRole('button', { name: /Créer le compte/ }));

    await waitFor(() => expect(screen.getByText('adresse déjà utilisée')).toBeInTheDocument());
  });

  it('charge un compte existant en modification', async () => {
    mocks.params = new URLSearchParams('userId=u1');
    mocks.reponses.user_profiles = [
      { id: 'u1', full_name: 'Moussa OUEDRAOGO', email: 'moussa@sonasp.bf', phone: '+226 70', role: 'factory', mining_company_id: null, is_active: false },
    ];
    mocks.load.mockResolvedValue({ permissions: { m1: { ...EMPTY_PERMISSION('m1'), can_view: true } } });

    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Moussa OUEDRAOGO'));

    expect(screen.getByLabelText(/Adresse e-mail/)).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Usine/ })).toBeChecked();
    expect(screen.queryByText('Activation sécurisée')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();
  });
});
