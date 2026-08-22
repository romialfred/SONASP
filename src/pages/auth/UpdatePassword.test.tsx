import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UpdatePassword from './UpdatePassword';

const mocks = vi.hoisted(() => ({ changerMotDePasse: vi.fn() }));

vi.mock('@/services/mfaService', () => ({
  mfaService: { changerMotDePasse: mocks.changerMotDePasse },
}));

describe('UpdatePassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('finalise le mot de passe puis conduit à l’enrôlement 2FA', async () => {
    mocks.changerMotDePasse.mockResolvedValue(undefined);
    render(<MemoryRouter><UpdatePassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'Phrase-de-passe-2026!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'Phrase-de-passe-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    await waitFor(() => expect(mocks.changerMotDePasse).toHaveBeenCalledWith('Phrase-de-passe-2026!'));
    expect(screen.getByRole('link', { name: 'Configurer le second facteur' })).toHaveAttribute('href', '/dashboard');
  });

  it('refuse deux valeurs différentes avant tout appel', () => {
    render(<MemoryRouter><UpdatePassword /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'Phrase-de-passe-2026!' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'Autre-phrase-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    expect(mocks.changerMotDePasse).not.toHaveBeenCalled();
    expect(screen.getByText(/confirmez le même mot de passe/i)).toBeInTheDocument();
  });
});
