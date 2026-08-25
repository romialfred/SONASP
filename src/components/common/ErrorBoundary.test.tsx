import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { purgerVersionPwaObsolete } from '@/lib/pwaRecovery';
import { RouteErrorBoundary } from './ErrorBoundary';

const pwaMocks = vi.hoisted(() => ({
  requestPwaUpdateCheck: vi.fn().mockResolvedValue('checked'),
}));

vi.mock('@/lib/pwaUpdate', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/pwaUpdate')>(),
  requestPwaUpdateCheck: pwaMocks.requestPwaUpdateCheck,
}));

function BrokenLazyRoute(): never {
  throw new Error('Failed to fetch dynamically imported module');
}

function BrokenApiRoute(): never {
  throw new TypeError('Failed to fetch');
}

/** Reproduit un champ nul formaté pendant le rendu, indépendant du réseau. */
function BrokenRenderRoute(): never {
  throw new TypeError("Cannot read properties of null (reading 'toLocaleString')");
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('passe hors ligne puis vérifie la version sans recharger au retour du réseau', async () => {
    render(
      <RouteErrorBoundary>
        <BrokenLazyRoute />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Connexion Internet interrompue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En attente du réseau' })).toBeDisabled();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));

    expect(screen.getByRole('heading', { name: 'Écran temporairement indisponible' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger cet écran' })).toBeEnabled();
    await waitFor(() => {
      expect(pwaMocks.requestPwaUpdateCheck).toHaveBeenCalledTimes(1);
    });
  });

  it('ne présente pas une erreur API ou CORS comme une coupure Internet', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    render(
      <RouteErrorBoundary>
        <BrokenApiRoute />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled();
    expect(screen.queryByText(/Connexion Internet interrompue/i)).not.toBeInTheDocument();
    expect(pwaMocks.requestPwaUpdateCheck).not.toHaveBeenCalled();
  });

  it('hors ligne, ne présente pas une erreur de rendu comme une coupure Internet', () => {
    render(
      <RouteErrorBoundary>
        <BrokenRenderRoute />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument();
    expect(screen.queryByText(/Connexion Internet interrompue/i)).not.toBeInTheDocument();
    // Rétablir le réseau ne corrigerait pas un champ nul : l'action reste offerte.
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled();
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
