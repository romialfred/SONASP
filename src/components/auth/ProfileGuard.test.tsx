import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileGuard } from './ProfileGuard';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types/auth';

type Mock = ReturnType<typeof vi.fn>;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = useAuth as unknown as Mock;

const baseUser: UserProfile = {
  id: 'user-1',
  email: 'user@example.com',
  full_name: 'Test User',
  phone: null,
  role: 'management',
  mining_company_id: null,
  site_ids: [],
  is_active: true,
  is_sales_approver: false,
  two_factor_enabled: false,
  language: null,
  email_notifications: true,
  batch_notifications: true,
  approval_notifications: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const createAuthValue = (overrides: Record<string, unknown> = {}) => ({
  user: null,
  session: null,
  loading: false,
  initialized: true,
  profileLoading: false,
  profileError: null,
  signIn: vi.fn().mockResolvedValue({}),
  signOut: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue({}),
  updatePassword: vi.fn().mockResolvedValue({}),
  refreshProfile: vi.fn().mockResolvedValue(undefined),
  ...overrides,
}) as any;

const renderGuard = () =>
  render(
    <ProfileGuard>
      <div data-testid="guard-content">Protected Content</div>
    </ProfileGuard>
  );

describe('ProfileGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when profile is loading', () => {
    mockedUseAuth.mockReturnValue(createAuthValue({ profileLoading: true }));

    renderGuard();

    expect(screen.getByText(/Chargement du profil/i)).toBeInTheDocument();
  });

  it('renders error state when profile fails to load and user is missing', () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthValue({ profileError: 'Impossible de charger le profil utilisateur.', refreshProfile })
    );

    renderGuard();

    expect(screen.getByText(/Impossible de charger le profil utilisateur/i)).toBeInTheDocument();
  });

  it('renders fallback when user is missing', () => {
    mockedUseAuth.mockReturnValue(createAuthValue({ user: null }));

    renderGuard();

    expect(screen.getByText(/Impossible de charger les informations de votre profil/i)).toBeInTheDocument();
  });

  it('renders children with warning when profileError exists but user is present', () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthValue({ user: baseUser, profileError: 'Certaines informations du profil sont indisponibles.', refreshProfile })
    );

    renderGuard();

    expect(screen.getByTestId('guard-content')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Informations de profil partielles/i);
    expect(alert).toHaveTextContent(/Certaines informations du profil sont indisponibles/i);
  });

  it('renders children when profile is available', () => {
    mockedUseAuth.mockReturnValue(
      createAuthValue({ user: baseUser, profileLoading: false, profileError: null })
    );

    renderGuard();

    expect(screen.getByTestId('guard-content')).toBeInTheDocument();
  });
});
