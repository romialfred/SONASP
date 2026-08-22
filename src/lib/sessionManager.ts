import { supabase } from './supabase';

// Session timeout configuration
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000; // Show warning 2 minutes before timeout
const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh token every 10 minutes

export type SessionWarningCallback = () => void;
export type SessionTimeoutCallback = () => void;

export class SessionManager {
  private lastActivityTime: number = Date.now();
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private inactivityCheckTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = true;
  private isRefreshing: boolean = false;
  private warningShown: boolean = false;
  private consecutiveRefreshFailures: number = 0;
  private maxConsecutiveFailures: number = 3;

  private onWarning: SessionWarningCallback | null = null;
  private onTimeout: SessionTimeoutCallback | null = null;

  private readonly activityEvents = [
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
  private listenersAttached = false;
  private readonly handleActivity = () => this.updateActivity();
  private readonly handleVisibilityChange = () => {
    if (!document.hidden) this.updateActivity();
  };
  private readonly handleFocus = () => this.updateActivity();

  constructor() {}

  private setupActivityListeners() {
    if (this.listenersAttached) return;
    this.activityEvents.forEach(event => {
      document.addEventListener(event, this.handleActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.handleFocus);
    this.listenersAttached = true;
  }

  private removeActivityListeners() {
    if (!this.listenersAttached) return;
    this.activityEvents.forEach(event => {
      document.removeEventListener(event, this.handleActivity);
    });
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleFocus);
    this.listenersAttached = false;
  }

  public start() {
    console.log('[SessionManager] Starting with 30-minute inactivity timeout');
    this.isActive = true;
    this.setupActivityListeners();
    this.updateActivity();
    this.startTokenRefresh();
    this.startInactivityCheck();
  }

  public stop() {
    console.log('[SessionManager] Stopping session management');
    this.isActive = false;
    if (this.tokenRefreshTimer) clearInterval(this.tokenRefreshTimer);
    if (this.inactivityCheckTimer) clearInterval(this.inactivityCheckTimer);
    this.tokenRefreshTimer = null;
    this.inactivityCheckTimer = null;
    this.removeActivityListeners();
  }

  private updateActivity() {
    if (!this.isActive) return;

    this.lastActivityTime = Date.now();

    // Reset warning if user becomes active again
    if (this.warningShown) {
      console.log('[SessionManager] User activity detected - hiding warning');
      this.warningShown = false;
    }

    // Reset refresh failure counter on user activity
    if (this.consecutiveRefreshFailures > 0) {
      console.log('[SessionManager] Resetting refresh failure counter due to user activity');
      this.consecutiveRefreshFailures = 0;
    }
  }

  private startTokenRefresh() {
    this.tokenRefreshTimer = setInterval(async () => {
      if (!this.isActive || this.isRefreshing) return;

      try {
        this.isRefreshing = true;
        const { data: { session }, error } = await supabase.auth.refreshSession();

        if (error) {
          this.consecutiveRefreshFailures++;
          console.error(`[SessionManager] Token refresh failed (${this.consecutiveRefreshFailures}/${this.maxConsecutiveFailures}):`, error.message);

          // Only logout after multiple consecutive failures
          if (this.consecutiveRefreshFailures >= this.maxConsecutiveFailures) {
            console.error('[SessionManager] Multiple token refresh failures - logging out');
            this.handleTimeout();
          }
        } else if (session) {
          // Reset failure counter on successful refresh
          this.consecutiveRefreshFailures = 0;
          console.log('[SessionManager] Token refreshed successfully');
        } else {
          // No error but no session - increment counter
          this.consecutiveRefreshFailures++;
          console.warn(`[SessionManager] No session after refresh (${this.consecutiveRefreshFailures}/${this.maxConsecutiveFailures})`);

          if (this.consecutiveRefreshFailures >= this.maxConsecutiveFailures) {
            console.error('[SessionManager] No valid session - logging out');
            this.handleTimeout();
          }
        }
      } catch (error) {
        this.consecutiveRefreshFailures++;
        console.error(`[SessionManager] Token refresh error (${this.consecutiveRefreshFailures}/${this.maxConsecutiveFailures}):`, error);

        if (this.consecutiveRefreshFailures >= this.maxConsecutiveFailures) {
          console.error('[SessionManager] Multiple token refresh errors - logging out');
          this.handleTimeout();
        }
      } finally {
        this.isRefreshing = false;
      }
    }, TOKEN_REFRESH_INTERVAL);
  }

  private startInactivityCheck() {
    this.inactivityCheckTimer = setInterval(() => {
      if (!this.isActive) return;

      const inactivityDuration = this.getInactivityDuration();

      // Check if we should show warning (2 minutes before timeout)
      if (inactivityDuration >= INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT && !this.warningShown) {
        console.log('[SessionManager] Showing inactivity warning (2 minutes before timeout)');
        this.warningShown = true;
        if (this.onWarning) {
          this.onWarning();
        }
      }

      // Check if session should timeout (30 minutes)
      if (inactivityDuration >= INACTIVITY_TIMEOUT) {
        console.log('[SessionManager] Session timeout due to inactivity (30 minutes)');
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
    this.consecutiveRefreshFailures = 0;
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
