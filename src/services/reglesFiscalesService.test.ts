import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reglesFiscalesService, type BrouillonRegle } from './reglesFiscalesService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

const BROUILLON: BrouillonRegle = {
  code_taxe: 'tva',
  libelle: 'TVA des comptoirs d’achat',
  assiette: 'ca_ht',
  mode_calcul: 'taux',
  taux: 0.015,
  profil_vendeur: 'comptoir',
  date_effet: '2026-08-26',
};

const REGLE = { id: '11111111-1111-4111-8111-111111111111', statut: 'projet' };

describe('reglesFiscalesService — écriture par procédure', () => {
  beforeEach(() => vi.clearAllMocks());

  // L'écriture directe est fermée à `authenticated` : la table n'accorde que
  // SELECT et une politique restrictive refuse INSERT et UPDATE. Passer par
  // `from()` renverrait un refus ; seule la procédure écrit.
  it('crée par RPC, jamais par écriture directe sur la table', async () => {
    mocks.rpc.mockResolvedValue({ data: REGLE, error: null });

    await reglesFiscalesService.creer(BROUILLON);

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('snp_regle_fiscale_creer', expect.objectContaining({
      p_code_taxe: 'tva',
      p_libelle: 'TVA des comptoirs d’achat',
      p_taux: 0.015,
      p_profil_vendeur: 'comptoir',
      p_date_effet: '2026-08-26',
    }));
  });

  it('ne laisse le client fixer ni statut, ni auteur, ni approbateur', async () => {
    mocks.rpc.mockResolvedValue({ data: REGLE, error: null });

    await reglesFiscalesService.creer(BROUILLON);

    const charge = mocks.rpc.mock.calls[0][1] as Record<string, unknown>;
    for (const interdit of ['statut', 'cree_par', 'approuve_par', 'approuve_le', 'p_statut']) {
      expect(charge).not.toHaveProperty(interdit);
    }
  });

  it('approuve et abroge par RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: REGLE, error: null });

    await reglesFiscalesService.approuver(REGLE.id);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_regle_fiscale_approuver', { p_id: REGLE.id });

    await reglesFiscalesService.abroger(REGLE.id);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_regle_fiscale_abroger', { p_id: REGLE.id });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('remonte le refus du serveur sans le masquer', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Vous n’êtes pas habilité à administrer le référentiel fiscal.' },
    });

    await expect(reglesFiscalesService.creer(BROUILLON)).rejects.toMatchObject({
      message: expect.stringContaining('habilité'),
    });
  });
});

describe('reglesFiscalesService — résolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transmet le profil du vendeur, qui départage deux règles de même taxe', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...REGLE, taux: 0.015 }, error: null });

    const regle = await reglesFiscalesService.resoudre(
      'tva', '2026-08-26', undefined, 'standard', 'comptoir',
    );

    expect(mocks.rpc).toHaveBeenCalledWith('snp_resoudre_regle_fiscale', expect.objectContaining({
      p_code_taxe: 'tva',
      p_profil_vendeur: 'comptoir',
    }));
    expect(regle?.taux).toBe(0.015);
  });

  // La procédure renvoie une ligne composite : sans règle applicable, la ligne
  // revient vide plutôt qu'absente. La traiter comme un tableau la faisait
  // toujours paraître introuvable.
  it('rend null quand la ligne composite revient sans identifiant', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: null, taux: null }, error: null });

    await expect(
      reglesFiscalesService.resoudre('royalties', '2026-08-26', 3800),
    ).resolves.toBeNull();
  });
});
