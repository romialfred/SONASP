import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserNetworkState, requestPwaUpdateCheck } from './pwaUpdate';

describe('cycle réseau et version PWA', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('déduit online/offline uniquement du signal navigateur', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    expect(browserNetworkState()).toBe('offline');

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    expect(browserNetworkState()).toBe('online');
  });

  it('vérifie une version sans activer le worker ni recharger la page', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue({ update }) },
    });

    await expect(requestPwaUpdateCheck()).resolves.toBe('checked');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('conserve l’état online lorsqu’un contrôle de version échoue', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) },
    });

    await expect(requestPwaUpdateCheck()).resolves.toBe('failed');
    expect(browserNetworkState()).toBe('online');
  });
});
