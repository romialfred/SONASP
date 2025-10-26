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
  site_ids: [],
  is_active: true,
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

    expect(screen.getByText(/Loading profile/i)).toBeInTheDocument();
  });

  it('renders error state when profile fails to load and user is missing', () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthValue({ profileError: 'Unable to load user profile.', refreshProfile })
    );

    renderGuard();

    expect(screen.getByText(/Unable to load user profile/i)).toBeInTheDocument();
  });

  it('renders fallback when user is missing', () => {
    mockedUseAuth.mockReturnValue(createAuthValue({ user: null }));

    renderGuard();

    expect(screen.getByText(/could not load your profile/i)).toBeInTheDocument();
  });

  it('renders children with warning when profileError exists but user is present', () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      createAuthValue({ user: baseUser, profileError: 'Using limited profile information.', refreshProfile })
    );

    renderGuard();

    expect(screen.getByTestId('guard-content')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Limited profile information/i);
    expect(alert).toHaveTextContent(/Using limited profile information/i);
  });

  it('renders children when profile is available', () => {
    mockedUseAuth.mockReturnValue(
      createAuthValue({ user: baseUser, profileLoading: false, profileError: null })
    );

    renderGuard();

    expect(screen.getByTestId('guard-content')).toBeInTheDocument();
  });
});
