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
