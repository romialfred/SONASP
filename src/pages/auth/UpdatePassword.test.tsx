import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UpdatePassword from './UpdatePassword';

const mocks = vi.hoisted(() => ({
  changerMotDePasse: vi.fn(),
  getSession: vi.fn(),
  verifyOtp: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/services/mfaService', () => ({
  mfaService: { changerMotDePasse: mocks.changerMotDePasse },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      verifyOtp: mocks.verifyOtp,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));

vi.mock('@/components/auth/TwoFactorSetup', () => ({
  TwoFactorSetup: () => <div>Enrôlement TOTP SONASP</div>,
}));

describe('UpdatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'recovery-session' } }, error: null });
    mocks.verifyOtp.mockResolvedValue({ data: { session: { access_token: 'verified-recovery-session' } }, error: null });
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
  });

  it('finalise le mot de passe puis conduit à l’enrôlement 2FA', async () => {
    mocks.changerMotDePasse.mockResolvedValue(undefined);
    render(<MemoryRouter><UpdatePassword /></MemoryRouter>);

    await screen.findByLabelText('Nouveau mot de passe');

    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'Phrase-de-passe-2026!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'Phrase-de-passe-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    await waitFor(() => expect(mocks.changerMotDePasse).toHaveBeenCalledWith('Phrase-de-passe-2026!'));
    expect(screen.getByText('Enrôlement TOTP SONASP')).toBeInTheDocument();
    expect(screen.getByText(/Enrôlez maintenant votre second facteur/i)).toBeInTheDocument();
  });

  it('refuse deux valeurs différentes avant tout appel', async () => {
    render(<MemoryRouter><UpdatePassword /></MemoryRouter>);
    await screen.findByLabelText('Nouveau mot de passe');
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'Phrase-de-passe-2026!' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'Autre-phrase-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    expect(mocks.changerMotDePasse).not.toHaveBeenCalled();
    expect(screen.getByText(/confirmez le même mot de passe/i)).toBeInTheDocument();
  });

  it('ne présente aucun formulaire sans session de récupération valide', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<MemoryRouter><UpdatePassword /></MemoryRouter>);

    expect(await screen.findByText(/lien est invalide/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recevoir un nouveau lien' })).toHaveAttribute('href', '/recuperer-acces');
  });

  it('échange le jeton du lien SONASP contre une session de récupération', async () => {
    render(
      <MemoryRouter initialEntries={['/modifier-mot-de-passe?token_hash=jeton-signe&type=recovery']}>
        <UpdatePassword />
      </MemoryRouter>,
    );

    await screen.findByLabelText('Nouveau mot de passe');
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: 'jeton-signe', type: 'recovery' });
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
  });
});
