import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

import {
  CarteProfessionnelleConflictError,
  CarteProfessionnelleMutationUnavailableError,
  carteProfessionnelleService,
} from './carteProfessionnelleService';

const carte = {
  id: 'carte-1',
  artisan_id: 'artisan-1',
  numero_carte: 'SONASP/AM/2026/1',
  statut: 'validee' as const,
  date_emission: '2026-08-24',
  date_expiration: '2028-08-24',
};

describe('carteProfessionnelleService — mutations RPC-only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: carte, error: null });
  });

  it('valide par transition optimiste sans acteur, date ni DML navigateur', async () => {
    await expect(carteProfessionnelleService.valider('carte-1', 'en_cours')).resolves.toEqual(carte);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_transition_carte_professionnelle', {
      p_carte_id: 'carte-1',
      p_expected_statut: 'en_cours',
      p_nouveau_statut: 'validee',
      p_motif: null,
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('validee_par');
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('updated_by');
  });

  it('refuse localement un saut de statut avant tout appel serveur', async () => {
    await expect(
      carteProfessionnelleService.transitionner('carte-1', 'en_cours', 'en_exploitation'),
    ).rejects.toThrow('Transition de carte interdite');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('exige un motif suffisant pour suspendre ou annuler', async () => {
    await expect(carteProfessionnelleService.suspendre('carte-1', 'validee', 'trop bref'))
      .rejects.toThrow('d’au moins dix caractères');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('convertit le conflit optimiste SQLSTATE 40001', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '40001', message: 'Conflit optimiste : état courant validee.' },
    });

    await expect(carteProfessionnelleService.valider('carte-1', 'en_cours'))
      .rejects.toBeInstanceOf(CarteProfessionnelleConflictError);
  });

  it('propage le refus AAL2/capability/tenant sans secours PostgREST', async () => {
    const refusal = { code: '42501', message: 'artisan.cards.manage et périmètre artisan requis.' };
    mocks.rpc.mockResolvedValueOnce({ data: null, error: refusal });

    await expect(carteProfessionnelleService.valider('carte-1', 'en_cours')).rejects.toBe(refusal);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('renouvelle par la signature serveur sans statut ni acteur client', async () => {
    await carteProfessionnelleService.renouveler(
      'artisan-1',
      '2028-08-24',
      '  Pièces actualisées  ',
    );

    expect(mocks.rpc).toHaveBeenCalledWith('snp_renouveler_carte_professionnelle', {
      p_artisan_id: 'artisan-1',
      p_date_expiration: '2028-08-24',
      p_observations: 'Pièces actualisées',
    });
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('statut');
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('created_by');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('bloque les mutations média tant qu’aucune RPC dédiée n’existe', async () => {
    await expect(carteProfessionnelleService.updateCartePdfUrl('carte-1', 'https://private/card.pdf'))
      .rejects.toBeInstanceOf(CarteProfessionnelleMutationUnavailableError);
    await expect(carteProfessionnelleService.updateQrCodeUrl('carte-1', 'https://private/qr.png'))
      .rejects.toBeInstanceOf(CarteProfessionnelleMutationUnavailableError);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
