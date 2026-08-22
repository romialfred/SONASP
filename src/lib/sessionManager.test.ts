import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: {
    auth: { signOut: mocks.signOut },
    from: vi.fn(() => ({ insert: vi.fn(), delete: vi.fn(() => ({ eq: vi.fn(), neq: vi.fn(), lt: vi.fn() })) })),
  },
}));

import {
  beginSessionActivity,
  clearSessionActivity,
  SessionManager,
  SESSION_INACTIVITY_TIMEOUT_MS,
  SESSION_WARNING_BEFORE_TIMEOUT_MS,
} from './sessionManager';

describe('SessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T12:00:00Z'));
    window.sessionStorage.clear();
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
  });

  afterEach(() => {
    clearSessionActivity();
    vi.useRealTimers();
  });

  it('avertit à neuf minutes puis ferme la session à dix minutes', async () => {
    beginSessionActivity();
    const warning = vi.fn();
    const timeout = vi.fn();
    const manager = new SessionManager();
    manager.setOnWarning(warning);
    manager.setOnTimeout(timeout);
    manager.start();

    await vi.advanceTimersByTimeAsync(SESSION_INACTIVITY_TIMEOUT_MS - SESSION_WARNING_BEFORE_TIMEOUT_MS);
    expect(warning).toHaveBeenCalledWith(60);
    expect(timeout).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SESSION_WARNING_BEFORE_TIMEOUT_MS);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('n’étend la session avertie que par une confirmation explicite', async () => {
    beginSessionActivity();
    const warning = vi.fn();
    const manager = new SessionManager();
    manager.setOnWarning(warning);
    manager.start();

    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await vi.advanceTimersByTimeAsync(30 * 1000);
    expect(manager.getRemainingTime()).toBe(30 * 1000);

    manager.extendSession();
    expect(manager.getRemainingTime()).toBe(SESSION_INACTIVITY_TIMEOUT_MS);
    manager.stop();
  });

  it('conserve l’inactivité lors d’un rechargement dans le même onglet', async () => {
    beginSessionActivity(Date.now() - SESSION_INACTIVITY_TIMEOUT_MS);
    const timeout = vi.fn();
    const manager = new SessionManager();
    manager.setOnTimeout(timeout);
    manager.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(timeout).toHaveBeenCalledTimes(1);
  });
});
