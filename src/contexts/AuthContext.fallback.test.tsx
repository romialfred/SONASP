import { useEffect, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { MandatoryMfaGate } from '@/components/auth/MandatoryMfaGate';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  contextConsumerRendered: vi.fn(),
  mfaState: vi.fn(),
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
      getUser: authMocks.getUser,
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

vi.mock('@/services/mfaService', () => ({
  mfaService: { etat: authMocks.mfaState },
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

function GuardedDraftProbe() {
  authMocks.contextConsumerRendered();
  const { initialized, loading, profileLoading, refreshProfile, session } = useAuth();
  const [draft, setDraft] = useState('');

  if (loading || !initialized || (session && profileLoading)) {
    return <div role="status">Chargement global</div>;
  }

  return (
    <section data-testid="stable-shell">
      <label htmlFor="lifecycle-draft">Brouillon métier</label>
      <input
        id="lifecycle-draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="button" onClick={() => void refreshProfile()}>Revalider le profil</button>
    </section>
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
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
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
    authMocks.mfaState.mockResolvedValue({ etape_suivante: 'pret', aal: 'aal2' });
  });

  it('conserve le vrai sous-arbre protégé pendant les reprises répétées et le ferme à la déconnexion', async () => {
    const session = { access_token: 'initial', user: { id: 'owner-lifecycle' } };
    authMocks.profileResult = {
      id: session.user.id, role: 'owner', is_active: true, capabilities: [],
    };
    authMocks.getSession.mockResolvedValue({ data: { session }, error: null });
    const mounted = vi.fn();
    const unmounted = vi.fn();
    function Draft() {
      const [value, setValue] = useState('');
      useEffect(() => { mounted(); return () => { unmounted(); }; }, []);
      return <input aria-label="Saisie protégée" value={value} onChange={event => setValue(event.target.value)} />;
    }
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <MandatoryMfaGate>
            <Routes>
              <Route path="/dashboard" element={<ProtectedRoute><Draft /></ProtectedRoute>} />
              <Route path="/login" element={<p>Session fermée</p>} />
            </Routes>
          </MandatoryMfaGate>
        </AuthProvider>
      </MemoryRouter>,
    );
    const input = await screen.findByLabelText('Saisie protégée');
    fireEvent.change(input, { target: { value: 'Travail non enregistré' } });
    for (let index = 0; index < 5; index += 1) {
      await act(async () => {
        fireEvent(window, new Event('blur'));
        fireEvent(document, new Event('visibilitychange'));
        await authMocks.authStateCallback?.('TOKEN_REFRESHED', { ...session, access_token: `renewed-${index}` });
        await authMocks.authStateCallback?.('SIGNED_IN', session);
        fireEvent(window, new Event('focus'));
        fireEvent(window, new Event('pageshow'));
      });
      expect(screen.getByLabelText('Saisie protégée')).toBe(input);
      expect(input).toHaveValue('Travail non enregistré');
      expect(screen.queryByRole('status', { name: /session|espace|plateforme/i })).not.toBeInTheDocument();
    }
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    expect(authMocks.mfaState).toHaveBeenCalledTimes(1);
    expect(authMocks.profileFetch).toHaveBeenCalledTimes(1);
    expect(authMocks.registerCurrentSession).toHaveBeenCalledTimes(1);
    await act(async () => { await authMocks.authStateCallback?.('SIGNED_OUT', null); });
    expect(screen.queryByLabelText('Saisie protégée')).not.toBeInTheDocument();
    expect(screen.getByText('Session fermée')).toBeInTheDocument();
    expect(unmounted).toHaveBeenCalledTimes(1);
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

  it('conserve le shell et le brouillon si SIGNED_IN revient pendant une revalidation silencieuse', async () => {
    const session = {
      access_token: 'token-stable',
      user: {
        id: 'stable-draft-user',
        email: 'draft@sonasp.bf',
        app_metadata: { role: 'customer' },
        user_metadata: {},
        created_at: '2026-08-17T00:00:00.000Z',
      },
    };
    const profile = {
      id: 'stable-draft-user',
      email: 'draft@sonasp.bf',
      full_name: 'Agent brouillon',
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
    let resolveRefresh: ((value: typeof profile) => void) | undefined;
    const pendingRefresh = new Promise<typeof profile>((resolve) => {
      resolveRefresh = resolve;
    });

    authMocks.profileResult = profile;
    authMocks.getSession.mockResolvedValue({ data: { session }, error: null });
    authMocks.getUser.mockResolvedValue({ data: { user: session.user }, error: null });
    authMocks.profileFetch
      .mockResolvedValueOnce(profile)
      .mockImplementationOnce(() => pendingRefresh);

    render(<AuthProvider><GuardedDraftProbe /></AuthProvider>);

    const draft = await screen.findByLabelText('Brouillon métier');
    fireEvent.change(draft, { target: { value: 'valeur non enregistrée' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revalider le profil' }));
    await waitFor(() => expect(authMocks.profileFetch).toHaveBeenCalledTimes(2));
    const renderCountBeforeLifecycleEvent = authMocks.contextConsumerRendered.mock.calls.length;

    await act(async () => {
      await authMocks.authStateCallback?.('SIGNED_IN', session);
    });

    expect(screen.queryByText('Chargement global')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Brouillon métier')).toBe(draft);
    expect(draft).toHaveValue('valeur non enregistrée');
    expect(authMocks.profileFetch).toHaveBeenCalledTimes(2);
    expect(authMocks.registerCurrentSession).toHaveBeenCalledTimes(1);
    expect(authMocks.contextConsumerRendered).toHaveBeenCalledTimes(renderCountBeforeLifecycleEvent);

    await act(async () => {
      resolveRefresh?.(profile);
      await pendingRefresh;
    });
  });

  it('ne republie pas le contexte global quand le jeton du même compte est renouvelé', async () => {
    const initialSession = {
      access_token: 'token-initial',
      user: {
        id: 'stable-token-user',
        email: 'token@sonasp.bf',
        app_metadata: { role: 'customer' },
        user_metadata: {},
        created_at: '2026-08-17T00:00:00.000Z',
      },
    };
    const refreshedSession = {
      ...initialSession,
      access_token: 'token-refreshed',
    };
    authMocks.profileResult = {
      id: 'stable-token-user',
      email: 'token@sonasp.bf',
      full_name: 'Agent jeton stable',
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
    authMocks.getSession.mockResolvedValue({ data: { session: initialSession }, error: null });

    render(<AuthProvider><GuardedDraftProbe /></AuthProvider>);

    const draft = await screen.findByLabelText('Brouillon métier');
    fireEvent.change(draft, { target: { value: 'saisie à préserver' } });
    const renderCountBeforeTokenRefresh = authMocks.contextConsumerRendered.mock.calls.length;

    await act(async () => {
      await authMocks.authStateCallback?.('TOKEN_REFRESHED', refreshedSession);
    });

    expect(authMocks.contextConsumerRendered).toHaveBeenCalledTimes(renderCountBeforeTokenRefresh);
    expect(screen.getByLabelText('Brouillon métier')).toBe(draft);
    expect(draft).toHaveValue('saisie à préserver');
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
