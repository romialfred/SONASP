import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Session, AuthChangeEvent, User as SupabaseUser } from '@supabase/supabase-js';
import { configureAuthPersistence, supabase } from '@/lib/supabase';
import { UserProfile, AuthState, UserRole } from '@/types/auth';
import { SessionManager } from '@/lib/sessionManager';
import { withTimeout, withRetry } from '@/lib/withTimeout';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';

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

const USER_ROLES: UserRole[] = ['owner', 'factory', 'airport', 'refinery', 'customer', 'management', 'admin'];
const OWNER_ACCOUNT_EMAILS = new Set(['romuald.tiegnan@gmail.com']);

const getTrustedAuthRole = (authUser: SupabaseUser): UserRole | null => {
  if (authUser.email && OWNER_ACCOUNT_EMAILS.has(authUser.email.toLowerCase())) {
    return 'owner';
  }
  const role = authUser.app_metadata?.role;
  return USER_ROLES.includes(role as UserRole) ? role as UserRole : null;
};

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
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [warningRemainingSeconds, setWarningRemainingSeconds] = useState(30);

  const resolveProfileResult = (
    profile: UserProfile | null,
    authUser?: SupabaseUser | null
  ): { profile: UserProfile | null; error: string | null } => {
    if (profile) {
      const trustedRole = authUser ? getTrustedAuthRole(authUser) : null;
      return {
        profile: trustedRole === 'owner' ? { ...profile, role: 'owner' } : profile,
        error: null,
      };
    }

    return {
      profile: null,
      error: 'Votre profil autorisé n’a pas pu être chargé. Réessayez ou contactez l’administrateur.',
    };
  };

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {

    return withRetry(
      async () => {
        // Fetch the user profile with timeout
        const { data: profile, error: profileError } = await withTimeout(
          supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single(),
          8000,
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
            5000,
            'Site-Assignments'
          );
          siteIds = assignments?.map((a: any) => a.site_id) || [];
        } catch (error) {
          console.warn('[Profile] Site assignments fetch failed (non-fatal):', error);
        }

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role,
          mining_company_id: profile.mining_company_id ?? null,
          site_ids: siteIds,
          is_active: profile.is_active,
          is_sales_approver: profile.is_sales_approver ?? false,
          two_factor_enabled: profile.two_factor_enabled,
          language: profile.language,
          email_notifications: profile.email_notifications,
          batch_notifications: profile.batch_notifications,
          approval_notifications: profile.approval_notifications,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        };
      },
      {
        maxRetries: 2,
        initialDelay: 1500,
        backoffMultiplier: 1.5,
        timeout: 8000,
        label: 'Profile-Fetch',
        shouldRetry: (error: any) => {
          // Don't retry on timeout or CORS errors
          if (error?.message?.includes('timeout')) return false;
          if (error?.message?.includes('CORS')) return false;
          // Retry on network errors
          return true;
        },
      }
    ).catch(error => {
      console.error('[Profile] All fetch attempts failed:', error);
      return null;
    });
  };

  const logSecurityEvent = async (
    userId: string | null,
    eventType: string,
    details?: any
  ) => {
    try {
      await supabase.rpc('log_security_event', {
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

  const closeRejectedSession = async () => {
    if (sessionManagerRef.current) {
      sessionManagerRef.current.stop();
      sessionManagerRef.current = null;
    }

    try {
      await supabase.auth.signOut();
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

  const signIn = async (
    email: string,
    password: string,
    options: { rememberMe?: boolean } = {},
  ) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      configureAuthPersistence(options.rememberMe ?? true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        await logSecurityEvent(null, 'login_failed', { email: normalizedEmail, error: error.message });
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

        await logSecurityEvent(data.user.id, 'login_success', { email: normalizedEmail });

        await supabase
          .from('user_profiles')
          .update({
            last_login_at: new Date().toISOString(),
            failed_login_attempts: 0,
          })
          .eq('id', data.user.id);
      }

      return {};
    } catch (error: any) {
      return { error: error.message || 'An unexpected error occurred' };
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

      // Now call Supabase signOut
      console.log('[Auth] Calling supabase.auth.signOut()');
      await supabase.auth.signOut();

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
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { error: error.message };
      }

      await logSecurityEvent(null, 'password_reset_requested', { email });
      return {};
    } catch (error: any) {
      return { error: error.message || 'An unexpected error occurred' };
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
      user: null,
      profileLoading: true,
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

      const { profile: resolvedProfile, error } = resolveProfileResult(profile, user);

      setState(prev => ({
        ...prev,
        user: resolvedProfile,
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

          // Start session manager immediately
          if (!sessionManagerRef.current) {
            console.log('[Auth] Starting session manager');
            sessionManagerRef.current = new SessionManager();
            sessionManagerRef.current.setOnWarning(() => {
              console.log('[Auth] Session timeout warning triggered');
              setShowTimeoutWarning(true);
              setWarningRemainingSeconds(30); // 30 seconds remaining
            });
            sessionManagerRef.current.setOnTimeout(() => {
              console.log('[Auth] Session timeout - forcing logout');
              setShowTimeoutWarning(false);
            });
            sessionManagerRef.current.start();
          }

          console.log('[Auth] Fetching authoritative profile...');
          void (async () => {
            try {
              const profile = await fetchUserProfile(session.user.id);
              if (!mounted) return;
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession?.user.id !== session.user.id) return;
              const { profile: resolvedProfile, error } = resolveProfileResult(profile, session.user);
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
          const isSameInitializedUser =
            currentState.initialized
            && currentState.session?.user.id === session.user.id
            && currentState.user?.id === session.user.id;

          if (isSameInitializedUser) {
            // Une reprise d'onglet ou une session rafraîchie ne doit jamais
            // remettre l'application en écran d'attente ni relancer le profil.
            setState(prev => ({
              ...prev,
              session,
              loading: false,
              initialized: true,
            }));
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

          if (!sessionManagerRef.current) {
            console.log('[Auth] Starting session manager');
            sessionManagerRef.current = new SessionManager();
            sessionManagerRef.current.setOnWarning(() => {
              console.log('[Auth] Session timeout warning triggered');
              setShowTimeoutWarning(true);
              setWarningRemainingSeconds(30); // 30 seconds remaining
            });
            sessionManagerRef.current.setOnTimeout(() => {
              console.log('[Auth] Session timeout - forcing logout');
              setShowTimeoutWarning(false);
            });
            sessionManagerRef.current.start();
          }

          console.log('[Auth] Fetching authoritative profile...');
          void (async () => {
            try {
              const profile = await fetchUserProfile(session.user.id);
              if (!mounted) return;
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession?.user.id !== session.user.id) return;
              const { profile: resolvedProfile, error } = resolveProfileResult(profile, session.user);
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
          console.log('[Auth] SIGNED_OUT event detected');
          console.log('[Auth] SessionManager active?', !!sessionManagerRef.current);

          // If session manager is active, this is likely a false SIGNED_OUT during token refresh
          // The session manager only runs when user is logged in
          if (sessionManagerRef.current) {
            console.log('[Auth] FALSE ALARM - SessionManager is active, ignoring spurious SIGNED_OUT event');
            console.log('[Auth] Token refresh may be in progress, keeping session active');
            return; // Ignore this event completely - don't check session or update state
          }

          // Only process logout if session manager is not active (real logout)
          console.log('[Auth] Confirmed logout - no active session manager');

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
          // Conserver intégralement l'état du profil : un rafraîchissement de
          // jeton est transparent pour l'écran actuellement consulté.
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
            user: null,
            profileLoading: true,
            profileError: null,
          }));
          let profile: UserProfile | null = null;
          try {
            profile = await fetchUserProfile(session.user.id);
          } catch (error) {
            console.error('[Auth] Profile fetch failed on USER_UPDATED event:', error);
          }
          const { profile: resolvedProfile, error } = resolveProfileResult(profile, session.user);
          setState(prev => ({
            ...prev,
            user: resolvedProfile,
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
      // DON'T stop session manager on unmount - it should persist
      // Only stop on explicit logout
      console.log('[Auth] Cleanup complete (session manager kept alive)');
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
