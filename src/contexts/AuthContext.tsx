import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, AuthState } from '@/types/auth';
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
  });
  const sessionManagerRef = useRef<SessionManager | null>(null);

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
      });
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if signOut fails, clear local state
      setState({
        user: null,
        session: null,
        loading: false,
        initialized: true,
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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const profile = await fetchUserProfile(user.id);
      setState((prev) => ({ ...prev, user: profile }));
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[Auth] Starting auth initialization...');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[Auth] Session error:', sessionError);
        }

        if (!mounted) {
          console.log('[Auth] Component unmounted, skipping state update');
          return;
        }

        if (session?.user) {
          console.log('[Auth] Active session found, fetching profile for:', session.user.id);

          try {
            const profile = await fetchUserProfile(session.user.id);

            if (mounted) {
              console.log('[Auth] Profile fetched successfully, updating state');
              setState({
                user: profile,
                session,
                loading: false,
                initialized: true,
              });

              // Start session manager if not already started
              if (!sessionManagerRef.current) {
                console.log('[Auth] Starting session manager on init');
                sessionManagerRef.current = new SessionManager();
                sessionManagerRef.current.start();
              }
            }
          } catch (profileError) {
            console.error('[Auth] Profile fetch failed during initialization:', profileError);

            if (mounted) {
              console.log('[Auth] Keeping session active despite profile error');
              // Keep the session but mark profile as null
              setState({
                user: null,
                session, // Keep the session!
                loading: false,
                initialized: true,
              });
            }
          }
        } else {
          console.log('[Auth] No active session, setting unauthenticated state');
          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
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
          const profile = await fetchUserProfile(session.user.id);
          setState({
            user: profile,
            session,
            loading: false,
            initialized: true,
          });

          if (!sessionManagerRef.current) {
            console.log('[Auth] Starting session manager');
            sessionManagerRef.current = new SessionManager();
            sessionManagerRef.current.start();
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[Auth] SIGNED_OUT event detected');
          console.log('[Auth] SessionManager active?', !!sessionManagerRef.current);

          // CRITICAL: Check if session is actually gone
          const { data: { session: currentSession } } = await supabase.auth.getSession();

          if (currentSession && sessionManagerRef.current) {
            // Session still exists and manager is active - this is a false SIGNED_OUT
            console.log('[Auth] FALSE ALARM - Session still valid, ignoring SIGNED_OUT');
            console.log('[Auth] Restoring state with current session');

            // Restore the state with current session
            const profile = await fetchUserProfile(currentSession.user.id);
            setState({
              user: profile,
              session: currentSession,
              loading: false,
              initialized: true,
            });
            return; // Don't process logout
          }

          // If we reach here, it's a real logout
          console.log('[Auth] Confirmed logout - clearing state');

          if (sessionManagerRef.current) {
            sessionManagerRef.current.stop();
            sessionManagerRef.current = null;
          }

          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
          });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('[Auth] Token refreshed successfully, updating session');
          // Keep existing user profile to avoid unnecessary refetch
          setState(prev => ({
            ...prev,
            session,
            loading: false,
            initialized: true,
          }));
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('[Auth] User updated, refreshing profile');
          const profile = await fetchUserProfile(session.user.id);
          setState({
            user: profile,
            session,
            loading: false,
            initialized: true,
          });
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
