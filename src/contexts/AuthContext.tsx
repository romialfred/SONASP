import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Session, AuthChangeEvent, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, AuthState, UserRole } from '@/types/auth';
import { SessionManager } from '@/lib/sessionManager';

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const buildFallbackProfile = (authUser: SupabaseUser): UserProfile => {
    const metadata = authUser.user_metadata || {};
    const now = new Date().toISOString();
    const resolvedRole = (metadata.role as UserRole | undefined) || 'management';
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
        error: 'Unable to load full user profile. Using account defaults instead.',
      };
    }

    return {
      profile: null,
      error: 'Unable to load user profile. Please try again.',
    };
  };

  const fetchUserProfile = async (userId: string, retryCount = 0): Promise<UserProfile | null> => {
    const MAX_RETRIES = 3;
    const FETCH_TIMEOUT = 10000;

    const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), timeoutMs)
        ),
      ]);
    };

    try {
      // First, fetch the user profile with timeout
      const { data: profile, error: profileError } = await fetchWithTimeout(
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        FETCH_TIMEOUT
      ) as any;

      if (profileError) {
        console.error('Profile fetch error:', profileError);

        // Check for infinite recursion error (42P17)
        if (profileError.code === '42P17') {
          console.error('CRITICAL: Infinite recursion detected in RLS policies. This should not happen after migration.');
          throw new Error('Database configuration error. Please contact support.');
        }

        // Check for missing profile (PGRST116 or null data)
        if (profileError.code === 'PGRST116' || profileError.message?.includes('no rows')) {
          console.warn('Profile not found for user:', userId, '- attempting retry');

          if (retryCount < MAX_RETRIES) {
            // Wait briefly then retry (profile might be created by trigger)
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return fetchUserProfile(userId, retryCount + 1);
          }
        }

        throw profileError;
      }

      if (!profile) {
        console.warn('No profile found for user:', userId);

        // Retry if this is the first attempt
        if (retryCount < MAX_RETRIES) {
          console.log('Retrying profile fetch in case trigger is still processing...');
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return fetchUserProfile(userId, retryCount + 1);
        }

        // Profile still missing after retries - this shouldn't happen with trigger
        console.error('Profile missing after retries. Trigger may have failed.');
        return null;
      }

      // Then fetch site assignments separately with timeout
      const { data: assignments, error: assignmentError } = await fetchWithTimeout(
        supabase
          .from('user_site_assignments')
          .select('site_id, is_primary')
          .eq('user_id', userId),
        FETCH_TIMEOUT
      ) as any;

      if (assignmentError) {
        console.warn('Site assignment fetch error (non-fatal):', assignmentError);
      }

      const siteIds = assignments?.map((assignment: any) => assignment.site_id) || [];

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
    } catch (error: any) {
      console.error('Error fetching user profile:', error);

      // If we still have retries and it's a timeout or 500 error, retry
      const isRetryable =
        error?.message?.includes('500') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('network') ||
        error?.message?.includes('fetch');

      if (retryCount < MAX_RETRIES && isRetryable) {
        console.log(`Retrying profile fetch (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return fetchUserProfile(userId, retryCount + 1);
      }

      console.error('Profile fetch failed after all retries. User will have limited access.');
      return null;
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
          console.log('[Auth] Active session found, fetching profile for:', session.user.id);

          setState(prev => ({
            ...prev,
            profileLoading: true,
            profileError: null,
          }));

          let profile: UserProfile | null = null;

          try {
            profile = await fetchUserProfile(session.user.id);
          } catch (profileError) {
            console.error('[Auth] Profile fetch failed during initialization:', profileError);
          }

          if (mounted) {
            const { profile: resolvedProfile, error } = resolveProfileResult(profile, session.user);

            console.log('[Auth] Profile state resolved, updating state');
            setState(prev => ({
              ...prev,
              user: resolvedProfile,
              session,
              loading: false,
              initialized: true,
              profileLoading: false,
              profileError: error,
            }));

            if (resolvedProfile && !sessionManagerRef.current) {
              console.log('[Auth] Starting session manager on init');
              sessionManagerRef.current = new SessionManager();
              sessionManagerRef.current.start();
            }
          }
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

    // Timeout only to prevent infinite loading - don't clear session
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.error('[Auth] Initialization timeout - setting initialized flag only');
        setState(prev => ({
          ...prev,
          loading: false,
          initialized: true,
          profileLoading: false,
          profileError: prev.profileError,
        }));
      }
    }, 30000); // Increased to 30 seconds

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
          console.log('[Auth] User signed in, fetching profile');
          setState(prev => ({
            ...prev,
            profileLoading: true,
            profileError: null,
          }));

          let profile: UserProfile | null = null;

          try {
            profile = await fetchUserProfile(session.user.id);
          } catch (error) {
            console.error('[Auth] Profile fetch failed on SIGNED_IN event:', error);
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

          if (resolvedProfile && !sessionManagerRef.current) {
            console.log('[Auth] Starting session manager');
            sessionManagerRef.current = new SessionManager();
            sessionManagerRef.current.start();
          }
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
