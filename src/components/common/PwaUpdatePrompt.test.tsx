import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';

const pwaMocks = vi.hoisted(() => ({
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn().mockResolvedValue(undefined),
  reloadCurrentDocument: vi.fn(),
  registrationOptions: null as { onNeedReload?: () => void } | null,
}));

vi.mock('@/lib/pwaRegistration', () => ({
  usePwaRegistration: (options?: { onNeedReload?: () => void }) => {
    pwaMocks.registrationOptions = options ?? null;
    return {
      needRefresh: [pwaMocks.needRefresh, pwaMocks.setNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: pwaMocks.updateServiceWorker,
    };
  },
}));

vi.mock('@/lib/pwaUpdate', () => ({
  browserNetworkState: () => !navigator.onLine ? 'offline' : 'online',
  reloadCurrentDocument: pwaMocks.reloadCurrentDocument,
}));

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pwaMocks.needRefresh = false;
    pwaMocks.registrationOptions = null;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('reste invisible tant qu’aucune nouvelle version n’attend', () => {
    render(<PwaUpdatePrompt />);
    expect(screen.queryByText(/mise à jour SONASP/i)).not.toBeInTheDocument();
    expect(pwaMocks.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('n’active la version qu’après le clic explicite, jamais au retour online', async () => {
    pwaMocks.needRefresh = true;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<PwaUpdatePrompt />);

    expect(screen.getAllByText(/mise à jour SONASP/i)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Connexion requise' })).toBeDisabled();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));

    const updateButton = await screen.findByRole('button', { name: 'Mettre à jour maintenant' });
    expect(updateButton).toBeEnabled();
    expect(pwaMocks.updateServiceWorker).not.toHaveBeenCalled();

    fireEvent.click(updateButton);
    await waitFor(() => {
      expect(pwaMocks.updateServiceWorker).toHaveBeenCalledTimes(1);
    });
  });

  it('permet de reporter l’unique notification sans activer la version', () => {
    pwaMocks.needRefresh = true;
    render(<PwaUpdatePrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Reporter cette mise à jour' }));

    expect(pwaMocks.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(pwaMocks.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('ne recharge jamais cet onglet quand un autre onglet active la version', () => {
    pwaMocks.needRefresh = true;
    render(<PwaUpdatePrompt />);

    act(() => {
      pwaMocks.registrationOptions?.onNeedReload?.();
    });

    expect(pwaMocks.reloadCurrentDocument).not.toHaveBeenCalled();
    expect(screen.getByText('La nouvelle version SONASP est prête')).toBeInTheDocument();
    expect(screen.getByText(/Cet écran reste intact/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recharger maintenant' }));
    expect(pwaMocks.reloadCurrentDocument).toHaveBeenCalledTimes(1);
    expect(pwaMocks.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('ne réagit pas aux événements lifecycle et recharge seulement après le clic local', async () => {
    pwaMocks.needRefresh = true;
    render(<PwaUpdatePrompt />);

    fireEvent(window, new Event('blur'));
    fireEvent(document, new Event('visibilitychange'));
    fireEvent(window, new Event('focus'));
    fireEvent(window, new Event('pageshow'));

    expect(pwaMocks.updateServiceWorker).not.toHaveBeenCalled();
    expect(pwaMocks.reloadCurrentDocument).not.toHaveBeenCalled();
    expect(screen.getByText('Une mise à jour SONASP est disponible')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour maintenant' }));
    await waitFor(() => {
      expect(pwaMocks.updateServiceWorker).toHaveBeenCalledTimes(1);
    });
    expect(pwaMocks.reloadCurrentDocument).not.toHaveBeenCalled();

    act(() => {
      pwaMocks.registrationOptions?.onNeedReload?.();
    });
    expect(pwaMocks.reloadCurrentDocument).toHaveBeenCalledTimes(1);
  });
});
