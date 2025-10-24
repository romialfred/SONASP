import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, AuthState } from '@/types/auth';

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

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          user_site_assignments!inner(
            site_id,
            is_primary
          )
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        const siteIds = profile.user_site_assignments?.map((assignment: any) => assignment.site_id) || [];

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
      }

      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
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
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id);
            setState({
              user: profile,
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
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
          });
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setState({
            user: profile,
            session,
            loading: false,
            initialized: true,
          });
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
          });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
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
      mounted = false;
      subscription.unsubscribe();
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
