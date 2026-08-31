import { describe, expect, it } from 'vitest';
import { GRAMMES_PAR_ONCE } from './achatMineService';
import {
  composer,
  construireLots,
  nomArtisan,
  validerComposition,
  type Lot,
} from './tracabiliteVenteService';

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
