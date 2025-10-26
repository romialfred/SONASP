import { supabase } from './supabase';

// Session only expires on explicit logout - no automatic timeout
// Keep token refresh active to maintain connection
// Supabase JWT tokens expire after 1 hour by default
// Refresh every 50 minutes to ensure token never expires (well before the 60 min expiry)
const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000; // Refresh token every 50 minutes

export class SessionManager {
  private lastActivityTime: number = Date.now();
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = true;
  private isRefreshing: boolean = false;

  constructor() {
    this.setupActivityListeners();
  }

  private setupActivityListeners() {
    // Listen to user activity to update last activity time
    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'mousemove',
      'keypress',
      'touchmove'
    ];

    events.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });

    // Listen to visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateActivity();
      }
    });

    // Listen to window focus
    window.addEventListener('focus', () => {
      this.updateActivity();
    });
  }

  public start() {
    console.log('[SessionManager] Starting session management - NO AUTO LOGOUT');
    this.updateActivity();
    this.startTokenRefresh();
  }

  public stop() {
    console.log('[SessionManager] Stopping session management');
    this.isActive = false;
    if (this.tokenRefreshTimer) clearInterval(this.tokenRefreshTimer);
  }

  private updateActivity() {
    if (!this.isActive) return;
    this.lastActivityTime = Date.now();
  }

  private startTokenRefresh() {
    // Periodically refresh the auth token to keep session alive indefinitely
    this.tokenRefreshTimer = setInterval(async () => {
      if (!this.isActive || this.isRefreshing) return;

      this.isRefreshing = true;

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[SessionManager] Error getting session:', error);
          this.isRefreshing = false;
          // Don't logout on error, just log and retry on next interval
          return;
        }

        if (!session) {
          console.warn('[SessionManager] No active session found');
          this.isRefreshing = false;
          return;
        }

        // Check if token is still valid (has more than 5 minutes left)
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const expiresInSeconds = expiresAt - Math.floor(Date.now() / 1000);
          console.log('[SessionManager] Token expires in', Math.floor(expiresInSeconds / 60), 'minutes');

          // If token expires in less than 10 minutes, refresh immediately
          if (expiresInSeconds < 600) {
            console.warn('[SessionManager] Token expiring soon, refreshing immediately');
          }
        }

        // Refresh the session token
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          console.error('[SessionManager] Error refreshing session:', refreshError);
          // Don't logout on refresh error, Supabase will retry automatically
          // The autoRefreshToken setting in supabase.ts handles this
        } else if (refreshData.session) {
          console.log('[SessionManager] Session token refreshed successfully');
          const newExpiresAt = refreshData.session.expires_at;
          if (newExpiresAt) {
            const newExpiresInSeconds = newExpiresAt - Math.floor(Date.now() / 1000);
            console.log('[SessionManager] New token expires in', Math.floor(newExpiresInSeconds / 60), 'minutes');
          }
        }
      } catch (error) {
        console.error('[SessionManager] Token refresh error:', error);
        // Don't logout on error, just log and continue
      } finally {
        this.isRefreshing = false;
      }
    }, TOKEN_REFRESH_INTERVAL);

    // Also do an immediate refresh on start to ensure token is fresh
    setTimeout(async () => {
      if (!this.isActive || this.isRefreshing) return;
      this.isRefreshing = true;

      try {
        console.log('[SessionManager] Performing initial token refresh');
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('[SessionManager] Initial refresh error:', error);
        } else {
          console.log('[SessionManager] Initial token refresh successful');
        }
      } catch (error) {
        console.error('[SessionManager] Initial refresh exception:', error);
      } finally {
        this.isRefreshing = false;
      }
    }, 5000); // Wait 5 seconds after start before first refresh
  }

  public getInactivityDuration(): number {
    return Date.now() - this.lastActivityTime;
  }

  public extendSession() {
    console.log('[SessionManager] Session extended by user action');
    this.updateActivity();

    // Also refresh the token when user explicitly extends
    supabase.auth.refreshSession().catch(error => {
      console.error('[SessionManager] Error refreshing on extend:', error);
    });
  }
}

export async function createSessionRecord(userId: string, sessionToken: string) {
  try {
    // Session records are maintained but don't enforce timeout
    const expiresAt = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year

    await supabase.from('user_sessions').insert({
      user_id: userId,
      session_token: sessionToken,
      ip_address: null,
      user_agent: navigator.userAgent,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to create session record:', error);
  }
}

export async function invalidateSession(sessionToken: string) {
  try {
    await supabase
      .from('user_sessions')
      .delete()
      .eq('session_token', sessionToken);
  } catch (error) {
    console.error('Failed to invalidate session:', error);
  }
}

export async function cleanupExpiredSessions() {
  try {
    await supabase
      .from('user_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
}
