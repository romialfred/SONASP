import { supabase } from './supabase';
import {
  SESSION_ACTIVITY_HEARTBEAT_MS,
  SESSION_WARNING_BEFORE_TIMEOUT_MS,
  dureeInactiviteMs,
} from './sessionPolicy';

export { SESSION_INACTIVITY_TIMEOUT_MS, SESSION_WARNING_BEFORE_TIMEOUT_MS } from './sessionPolicy';
export const SESSION_LAST_ACTIVITY_KEY = 'sonasp-session-last-activity';

export type SessionWarningCallback = (remainingSeconds: number) => void;
export type SessionTimeoutCallback = () => void | Promise<void>;
export type SessionActivitySyncCallback = () => void | Promise<void>;

function storedLastActivity(): number | null {
  const raw = window.sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function beginSessionActivity(now = Date.now()) {
  window.sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(now));
}

export function clearSessionActivity() {
  window.sessionStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
}

export class SessionManager {
  private lastActivityTime: number = storedLastActivity() ?? Date.now();
  private inactivityCheckTimer: ReturnType<typeof setInterval> | null = null;
  private isActive: boolean = true;
  private warningShown: boolean = false;

  private onWarning: SessionWarningCallback | null = null;
  private onTimeout: SessionTimeoutCallback | null = null;
  private onActivitySync: SessionActivitySyncCallback | null = null;
  private lastActivitySyncTime = 0;
  private activitySyncInFlight: Promise<void> | null = null;

  private readonly activityEvents = [
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'click',
  ];
  private listenersAttached = false;
  private readonly handleActivity = () => this.updateActivity();
  private readonly handleVisibilityChange = () => {
    // Revenir sur l'onglet ne constitue pas une activité. On vérifie au
    // contraire immédiatement si l'échéance est dépassée.
    if (!document.hidden) void this.checkInactivity();
  };

  constructor() {}

  private setupActivityListeners() {
    if (this.listenersAttached) return;
    this.activityEvents.forEach(event => {
      document.addEventListener(event, this.handleActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.listenersAttached = true;
  }

  private removeActivityListeners() {
    if (!this.listenersAttached) return;
    this.activityEvents.forEach(event => {
      document.removeEventListener(event, this.handleActivity);
    });
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.listenersAttached = false;
  }

  public start() {
    this.isActive = true;
    this.lastActivityTime = storedLastActivity() ?? Date.now();
    beginSessionActivity(this.lastActivityTime);
    this.setupActivityListeners();
    this.startInactivityCheck();
    void this.checkInactivity();
  }

  public stop() {
    this.isActive = false;
    if (this.inactivityCheckTimer) clearInterval(this.inactivityCheckTimer);
    this.inactivityCheckTimer = null;
    this.removeActivityListeners();
  }

  private updateActivity() {
    if (!this.isActive) return;

    // Une fois l'avertissement affiché, un mouvement ou une frappe parasite ne
    // suffit pas à prolonger la session : l'utilisateur doit choisir Continuer.
    if (this.warningShown) return;

    this.lastActivityTime = Date.now();
    beginSessionActivity(this.lastActivityTime);
    this.requestActivitySync();
  }

  private requestActivitySync(force = false) {
    if (!this.onActivitySync || this.activitySyncInFlight) return;
    const now = Date.now();
    if (!force && now - this.lastActivitySyncTime < SESSION_ACTIVITY_HEARTBEAT_MS) return;
    this.lastActivitySyncTime = now;
    this.activitySyncInFlight = Promise.resolve(this.onActivitySync())
      .catch(() => undefined)
      .finally(() => {
        this.activitySyncInFlight = null;
      });
  }

  private startInactivityCheck() {
    if (this.inactivityCheckTimer) clearInterval(this.inactivityCheckTimer);
    this.inactivityCheckTimer = setInterval(() => void this.checkInactivity(), 1000);
  }

  private async checkInactivity() {
    if (!this.isActive) return;
    const inactivityDuration = this.getInactivityDuration();

    if (inactivityDuration >= dureeInactiviteMs()) {
      await this.handleTimeout();
      return;
    }

    if (inactivityDuration >= dureeInactiviteMs() - SESSION_WARNING_BEFORE_TIMEOUT_MS) {
      this.warningShown = true;
      this.onWarning?.(Math.max(0, Math.ceil(this.getRemainingTime() / 1000)));
    }
  }

  private async handleTimeout() {
    this.stop();
    if (this.onTimeout) {
      await this.onTimeout();
    }
    await this.logout();
  }

  private async logout() {
    try {
      clearSessionActivity();
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('[SessionManager] Logout error:', error);
    }
  }

  public getInactivityDuration(): number {
    return Date.now() - this.lastActivityTime;
  }

  public getRemainingTime(): number {
    const remaining = dureeInactiviteMs() - this.getInactivityDuration();
    return Math.max(0, remaining);
  }

  public getTimeUntilWarning(): number {
    const remaining = dureeInactiviteMs()
      - SESSION_WARNING_BEFORE_TIMEOUT_MS
      - this.getInactivityDuration();
    return Math.max(0, remaining);
  }

  public extendSession() {
    this.warningShown = false;
    this.lastActivityTime = Date.now();
    beginSessionActivity(this.lastActivityTime);
    this.requestActivitySync(true);
  }

  public setOnWarning(callback: SessionWarningCallback) {
    this.onWarning = callback;
  }

  public setOnTimeout(callback: SessionTimeoutCallback) {
    this.onTimeout = callback;
  }

  public setOnActivitySync(callback: SessionActivitySyncCallback) {
    this.onActivitySync = callback;
  }
}
