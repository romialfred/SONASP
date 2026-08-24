import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));
import {
  MOYEN_VIDE,
  appliquerPrincipalUnique,
  artisanMoyenPaiementService,
  coordonneeMasquee,
  libelleMoyen,
  moyenParDefaut,
  validerMoyen,
  type MoyenPaiement,
} from './artisanMoyenPaiementService';

const mobile = (over: Partial<MoyenPaiement> = {}): MoyenPaiement => ({
  ...MOYEN_VIDE('a1'),
  type: 'orange_money',
  titulaire: 'KABORE Awa',
  numero_telephone: '+22670112233',
  ...over,
});

const bancaire = (over: Partial<MoyenPaiement> = {}): MoyenPaiement => ({
  ...MOYEN_VIDE('a1'),
  type: 'virement_bancaire',
  titulaire: 'KABORE Awa',
  banque: 'Coris Bank',
  numero_compte: 'BF76 1234 5678 9012',
  ...over,
});

describe('coordonneeMasquee', () => {
  it('ne montre que les quatre derniers caractères', () => {
    // Comme sur un relevé bancaire : de quoi reconnaître le compte, pas de quoi le recopier.
    expect(coordonneeMasquee(mobile())).toBe('•••• 2233');
    expect(coordonneeMasquee(bancaire())).toBe('•••• 9012');
  });

  it('supporte l’absence de coordonnée et les valeurs courtes', () => {
    expect(coordonneeMasquee({ type: 'especes' })).toBe('—');
    expect(coordonneeMasquee({ type: 'orange_money', numero_telephone: '12' })).toBe('12');
  });
});

describe('libelleMoyen', () => {
  it('associe le canal et le titulaire', () => {
    expect(libelleMoyen(mobile())).toBe('Orange Money — KABORE Awa');
  });

  it('préfère le libellé personnalisé', () => {
    expect(libelleMoyen({ ...mobile(), libelle: 'Compte principal' })).toBe('Compte principal — KABORE Awa');
  });
});

describe('validerMoyen', () => {
  it('accepte un moyen complet', () => {
    expect(validerMoyen(mobile())).toBeNull();
    expect(validerMoyen(bancaire())).toBeNull();
  });

  it('exige le titulaire quel que soit le canal', () => {
    expect(validerMoyen(mobile({ titulaire: '  ' }))).toMatch(/titulaire/);
  });

  it('exige un numéro mobile au bon format', () => {
    // Un moyen sans coordonnée exploitable se découvrirait au moment de payer.
    expect(validerMoyen(mobile({ numero_telephone: '' }))).toMatch(/numéro de téléphone/i);
    expect(validerMoyen(mobile({ numero_telephone: '70-AB-CD' }))).toMatch(/format/);
    expect(validerMoyen(mobile({ numero_telephone: '+226 70 11 22 33' }))).toBeNull();
  });

  it('exige banque et compte pour un virement ou un chèque', () => {
    expect(validerMoyen(bancaire({ banque: '' }))).toMatch(/banque/i);
    expect(validerMoyen(bancaire({ numero_compte: '' }))).toMatch(/compte/i);
    expect(validerMoyen(bancaire({ type: 'cheque', banque: '' }))).toMatch(/banque/i);
  });

  it('n’exige aucune coordonnée pour les espèces', () => {
    expect(validerMoyen({ ...MOYEN_VIDE('a1'), type: 'especes', titulaire: 'KABORE Awa' })).toBeNull();
  });
});

describe('appliquerPrincipalUnique', () => {
  it('ne laisse qu’un seul principal', () => {
    // Sans cela, l'écran de paiement en présélectionnerait plusieurs.
    const resultat = appliquerPrincipalUnique(
      [mobile({ est_principal: true }), bancaire({ est_principal: true }), mobile()],
      1
    );
    expect(resultat.map((moyen) => moyen.est_principal)).toEqual([false, true, false]);
  });
});

describe('moyenParDefaut', () => {
  it('retient le principal', () => {
    const principal = bancaire({ id: 'm2', est_principal: true });
    expect(moyenParDefaut([mobile({ id: 'm1' }), principal])?.id).toBe('m2');
  });

  it('retombe sur le premier actif à défaut de principal', () => {
    expect(moyenParDefaut([mobile({ id: 'm1' }), bancaire({ id: 'm2' })])?.id).toBe('m1');
  });

  it('écarte les moyens désactivés', () => {
    expect(moyenParDefaut([mobile({ id: 'm1', actif: false })])).toBeNull();
    expect(moyenParDefaut([])).toBeNull();
  });
});

describe('artisanMoyenPaiementService — mutations RPC-only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: mobile({ id: 'm1' }), error: null });
  });

  it('crée uniquement par la RPC sans acteur, vérificateur ni audit client', async () => {
    await artisanMoyenPaiementService.creer(mobile());

    expect(mocks.rpc).toHaveBeenCalledWith('snp_upsert_artisan_moyen_paiement', {
      p_artisan_id: 'a1',
      p_type: 'orange_money',
      p_titulaire: 'KABORE Awa',
      p_moyen_id: null,
      p_libelle: null,
      p_numero_telephone: '+22670112233',
      p_banque: null,
      p_numero_compte: null,
      p_code_swift: null,
      p_est_principal: false,
      p_actif: true,
      p_observations: null,
    });
    const params = mocks.rpc.mock.calls[0][1];
    expect(params).not.toHaveProperty('created_by');
    expect(params).not.toHaveProperty('updated_by');
    expect(params).not.toHaveProperty('verifie_par');
    expect(params).not.toHaveProperty('verifie_le');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('vérifie par la RPC de double contrôle avec le seul motif métier', async () => {
    await artisanMoyenPaiementService.verifier('m1', true);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_verifier_artisan_moyen_paiement', {
      p_moyen_id: 'm1',
      p_approuve: true,
      p_motif: null,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('refuse un rejet sans motif avant tout appel RPC', async () => {
    await expect(artisanMoyenPaiementService.verifier('m1', false, 'trop bref'))
      .rejects.toThrow('d’au moins dix caractères');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('propage les refus AAL2, capability, tenant et double contrôle sans fallback', async () => {
    const refusal = { code: '42501', message: 'Double contrôle requis : le saisissant ne vérifie pas sa coordonnée.' };
    mocks.rpc.mockResolvedValueOnce({ data: null, error: refusal });

    await expect(artisanMoyenPaiementService.verifier('m1', true)).rejects.toBe(refusal);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('conserve le rattachement serveur lors d’une modification malgré un payload forgé', async () => {
    const result = Promise.resolve({ data: mobile({ id: 'm1', artisan_id: 'a1' }), error: null });
    const query: Record<string, unknown> = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(() => result),
    };
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    mocks.from.mockReturnValue(query);

    await artisanMoyenPaiementService.modifier(
      'm1',
      { artisan_id: 'artisan-hors-tenant', titulaire: 'Nouveau titulaire' } as never,
    );

    expect(mocks.rpc).toHaveBeenCalledWith(
      'snp_upsert_artisan_moyen_paiement',
      expect.objectContaining({
        p_moyen_id: 'm1',
        p_artisan_id: 'a1',
        p_titulaire: 'Nouveau titulaire',
      }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('remplace la liste par SELECT puis RPC sans mutation PostgREST', async () => {
    const result = Promise.resolve({ data: [mobile({ id: 'obsolete' })], error: null });
    const query: Record<string, unknown> = {
      select: vi.fn(),
      eq: vi.fn(),
      insert: mocks.insert,
      update: mocks.update,
      delete: mocks.remove,
      then: result.then.bind(result),
    };
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    mocks.from.mockReturnValue(query);

    await artisanMoyenPaiementService.remplacerPourArtisan('a1', [bancaire({ id: 'm2' })]);

    expect(mocks.from).toHaveBeenCalledWith('snp_artisan_moyens_paiement');
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
