import { supabase } from './supabase';

const SESSION_TIMEOUT = 30 * 60 * 1000;
const INACTIVITY_WARNING = 5 * 60 * 1000;
const ACTIVITY_CHECK_INTERVAL = 60 * 1000;

export class SessionManager {
  private lastActivityTime: number = Date.now();
  private sessionTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private activityCheckTimer: NodeJS.Timeout | null = null;
  private onWarning?: () => void;
  private onTimeout?: () => void;

  constructor(onWarning?: () => void, onTimeout?: () => void) {
    this.onWarning = onWarning;
    this.onTimeout = onTimeout;
    this.setupActivityListeners();
  }

  private setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });
  }

  public start() {
    this.updateActivity();
    this.startActivityCheck();
  }

  public stop() {
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.activityCheckTimer) clearInterval(this.activityCheckTimer);
  }

  private updateActivity() {
    this.lastActivityTime = Date.now();
    this.resetTimers();
  }

  private resetTimers() {
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);

    const warningTime = SESSION_TIMEOUT - INACTIVITY_WARNING;

    this.warningTimer = setTimeout(() => {
      if (this.onWarning) {
        this.onWarning();
      }
    }, warningTime);

    this.sessionTimer = setTimeout(() => {
      if (this.onTimeout) {
        this.onTimeout();
      }
    }, SESSION_TIMEOUT);
  }

  private startActivityCheck() {
    this.activityCheckTimer = setInterval(async () => {
      const inactiveDuration = Date.now() - this.lastActivityTime;

      if (inactiveDuration >= SESSION_TIMEOUT) {
        this.stop();
        if (this.onTimeout) {
          this.onTimeout();
        }
      }
    }, ACTIVITY_CHECK_INTERVAL);
  }

  public getInactivityDuration(): number {
    return Date.now() - this.lastActivityTime;
  }

  public getRemainingTime(): number {
    const elapsed = this.getInactivityDuration();
    return Math.max(0, SESSION_TIMEOUT - elapsed);
  }

  public extendSession() {
    this.updateActivity();
  }
}

export async function createSessionRecord(userId: string, sessionToken: string) {
  try {
    const expiresAt = new Date(Date.now() + SESSION_TIMEOUT);

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
