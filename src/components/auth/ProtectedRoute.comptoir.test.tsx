import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'counter-user',
      email: 'counter@example.bf',
      role: 'customer',
      mining_company_id: null,
      is_active: true,
      capabilities: ['customer.operate', 'comptoir.manage'],
    },
    session: { access_token: 'session' },
    loading: false,
    initialized: true,
    profileLoading: false,
    profileError: null,
    refreshProfile: vi.fn(),
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={<ProtectedRoute><div>Écran demandé</div></ProtectedRoute>}
        />
        <Route path="/portail-comptoir" element={<div>Accueil comptoir</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute Comptoir', () => {
  it('conserve les opérations artisanales autorisées', () => {
    renderAt('/artisan-minier/ventes-or');
    expect(screen.getByText('Écran demandé')).toBeInTheDocument();
  });

  it('redirige toute tentative de vente internationale vers le portail Comptoir', () => {
    renderAt('/sales');
    expect(screen.queryByText('Écran demandé')).not.toBeInTheDocument();
    expect(screen.getByText('Accueil comptoir')).toBeInTheDocument();
  });
});
