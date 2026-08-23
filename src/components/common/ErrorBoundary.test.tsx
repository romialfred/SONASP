import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    expect(screen.getByRole('button', { name: 'Recharger la page' })).toBeEnabled();
  });
});
