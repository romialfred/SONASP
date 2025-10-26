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
    console.log('[SessionManager] Relying on Supabase autoRefreshToken for token maintenance');
    this.updateActivity();
    // Removed manual token refresh - Supabase handles this automatically with autoRefreshToken: true
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

  // Token refresh is handled automatically by Supabase with autoRefreshToken: true
  // No manual refresh needed - this prevents conflicts and spurious SIGNED_OUT events

  public getInactivityDuration(): number {
    return Date.now() - this.lastActivityTime;
  }

  public extendSession() {
    console.log('[SessionManager] Session extended by user action');
    this.updateActivity();
    // Token refresh handled automatically by Supabase
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
