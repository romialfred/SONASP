import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  configureAuthPersistence: vi.fn(),
  registerCurrentSession: vi.fn(),
  reportActivity: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSecurely: vi.fn(),
  isTerminalSessionError: vi.fn(),
  sessionActivityCallback: null as (() => Promise<void>) | null,
  profileResult: null as Record<string, unknown> | null,
  authStateCallback: null as ((event: string, session: unknown) => Promise<void>) | null,
  profileFetch: vi.fn(() => Promise.resolve(null as Record<string, unknown> | null)),
  onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => Promise<void>) => {
    authMocks.authStateCallback = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }),
}));

vi.mock('@/lib/supabase', () => ({
  configureAuthPersistence: authMocks.configureAuthPersistence,
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      signInWithPassword: authMocks.signInWithPassword,
      signOut: authMocks.signOut,
      onAuthStateChange: authMocks.onAuthStateChange,
    },
    rpc: authMocks.rpc,
  },
}));

vi.mock('@/lib/withTimeout', () => ({
  withTimeout: vi.fn(async (value: unknown) => value),
  withRetry: vi.fn(() => authMocks.profileFetch()),
}));

vi.mock('@/lib/sessionManager', () => ({
  beginSessionActivity: vi.fn(),
  clearSessionActivity: vi.fn(),
  SessionManager: class {
    setOnWarning() {}
    setOnTimeout() {}
    setOnActivitySync(callback: () => Promise<void>) {
      authMocks.sessionActivityCallback = callback;
    }
    start() {}
    stop() {}
    extendSession() {}
  },
}));

vi.mock('@/services/userSessionService', () => ({
  isTerminalCurrentSessionError: authMocks.isTerminalSessionError,
  userSessionService: {
    registerCurrentSession: authMocks.registerCurrentSession,
    reportActivity: authMocks.reportActivity,
    revoke: authMocks.revokeSession,
    revokeAllSecurely: authMocks.revokeAllSecurely,
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

function SignInProbe() {
  const { initialized, signIn } = useAuth();
  const [result, setResult] = useState('');

  return (
    <>
      <button
        type="button"
        disabled={!initialized}
        onClick={() => void signIn(' Agent@SONASP.BF ', 'secret', { rememberMe: false })
          .then((response) => setResult(response.error ?? 'ok'))}
      >
        Connexion test
      </button>
      <output data-testid="sign-in-result">{result}</output>
    </>
  );
}

function SignOutProbe() {
  const { initialized, signOut, user } = useAuth();
  return (
    <button type="button" disabled={!initialized || !user} onClick={() => void signOut()}>
      Déconnexion test
    </button>
  );
}

describe('AuthProvider profile fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.profileResult = null;
    authMocks.authStateCallback = null;
    authMocks.sessionActivityCallback = null;
    authMocks.profileFetch.mockImplementation(() => Promise.resolve(authMocks.profileResult));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.rpc.mockResolvedValue({ error: null });
    authMocks.registerCurrentSession.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
    });
    authMocks.reportActivity.mockResolvedValue(undefined);
    authMocks.revokeSession.mockResolvedValue(undefined);
    authMocks.revokeAllSecurely.mockResolvedValue({
      mode: 'strong_self_global',
      revoked_count: 2,
      application_sessions_revoked: true,
      refresh_tokens_revoked: true,
      access_tokens_revoked: false,
    });
    authMocks.isTerminalSessionError.mockReturnValue(false);
  });

  it('refuse tout accès privé quand le profil autoritatif est indisponible', async () => {
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
    await waitFor(() => expect(state).toHaveAttribute('data-user-id', ''));
    await waitFor(() => expect(state.getAttribute('data-profile-error')).toMatch(/profil autorisé/i));
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

  it('conserve le rôle autoritaire du profil même pour l’adresse historique du propriétaire', async () => {
    authMocks.profileResult = {
      id: 'owner-123',
      email: 'romuald.tiegnan@gmail.com',
      full_name: 'Owner',
      phone: null,
      role: 'management',
      mining_company_id: null,
      site_ids: [],
      is_active: true,
      is_sales_approver: true,
      two_factor_enabled: true,
      language: 'fr',
      email_notifications: true,
      batch_notifications: true,
      approval_notifications: true,
      created_at: '2026-08-17T00:00:00.000Z',
      updated_at: '2026-08-17T00:00:00.000Z',
    };
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'owner-123',
            email: 'romuald.tiegnan@gmail.com',
            user_metadata: { role: 'customer' },
            app_metadata: { role: 'owner' },
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
    await waitFor(() => expect(state).toHaveAttribute('data-user-role', 'management'));
  });

  it('conserve le profil affiché quand le même SIGNED_IN est réémis au retour d’onglet', async () => {
    const session = {
      access_token: 'token',
      user: {
        id: 'stable-user',
        email: 'stable@sonasp.bf',
        app_metadata: { role: 'customer' },
        user_metadata: {},
        created_at: '2026-08-17T00:00:00.000Z',
      },
    };
    authMocks.profileResult = {
      id: 'stable-user',
      email: 'stable@sonasp.bf',
      full_name: 'Agent stable',
      phone: null,
      role: 'customer',
      mining_company_id: null,
      site_ids: [],
      is_active: true,
      is_sales_approver: false,
      two_factor_enabled: false,
      language: 'fr',
      email_notifications: true,
      batch_notifications: true,
      approval_notifications: true,
      created_at: '2026-08-17T00:00:00.000Z',
      updated_at: '2026-08-17T00:00:00.000Z',
    };
    authMocks.getSession.mockResolvedValue({ data: { session }, error: null });

    render(<AuthProvider><AuthStateProbe /></AuthProvider>);
    const state = await screen.findByTestId('auth-state');
    await waitFor(() => expect(state).toHaveAttribute('data-user-id', 'stable-user'));
    expect(authMocks.profileFetch).toHaveBeenCalledTimes(1);
    expect(authMocks.registerCurrentSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await authMocks.authStateCallback?.('SIGNED_IN', session);
    });

    expect(state).toHaveAttribute('data-user-id', 'stable-user');
    expect(state).toHaveAttribute('data-profile-error', '');
    expect(authMocks.profileFetch).toHaveBeenCalledTimes(1);
    expect(authMocks.registerCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('ferme la session et refuse explicitement un profil désactivé', async () => {
    authMocks.profileResult = {
      id: 'inactive-123',
      email: 'agent@sonasp.bf',
      full_name: 'Agent inactif',
      role: 'customer',
      is_active: false,
    };
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'inactive-123' } },
      error: null,
    });

    render(<AuthProvider><SignInProbe /></AuthProvider>);
    const button = await screen.findByRole('button', { name: 'Connexion test' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByTestId('sign-in-result')).toHaveTextContent('ACCOUNT_NOT_AUTHORIZED'));
    expect(authMocks.configureAuthPersistence).toHaveBeenCalledWith();
    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'agent@sonasp.bf',
      password: 'secret',
    });
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('ne transforme pas une panne du suivi de connexion en échec d’authentification', async () => {
    authMocks.profileResult = {
      id: 'active-123',
      email: 'agent@sonasp.bf',
      full_name: 'Agent actif',
      role: 'management',
      is_active: true,
    };
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'active-123' } },
      error: null,
    });
    authMocks.rpc.mockImplementation((name: string) => name === 'snp_enregistrer_connexion'
      ? Promise.reject(new Error('fonction indisponible'))
      : Promise.resolve({ error: null }));

    render(<AuthProvider><SignInProbe /></AuthProvider>);
    const button = await screen.findByRole('button', { name: 'Connexion test' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByTestId('sign-in-result')).toHaveTextContent('ok'));
    expect(authMocks.rpc).toHaveBeenCalledWith('snp_enregistrer_connexion');
  });

  it('échoue fermé si la session serveur ne peut pas être enregistrée', async () => {
    authMocks.profileResult = {
      id: 'active-123',
      email: 'agent@sonasp.bf',
      full_name: 'Agent actif',
      role: 'management',
      is_active: true,
    };
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'active-123' } },
      error: null,
    });
    authMocks.registerCurrentSession.mockRejectedValue(new Error('network'));

    render(<AuthProvider><SignInProbe /></AuthProvider>);
    const button = await screen.findByRole('button', { name: 'Connexion test' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByTestId('sign-in-result'))
      .toHaveTextContent('SESSION_SECURITY_UNAVAILABLE'));
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('ferme localement une session que le heartbeat serveur déclare révoquée', async () => {
    authMocks.profileResult = {
      id: 'active-123',
      email: 'agent@sonasp.bf',
      full_name: 'Agent actif',
      role: 'management',
      is_active: true,
    };
    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'active-123' } } },
      error: null,
    });

    render(<AuthProvider><AuthStateProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth-state'))
      .toHaveAttribute('data-user-id', 'active-123'));
    expect(authMocks.sessionActivityCallback).not.toBeNull();

    authMocks.reportActivity.mockRejectedValue(new Error('revoked'));
    authMocks.isTerminalSessionError.mockReturnValue(true);
    await act(async () => {
      await authMocks.sessionActivityCallback?.();
    });

    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.getByTestId('auth-state')).toHaveAttribute('data-user-id', '');
  });

  it('révoque registre et refresh tokens avant de purger localement une déconnexion manuelle', async () => {
    authMocks.profileResult = {
      id: 'active-123',
      email: 'agent@sonasp.bf',
      full_name: 'Agent actif',
      role: 'management',
      is_active: true,
    };
    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'active-123' } } },
      error: null,
    });

    render(<AuthProvider><SignOutProbe /></AuthProvider>);
    const button = await screen.findByRole('button', { name: 'Déconnexion test' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(authMocks.revokeAllSecurely).toHaveBeenCalledWith(
      undefined,
      false,
      'Déconnexion globale volontaire par le titulaire du compte',
    ));
    expect(authMocks.revokeSession).not.toHaveBeenCalled();
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('retombe sur la révocation courante et le signOut global si l’Edge est indisponible', async () => {
    authMocks.profileResult = {
      id: 'active-123',
      email: 'agent@sonasp.bf',
      full_name: 'Agent actif',
      role: 'management',
      is_active: true,
    };
    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'active-123' } } },
      error: null,
    });
    authMocks.revokeAllSecurely.mockRejectedValue(new Error('edge unavailable'));

    render(<AuthProvider><SignOutProbe /></AuthProvider>);
    const button = await screen.findByRole('button', { name: 'Déconnexion test' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(authMocks.revokeSession).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'Déconnexion volontaire de la session courante',
    ));
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
});
