import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileErrorBanner } from './ProfileErrorBanner';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: authMock.useAuth,
}));

describe('ProfileErrorBanner', () => {
  const refreshProfile = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.useAuth.mockReturnValue({
      profileError: 'Unable to load full profile. Using account defaults.',
      refreshProfile,
      user: { id: 'user-1' },
    });
  });

  it('shows an actionable offline message away from the header', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    render(<ProfileErrorBanner />);

    expect(screen.getByText('Connexion réseau indisponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hors ligne' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveClass('bottom-4');
    expect(screen.queryByText('Profile loading issue')).not.toBeInTheDocument();
  });

  it('réactive seulement le bouton au retour du réseau, sans relance automatique', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<ProfileErrorBanner />);

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeEnabled();
    expect(refreshProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(1));
  });
});
