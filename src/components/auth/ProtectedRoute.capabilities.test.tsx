import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES } from '@/lib/capabilities';
import { SONASP_COMPTOIR_INBOX_CAPABILITIES } from '@/lib/sonaspComptoirAccess';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

function authWith(user: any) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    session: {} as any,
    loading: false,
    initialized: true,
    profileLoading: false,
    profileError: null,
    refreshProfile: vi.fn(),
  } as any);
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/sonasp/cessions-comptoirs']}>
      <Routes>
        <Route path="/sonasp/cessions-comptoirs" element={
          <ProtectedRoute requiredAnyCapabilities={SONASP_COMPTOIR_INBOX_CAPABILITIES}>
            <div>Boîte SONASP autorisée</div>
          </ProtectedRoute>
        } />
        <Route path="/portail-comptoir" element={<div>Portail Comptoir</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderLicenseRequestsRoute() {
  return render(
    <MemoryRouter initialEntries={['/production/licenses/requests']}>
      <Routes>
        <Route path="/production/licenses/requests" element={
          <ProtectedRoute
            allowedRoles={['management']}
            requiredSensitiveCapability={CAPABILITIES.SONASP_APPROVE}
          >
            <div>Demandes de licences autorisées</div>
          </ProtectedRoute>
        } />
        <Route path="/portail-mine" element={<div>Portail Mine</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute — capacités de la boîte Comptoir → SONASP', () => {
  beforeEach(() => vi.mocked(useAuth).mockReset());

  it('autorise une capacité de consultation opérationnelle', () => {
    authWith({ id: 'u1', role: 'management', is_active: true, capabilities: [CAPABILITIES.SONASP_PREPARE] });
    renderRoute();
    expect(screen.getByText('Boîte SONASP autorisée')).toBeInTheDocument();
  });

  it('refuse un compte sans aucune capacité de la boîte', () => {
    authWith({ id: 'u2', role: 'admin', is_active: true, capabilities: [CAPABILITIES.REPORTS_READ] });
    renderRoute();
    expect(screen.getByText('Habilitations insuffisantes')).toBeInTheDocument();
  });

  it('maintient le cloisonnement Comptoir même si une capacité SONASP est injectée', () => {
    authWith({
      id: 'u3', role: 'customer', is_active: true,
      capabilities: [CAPABILITIES.COMPTOIR_MANAGE, CAPABILITIES.SONASP_APPROVE],
    });
    renderRoute();
    expect(screen.getByText('Portail Comptoir')).toBeInTheDocument();
  });
});

describe('ProtectedRoute — décision sensible des licences Mine', () => {
  beforeEach(() => vi.mocked(useAuth).mockReset());

  it('autorise la capability explicite issue du contrat AAL2', () => {
    authWith({
      id: 'approver', role: 'management', is_active: true,
      capabilities: [CAPABILITIES.SONASP_APPROVE],
    });
    renderLicenseRequestsRoute();
    expect(screen.getByText('Demandes de licences autorisées')).toBeInTheDocument();
  });

  it('refuse le repli historique de rôle quand la liste autoritative est absente', () => {
    authWith({ id: 'legacy-management', role: 'management', is_active: true, capabilities: undefined });
    renderLicenseRequestsRoute();
    expect(screen.getByText('Habilitations insuffisantes')).toBeInTheDocument();
  });

  it('cloisonne une Mine même si son profil contient une capability SONASP injectée', () => {
    authWith({
      id: 'mine', role: 'mine', is_active: true, mining_company_id: 'mine-1',
      capabilities: [CAPABILITIES.MINE_OPERATE, CAPABILITIES.SONASP_APPROVE],
    });
    renderLicenseRequestsRoute();
    expect(screen.getByText('Portail Mine')).toBeInTheDocument();
  });
});
