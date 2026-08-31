import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import { CollectorPortalGuard } from './CollectorPortalGuard';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/useCollectorWorkspace', () => ({ useCollectorWorkspace: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);
const mockedWorkspace = vi.mocked(useCollectorWorkspace);

const collector = {
  id: 'collector-user', email: 'collector@example.bf', role: 'customer' as const,
  full_name: 'Collecteur Test', phone: null, is_active: true, mining_company_id: null,
  site_ids: [], capabilities: ['collector.operate'], is_sales_approver: false,
  two_factor_enabled: true, language: 'fr', email_notifications: true,
  batch_notifications: true, approval_notifications: true,
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
};

const authValue = (capabilities = collector.capabilities): ReturnType<typeof useAuth> => ({
  user: { ...collector, capabilities },
  session: { access_token: 'token' } as never,
  loading: false,
  initialized: true,
  profileLoading: false,
  profileError: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
  refreshProfile: vi.fn(),
});

describe('CollectorPortalGuard', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue(authValue());
    mockedWorkspace.mockReturnValue({
      isCollector: true, loading: false,
      workspace: {
        collectorId: 'collector-1', collectorName: 'Collecteur Test', collectorCardNumber: null,
        organizationId: 'org-1', organizationName: 'Comptoir Test', organizationCode: 'CPT-1',
        assignedArtisanIds: ['artisan-1'],
      },
    });
  });

  it('ouvre le portail avec un rattachement complet', () => {
    render(<MemoryRouter><CollectorPortalGuard><div>Espace autorisé</div></CollectorPortalGuard></MemoryRouter>);
    expect(screen.getByText('Espace autorisé')).toBeInTheDocument();
  });

  it('refuse explicitement une capacité sans rattachement serveur', () => {
    mockedWorkspace.mockReturnValue({ isCollector: true, loading: false, workspace: null });
    render(<MemoryRouter><CollectorPortalGuard><div>Espace autorisé</div></CollectorPortalGuard></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Collecteur non rattaché' })).toBeInTheDocument();
  });

  it('redirige un autre partenaire vers le tableau national', () => {
    mockedUseAuth.mockReturnValue(authValue(['comptoir.manage']));
    render(
      <MemoryRouter initialEntries={['/portail-collecteur']}>
        <Routes>
          <Route path="/dashboard" element={<div>Tableau national</div>} />
          <Route path="/portail-collecteur" element={<CollectorPortalGuard><div>Espace autorisé</div></CollectorPortalGuard>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Tableau national')).toBeInTheDocument();
  });
});
