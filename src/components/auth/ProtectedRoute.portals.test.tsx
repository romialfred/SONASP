import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

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
        <Route path="/contrats/nouveau" element={<ProtectedRoute><div>Proposition de contrat</div></ProtectedRoute>} />
        <Route path="/requisitions/:id" element={<ProtectedRoute><div>Réquisition reçue</div></ProtectedRoute>} />
        <Route path="/requisitions/nouvelle" element={<ProtectedRoute><div>Émission de réquisition</div></ProtectedRoute>} />
        <Route path="/achats/reglements/nouveau" element={<ProtectedRoute><div>Création de règlement</div></ProtectedRoute>} />
        <Route path="/production/achats-mines" element={<ProtectedRoute><div>Achats SONASP</div></ProtectedRoute>} />
        <Route path="/portail-mine" element={<div>Portail société</div>} />
        <Route path="/portail-direction" element={<div>Portail Direction</div>} />
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
    mockedUseAuth.mockReturnValue(auth({ ...baseUser, mining_company_id: 'mine-1' }));
    const proposition = renderRoute('/contrats/nouveau');
    expect(screen.getByText('Proposition de contrat')).toBeInTheDocument();
    proposition.unmount();

    renderRoute('/requisitions/req-1');
    expect(screen.getByText('Réquisition reçue')).toBeInTheDocument();
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
});
