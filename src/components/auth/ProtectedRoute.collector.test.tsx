import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'collector-user', email: 'collector@example.bf', role: 'customer',
      mining_company_id: null, is_active: true,
      capabilities: ['collector.operate', 'comptoir.manage'],
    },
    session: { access_token: 'session' }, loading: false, initialized: true,
    profileLoading: false, profileError: null, refreshProfile: vi.fn(),
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/portail-collecteur" element={<div>Accueil collecteur</div>} />
        <Route path="*" element={<ProtectedRoute><div>Écran demandé</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute Collecteur', () => {
  afterEach(cleanup);

  it.each([
    '/artisan-minier/liste',
    '/artisan-minier/ventes-or/123e4567-e89b-12d3-a456-426614174000',
    '/artisan-minier/paiements/historique',
  ])('conserve la consultation autorisée %s', (route) => {
    renderAt(route);
    expect(screen.getByText('Écran demandé')).toBeInTheDocument();
  });

  it.each([
    '/sales', '/portail-comptoir/ventes-sonasp', '/artisan-minier/ventes-or/nouvelle',
    '/artisan-minier/ventes-or/123e4567-e89b-12d3-a456-426614174000/modifier',
    '/artisan-minier/paiements/123e4567-e89b-12d3-a456-426614174000/nouveau',
  ])('redirige l’opération interdite %s', (route) => {
    renderAt(route);
    expect(screen.getByText('Accueil collecteur')).toBeInTheDocument();
    expect(screen.queryByText('Écran demandé')).not.toBeInTheDocument();
  });
});
