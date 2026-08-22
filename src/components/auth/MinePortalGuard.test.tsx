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
  const { companyId } = useMinePortalAccess();
  return <div>Mine autorisée {companyId}</div>;
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

  it('n’autorise jamais un profil en erreur même si un utilisateur est présent', () => {
    mockedUseAuth.mockReturnValue(auth({ profileError: 'Profil non vérifié' }));
    render(<MemoryRouter><MinePortalGuard><Probe /></MinePortalGuard></MemoryRouter>);
    expect(screen.getByText('Profil non vérifié', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.queryByText(/Mine autorisée/)).not.toBeInTheDocument();
  });

  it('expose uniquement la société du profil autoritatif', () => {
    mockedUseAuth.mockReturnValue(auth());
    render(<MemoryRouter><MinePortalGuard><Probe /></MinePortalGuard></MemoryRouter>);
    expect(screen.getByText('Mine autorisée mine-1')).toBeInTheDocument();
  });
});
