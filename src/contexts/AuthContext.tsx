import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Session, AuthChangeEvent, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, AuthState, UserRole } from '@/types/auth';
import { SessionManager } from '@/lib/sessionManager';
import { withTimeout, withRetry } from '@/lib/withTimeout';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const sessionManagerRef = useRef<SessionManager | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [warningRemainingSeconds, setWarningRemainingSeconds] = useState(30);

  const buildFallbackProfile = (authUser: SupabaseUser): UserProfile => {
    const metadata = authUser.user_metadata || {};
    const now = new Date().toISOString();
    // SÉCURITÉ (audit V4) : repli sur le rôle le MOINS privilégié, jamais 'management'.
    // Un profil non résolu ne doit jamais déverrouiller les fonctions d'administration.
    const resolvedRole = (metadata.role as UserRole | undefined) || 'customer';
    const rawSiteIds = Array.isArray(metadata.site_ids)
      ? (metadata.site_ids as string[])
      : metadata.site_id
      ? [metadata.site_id as string]
      : [];

    return {
      id: authUser.id,
      email: authUser.email || 'user@example.com',
      full_name: (metadata.full_name as string | undefined) || authUser.email || 'GoldShipper User',
      phone: (metadata.phone as string | undefined) || null,
      role: resolvedRole,
      site_ids: rawSiteIds,
      is_active: metadata.is_active !== undefined ? Boolean(metadata.is_active) : true,
      two_factor_enabled:
        metadata.two_factor_enabled !== undefined ? Boolean(metadata.two_factor_enabled) : false,
      language: (metadata.language as string | undefined) || null,
      email_notifications:
        metadata.email_notifications !== undefined ? Boolean(metadata.email_notifications) : true,
      batch_notifications:
        metadata.batch_notifications !== undefined ? Boolean(metadata.batch_notifications) : true,
      approval_notifications:
        metadata.approval_notifications !== undefined
          ? Boolean(metadata.approval_notifications)
          : true,
      created_at: authUser.created_at || now,
      updated_at: authUser.updated_at || authUser.last_sign_in_at || now,
    };
  };

  const resolveProfileResult = (
    profile: UserProfile | null,
    authUser?: SupabaseUser | null
  ): { profile: UserProfile | null; error: string | null } => {
    if (profile) {
      return { profile, error: null };
    }

    if (authUser) {
      console.warn('[Auth] Falling back to authentication metadata for user profile');
      return {
        profile: buildFallbackProfile(authUser),
        // A usable fallback is a degraded data source, not an actionable user error.
        error: null,
      };
    }

    return {
      profile: null,
      error: 'Unable to load user profile. Please try again.',
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

          // Missing profile - try to create it
          if (isMissingUserProfileError(profileError)) {
            console.warn('[Profile] Not found, attempting to create minimal profile');
            return await createMinimalProfile(userId);
          }

          throw profileError;
        }

        if (!profile) {
          console.warn('[Profile] Empty result, creating minimal profile');
          return await createMinimalProfile(userId);
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
          site_ids: siteIds,
          is_active: profile.is_active,
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

  const createMinimalProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log('[Profile] Creating minimal profile for user:', userId);

      const { data: user } = await supabase.auth.getUser();
      const email = user?.user?.email || 'user@example.com';

      const { data: created, error: insertError } = await withTimeout(
        supabase
          .from('user_profiles')
          .insert([{
            id: userId,
            email: email,
            full_name: email.split('@')[0],
            // SÉCURITÉ (audit V4) : rôle minimal par défaut, jamais 'management'.
            role: 'customer',
            is_active: true,
          }])
          .select()
          .single(),
        8000,
        'Profile-Create'
      );

      if (insertError) {
        console.error('[Profile] Failed to create profile:', insertError);
        throw insertError;
      }

      console.log('[Profile] Minimal profile created successfully');
      return {
        id: created.id,
        email: created.email,
        full_name: created.full_name,
        phone: null,
        role: created.role,
        site_ids: [],
        is_active: created.is_active,
        two_factor_enabled: false,
        language: null,
        email_notifications: true,
        batch_notifications: true,
        approval_notifications: true,
        created_at: created.created_at,
        updated_at: created.updated_at,
      };
    } catch (error) {
      console.error('[Profile] Failed to create minimal profile:', error);
      throw error;
    }
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

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await logSecurityEvent(null, 'login_failed', { email, error: error.message });
        return { error: error.message };
      }

      if (data.user) {
        await logSecurityEvent(data.user.id, 'login_success', { email });

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

          // Immediately set the session with fallback profile - don't block
          const fallbackProfile = buildFallbackProfile(session.user);
          console.log('[Auth] Setting fallback profile immediately to unblock app');

          setState(prev => ({
            ...prev,
            user: fallbackProfile,
            session,
            loading: false,
            initialized: true,
            profileLoading: false, // Don't block on profile loading
            profileError: null, // Clear any previous errors
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

          // Fetch real profile in the background
          console.log('[Auth] Fetching full profile in background...');
          void (async () => {
            try {
              const profile = await fetchUserProfile(session.user.id);

              if (mounted && profile) {
                console.log('[Auth] Background profile fetch succeeded, updating');
                setState(prev => ({
                  ...prev,
                  user: profile,
                  profileError: null,
                }));
              } else if (mounted && !profile) {
                console.warn('[Auth] Background profile fetch failed, keeping fallback');
              }
            } catch (error) {
              console.error('[Auth] Background profile fetch error:', error);
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

          // Immediately set fallback profile - don't block
          const fallbackProfile = buildFallbackProfile(session.user);
          console.log('[Auth] Setting fallback profile immediately');

          setState(prev => ({
            ...prev,
            user: fallbackProfile,
            session,
            loading: false,
            initialized: true,
            profileLoading: false,
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

          // Fetch real profile in background
          console.log('[Auth] Fetching full profile in background...');
          (async () => {
            try {
              const profile = await fetchUserProfile(session.user.id);
              if (mounted && profile) {
                console.log('[Auth] Background profile loaded');
                setState(prev => ({
                  ...prev,
                  user: profile,
                  profileError: null,
                }));
              } else if (mounted) {
                console.warn('[Auth] Background profile fetch failed, keeping fallback');
              }
            } catch (error) {
              console.error('[Auth] Background profile fetch error:', error);
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
          // Keep existing user profile to avoid unnecessary refetch
          setState(prev => ({
            ...prev,
            session,
            loading: false,
            initialized: true,
            profileLoading: false,
          }));
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('[Auth] User updated, refreshing profile');
          setState(prev => ({
            ...prev,
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
