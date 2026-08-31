import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UserManagementModern,
  DESCRIPTIONS_ROLE,
  EMPTY_USER_FORM,
  appliquerGabarit,
  indisponibiliteSocieteMiniere,
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
  loadCapabilities: vi.fn(),
  saveCapabilities: vi.fn(),
  createUser: vi.fn(),
  getUserDetails: vi.fn(),
  actor: { id: 'owner', role: 'owner' },
  pathname: '/users/new',
  addToast: vi.fn(),
  reponses: {} as Record<string, unknown[] | null>,
  inserts: [] as Array<{ table: string; lignes: unknown }>,
  deletes: [] as string[],
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.params, vi.fn()],
  useLocation: () => ({ pathname: mocks.pathname }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ addToast: mocks.addToast }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { ...mocks.actor, is_active: true, mining_company_id: null } }),
}));
vi.mock('@/services/userAdministrationDetailsService', () => ({
  getAdministrationUserDetails: mocks.getUserDetails,
}));
vi.mock('@/services/userManagementService', () => ({ createUser: mocks.createUser }));
vi.mock('@/services/userCapabilitiesService', () => ({
  userCapabilitiesService: {
    load: mocks.loadCapabilities,
    save: mocks.saveCapabilities,
  },
}));

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
  builder.not = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
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
  { id: 'm1', name: 'sales', display_name: 'Ventes', description: 'Gestion des ventes', category: 'Ventes', access_domain: 'sales' },
  { id: 'm2', name: 'audit', display_name: 'Audit', description: null, category: 'Système', access_domain: 'audit' },
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
    expect(validateIdentite(
      { ...formValide, role: 'mine', miningCompanyIds: ['c1'] },
      false,
      new Map([['c1', 'Cette société minière possède déjà un compte.']]),
    )).toBe('Cette société minière possède déjà un compte.');
    expect(validateIdentite(formValide, false)).toBeNull();
    expect(validateIdentite({ ...formValide, role: 'manager', miningCompanyIds: [] }, false)).toMatch(/rôle historique/);
    expect(validateIdentite(formValide, true)).toBeNull();
  });

  it('décrit chaque rôle sans référence à un module inexistant', () => {
    expect(DESCRIPTIONS_ROLE.owner).toContain('Accès complet à tous les modules');
    expect(Object.values(DESCRIPTIONS_ROLE).join(' ')).not.toMatch(/batch/i);
  });

  it('applique un gabarit d’habilitations', () => {
    const base = { m1: EMPTY_PERMISSION('m1'), m2: EMPTY_PERMISSION('m2') };
    expect(appliquerGabarit(base, 'complet').m1).toMatchObject({ can_view: true, can_approve: true });
    expect(appliquerGabarit(base, 'consultation').m1).toMatchObject({ can_view: true, can_create: false });
    expect(appliquerGabarit(base, 'aucun').m1).toMatchObject({ can_view: false });
  });

  it('considère une société occupée par un autre compte comme indisponible', () => {
    const compagnie = { id: 'c1', name: 'Essakane SA', abbreviation: 'ESK', is_active: true };
    const comptes = [{
      id: 'u1',
      full_name: 'Compte Essakane',
      email: 'mine@essakane.bf',
      is_active: false,
      mining_company_id: 'c1',
    }];

    expect(indisponibiliteSocieteMiniere(compagnie, comptes, null)?.compte?.id).toBe('u1');
    expect(indisponibiliteSocieteMiniere(compagnie, comptes, 'u1')).toBeNull();
  });
});

describe('UserManagementModern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = new URLSearchParams();
    mocks.pathname = '/users/new';
    mocks.actor = { id: 'owner', role: 'owner' };
    mocks.getUserDetails.mockReset();
    mocks.inserts = [];
    mocks.deletes = [];
    mocks.listModules.mockResolvedValue({ modules });
    mocks.load.mockResolvedValue({ permissions: {} });
    mocks.save.mockResolvedValue({ success: true });
    mocks.loadCapabilities.mockResolvedValue({ overrides: {}, error: null });
    mocks.saveCapabilities.mockResolvedValue({ success: true });
    mocks.createUser.mockResolvedValue({ success: true, user: { id: 'nouveau' } });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.reponses = {
      mining_companies: [{ id: 'c1', name: 'Essakane SA', abbreviation: 'ESK', is_active: true }],
      user_profiles: [],
      snp_organizations: [{ id: 'org-nafo', code: 'NAFO', name: 'Comptoir d’or NAFO', organization_type: 'comptoir', is_active: true }],
      snp_artisans_miniers: [],
      snp_user_responsibilities: [],
      snp_user_organization_memberships: [],
      snp_collector_accounts: [],
      user_site_assignments: [],
    };
    mocks.from.mockImplementation((table: string) => stub(table));
  });

  const remplirIdentite = () => {
    fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: 'Awa KABORE' } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'awa@sonasp.bf' } });
    fireEvent.click(screen.getByRole('radio', { name: /Administrateur/ }));
  };

  it('propose Propriétaire à Owner sans réintroduire les rôles historiques', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    expect(screen.getByRole('radio', { name: /Propriétaire/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Administrateur/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Direction/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Société minière/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Comptoir d’achat/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Manager/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Usine/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Aéroport/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Add New User')).not.toBeInTheDocument();
  });

  it('crée un autre Owner avec une matrice complète non réductible', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());
    remplirIdentite();
    fireEvent.click(screen.getByRole('radio', { name: /Propriétaire/ }));
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    for (const input of screen.getAllByRole('checkbox')) {
      expect(input).toBeChecked();
      expect(input).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Aucun droit' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Créer le compte/ })[0]);
    await waitFor(() => expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: 'owner', permissions: expect.objectContaining({ m1: expect.objectContaining({ can_delete: true, can_approve: true }) }),
    })));
  });

  it('ne propose ni Owner ni Administrateur à un Administrateur', async () => {
    mocks.actor = { id: 'admin', role: 'admin' };
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());
    expect(screen.queryByRole('radio', { name: /Propriétaire/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Administrateur/ })).not.toBeInTheDocument();
  });

  it('bloque le passage aux habilitations tant que l’identité est incomplète', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Habilitations/ })).toBeDisabled();
    expect(screen.getByText('Le nom complet est obligatoire.')).toBeInTheDocument();

    remplirIdentite();
    expect(screen.getByRole('button', { name: /Habilitations/ })).not.toBeDisabled();
  });

  it('présente uniquement les responsabilités compatibles avec le rôle', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: /Direction SONASP/ }));

    expect(screen.getByLabelText('SONASP Gestionnaire')).toBeInTheDocument();
    expect(screen.getByLabelText('SONASP Approbateur')).toBeInTheDocument();
    expect(screen.queryByLabelText('Gestion du comptoir')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Collecte terrain')).not.toBeInTheDocument();
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

    fireEvent.click(screen.getAllByRole('button', { name: /Créer le compte/ })[0]);

    await waitFor(() => expect(mocks.createUser).toHaveBeenCalled());
    expect(mocks.createUser.mock.calls[0][0]).toMatchObject({ email: 'awa@sonasp.bf', role: 'admin' });
    expect(mocks.createUser.mock.calls[0][0]).toMatchObject({ mining_company_id: null });
    expect(mocks.inserts).not.toContainEqual(expect.objectContaining({ table: 'user_site_assignments' }));
    expect(mocks.createUser.mock.calls[0][0].permissions.m1).toMatchObject({ can_view: true });
    expect(mocks.createUser.mock.calls[0][0].capabilities).toMatchObject({
      'sonasp.prepare': false,
      'sonasp.approve': false,
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/users');
  });

  it('impose la consultation aux autres droits autorisés par le plafond', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: 'Awa KABORE' } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'awa@sonasp.bf' } });
    fireEvent.click(screen.getByRole('radio', { name: /Direction SONASP/ }));
    fireEvent.click(screen.getByLabelText('SONASP Gestionnaire'));
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));

    fireEvent.click(screen.getByLabelText('Modifier — Ventes'));
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();

    fireEvent.click(screen.getByLabelText('Consulter — Ventes'));
    expect(screen.getByLabelText('Modifier — Ventes')).not.toBeChecked();
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
    fireEvent.click(screen.getAllByRole('button', { name: /Créer le compte/ })[0]);

    await waitFor(() => expect(mocks.createUser).toHaveBeenCalled());
    expect(mocks.createUser.mock.calls[0][0]).toMatchObject({
      email: 'awa@mine.bf',
      role: 'mine',
      mining_company_id: 'c1',
    });
    expect(mocks.inserts).not.toContainEqual(expect.objectContaining({ table: 'user_site_assignments' }));
  });

  it('crée un compte Comptoir avec son périmètre et son habilitation obligatoires', async () => {
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: 'Compte NAFO' } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'nafo@comptoir.bf' } });
    fireEvent.click(screen.getByRole('radio', { name: /Comptoir d’achat/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Comptoir d’or NAFO/ }));

    expect(screen.getByLabelText('Gestion du comptoir')).toBeChecked();
    expect(screen.getByLabelText('Gestion du comptoir')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Créer le compte/ })[0]);

    await waitFor(() => expect(mocks.createUser).toHaveBeenCalled());
    expect(mocks.createUser.mock.calls[0][0]).toMatchObject({
      email: 'nafo@comptoir.bf',
      role: 'comptoir',
      account_type: 'comptoir',
      organization_id: 'org-nafo',
      mining_company_id: null,
      responsibilities: expect.objectContaining({ 'comptoir.manage': true }),
    });
  });

  it('enregistre la finance Comptoir explicitement et refuse le cumul exécution/contrôle', async () => {
    render(<UserManagementModern />);
    await screen.findByLabelText(/Nom complet/);
    fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: 'Finance NAFO' } });
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'finance@example.invalid' } });
    fireEvent.click(screen.getByRole('radio', { name: /Comptoir d’achat/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Comptoir d’or NAFO/ }));
    expect(screen.getByLabelText('Paiements — exécution')).not.toBeChecked();
    expect(screen.getByLabelText('Paiements — contrôle')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Paiements — exécution'));
    fireEvent.click(screen.getByLabelText('Paiements — contrôle'));
    expect(screen.getByLabelText('Paiements — exécution')).toBeChecked();
    expect(screen.getByLabelText('Paiements — contrôle')).not.toBeChecked();
    expect(screen.getAllByText(/Séparation des fonctions/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Facturation du comptoir'));
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Créer le compte/ })[0]);
    await waitFor(() => expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: 'comptoir', organization_id: 'org-nafo',
      responsibilities: expect.objectContaining({
        'comptoir.invoices.issue': true, 'comptoir.payments.execute': true, 'comptoir.payments.reconcile': false,
      }),
    })));
  });

  it('affiche les mines déjà rattachées en grisé sans permettre leur sélection', async () => {
    mocks.reponses.mining_companies = [
      { id: 'c1', name: 'Essakane SA', abbreviation: 'ESK', is_active: true },
      { id: 'c2', name: 'SOPAMIB', abbreviation: 'SPM', is_active: true },
    ];
    mocks.reponses.user_profiles = [{
      id: 'u-essakane',
      full_name: 'Compte Essakane',
      email: 'portail@essakane.bf',
      role: 'mine',
      is_active: false,
      mining_company_id: 'c1',
    }];

    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: /Société minière/ }));

    expect(screen.getByRole('radio', { name: /Essakane SA/ })).toBeDisabled();
    expect(screen.getByText('Compte déjà créé')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /SOPAMIB/ })).toBeEnabled();
    expect(screen.getByText('1 disponible(s)')).toBeInTheDocument();
  });

  it('restitue un échec de création', async () => {
    mocks.createUser.mockResolvedValue({ success: false, error: 'adresse déjà utilisée' });
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toBeInTheDocument());

    remplirIdentite();
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Créer le compte/ })[0]);

    await waitFor(() => expect(screen.getByText('adresse déjà utilisée')).toBeInTheDocument());
  });

  it('charge un compte historique et exige sa migration explicite', async () => {
    mocks.params = new URLSearchParams('userId=u1');
    mocks.reponses.user_profiles = [
      { id: 'u1', full_name: 'Moussa OUEDRAOGO', email: 'moussa@sonasp.bf', phone: '+226 70', role: 'factory', mining_company_id: null, is_active: false },
    ];
    mocks.getUserDetails.mockResolvedValue({ profile: mocks.reponses.user_profiles[0] });
    mocks.load.mockResolvedValue({ permissions: { m1: { ...EMPTY_PERMISSION('m1'), can_view: true } } });

    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Moussa OUEDRAOGO'));

    expect(screen.getByLabelText(/Adresse e-mail/)).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Usine/ })).toBeChecked();
    expect(screen.queryByText('Activation sécurisée')).not.toBeInTheDocument();
    expect(screen.getByText(/Remplacez ce rôle historique/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Habilitations/ })).toBeDisabled();
  });

  const editProfile = (id = 'u1', role = 'admin', name = 'Compte administratif') => ({
    id, role, full_name: name, email: `${id}@example.test`, phone: '+226 70',
    mining_company_id: null, is_active: true,
  });

  it('permet à Owner de modifier un autre Owner avec tous les modules y compris désactivés', async () => {
    mocks.params = new URLSearchParams('userId=other-owner&step=permissions');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile('other-owner', 'owner', 'Autre Owner') });
    mocks.listModules.mockResolvedValue({ modules: [...modules, {
      id: 'inactive', name: 'national_reserve', display_name: 'Réserve désactivée',
      access_domain: 'inventory', is_active: false,
    }] });
    render(<UserManagementModern />);
    const checkbox = await screen.findByLabelText('Consulter — Réserve désactivée');
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(mocks.listModules).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer les modifications' })[0]);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('snp_configurer_acces_compte', expect.objectContaining({
      p_user_id: 'other-owner', p_role: 'owner',
    })));
  });

  it('permet à Owner d’accorder puis retirer les droits métier d’un Administrateur', async () => {
    mocks.params = new URLSearchParams('userId=u1&step=permissions');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile() });
    mocks.load.mockResolvedValue({ permissions: { m1: { ...EMPTY_PERMISSION('m1'), can_view: true } } });
    render(<UserManagementModern />);
    for (const action of ['Consulter', 'Créer', 'Modifier', 'Supprimer', 'Approuver']) {
      expect(await screen.findByLabelText(`${action} — Ventes`)).toBeEnabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Tous les droits sur les modules' }));
    expect(screen.getByLabelText('Approuver — Ventes')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Supprimer — Ventes'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer les modifications' })[0]);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('snp_configurer_acces_compte', expect.objectContaining({
      p_user_id: 'u1', p_role: 'admin',
      p_permissions: expect.arrayContaining([expect.objectContaining({
        module_id: 'm1', can_view: true, can_create: true, can_edit: true, can_delete: false, can_approve: true,
      })]),
    })));
  });

  it('charge et enregistre le compte via les services autorisés même si la lecture directe est vide pour Owner', async () => {
    mocks.params = new URLSearchParams('userId=u1');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile() });
    mocks.load.mockResolvedValue({ permissions: { m1: { ...EMPTY_PERMISSION('m1'), can_view: true } } });
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Compte administratif'));
    expect(mocks.getUserDetails).toHaveBeenCalledWith('u1', expect.any(AbortSignal));
    expect(screen.queryByText(/niveau supérieur/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Nom complet/), { target: { value: 'Nom corrigé' } });
    fireEvent.click(screen.getByRole('button', { name: /Habilitations/ }));
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer les modifications' })[0]);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('snp_configurer_acces_compte', expect.objectContaining({
      p_user_id: 'u1', p_full_name: 'Nom corrigé', p_role: 'admin',
      p_permissions: expect.arrayContaining([expect.objectContaining({ module_id: 'm1', can_view: true })]),
    })));
    expect(mocks.navigate).toHaveBeenCalledWith('/users');
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('propose de réessayer sans formulaire vide ni faux refus hiérarchique si le compte ne charge pas', async () => {
    mocks.params = new URLSearchParams('userId=u1');
    mocks.getUserDetails.mockRejectedValueOnce(new Error('Ce compte est introuvable ou a été supprimé.'))
      .mockResolvedValueOnce({ profile: editProfile() });
    render(<UserManagementModern />);
    await screen.findByText('Ce compte est introuvable ou a été supprimé.');
    expect(screen.queryByLabelText(/Nom complet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/niveau supérieur/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enregistrer|Habilitations/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Compte administratif'));
  });

  it.each(['permissions', 'modules', 'rattachement', 'responsabilités'])('interdit de remplacer les droits si le chargement %s échoue', async (source) => {
    mocks.params = new URLSearchParams('userId=u1&step=permissions');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile() });
    if (source === 'permissions') mocks.load.mockResolvedValue({ permissions: {}, error: 'Habilitations indisponibles' });
    if (source === 'modules') mocks.listModules.mockResolvedValue({ modules: [], error: 'Modules indisponibles' });
    if (source === 'rattachement') mocks.reponses.snp_user_organization_memberships = null;
    if (source === 'responsabilités') {
      mocks.reponses.snp_user_responsibilities = null;
      mocks.loadCapabilities.mockResolvedValue({ overrides: {}, error: 'Responsabilités indisponibles' });
    }
    render(<UserManagementModern />);
    await screen.findByRole('button', { name: 'Réessayer' });
    expect(screen.queryByRole('button', { name: 'Enregistrer les modifications' })).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuse une fiche ne correspondant pas à la cible', async () => {
    mocks.params = new URLSearchParams('userId=u1');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile('u2') });
    render(<UserManagementModern />);
    await screen.findByText('La fiche reçue ne correspond pas au compte demandé.');
    expect(screen.queryByLabelText(/Nom complet/)).not.toBeInTheDocument();
  });

  it('ouvre le lien direct vers les habilitations sans perdre les permissions existantes', async () => {
    mocks.params = new URLSearchParams('userId=u1&step=permissions');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile() });
    mocks.load.mockResolvedValue({ permissions: { m1: { ...EMPTY_PERMISSION('m1'), can_view: true, can_edit: true } } });
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText('Modifier — Ventes')).toBeChecked());
    expect(screen.getByRole('tab', { name: /Habilitations/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Consulter — Ventes')).toBeChecked();
  });

  it('conserve la saisie et ne signale aucun succès lorsque le serveur refuse l’enregistrement', async () => {
    mocks.params = new URLSearchParams('userId=u1&step=permissions');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile() });
    mocks.rpc.mockResolvedValue({ error: { message: 'Session administrative expirée.' } });
    render(<UserManagementModern />);
    const save = (await screen.findAllByRole('button', { name: 'Enregistrer les modifications' }))[0];
    fireEvent.click(save);
    await screen.findByText('Session administrative expirée.');
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.addToast).not.toHaveBeenCalledWith('Compte mis à jour', 'success');
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à l’identité' }));
    expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Compte administratif');
  });

  it('réinitialise le formulaire lors du passage de la modification à la création', async () => {
    mocks.params = new URLSearchParams('userId=u1&step=permissions');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile() });
    const { rerender } = render(<UserManagementModern />);
    await screen.findAllByRole('button', { name: 'Enregistrer les modifications' });
    mocks.params = new URLSearchParams();
    rerender(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue(''));
    expect(screen.getByRole('tab', { name: /Identité et rôle/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('ignore la réponse tardive du compte précédent', async () => {
    let resolveFirst!: (value: unknown) => void;
    mocks.params = new URLSearchParams('userId=u1');
    mocks.getUserDetails.mockImplementation((id: string) => id === 'u1'
      ? new Promise((resolve) => { resolveFirst = resolve; })
      : Promise.resolve({ profile: editProfile('u2', 'admin', 'Deuxième compte') }));
    const { rerender } = render(<UserManagementModern />);
    await waitFor(() => expect(mocks.getUserDetails).toHaveBeenCalled());
    mocks.params = new URLSearchParams('userId=u2');
    rerender(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Deuxième compte'));
    await act(async () => resolveFirst({ profile: editProfile() }));
    expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Deuxième compte');
  });

  it.each([
    ['admin', 'owner', 'other-owner'],
    ['owner', 'owner', 'owner'],
    ['admin', 'admin', 'other-admin'],
    ['owner', 'admin', 'owner'],
  ])('préserve les restrictions %s → %s (%s)', async (actorRole, targetRole, id) => {
    mocks.actor = { id: 'owner', role: actorRole };
    mocks.params = new URLSearchParams(`userId=${id}`);
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile(id, targetRole) });
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Compte administratif'));
    expect(screen.getByRole('button', { name: /Habilitations/ })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /Habilitations/ })).toBeDisabled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('ne transforme pas une URL de modification sans identifiant en création', async () => {
    mocks.pathname = '/users/edit';
    render(<UserManagementModern />);
    await screen.findByText('La référence du compte à modifier est absente.');
    expect(screen.queryByLabelText(/Nom complet/)).not.toBeInTheDocument();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('précharge le périmètre et le profil collecteur existants', async () => {
    mocks.params = new URLSearchParams('userId=u1');
    mocks.getUserDetails.mockResolvedValue({ profile: editProfile('u1', 'collector') });
    mocks.reponses.snp_user_organization_memberships = [{ organization_id: 'org-nafo', snp_organizations: { organization_type: 'comptoir' } }];
    mocks.reponses.snp_collector_accounts = [{ collector_id: 'collector-1' }];
    mocks.reponses.snp_artisans_miniers = [{ id: 'collector-1', nom: 'KABORE', prenoms: 'Awa' }];
    render(<UserManagementModern />);
    await waitFor(() => expect(screen.getByLabelText(/Profil collecteur/)).toHaveValue('collector-1'));
    expect(screen.getByRole('radio', { name: /Comptoir d’or NAFO/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /Habilitations/ })).toBeEnabled();
  });
});
