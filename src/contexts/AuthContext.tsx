import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, AuthState } from '@/types/auth';
import { SessionManager } from '@/lib/sessionManager';
import { DEMO_MODE } from '@/lib/demoSeed';

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

  const createDemoUserProfile = (userId: string, email: string): UserProfile => {
    return {
      id: userId,
      email: email,
      full_name: 'Demo User',
      phone: null,
      role: 'management',
      site_ids: [],
      is_active: true,
      two_factor_enabled: false,
      language: 'en',
      email_notifications: true,
      batch_notifications: true,
      approval_notifications: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const fetchUserProfile = async (userId: string, retryCount = 0): Promise<UserProfile | null> => {
    const MAX_RETRIES = 2;
    const FETCH_TIMEOUT = 5000;

    // In demo mode, immediately return demo user without trying database
    if (DEMO_MODE) {
      console.warn('Demo mode: Skipping database profile fetch, using demo user');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          return createDemoUserProfile(userId, user.email);
        }
      } catch (error) {
        console.error('Error getting auth user for demo profile:', error);
      }
      return null;
    }

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

          // In demo mode, return a demo user instead of throwing
          if (DEMO_MODE) {
            console.warn('Demo mode: Using demo user profile due to RLS recursion error');
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              return createDemoUserProfile(userId, user.email);
            }
          }

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

          // After all retries failed, use demo profile if in demo mode
          if (DEMO_MODE) {
            console.warn('Demo mode: Using demo user profile after retry exhaustion');
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
              return createDemoUserProfile(userId, user.email);
            }
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

        // Profile still missing after retries
        console.error('Profile missing after retries. Trigger may have failed.');

        // In demo mode, return a demo user profile if database fetch fails
        if (DEMO_MODE) {
          console.warn('Demo mode: Using demo user profile due to missing profile');
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            return createDemoUserProfile(userId, user.email);
          }
        }

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
        error?.message?.includes('network');

      if (retryCount < MAX_RETRIES && isRetryable) {
        console.log(`Retrying profile fetch (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchUserProfile(userId, retryCount + 1);
      }

      // In demo mode, return a demo user profile if database fetch fails
      if (DEMO_MODE) {
        console.warn('Demo mode: Using demo user profile due to database error');
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          return createDemoUserProfile(userId, user.email);
        }
      }

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
      if (state.user) {
        await logSecurityEvent(state.user.id, 'logout', {});
      }

      if (sessionManagerRef.current) {
        sessionManagerRef.current.stop();
        sessionManagerRef.current = null;
      }

      await supabase.auth.signOut();
      setState({
        user: null,
        session: null,
        loading: false,
        initialized: true,
      });
    } catch (error) {
      console.error('Error signing out:', error);
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
              if (profile) {
                console.log('[Auth] Profile fetched successfully, updating state');
                setState({
                  user: profile,
                  session,
                  loading: false,
                  initialized: true,
                });
              } else {
                console.warn('[Auth] Profile fetch returned null');
                // In demo mode with session but no profile, create demo user
                if (DEMO_MODE && session.user.email) {
                  console.warn('[Auth] Demo mode: Creating demo user for active session');
                  const demoProfile = createDemoUserProfile(session.user.id, session.user.email);
                  setState({
                    user: demoProfile,
                    session,
                    loading: false,
                    initialized: true,
                  });
                } else {
                  setState({
                    user: null,
                    session: null,
                    loading: false,
                    initialized: true,
                  });
                }
              }
            }
          } catch (profileError) {
            console.error('[Auth] Profile fetch failed during initialization:', profileError);

            if (mounted) {
              // In demo mode, provide demo user even on error
              if (DEMO_MODE && session?.user?.email) {
                console.warn('[Auth] Demo mode: Using demo user after initialization error');
                const demoProfile = createDemoUserProfile(session.user.id, session.user.email);
                setState({
                  user: demoProfile,
                  session,
                  loading: false,
                  initialized: true,
                });
              } else {
                console.log('[Auth] Setting initialized=true despite profile error');
                setState({
                  user: null,
                  session: null,
                  loading: false,
                  initialized: true,
                });
              }
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

    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.error('[Auth] Initialization timeout - forcing initialized state');
        setState({
          user: null,
          session: null,
          loading: false,
          initialized: true,
        });
      }
    }, 10000);

    initializeAuth().finally(() => {
      clearTimeout(timeoutId);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('[Auth] Auth state changed:', event, session ? 'with session' : 'no session');

        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[Auth] User signed in, fetching profile');
          try {
            const profile = await fetchUserProfile(session.user.id);

            // Use demo profile if fetch returned null in demo mode
            const userProfile = profile || (DEMO_MODE && session.user.email
              ? createDemoUserProfile(session.user.id, session.user.email)
              : null);

            setState({
              user: userProfile,
              session,
              loading: false,
              initialized: true,
            });

            if (!sessionManagerRef.current && userProfile) {
              console.log('[Auth] Starting session manager');
              sessionManagerRef.current = new SessionManager();
              sessionManagerRef.current.start();
            }
          } catch (error) {
            console.error('[Auth] Error during sign in profile fetch:', error);

            // In demo mode, provide demo user even on error
            if (DEMO_MODE && session.user.email) {
              const demoProfile = createDemoUserProfile(session.user.id, session.user.email);
              setState({
                user: demoProfile,
                session,
                loading: false,
                initialized: true,
              });
            } else {
              setState({
                user: null,
                session: null,
                loading: false,
                initialized: true,
              });
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[Auth] SIGNED_OUT event detected');

          // Only process SIGNED_OUT if it's an explicit logout
          // Don't logout on token expiry - let auto-refresh handle it
          if (sessionManagerRef.current) {
            console.log('[Auth] Explicit logout - stopping session manager');
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
          try {
            const profile = await fetchUserProfile(session.user.id);

            // Use demo profile if fetch returned null in demo mode
            const userProfile = profile || (DEMO_MODE && session.user.email
              ? createDemoUserProfile(session.user.id, session.user.email)
              : null);

            setState({
              user: userProfile,
              session,
              loading: false,
              initialized: true,
            });
          } catch (error) {
            console.error('[Auth] Error refreshing profile after user update:', error);

            // In demo mode, provide demo user even on error
            if (DEMO_MODE && session.user.email) {
              const demoProfile = createDemoUserProfile(session.user.id, session.user.email);
              setState({
                user: demoProfile,
                session,
                loading: false,
                initialized: true,
              });
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (sessionManagerRef.current) {
        sessionManagerRef.current.stop();
      }
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
