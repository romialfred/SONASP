import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TwoFactorVerify } from './TwoFactorVerify';

describe('TwoFactorVerify', () => {
  it('présente les deux modes de vérification en français', async () => {
    const user = userEvent.setup();
    render(<TwoFactorVerify onVerify={vi.fn().mockResolvedValue({})} onCancel={vi.fn()} />);

    expect(screen.getByText('Authentification à deux facteurs')).toBeInTheDocument();
    expect(screen.getByText(/code à 6 chiffres/i)).toBeInTheDocument();
    expect(screen.getByText('Code de vérification')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Utiliser plutôt un code de récupération' }));

    expect(screen.getByText(/codes de récupération/i)).toBeInTheDocument();
    expect(screen.getByText('Code de récupération')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Utiliser l’application d’authentification' })).toBeInTheDocument();
  });
});
