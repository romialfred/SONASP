import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { PublicRoute, safeReturnPath } from './PublicRoute';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

const user = {
  id: 'u1', email: 'mine@example.bf', full_name: 'Mine', phone: null, role: 'customer' as const,
  mining_company_id: 'mine-1', site_ids: [], is_active: true, is_sales_approver: false,
  two_factor_enabled: true, language: 'fr', email_notifications: true, batch_notifications: true,
  approval_notifications: true, created_at: '2026-01-01', updated_at: '2026-01-01',
};

describe('PublicRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user, session: { access_token: 'token' } as never, loading: false, initialized: true,
      profileLoading: false, profileError: null, refreshProfile: vi.fn(), signIn: vi.fn(),
      signOut: vi.fn(), resetPassword: vi.fn(), updatePassword: vi.fn(),
    });
  });

  it('ignore un ancien retour vers le tableau national pour une mine', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/dashboard' } } }]}>
        <Routes>
          <Route path="/login" element={<PublicRoute><div>Formulaire</div></PublicRoute>} />
          <Route path="/portail-mine" element={<div>Portail Mine</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Portail Mine')).toBeInTheDocument();
  });

  it('renvoie un Collecteur vers son portail et refuse un ancien retour Comptoir', () => {
    mockedUseAuth.mockReturnValue({
      user: { ...user, mining_company_id: null, capabilities: ['collector.operate', 'comptoir.manage'] },
      session: { access_token: 'token' } as never, loading: false, initialized: true,
      profileLoading: false, profileError: null, refreshProfile: vi.fn(), signIn: vi.fn(),
      signOut: vi.fn(), resetPassword: vi.fn(), updatePassword: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/portail-comptoir/ventes-sonasp' } } }]}>
        <Routes>
          <Route path="/login" element={<PublicRoute><div>Formulaire</div></PublicRoute>} />
          <Route path="/portail-collecteur" element={<div>Portail Collecteur</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Portail Collecteur')).toBeInTheDocument();
  });

  it('rejette les destinations externes et les boucles de connexion', () => {
    expect(safeReturnPath('//example.com')).toBeNull();
    expect(safeReturnPath('https://example.com')).toBeNull();
    expect(safeReturnPath('/login')).toBeNull();
    expect(safeReturnPath('/reports')).toBe('/reports');
  });
});
