import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
    },
  },
}));

vi.mock('@/lib/withTimeout', () => ({
  withTimeout: vi.fn(async (value: unknown) => value),
  withRetry: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/lib/sessionManager', () => ({
  SessionManager: class {
    setOnWarning() {}
    setOnTimeout() {}
    start() {}
    stop() {}
    extendSession() {}
  },
}));

vi.mock('@/components/auth/SessionTimeoutWarning', () => ({
  SessionTimeoutWarning: () => null,
}));

function AuthStateProbe() {
  const { initialized, profileError, user } = useAuth();

  return (
    <output
      data-testid="auth-state"
      data-initialized={String(initialized)}
      data-profile-error={profileError ?? ''}
      data-user-id={user?.id ?? ''}
      data-user-role={user?.role ?? ''}
    />
  );
}

describe('AuthProvider profile fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('keeps a valid authentication fallback without surfacing a profile error', async () => {
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
            email: 'agent@sonasp.bf',
            user_metadata: { full_name: 'Agent SONASP', role: 'customer' },
            created_at: '2026-08-17T00:00:00.000Z',
            updated_at: '2026-08-17T00:00:00.000Z',
            last_sign_in_at: '2026-08-17T00:00:00.000Z',
          },
        },
      },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    const state = await screen.findByTestId('auth-state');
    await waitFor(() => expect(state).toHaveAttribute('data-initialized', 'true'));
    await waitFor(() => expect(state).toHaveAttribute('data-user-id', 'user-123'));
    expect(state).toHaveAttribute('data-profile-error', '');
  });

  it('still surfaces an actionable authentication initialization error', async () => {
    authMocks.getSession.mockRejectedValue(new Error('authentication unavailable'));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    const state = await screen.findByTestId('auth-state');
    await waitFor(() => expect(state).toHaveAttribute('data-initialized', 'true'));
    expect(state).toHaveAttribute(
      'data-profile-error',
      'Authentication failed to initialize. Please refresh or sign in again.'
    );
    expect(state).toHaveAttribute('data-user-id', '');
  });

  it('utilise le rôle Owner depuis les métadonnées Auth protégées', async () => {
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'owner-123',
            email: 'romuald.tiegnan@gmail.com',
            user_metadata: { role: 'customer' },
            app_metadata: {},
            created_at: '2026-08-17T00:00:00.000Z',
            updated_at: '2026-08-17T00:00:00.000Z',
            last_sign_in_at: '2026-08-17T00:00:00.000Z',
          },
        },
      },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    const state = await screen.findByTestId('auth-state');
    await waitFor(() => expect(state).toHaveAttribute('data-user-role', 'owner'));
  });
});
