import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MandatoryMfaGate } from './MandatoryMfaGate';

const mocks = vi.hoisted(() => ({
  etat: vi.fn(),
  facteurVerifie: vi.fn(),
  verifierCode: vi.fn(),
  changerMotDePasse: vi.fn(),
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
  setupProps: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'token-a', user: { id: 'user-1' } },
    initialized: true,
    signOut: mocks.signOut,
    refreshProfile: mocks.refreshProfile,
  }),
}));

vi.mock('@/services/mfaService', () => ({
  mfaService: {
    etat: mocks.etat,
    facteurVerifie: mocks.facteurVerifie,
    verifierCode: mocks.verifierCode,
    changerMotDePasse: mocks.changerMotDePasse,
  },
}));

vi.mock('./TwoFactorSetup', () => ({
  TwoFactorSetup: (props: { obligatoire?: boolean; onComplete: () => void }) => {
    mocks.setupProps(props);
    return <button onClick={props.onComplete}>Terminer l’enrôlement</button>;
  },
}));

const etat = (etape_suivante: 'enrolement' | 'verification' | 'pret') => ({
  enrole: etape_suivante !== 'enrolement',
  enrole_le: null,
  mot_de_passe_a_changer: false,
  aal: etape_suivante === 'pret' ? 'aal2' : 'aal1',
  facteurs_verifies: etape_suivante === 'enrolement' ? 0 : 1,
  etape_suivante,
});

describe('MandatoryMfaGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshProfile.mockResolvedValue(undefined);
    mocks.verifierCode.mockResolvedValue(undefined);
    mocks.facteurVerifie.mockResolvedValue({ id: 'factor-1' });
  });

  it('impose l’enrôlement sans option de report', async () => {
    mocks.etat.mockResolvedValue(etat('enrolement'));
    render(<MemoryRouter initialEntries={['/dashboard']}><MandatoryMfaGate><p>Privé</p></MandatoryMfaGate></MemoryRouter>);

    await screen.findByRole('button', { name: 'Terminer l’enrôlement' });
    expect(mocks.setupProps).toHaveBeenCalledWith(expect.objectContaining({ obligatoire: true }));
    expect(screen.queryByText('Privé')).not.toBeInTheDocument();
  });

  it('vérifie le code TOTP avant de rendre le contenu privé', async () => {
    mocks.etat.mockResolvedValueOnce(etat('verification')).mockResolvedValueOnce(etat('pret'));
    render(<MemoryRouter initialEntries={['/dashboard']}><MandatoryMfaGate><p>Contenu privé</p></MandatoryMfaGate></MemoryRouter>);

    const input = await screen.findByLabelText('Code de sécurité');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Vérifier et continuer/ }));

    await waitFor(() => expect(mocks.verifierCode).toHaveBeenCalledWith('factor-1', '123456'));
    expect(await screen.findByText('Contenu privé')).toBeInTheDocument();
  });
});
