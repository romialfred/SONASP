import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { configureAuthPersistence, supabase } from '@/lib/supabase';
import { UserProfile, AuthState } from '@/types/auth';
import { beginSessionActivity, clearSessionActivity, SessionManager } from '@/lib/sessionManager';
import { dureeInactiviteMs, reinitialiserDureeInactivite } from '@/lib/sessionPolicy';
import { parametresPlateformeService } from '@/services/parametresPlateformeService';
import { withTimeout, withRetry } from '@/lib/withTimeout';
import { BUSINESS_RESPONSIBILITIES, moduleDomain } from '@/lib/accessControl';
import {
  PLATFORM_MODULE_BY_CODE,
  type PlatformModuleCode,
} from '@/lib/platformModuleCatalog';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';
import {
  isTerminalCurrentSessionError,
  userSessionService,
} from '@/services/userSessionService';

interface AuthContextType extends AuthState {
  signIn: (
    email: string,
    password: string,
    options?: { rememberMe?: boolean },
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const profileRequests = new Map<string, Promise<UserProfile | null>>();
const responsibilityCodes = new Set<string>(
  BUSINESS_RESPONSIBILITIES.map(({ code }) => code),
);

function isPlatformModuleCode(code: string | null): code is PlatformModuleCode {
  return code !== null && PLATFORM_MODULE_BY_CODE.has(code as PlatformModuleCode);
}

export const isMissingUserProfileError = (
  error: { code?: string } | null | undefined
): boolean => error?.code === 'PGRST116';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false,
    profileLoading: true,
    profileError: null,
  });
  // Supabase peut réémettre SIGNED_IN lorsqu'un onglet redevient visible.
  // Garder une référence sur l'état courant permet de distinguer cette reprise
  // d'une véritable nouvelle connexion, sans effacer le profil déjà affiché.
  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionManagerRef = useRef<SessionManager | null>(null);
  const serverSessionIdRef = useRef<string | null>(null);
  const serverSessionRegistrationRef = useRef<Promise<boolean> | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [warningRemainingSeconds, setWarningRemainingSeconds] = useState(60);

  const startSessionManager = () => {
    if (sessionManagerRef.current) return;
    const manager = new SessionManager();
    manager.setOnWarning((remainingSeconds) => {
      setWarningRemainingSeconds(remainingSeconds);
      setShowTimeoutWarning(true);
    });
    manager.setOnTimeout(async () => {
      setShowTimeoutWarning(false);
      const sessionId = serverSessionIdRef.current;
      serverSessionIdRef.current = null;
      if (sessionId) {
        try {
          await userSessionService.revoke(
            sessionId,
            `Expiration après ${Math.round(dureeInactiviteMs() / 60000)} minutes d’inactivité`,
          );
        } catch {
          // La fermeture locale reste obligatoire même si le réseau est perdu.
        }
      }
    });
    manager.setOnActivitySync(async () => {
      try {
        await userSessionService.reportActivity();
      } catch (error) {
        if (isTerminalCurrentSessionError(error)) await closeRejectedSession('local');
      }
    });
    // La durée d'inactivité est un paramètre de plateforme. On la lit sans
    // bloquer le démarrage : tant que la réponse n'est pas là, le minuteur
    // applique son repli de dix minutes, plus prudent que la valeur réelle.
    void parametresPlateformeService.synchroniserDureeSession();

    manager.start();
    sessionManagerRef.current = manager;
  };

  const resolveProfileResult = (
    profile: UserProfile | null,
  ): { profile: UserProfile | null; error: string | null } => {
    if (profile) {
      return {
        // Le rôle vient exclusivement du profil autoritatif protégé par RLS.
        // Une adresse e-mail ou une app_metadata ne peut pas promouvoir un
        // compte en Owner depuis le navigateur.
        profile,
        error: null,
      };
    }

    return {
      profile: null,
      error: 'Votre profil autorisé n’a pas pu être chargé. Réessayez ou contactez l’administrateur.',
    };
  };

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const pendingRequest = profileRequests.get(userId);
    if (pendingRequest) return pendingRequest;

    const request = withRetry(
      async () => {
        // Fetch the user profile with timeout
        const { data: profile, error: profileError } = await withTimeout(
          supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single(),
          5000,
          'Profile-Fetch'
        );

        if (profileError) {
          console.error('[Profile] Fetch error:', profileError);

          // Check for infinite recursion error (42P17)
          if (profileError.code === '42P17') {
            console.error('[Profile] CRITICAL: Infinite recursion in RLS policies');
            throw new Error('Database configuration error');
          }

          // Un profil d'autorisation ne se fabrique jamais depuis le navigateur.
          if (isMissingUserProfileError(profileError)) {
            console.error('[Profile] Missing authoritative profile');
            return null;
          }

          throw profileError;
        }

        if (!profile) {
          console.error('[Profile] Empty authoritative profile result');
          return null;
        }

        // Fetch site assignments separately (non-blocking)
        let siteIds: string[] = [];
        try {
          const { data: assignments } = await withTimeout(
            supabase
              .from('user_site_assignments')
              .select('site_id, is_primary')
              .eq('user_id', userId),
            2500,
            'Site-Assignments'
          );
          siteIds = assignments?.map((a: any) => a.site_id) || [];
        } catch (error) {
          console.warn('[Profile] Site assignments fetch failed (non-fatal):', error);
        }

        // La liste vient du resolver serveur autoritatif. Une indisponibilité
        // ferme les accès au lieu de reconstruire des privilèges dans le client.
        let capabilities: string[] = [];
        try {
          const { data, error } = await withTimeout<{ data: Array<{ capability_code?: unknown }> | null; error: any }>(
            (supabase as any).rpc('snp_actor_capabilities') as PromiseLike<{ data: Array<{ capability_code?: unknown }> | null; error: any }>,
            2500,
            'Actor-Capabilities'
          );
          if (error) throw error;
          capabilities = (data ?? [])
            .map((row: { capability_code?: unknown }) => row.capability_code)
            .filter((code: unknown): code is string => typeof code === 'string');
        } catch (error) {
          console.warn('[Profile] Actor capabilities unavailable; access denied by default:', error);
        }

        let organizationId: string | null = null;
        let organizationType: string | null = null;
        // Le resolver serveur retourne déjà les seules capacités effectives de
        // l'acteur. Leur intersection avec le catalogue des responsabilités
        // évite une lecture directe de la table IAM, absente des schémas plus
        // anciens, sans jamais reconstituer de privilège côté client.
        const responsibilities = capabilities.filter((code) => responsibilityCodes.has(code));
        let moduleDomains: string[] = [];
        let moduleCodes: string[] = [];
        let accessPortalId: string | null = null;
        let accessPortalCode: string | null = null;
        let accessPortalName: string | null = null;
        let accessRoleId: string | null = null;
        let accessRoleCode: string | null = null;
        let accessRoleName: string | null = null;
        let actorCategoryCode: string | null = null;
        try {
          const [membershipResult, permissionsResult] = await Promise.all([
            withTimeout<{ data: any; error: any }>(
              (supabase as any)
                .from('snp_user_organization_memberships')
                .select('organization_id, snp_organizations(organization_type)')
                .eq('user_id', userId)
                .eq('is_primary', true)
                .is('valid_until', null)
                .maybeSingle() as PromiseLike<{ data: any; error: any }>,
              2500,
              'Organization-Membership',
            ),
            withTimeout<{ data: Array<{ modules?: { name?: unknown; access_domain?: unknown; is_active?: unknown } | null }> | null; error: any }>(
              (supabase as any)
                .from('user_permissions')
                .select('modules(name, access_domain, is_active)')
                .eq('user_id', userId)
                .eq('can_view', true) as PromiseLike<{ data: Array<{ modules?: { name?: unknown } | null }> | null; error: any }>,
              2500,
              'Effective-Modules',
            ),
          ]);
          if (membershipResult.error) throw membershipResult.error;
          if (permissionsResult.error) throw permissionsResult.error;
          organizationId = membershipResult.data?.organization_id ?? null;
          organizationType = membershipResult.data?.snp_organizations?.organization_type ?? null;
          const activePermissions = (permissionsResult.data ?? []).filter(
            (row) => row.modules?.is_active !== false,
          );
          moduleCodes = [...new Set(activePermissions
            .map((row) => typeof row.modules?.name === 'string' ? row.modules.name : null)
            .filter(isPlatformModuleCode))];
          moduleDomains = [...new Set(activePermissions
            .map((row) => moduleDomain({
              name: typeof row.modules?.name === 'string' ? row.modules.name : undefined,
              access_domain: typeof row.modules?.access_domain === 'string'
                ? row.modules.access_domain
                : undefined,
            }))
            .filter((domain) => domain !== 'unknown'))];
        } catch (error) {
          console.warn('[Profile] Access perimeter unavailable; scoped profile remains closed:', error);
        }

        // La gouvernance par portail est la dernière frontière d’autorisation.
        // Sur une base migrée, sa matrice effective remplace la projection CRUD
        // historique. Le repli n’est admis que si la RPC n’existe pas encore.
        try {
          const { data: accessContext, error: accessError } = await withTimeout<{ data: any; error: any }>(
            (supabase as any).rpc('snp_current_access_context') as PromiseLike<{ data: any; error: any }>,
            2500,
            'Access-Governance-Context',
          );
          if (accessError) {
            if (!['PGRST202', '42883'].includes(accessError.code)) throw accessError;
          } else if (accessContext) {
            accessPortalId = accessContext.portal_id ?? null;
            accessPortalCode = accessContext.portal_code ?? null;
            accessPortalName = accessContext.portal_name ?? null;
            accessRoleId = accessContext.role_id ?? null;
            accessRoleCode = accessContext.role_code ?? null;
            accessRoleName = accessContext.role_name ?? null;
            actorCategoryCode = accessContext.actor_category_code ?? null;
            const effectiveCodes = (Array.isArray(accessContext.module_codes) ? accessContext.module_codes : [])
              .filter((code: unknown): code is string => typeof code === 'string' && isPlatformModuleCode(code));
            moduleCodes = [...new Set<string>(effectiveCodes)];
            moduleDomains = [...new Set(moduleCodes.map((code) => moduleDomain({ name: code })).filter((domain) => domain !== 'unknown'))];
          } else {
            moduleCodes = [];
            moduleDomains = [];
          }
        } catch (error) {
          console.warn('[Profile] Access governance unavailable; effective perimeter closed:', error);
          moduleCodes = [];
          moduleDomains = [];
        }

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role as UserProfile['role'],
          mining_company_id: profile.mining_company_id ?? null,
          organization_id: organizationId,
          organization_type: organizationType,
          responsibilities,
          module_domains: moduleDomains,
          module_codes: moduleCodes,
          access_portal_id: accessPortalId,
          access_portal_code: accessPortalCode,
          access_portal_name: accessPortalName,
          access_role_id: accessRoleId,
          access_role_code: accessRoleCode,
          access_role_name: accessRoleName,
          actor_category_code: actorCategoryCode,
          site_ids: siteIds,
          is_active: profile.is_active === true,
          capabilities,
          is_sales_approver: profile.is_sales_approver ?? false,
          two_factor_enabled: profile.two_factor_enabled === true,
          language: profile.language,
          email_notifications: profile.email_notifications === true,
          batch_notifications: (profile as any).batch_notifications === true,
          approval_notifications: profile.approval_notifications === true,
          created_at: profile.created_at ?? '',
          updated_at: profile.updated_at ?? '',
        };
      },
      {
        maxRetries: 1,
        initialDelay: 350,
        backoffMultiplier: 1.5,
        timeout: 8000,
        label: 'Profile-Fetch',
        shouldRetry: (error: any) => {
          // Les erreurs fonctionnelles/RLS ne changeront pas après une attente.
          if (error?.message?.includes('timeout')) return false;
          if (error?.message?.includes('CORS')) return false;
          if (typeof error?.code === 'string' && /^(PGRST|42|22|23)/.test(error.code)) return false;
          return true;
        },
      }
    ).catch(error => {
      console.error('[Profile] All fetch attempts failed:', error);
      return null;
    });

    // React StrictMode et SIGNED_IN peuvent lancer l'initialisation presque au
    // même instant. Une seule lecture autoritative suffit pour ce même compte.
    profileRequests.set(userId, request);
    try {
      return await request;
    } finally {
      if (profileRequests.get(userId) === request) profileRequests.delete(userId);
    }
  };

  const logSecurityEvent = async (
    userId: string | null,
    eventType: string,
    details?: any
  ) => {
    try {
      await (supabase as any).rpc('log_security_event', {
        p_user_id: userId,
        p_event_type: eventType,
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
        p_details: details || null,
      });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  };

  const closeRejectedSession = async (scope: 'global' | 'local' = 'global') => {
    if (sessionManagerRef.current) {
      sessionManagerRef.current.stop();
      sessionManagerRef.current = null;
    }

    try {
      clearSessionActivity();
      reinitialiserDureeInactivite();
      serverSessionIdRef.current = null;
      serverSessionRegistrationRef.current = null;
      await supabase.auth.signOut({ scope });
    } finally {
      setState({
        user: null,
        session: null,
        loading: false,
        initialized: true,
        profileLoading: false,
        profileError: null,
      });
    }
  };

  const registerServerSession = async (): Promise<boolean> => {
    if (serverSessionIdRef.current) return true;
    if (serverSessionRegistrationRef.current) return serverSessionRegistrationRef.current;

    const registration = (async () => {
      try {
        const registered = await userSessionService.registerCurrentSession();
        serverSessionIdRef.current = registered.id;
        return true;
      } catch {
        // Sans enregistrement serveur, la révocation et la borne d'inactivité ne
        // sont pas démontrables. Une nouvelle session échoue donc fermée.
        await closeRejectedSession('local');
        return false;
      }
    })();
    serverSessionRegistrationRef.current = registration;
    try {
      return await registration;
    } finally {
      if (serverSessionRegistrationRef.current === registration) {
        serverSessionRegistrationRef.current = null;
      }
    }
  };

  const signIn = async (
    email: string,
    password: string,
    options: { rememberMe?: boolean } = {},
  ) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      // Le paramètre historique est volontairement ignoré : une session SONASP
      // ne peut plus être persistée après la fermeture de l'onglet.
      void options;
      configureAuthPersistence();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        void logSecurityEvent(null, 'login_failed', { email: normalizedEmail, error: error.message });
        return { error: error.message };
      }

      if (data.user) {
        const authorizedProfile = await fetchUserProfile(data.user.id);

        if (!authorizedProfile) {
          await logSecurityEvent(data.user.id, 'login_profile_unavailable', {
            email: normalizedEmail,
          });
          await closeRejectedSession();
          return { error: 'PROFILE_AUTHORIZATION_UNAVAILABLE' };
        }

        if (!authorizedProfile.is_active) {
          await logSecurityEvent(data.user.id, 'login_denied_inactive_account', {
            email: normalizedEmail,
          });
          await closeRejectedSession();
          return { error: 'ACCOUNT_NOT_AUTHORIZED' };
        }

        if (!(await registerServerSession())) {
          return { error: 'SESSION_SECURITY_UNAVAILABLE' };
        }

        // Ces écritures de suivi ne conditionnent pas l'autorisation. Les
        // lancer en arrière-plan évite d'ajouter deux allers-retours réseau au
        // délai perçu entre la validation et l'ouverture du tableau de bord.
        // Ces appels sont non bloquants et indépendants. `allSettled` évite
        // qu'une fonction d'audit momentanément absente ou indisponible ne
        // produise un rejet non géré après une connexion pourtant valide.
        void Promise.allSettled([
          logSecurityEvent(data.user.id, 'login_success', { email: normalizedEmail }),
          supabase.rpc('snp_enregistrer_connexion'),
        ]);
        beginSessionActivity();
      }

      return {};
    } catch (error: any) {
      return { error: error.message || 'Une erreur inattendue est survenue.' };
    }
  };

  const signOut = async () => {
    try {
      console.log('[Auth] Manual signOut called');

      if (state.user) {
        await logSecurityEvent(state.user.id, 'logout', {});
      }

      // Stop session manager FIRST to mark this as manual logout
      if (sessionManagerRef.current) {
        console.log('[Auth] Stopping session manager before signOut');
        sessionManagerRef.current.stop();
        sessionManagerRef.current = null;
      }

      clearSessionActivity();
      reinitialiserDureeInactivite();

      const serverSessionId = serverSessionIdRef.current;
      serverSessionIdRef.current = null;
      serverSessionRegistrationRef.current = null;
      let refreshTokensRevokedByEdge = false;
      if (serverSessionId) {
        try {
          const resultat = await userSessionService.revokeAllSecurely(
            undefined,
            false,
            'Déconnexion globale volontaire par le titulaire du compte',
          );
          refreshTokensRevokedByEdge = resultat.mode === 'strong_self_global';
        } catch {
          try {
            await userSessionService.revoke(serverSessionId, 'Déconnexion volontaire de la session courante');
          } catch {
            // La déconnexion Supabase ne doit jamais être bloquée par l'audit.
          }
        }
      }

      // L'Edge a déjà révoqué tous les refresh tokens en mode fort. Le scope
      // local purge alors le stockage de cet onglet sans refaire une révocation
      // globale. En fallback, le client demande lui-même le scope global.
      console.log('[Auth] Calling supabase.auth.signOut()');
      await supabase.auth.signOut({ scope: refreshTokensRevokedByEdge ? 'local' : 'global' });

      // Clear state immediately (don't wait for onAuthStateChange)
      console.log('[Auth] Clearing auth state');
      setState({
        user: null,
        session: null,
        loading: false,
        initialized: true,
        profileLoading: false,
        profileError: null,
      });
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if signOut fails, clear local state
      setState({
        user: null,
        session: null,
        loading: false,
        initialized: true,
        profileLoading: false,
        profileError: null,
      });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/modifier-mot-de-passe`,
      });

      if (error) {
        return { error: error.message };
      }

      await logSecurityEvent(null, 'password_reset_requested', { email });
      return {};
    } catch (error: any) {
      return { error: error.message || 'Une erreur inattendue est survenue.' };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { error: error.message };
      }

      if (state.user) {
        await logSecurityEvent(state.user.id, 'password_changed', {});
      }

      return {};
    } catch (error: any) {
      return { error: error.message || 'An unexpected error occurred' };
    }
  };

  const refreshProfile = async () => {
    setState(prev => ({
      ...prev,
      // Un profil déjà autorisé reste affiché pendant sa revalidation. Seul le
      // bootstrap sans profil utilise le loader bloquant.
      profileLoading: !prev.user,
      profileError: null,
    }));

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      let profile: UserProfile | null = null;

      try {
        profile = await fetchUserProfile(user.id);
      } catch (error) {
        console.error('[Auth] refreshProfile: profile fetch failed', error);
      }

      const { profile: resolvedProfile, error } = resolveProfileResult(profile);

      setState(prev => ({
        ...prev,
        // Une panne transitoire ne détruit pas le shell ni le formulaire en
        // cours. Les contrôles serveur/RLS restent l'autorité d'accès.
        user: resolvedProfile ?? prev.user,
        profileLoading: false,
        profileError: error,
      }));
    } else {
      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        profileLoading: false,
        profileError: 'Session expired. Please sign in again.',
      }));
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[Auth] Starting auth initialization...');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        console.log('[Auth] INITIAL_SESSION event processed. Session present:', !!session);

        if (sessionError) {
          console.error('[Auth] Session error:', sessionError);
        }

        if (!mounted) {
          console.log('[Auth] Component unmounted, skipping state update');
          return;
        }

        if (session?.user) {
          console.log('[Auth] Active session found for:', session.user.id);

          setState(prev => ({
            ...prev,
            user: null,
            session,
            loading: false,
            initialized: true,
            profileLoading: true,
            profileError: null,
          }));

          startSessionManager();

          console.log('[Auth] Fetching authoritative profile...');
          void (async () => {
            try {
              const profile = await fetchUserProfile(session.user.id);
              if (!mounted) return;
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession?.user.id !== session.user.id) return;
              const { profile: resolvedProfile, error } = resolveProfileResult(profile);
              if (!resolvedProfile) {
                setState(prev => ({
                  ...prev,
                  user: null,
                  profileLoading: false,
                  profileError: error,
                }));
                return;
              }
              if (!(await registerServerSession())) return;
              setState(prev => ({
                ...prev,
                user: resolvedProfile,
                profileLoading: false,
                profileError: error,
              }));
            } catch (error) {
              console.error('[Auth] Background profile fetch error:', error);
              if (mounted) {
                setState(prev => ({
                  ...prev,
                  user: null,
                  profileLoading: false,
                  profileError: 'Votre profil autorisé n’a pas pu être chargé.',
                }));
              }
            }
          })();
        } else {
          console.log('[Auth] No active session, setting unauthenticated state');
          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
            profileLoading: false,
            profileError: null,
          });
        }
      } catch (error) {
        console.error('[Auth] Critical error initializing auth:', error);
        if (mounted) {
          console.log('[Auth] Setting fallback state due to critical error');
          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
            profileLoading: false,
            profileError: 'Authentication failed to initialize. Please refresh or sign in again.',
          });
        }
      }
    };

    // Much shorter timeout - just for the session check, not profile
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.error('[Auth] Initialization timeout - setting initialized flag');
        setState(prev => ({
          ...prev,
          loading: false,
          initialized: true,
          profileLoading: false,
          profileError: prev.session && !prev.user
            ? 'Le chargement du profil autorisé a expiré. Réessayez.'
            : prev.profileError,
        }));
      }
    }, 5000); // 5 seconds max for session check

    initializeAuth().finally(() => {
      clearTimeout(timeoutId);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('[Auth] ========================================');
        console.log('[Auth] Auth state changed:', event);
        console.log('[Auth] Session present:', !!session);
        console.log('[Auth] User ID:', session?.user?.id);
        console.log('[Auth] Session Manager active:', !!sessionManagerRef.current);
        console.log('[Auth] ========================================');

        if (!mounted) {
          console.log('[Auth] Component unmounted - ignoring event');
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[Auth] User signed in');

          const currentState = stateRef.current;
          const isSameInitializedPrincipal =
            currentState.initialized
            && currentState.session?.user.id === session.user.id;

          if (isSameInitializedPrincipal) {
            // Une reprise d'onglet ou une session rafraîchie ne doit jamais
            // republier le contexte global. Supabase conserve déjà le nouveau
            // jeton dans son client ; les consommateurs React n'utilisent ici
            // que l'identité et la présence de la session, restées inchangées.
            return;
          }

          setState(prev => ({
            ...prev,
            user: null,
            session,
            loading: false,
            initialized: true,
            profileLoading: true,
            profileError: null,
          }));

          startSessionManager();

          console.log('[Auth] Fetching authoritative profile...');
          void (async () => {
            try {
              const profile = await fetchUserProfile(session.user.id);
              if (!mounted) return;
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession?.user.id !== session.user.id) return;
              const { profile: resolvedProfile, error } = resolveProfileResult(profile);
              if (!resolvedProfile) {
                setState(prev => ({
                  ...prev,
                  user: null,
                  profileLoading: false,
                  profileError: error,
                }));
                return;
              }
              if (!(await registerServerSession())) return;
              setState(prev => ({
                ...prev,
                user: resolvedProfile,
                profileLoading: false,
                profileError: error,
              }));
            } catch (error) {
              console.error('[Auth] Background profile fetch error:', error);
              if (mounted) {
                setState(prev => ({
                  ...prev,
                  user: null,
                  profileLoading: false,
                  profileError: 'Votre profil autorisé n’a pas pu être chargé.',
                }));
              }
            }
          })();
        } else if (event === 'SIGNED_OUT') {
          if (sessionManagerRef.current) {
            sessionManagerRef.current.stop();
            sessionManagerRef.current = null;
          }
          clearSessionActivity();
          reinitialiserDureeInactivite();
          serverSessionIdRef.current = null;
          serverSessionRegistrationRef.current = null;
          setShowTimeoutWarning(false);
          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
            profileLoading: false,
            profileError: null,
          });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('[Auth] Token refreshed successfully, updating session');
          const currentState = stateRef.current;
          if (
            currentState.initialized
            && currentState.session?.user.id === session.user.id
          ) {
            // Le client Supabase a déjà mémorisé le jeton renouvelé. Ne pas le
            // recopier dans le contexte évite de rerendre tous les écrans au
            // retour d'onglet alors que l'identité n'a pas changé.
            return;
          }

          // Cas défensif d'un changement de principal pendant le bootstrap.
          setState(prev => ({
            ...prev,
            session,
            loading: false,
            initialized: true,
          }));
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('[Auth] User updated, refreshing profile');
          setState(prev => ({
            ...prev,
            session,
            profileLoading: !prev.user || prev.user.id !== session.user.id,
            profileError: null,
          }));
          let profile: UserProfile | null = null;
          try {
            profile = await fetchUserProfile(session.user.id);
          } catch (error) {
            console.error('[Auth] Profile fetch failed on USER_UPDATED event:', error);
          }
          const { profile: resolvedProfile, error } = resolveProfileResult(profile);
          setState(prev => ({
            ...prev,
            user: resolvedProfile
              ?? (prev.user?.id === session.user.id ? prev.user : null),
            session,
            loading: false,
            initialized: true,
            profileLoading: false,
            profileError: error,
          }));
        }
      }
    );

    return () => {
      console.log('[Auth] Component unmounting - cleaning up');
      mounted = false;
      subscription.unsubscribe();
      sessionManagerRef.current?.stop();
      sessionManagerRef.current = null;
    };
  }, []);

  const handleExtendSession = () => {
    console.log('[Auth] User extended session');
    if (sessionManagerRef.current) {
      sessionManagerRef.current.extendSession();
    }
    setShowTimeoutWarning(false);
  };

  const handleLogoutNow = async () => {
    console.log('[Auth] User chose to logout');
    setShowTimeoutWarning(false);
    await signOut();
  };

  const value: AuthContextType = {
    ...state,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionTimeoutWarning
        isOpen={showTimeoutWarning}
        remainingSeconds={warningRemainingSeconds}
        onExtend={handleExtendSession}
        onLogout={handleLogoutNow}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
