import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'owner-id',
      email: 'romuald.tiegnan@gmail.com',
      role: 'owner',
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

describe('ProtectedRoute Owner', () => {
  it('ouvre au propriétaire actif une route métier limitée à un autre rôle', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute allowedRoles={['factory']}>
          <div>Module protégé</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Module protégé')).toBeInTheDocument();
    expect(screen.queryByText('Accès refusé')).not.toBeInTheDocument();
  });
});
