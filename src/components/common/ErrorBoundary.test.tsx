import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { purgerVersionPwaObsolete } from '@/lib/pwaRecovery';
import { RouteErrorBoundary } from './ErrorBoundary';

function BrokenLazyRoute(): never {
  throw new Error('Failed to fetch dynamically imported module');
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('explique la panne réseau et permet de reprendre après le retour en ligne', () => {
    render(
      <RouteErrorBoundary>
        <BrokenLazyRoute />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Connexion Internet interrompue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En attente du réseau' })).toBeDisabled();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));

    expect(screen.getByRole('button', { name: 'Réparer et recharger' })).toBeEnabled();
  });

  it('retire le service worker et uniquement les caches applicatifs obsolètes', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const supprimerCache = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([
          { scope: `${window.location.origin}/`, unregister },
          { scope: 'https://autre-application.example/', unregister: vi.fn() },
        ]),
      },
    });
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(['sonasp-route-assets', 'workbox-precache-v1', 'cache-externe']),
        delete: supprimerCache,
      },
    });

    await purgerVersionPwaObsolete();

    expect(unregister).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(supprimerCache).toHaveBeenCalledTimes(2);
    });
    expect(supprimerCache).toHaveBeenCalledWith('sonasp-route-assets');
    expect(supprimerCache).toHaveBeenCalledWith('workbox-precache-v1');
  });
});
