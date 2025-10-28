import { supabase } from './supabase';

// Session timeout configuration
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE_TIMEOUT = 60 * 1000; // Show warning 60 seconds before timeout
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh token every 5 minutes

export type SessionWarningCallback = () => void;
export type SessionTimeoutCallback = () => void;

export class SessionManager {
  private lastActivityTime: number = Date.now();
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private inactivityCheckTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = true;
  private isRefreshing: boolean = false;
  private warningShown: boolean = false;

  private onWarning: SessionWarningCallback | null = null;
  private onTimeout: SessionTimeoutCallback | null = null;

  constructor() {
    this.setupActivityListeners();
  }

  private setupActivityListeners() {
    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'mousemove',
      'keypress',
      'touchmove',
      'touchend',
    ];

    events.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateActivity();
      }
    });

    window.addEventListener('focus', () => {
      this.updateActivity();
    });
  }

  public start() {
    console.log('[SessionManager] Starting with 10-minute inactivity timeout');
    this.updateActivity();
    this.startTokenRefresh();
    this.startInactivityCheck();
  }

  public stop() {
    console.log('[SessionManager] Stopping session management');
    this.isActive = false;
    if (this.tokenRefreshTimer) clearInterval(this.tokenRefreshTimer);
    if (this.inactivityCheckTimer) clearInterval(this.inactivityCheckTimer);
  }

  private updateActivity() {
    if (!this.isActive) return;

    const previousActivityTime = this.lastActivityTime;
    this.lastActivityTime = Date.now();

    // Reset warning if user becomes active again
    if (this.warningShown) {
      console.log('[SessionManager] User activity detected - hiding warning');
      this.warningShown = false;
    }
  }

  private startTokenRefresh() {
    this.tokenRefreshTimer = setInterval(async () => {
      if (!this.isActive || this.isRefreshing) return;

      try {
        this.isRefreshing = true;
        const { data: { session }, error } = await supabase.auth.refreshSession();

        if (error) {
          console.error('[SessionManager] Token refresh failed:', error);
          this.handleTimeout();
        } else {
          console.log('[SessionManager] Token refreshed successfully');
        }
      } catch (error) {
        console.error('[SessionManager] Token refresh error:', error);
      } finally {
        this.isRefreshing = false;
      }
    }, TOKEN_REFRESH_INTERVAL);
  }

  private startInactivityCheck() {
    this.inactivityCheckTimer = setInterval(() => {
      if (!this.isActive) return;

      const inactivityDuration = this.getInactivityDuration();

      // Check if we should show warning (60 seconds before timeout)
      if (inactivityDuration >= INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT && !this.warningShown) {
        console.log('[SessionManager] Showing inactivity warning (60 seconds before timeout)');
        this.warningShown = true;
        if (this.onWarning) {
          this.onWarning();
        }
      }

      // Check if session should timeout (10 minutes)
      if (inactivityDuration >= INACTIVITY_TIMEOUT) {
        console.log('[SessionManager] Session timeout due to inactivity (10 minutes)');
        this.handleTimeout();
      }
    }, 1000); // Check every second for accuracy
  }

  private async handleTimeout() {
    this.stop();
    if (this.onTimeout) {
      this.onTimeout();
    }
    await this.logout();
  }

  private async logout() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await invalidateSession(session.access_token);
      }
      await supabase.auth.signOut();
      console.log('[SessionManager] User logged out due to timeout');
    } catch (error) {
      console.error('[SessionManager] Logout error:', error);
    }
  }

  public getInactivityDuration(): number {
    return Date.now() - this.lastActivityTime;
  }

  public getRemainingTime(): number {
    const remaining = INACTIVITY_TIMEOUT - this.getInactivityDuration();
    return Math.max(0, remaining);
  }

  public getTimeUntilWarning(): number {
    const remaining = WARNING_BEFORE_TIMEOUT - this.getInactivityDuration();
    return Math.max(0, remaining);
  }

  public extendSession() {
    console.log('[SessionManager] Session extended by user action');
    this.updateActivity();
    this.warningShown = false;
  }

  public setOnWarning(callback: SessionWarningCallback) {
    this.onWarning = callback;
  }

  public setOnTimeout(callback: SessionTimeoutCallback) {
    this.onTimeout = callback;
  }
}

export async function createSessionRecord(userId: string, sessionToken: string) {
  try {
    const expiresAt = new Date(Date.now() + INACTIVITY_TIMEOUT);

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

export async function invalidateAllSessions() {
  try {
    console.log('[SessionManager] Invalidating all sessions (deployment cleanup)');
    await supabase.from('user_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('[SessionManager] All sessions invalidated');
  } catch (error) {
    console.error('Failed to invalidate all sessions:', error);
  }
}
