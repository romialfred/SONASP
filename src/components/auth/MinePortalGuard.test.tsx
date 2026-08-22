import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { MinePortalGuard, useMinePortalAccess } from './MinePortalGuard';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

const mineUser = {
  id: 'user-1', email: 'mine@example.bf', full_name: 'Mine User', phone: null,
  role: 'customer' as const, mining_company_id: 'mine-1', site_ids: [], is_active: true,
  is_sales_approver: false, two_factor_enabled: true, language: 'fr', email_notifications: true,
  batch_notifications: true, approval_notifications: true, created_at: '2026-01-01', updated_at: '2026-01-01',
};

function auth(overrides: Record<string, unknown> = {}) {
  return {
    user: mineUser, session: { access_token: 'token' }, loading: false, initialized: true,
    profileLoading: false, profileError: null, refreshProfile: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    resetPassword: vi.fn(), updatePassword: vi.fn(), ...overrides,
  } as unknown as ReturnType<typeof useAuth>;
}

function Probe() {
  const { companyId, canChooseCompany } = useMinePortalAccess();
  return <div>{canChooseCompany ? 'Toutes les mines autorisées' : `Mine autorisée ${companyId}`}</div>;
}

describe('MinePortalGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirige une session absente vers la connexion', () => {
    mockedUseAuth.mockReturnValue(auth({ user: null, session: null }));
    render(
      <MemoryRouter initialEntries={['/portail-mine']}>
        <Routes>
          <Route path="/login" element={<div>Connexion</div>} />
          <Route path="/portail-mine" element={<MinePortalGuard><Probe /></MinePortalGuard>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Connexion')).toBeInTheDocument();
  });

  it('n’autorise pas un profil sans société minière', () => {
    mockedUseAuth.mockReturnValue(auth({ user: { ...mineUser, mining_company_id: null } }));
    render(<MemoryRouter><MinePortalGuard><Probe /></MinePortalGuard></MemoryRouter>);
    expect(screen.getByText('Portail Mine non attribué')).toBeInTheDocument();
    expect(screen.queryByText(/Mine autorisée/)).not.toBeInTheDocument();
  });

  it('autorise l’Owner actif à choisir n’importe quelle société sans rattachement', () => {
    mockedUseAuth.mockReturnValue(auth({
      user: { ...mineUser, role: 'owner', mining_company_id: null },
    }));
    render(<MemoryRouter initialEntries={['/portail-mine?mine=mine-2']}><MinePortalGuard><Probe /></MinePortalGuard></MemoryRouter>);
    expect(screen.getByText('Toutes les mines autorisées')).toBeInTheDocument();
    expect(screen.queryByText('Portail Mine non attribué')).not.toBeInTheDocument();
  });

  it('n’autorise jamais un profil en erreur même si un utilisateur est présent', () => {
    mockedUseAuth.mockReturnValue(auth({ profileError: 'Profil non vérifié' }));
    render(<MemoryRouter><MinePortalGuard><Probe /></MinePortalGuard></MemoryRouter>);
    expect(screen.getByText('Profil non vérifié', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.queryByText(/Mine autorisée/)).not.toBeInTheDocument();
  });

  it('expose uniquement la société du profil autoritatif', () => {
    mockedUseAuth.mockReturnValue(auth());
    render(<MemoryRouter initialEntries={['/portail-mine?mine=mine-2']}><MinePortalGuard><Probe /></MinePortalGuard></MemoryRouter>);
    expect(screen.getByText('Mine autorisée mine-1')).toBeInTheDocument();
  });

  it('renvoie l’Owner vers le tableau de bord lorsqu’aucune mine n’est choisie', () => {
    mockedUseAuth.mockReturnValue(auth({
      user: { ...mineUser, role: 'owner', mining_company_id: null },
    }));
    render(
      <MemoryRouter initialEntries={['/portail-mine']}>
        <Routes>
          <Route path="/dashboard" element={<div>Tableau de bord SONASP</div>} />
          <Route path="/portail-mine" element={<MinePortalGuard><Probe /></MinePortalGuard>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Tableau de bord SONASP')).toBeInTheDocument();
  });
});
