import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { CAPABILITIES, type CapabilityCode } from '@/lib/capabilities';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);
const relationReadCapabilities: CapabilityCode[] = [
  CAPABILITIES.MINE_OPERATE,
  CAPABILITIES.SONASP_WORKFLOW_READ,
  CAPABILITIES.SONASP_PREPARE,
];
const contractWriteCapabilities: CapabilityCode[] = [
  CAPABILITIES.MINE_OPERATE,
  CAPABILITIES.SONASP_PREPARE,
];
const requisitionWriteCapabilities: CapabilityCode[] = [CAPABILITIES.SONASP_PREPARE];
const paymentWriteCapabilities: CapabilityCode[] = [CAPABILITIES.FINANCE_EXECUTE];

const baseUser = {
  id: 'user-1', email: 'user@sonasp.bf', full_name: 'Utilisateur', phone: null,
  role: 'customer' as const, mining_company_id: null, site_ids: [], is_active: true,
  is_sales_approver: false, two_factor_enabled: true, language: 'fr', email_notifications: true,
  batch_notifications: true, approval_notifications: true, created_at: '2026-01-01', updated_at: '2026-01-01',
};

function auth(user: typeof baseUser | { [key: string]: unknown }) {
  return {
    user, session: { access_token: 'token' }, loading: false, initialized: true,
    profileLoading: false, profileError: null, refreshProfile: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    resetPassword: vi.fn(), updatePassword: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>;
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute><div>Interne SONASP</div></ProtectedRoute>} />
        <Route path="/production/daily" element={<ProtectedRoute allowedRoles={['mine']}><div>Production mine</div></ProtectedRoute>} />
        <Route path="/stakeholders/depositors/new" element={<ProtectedRoute allowedRoles={['management', 'admin', 'mine']}><div>Nouveau dépositaire</div></ProtectedRoute>} />
        <Route path="/contrats/nouveau" element={<ProtectedRoute allowedRoles={['management', 'mine']} requiredAnyCapabilities={contractWriteCapabilities}><div>Proposition de contrat</div></ProtectedRoute>} />
        <Route path="/contrats/:id/modifier" element={<ProtectedRoute allowedRoles={['management', 'mine']} requiredAnyCapabilities={contractWriteCapabilities}><div>Modification de contrat</div></ProtectedRoute>} />
        <Route path="/requisitions/:id" element={<ProtectedRoute allowedRoles={['management', 'mine']} requiredAnyCapabilities={relationReadCapabilities}><div>Réquisition reçue</div></ProtectedRoute>} />
        <Route path="/requisitions/:id/modifier" element={<ProtectedRoute allowedRoles={['management', 'mine']} requiredAnyCapabilities={requisitionWriteCapabilities}><div>Modification de réquisition</div></ProtectedRoute>} />
        <Route path="/requisitions/nouvelle" element={<ProtectedRoute allowedRoles={['management', 'mine']} requiredAnyCapabilities={requisitionWriteCapabilities}><div>Émission de réquisition</div></ProtectedRoute>} />
        <Route path="/achats/reglements/nouveau" element={<ProtectedRoute allowedRoles={['management', 'mine']} requiredAnyCapabilities={paymentWriteCapabilities}><div>Création de règlement</div></ProtectedRoute>} />
        <Route path="/production/achats-mines" element={<ProtectedRoute><div>Achats SONASP</div></ProtectedRoute>} />
        <Route path="/portail-mine" element={<div>Portail société</div>} />
        <Route path="/portail-direction" element={<div>Portail Direction</div>} />
        <Route
          path="/portail-dgmg"
          element={<ProtectedRoute requiredAnyCapabilities={[CAPABILITIES.DGMG_SUPERVISE]}><div>Portail DGMG</div></ProtectedRoute>}
        />
        <Route
          path="/portail-dgmg/reserve-validations"
          element={(
            <ProtectedRoute requiredSensitiveCapability={CAPABILITIES.RESERVE_ALLOCATIONS_VALIDATE_LEVEL_1}>
              <div>File Réserve DGMG</div>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/portail-dgi"
          element={<ProtectedRoute requiredAnyCapabilities={[CAPABILITIES.DGI_FISCAL_CONTROL]}><div>Portail DGI</div></ProtectedRoute>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute — frontières de portail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renvoie un compte de société vers son seul portail', () => {
    mockedUseAuth.mockReturnValue(auth({ ...baseUser, mining_company_id: 'mine-1' }));
    renderRoute('/dashboard');
    expect(screen.getByText('Portail société')).toBeInTheDocument();
    expect(screen.queryByText('Interne SONASP')).not.toBeInTheDocument();
  });

  it('ouvre les modules industriels autorisés à un ancien compte société customer', () => {
    mockedUseAuth.mockReturnValue(auth({ ...baseUser, mining_company_id: 'mine-1' }));
    renderRoute('/production/daily');
    expect(screen.getByText('Production mine')).toBeInTheDocument();
  });

  it('autorise un compte société à créer un dépositaire dans son périmètre', () => {
    mockedUseAuth.mockReturnValue(auth({ ...baseUser, mining_company_id: 'mine-1' }));
    renderRoute('/stakeholders/depositors/new');
    expect(screen.getByText('Nouveau dépositaire')).toBeInTheDocument();
  });

  it('autorise une société à proposer un contrat et consulter une réquisition reçue', () => {
    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      mining_company_id: 'mine-1',
      capabilities: ['mine.operate'],
    }));
    const proposition = renderRoute('/contrats/nouveau');
    expect(screen.getByText('Proposition de contrat')).toBeInTheDocument();
    proposition.unmount();

    renderRoute('/requisitions/req-1');
    expect(screen.getByText('Réquisition reçue')).toBeInTheDocument();
  });

  it('refuse toutes les routes privées au tenant dont mine.operate a été retirée', () => {
    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      mining_company_id: 'mine-1',
      capabilities: [],
    }));
    renderRoute('/requisitions/req-1');
    expect(screen.getByText('Habilitation Société minière requise')).toBeInTheDocument();
    expect(screen.queryByText('Réquisition reçue')).not.toBeInTheDocument();
  });

  it('ne transforme pas un client sans tenant en opérateur de mine', () => {
    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      capabilities: ['customer.operate'],
    }));
    renderRoute('/requisitions/req-1');
    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByText('Réquisition reçue')).not.toBeInTheDocument();
  });

  it('empêche la modification directe des contrats et réquisitions SONASP', () => {
    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      mining_company_id: 'mine-1',
      capabilities: ['mine.operate'],
    }));
    const contrat = renderRoute('/contrats/contrat-1/modifier');
    expect(screen.getByText('Portail société')).toBeInTheDocument();
    expect(screen.queryByText('Modification de contrat')).not.toBeInTheDocument();
    contrat.unmount();

    renderRoute('/requisitions/req-1/modifier');
    expect(screen.getByText('Portail société')).toBeInTheDocument();
    expect(screen.queryByText('Modification de réquisition')).not.toBeInTheDocument();
  });

  it('empêche une société d’émettre une réquisition ou son propre règlement', () => {
    mockedUseAuth.mockReturnValue(auth({ ...baseUser, mining_company_id: 'mine-1' }));
    const requisition = renderRoute('/requisitions/nouvelle');
    expect(screen.getByText('Portail société')).toBeInTheDocument();
    expect(screen.queryByText('Émission de réquisition')).not.toBeInTheDocument();
    requisition.unmount();

    renderRoute('/achats/reglements/nouveau');
    expect(screen.getByText('Portail société')).toBeInTheDocument();
    expect(screen.queryByText('Création de règlement')).not.toBeInTheDocument();
  });

  it('sépare la préparation métier de l’exécution financière côté SONASP', () => {
    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      role: 'management',
      capabilities: ['sonasp.prepare'],
    }));
    const preparation = renderRoute('/requisitions/nouvelle');
    expect(screen.getByText('Émission de réquisition')).toBeInTheDocument();
    preparation.unmount();

    const paiementRefuse = renderRoute('/achats/reglements/nouveau');
    expect(screen.getByText('Habilitations insuffisantes')).toBeInTheDocument();
    expect(screen.queryByText('Création de règlement')).not.toBeInTheDocument();
    paiementRefuse.unmount();

    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      role: 'management',
      capabilities: ['sonasp.finance.execute'],
    }));
    renderRoute('/achats/reglements/nouveau');
    expect(screen.getByText('Création de règlement')).toBeInTheDocument();
  });

  it('refuse explicitement le module Achats aux mines au compte société', () => {
    mockedUseAuth.mockReturnValue(auth({ ...baseUser, mining_company_id: 'mine-1' }));
    renderRoute('/production/achats-mines');
    expect(screen.getByText('Portail société')).toBeInTheDocument();
    expect(screen.queryByText('Achats SONASP')).not.toBeInTheDocument();
  });

  it('renvoie un Manager vers la vue consultative', () => {
    mockedUseAuth.mockReturnValue(auth({ ...baseUser, role: 'manager' }));
    renderRoute('/dashboard');
    expect(screen.getByText('Portail Direction')).toBeInTheDocument();
    expect(screen.queryByText('Interne SONASP')).not.toBeInTheDocument();
  });

  it.each([
    ['dgi', 'dgi-organization', CAPABILITIES.DGI_FISCAL_CONTROL, '/portail-dgi', 'Portail DGI'],
    ['dgmg', 'dgmg-organization', CAPABILITIES.DGMG_SUPERVISE, '/portail-dgmg', 'Portail DGMG'],
  ] as const)(
    'ouvre le portail %s seulement avec son organisation et sa responsabilité autoritatives',
    (role, organizationId, capability, path, expectedTitle) => {
      mockedUseAuth.mockReturnValue(auth({
        ...baseUser,
        role,
        organization_id: organizationId,
        organization_type: role,
        capabilities: [capability],
      }));

      renderRoute(path);

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
    },
  );

  it('renvoie un compte DGI hors du portail DGMG vers son accueil fiscal', () => {
    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      role: 'dgi',
      organization_id: 'dgi-organization',
      organization_type: 'dgi',
      capabilities: [CAPABILITIES.DGI_FISCAL_CONTROL],
    }));

    renderRoute('/portail-dgmg');

    expect(screen.getByText('Portail DGI')).toBeInTheDocument();
    expect(screen.queryByText('Portail DGMG')).not.toBeInTheDocument();
  });

  it('garde la file Réserve DGMG par module et capability sensibles', () => {
    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      role: 'dgmg',
      organization_id: 'dgmg-organization',
      organization_type: 'dgmg',
      capabilities: [CAPABILITIES.DGMG_SUPERVISE, CAPABILITIES.RESERVE_ALLOCATIONS_VALIDATE_LEVEL_1],
      module_codes: ['dashboard', 'national_reserve'],
    }));
    const allowed = renderRoute('/portail-dgmg/reserve-validations');
    expect(screen.getByText('File Réserve DGMG')).toBeInTheDocument();
    allowed.unmount();

    mockedUseAuth.mockReturnValue(auth({
      ...baseUser,
      role: 'dgmg',
      organization_id: 'dgmg-organization',
      organization_type: 'dgmg',
      capabilities: [CAPABILITIES.DGMG_SUPERVISE],
      module_codes: ['dashboard', 'national_reserve'],
    }));
    renderRoute('/portail-dgmg/reserve-validations');
    expect(screen.getByText('Portail DGMG')).toBeInTheDocument();
    expect(screen.queryByText('File Réserve DGMG')).not.toBeInTheDocument();
  });
});
