import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-id',
      email: 'admin@sonasp.bf',
      role: 'admin',
      mining_company_id: null,
      is_active: true,
    },
    session: { access_token: 'session' },
    loading: false,
    initialized: true,
    profileLoading: false,
    profileError: null,
    refreshProfile: vi.fn(),
  }),
}));

describe('ProtectedRoute Administrateur', () => {
  it('n’ouvre plus un module métier limité à la Direction', () => {
    render(
      <MemoryRouter initialEntries={['/artisan-sites']}>
        <ProtectedRoute allowedRoles={['management']}>
          <div>Sites artisanaux</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Sites artisanaux')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
  });

  it('conserve les référentiels techniques historiquement déclarés Direction', () => {
    render(
      <MemoryRouter initialEntries={['/admin/modules']}>
        <ProtectedRoute allowedRoles={['management']}>
          <div>Référentiel des modules</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText('Référentiel des modules')).toBeInTheDocument();
  });

  it('ne transforme pas l’administrateur en compte de portail métier', () => {
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['factory']}>
          <div>Portail usine</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Portail usine')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
  });
});
