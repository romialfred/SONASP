import { supabase } from './supabase';

// Session only expires on explicit logout - no automatic timeout
// Keep token refresh active to maintain connection
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh token every 5 minutes

export class SessionManager {
  private lastActivityTime: number = Date.now();
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = true;

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
      if (!this.isActive) return;

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[SessionManager] Error getting session:', error);
          return;
        }

        if (session) {
          // Refresh the session token
          const { error: refreshError } = await supabase.auth.refreshSession();

          if (refreshError) {
            console.error('[SessionManager] Error refreshing session:', refreshError);
          } else {
            console.log('[SessionManager] Session token refreshed successfully');
          }
        }
      } catch (error) {
        console.error('[SessionManager] Token refresh error:', error);
      }
    }, TOKEN_REFRESH_INTERVAL);
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
