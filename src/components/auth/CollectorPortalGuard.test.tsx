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
  is_active: true, mining_company_id: null, capabilities: ['collector.operate'],
};

describe('CollectorPortalGuard', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: collector, session: { access_token: 'token' } as never, loading: false,
      initialized: true, profileLoading: false,
    } as ReturnType<typeof useAuth>);
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
    mockedUseAuth.mockReturnValue({
      user: { ...collector, capabilities: ['comptoir.manage'] },
      session: { access_token: 'token' } as never, loading: false, initialized: true, profileLoading: false,
    } as ReturnType<typeof useAuth>);
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
