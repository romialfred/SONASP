import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAMMES_PAR_ONCE } from './achatMineService';
import {
  composer,
  construireLots,
  lireLotsEligibles,
  messageIndisponibiliteLots,
  nomArtisan,
  tracabiliteVenteService,
  validerComposition,
  type Lot,
} from './tracabiliteVenteService';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

const lot = (partiel: Partial<Lot> & { source_id: string; date: string; disponibleOz: number }): Lot => ({
  source_type: 'achat_mine',
  reference: `AC-MI-${partiel.source_id}`,
  origine: 'SEMAFO Boungou Gold Mine',
  quantiteOz: partiel.disponibleOz,
  affecteeOz: 0,
  ...partiel,
});

describe('composer', () => {
  it('sert la vente au plus ancien lot d’abord', () => {
    const composition = composer(
      [
        lot({ source_id: 'récent', date: '2026-08-01', disponibleOz: 500 }),
        lot({ source_id: 'ancien', date: '2026-06-01', disponibleOz: 300 }),
      ],
      400
    );
    expect(composition.affectations.map((part) => [part.source_id, part.quantite_oz])).toEqual([
      ['ancien', 300],
      ['récent', 100],
    ]);
    expect(composition.couverte).toBe(true);
    expect(composition.resteOz).toBe(0);
  });

  it('n’entame qu’un seul lot quand il suffit', () => {
    const composition = composer([lot({ source_id: 'a', date: '2026-06-01', disponibleOz: 500 })], 120);
    expect(composition.affectations).toHaveLength(1);
    expect(composition.affectations[0].quantite_oz).toBe(120);
  });

  it('signale ce que le stock ne couvre pas au lieu de le combler', () => {
    // Vendre 100 oz avec 30 oz en stock doit laisser 70 oz sans origine.
    const composition = composer([lot({ source_id: 'a', date: '2026-06-01', disponibleOz: 30 })], 100);
    expect(composition.resteOz).toBe(70);
    expect(composition.couverte).toBe(false);
    expect(composition.affectations.reduce((t, p) => t + p.quantite_oz, 0)).toBe(30);
  });

  it('ignore les lots épuisés', () => {
    const composition = composer(
      [
        lot({ source_id: 'épuisé', date: '2026-01-01', disponibleOz: 0 }),
        lot({ source_id: 'plein', date: '2026-07-01', disponibleOz: 50 }),
      ],
      50
    );
    expect(composition.affectations.map((part) => part.source_id)).toEqual(['plein']);
  });

  it('départage deux lots du même jour par leur référence, pour rester reproductible', () => {
    const composition = composer(
      [
        lot({ source_id: 'b', reference: 'AC-MI-2026-00002', date: '2026-06-01', disponibleOz: 10 }),
        lot({ source_id: 'a', reference: 'AC-MI-2026-00001', date: '2026-06-01', disponibleOz: 10 }),
      ],
      15
    );
    expect(composition.affectations.map((part) => part.source_id)).toEqual(['a', 'b']);
  });

  it('ne compose rien pour une quantité nulle', () => {
    const composition = composer([lot({ source_id: 'a', date: '2026-06-01', disponibleOz: 10 })], 0);
    expect(composition.affectations).toHaveLength(0);
    expect(composition.couverte).toBe(false);
  });
});

describe('validerComposition', () => {
  const lots = [lot({ source_id: 'a', date: '2026-06-01', disponibleOz: 100 })];

  it('accepte une composition qui couvre exactement la vente', () => {
    expect(validerComposition(composer(lots, 100), 100)).toBeNull();
  });

  it('refuse une vente que le stock ne couvre pas', () => {
    expect(validerComposition(composer(lots, 150), 150)).toMatch(/ne couvre pas/);
  });

  it('refuse une quantité nulle', () => {
    expect(validerComposition(composer(lots, 0), 0)).toMatch(/supérieure à zéro/);
  });

  it('refuse une composition qui ne totalise pas la quantité vendue', () => {
    const composition = composer(lots, 50);
    expect(validerComposition(composition, 80)).toMatch(/ne correspond pas/);
  });
});

describe('construireLots', () => {
  const achatMine = {
    id: 'm1',
    numero_achat: 'AC-MI-2026-00001',
    date_achat: '2026-07-31',
    quantite_oz: 1_000,
    statut: 'validee' as const,
    mining_company: { name: 'Wahgnion Gold Mine' },
  };

  const achatArtisan = {
    id: 'v1',
    numero_recu: 'VE-OR-2026-00034',
    date_vente: '2026-07-15',
    quantite_grammes: GRAMMES_PAR_ONCE * 20,
    statut: 'validee',
    artisan: { nom: 'OUEDRAOGO', prenoms: 'Salif' },
  };

  it('réunit les deux filières et convertit les grammes en onces', () => {
    const lots = construireLots([achatMine], [achatArtisan], []);
    expect(lots).toHaveLength(2);
    expect(lots.find((l) => l.source_type === 'achat_artisan')?.quantiteOz).toBeCloseTo(20, 3);
    expect(lots.find((l) => l.source_type === 'achat_artisan')?.origine).toBe('Salif OUEDRAOGO');
    expect(lots.find((l) => l.source_type === 'achat_mine')?.origine).toBe('Wahgnion Gold Mine');
  });

  it('retranche ce qui est déjà affecté à des ventes', () => {
    const lots = construireLots(
      [achatMine],
      [],
      [{ source_type: 'achat_mine', achat_mine_id: 'm1', artisan_vente_id: null, quantite_oz: 400 }]
    );
    expect(lots[0].affecteeOz).toBe(400);
    expect(lots[0].disponibleOz).toBe(600);
  });

  it('écarte les achats non acquis', () => {
    const lots = construireLots(
      [{ ...achatMine, statut: 'annulee' as const }],
      [{ ...achatArtisan, statut: 'en_attente' }],
      []
    );
    expect(lots).toHaveLength(0);
  });

  it('ne rend pas un disponible négatif quand l’affectation dépasse le lot', () => {
    const lots = construireLots(
      [achatMine],
      [],
      [{ source_type: 'achat_mine', achat_mine_id: 'm1', artisan_vente_id: null, quantite_oz: 1_500 }]
    );
    expect(lots[0].disponibleOz).toBe(0);
    expect(lots[0].affecteeOz).toBe(1_500);
  });

  it('nomme les lots sans référence plutôt que d’afficher un vide', () => {
    const lots = construireLots([{ ...achatMine, numero_achat: null }], [], []);
    expect(lots[0].reference).toBe('Achat sans numéro');
  });

  it('mobilise une cession de comptoir acquise sans recompter son achat artisanal', () => {
    const lots = construireLots(
      [],
      [],
      [{
        source_type: 'cession_comptoir',
        achat_mine_id: null,
        artisan_vente_id: null,
        comptoir_cession_id: 'c1',
        quantite_oz: 2,
      }],
      0,
      [{
        id: 'c1',
        reference_vente: 'CESS-2026-001',
        date_vente: '2026-08-10',
        quantity_grams: GRAMMES_PAR_ONCE * 10,
        status: 'accepted',
        comptoir: { name: 'Comptoir NAFOLA' },
      }],
    );
    expect(lots).toEqual([
      expect.objectContaining({
        source_type: 'cession_comptoir',
        origine: 'Comptoir NAFOLA',
        quantiteOz: 10,
        affecteeOz: 2,
        disponibleOz: 8,
      }),
    ]);
  });
});

describe('nomArtisan', () => {
  it('assemble prénoms et nom', () => {
    expect(nomArtisan({ nom: 'SAWADOGO', prenoms: 'Adama' })).toBe('Adama SAWADOGO');
  });

  it('tolère un nom partiel', () => {
    expect(nomArtisan({ nom: 'SAWADOGO', prenoms: null })).toBe('SAWADOGO');
    expect(nomArtisan(null)).toBe('');
  });
});

describe('lots de vente physiquement éligibles', () => {
  const payload = {
    lots: [{
      source_type: 'achat_mine',
      source_id: '73000000-0000-4000-8000-000000000301',
      reference: 'AC-MI-2026-00001',
      origine: 'Mine de test',
      date: '2026-08-20',
      quantite_oz: '100',
      affectee_oz: '20',
      disponible_oz: '55.25',
    }],
    diagnostic: {
      blocked: false,
      code: null,
      historical_gap_count: 0,
      excluded_untraceable_source_count: 2,
      excluded_untraceable_quantity_oz: '12.5',
    },
  };

  beforeEach(() => rpcMock.mockReset());

  it('lit uniquement la RPC autoritative et normalise les quantités', async () => {
    rpcMock.mockResolvedValue({ data: payload, error: null });

    const result = await tracabiliteVenteService.lotsDisponibles();

    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('snp_lots_vente_export_eligibles');
    expect(result.lots).toEqual([expect.objectContaining({
      source_type: 'achat_mine',
      source_id: '73000000-0000-4000-8000-000000000301',
      disponibleOz: 55.25,
    })]);
    expect(result.diagnostic.excludedUntraceableSourceCount).toBe(2);
  });

  it('reste fermé si la RPC échoue, sans repli sur les tables historiques', async () => {
    const rpcError = { code: '42501', message: 'forbidden' };
    rpcMock.mockResolvedValue({ data: null, error: rpcError });

    await expect(tracabiliteVenteService.lotsDisponibles()).rejects.toBe(rpcError);
    expect(rpcMock).toHaveBeenCalledOnce();
  });

  it.each(['achat_artisan', 'cession_comptoir'])(
    'refuse côté client une source %s même si une réponse altérée la contient',
    (sourceType) => {
      expect(() => lireLotsEligibles({
        ...payload,
        lots: [{ ...payload.lots[0], source_type: sourceType }],
      })).toThrow(/contrat de stock physique/);
    },
  );

  it('refuse des quantités supérieures au reliquat de la source', () => {
    expect(() => lireLotsEligibles({
      ...payload,
      lots: [{ ...payload.lots[0], disponible_oz: 81 }],
    })).toThrow(/contrat de stock physique/);
  });

  it('ne tolère aucun lot lorsqu’un écart historique bloque les ventes', () => {
    expect(() => lireLotsEligibles({
      ...payload,
      diagnostic: {
        ...payload.diagnostic,
        blocked: true,
        code: 'historical_physical_backing_gaps',
        historical_gap_count: 1,
      },
    })).toThrow(/blocage physique historique/);
  });

  it('refuse un code de blocage lorsque blocked est faux', () => {
    expect(() => lireLotsEligibles({
      ...payload,
      diagnostic: {
        ...payload.diagnostic,
        blocked: false,
        code: 'historical_physical_backing_gaps',
      },
    })).toThrow(/diagnostic de disponibilité physique/);
  });

  it.each([
    { blocked: false, code: null, historical_gap_count: 1 },
    { blocked: true, code: 'historical_physical_backing_gaps', historical_gap_count: 0 },
  ])('refuse un compteur historique incohérent avec le blocage %#', (diagnostic) => {
    expect(() => lireLotsEligibles({
      ...payload,
      lots: [],
      diagnostic: { ...payload.diagnostic, ...diagnostic },
    })).toThrow(/diagnostic de disponibilité physique/);
  });

  it('fournit un message métier sans révéler les références des écarts historiques', () => {
    const result = lireLotsEligibles({
      lots: [],
      diagnostic: {
        ...payload.diagnostic,
        blocked: true,
        code: 'historical_physical_backing_gaps',
        historical_gap_count: 3,
      },
    });
    const message = messageIndisponibiliteLots(result);
    expect(message).toMatch(/ventes historiques.*stock physique/i);
    expect(message).not.toContain('3');
  });

  it('explique l’exclusion des filières sans provenance quand elles seules subsistent', () => {
    const result = lireLotsEligibles({ ...payload, lots: [] });
    expect(messageIndisponibiliteLots(result)).toMatch(/artisanales.*comptoir/i);
  });
});
