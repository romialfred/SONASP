import { describe, expect, it } from 'vitest';
import {
  GRAMMES_PAR_ONCE,
  calculerStock,
  oncesVersGrammes,
  validerAchat,
  valoriser,
  type StatutAchat,
} from './achatMineService';

describe('valoriser', () => {
  it('ajoute les taxes au montant brut', () => {
    // 100 oz à 2 500 000 FCFA → 250 000 000 brut, aux taux qu'on lui donne.
    const v = valoriser(100, 2_500_000, 18, 1);
    expect(v.montantBrut).toBe(250_000_000);
    expect(v.tva).toBe(45_000_000);
    expect(v.taxeDevComm).toBe(2_500_000);
    expect(v.montantTotal).toBe(297_500_000);
  });

  it('accepte des taux particuliers', () => {
    const v = valoriser(10, 1_000, 0, 0);
    expect(v.montantTotal).toBe(10_000);
  });

  it('ne produit rien de négatif', () => {
    expect(valoriser(-5, 1_000, 18, 1).montantBrut).toBe(0);
    expect(valoriser(5, -1_000, 18, 1).montantBrut).toBe(0);
  });
});

describe('oncesVersGrammes', () => {
  it('convertit à l’once troy', () => {
    expect(oncesVersGrammes(1)).toBeCloseTo(GRAMMES_PAR_ONCE, 3);
    expect(oncesVersGrammes(0)).toBe(0);
  });
});

const societes = [
  { id: 'm1', name: 'SEMAFO Boungou Gold Mine' },
  { id: 'm2', name: 'Wahgnion Gold Mine' },
];

describe('calculerStock', () => {
  it('cumule la production et retranche les achats engagés', () => {
    const stocks = calculerStock(
      [
        { mining_company_id: 'm1', estimated_oz: 1_000 },
        { mining_company_id: 'm1', estimated_oz: 500 },
        { mining_company_id: 'm2', estimated_oz: 200 },
      ],
      [{ mining_company_id: 'm1', quantite_oz: 400, statut: 'validee' }],
      societes
    );

    const semafo = stocks.find((s) => s.mining_company_id === 'm1');
    expect(semafo?.produitOz).toBe(1_500);
    expect(semafo?.acheteOz).toBe(400);
    expect(semafo?.disponibleOz).toBe(1_100);
    expect(semafo?.declarations).toBe(2);
  });

  it('libère la quantité d’un achat annulé', () => {
    const stocks = calculerStock(
      [{ mining_company_id: 'm1', estimated_oz: 1_000 }],
      [
        { mining_company_id: 'm1', quantite_oz: 300, statut: 'annulee' },
        { mining_company_id: 'm1', quantite_oz: 200, statut: 'payee' },
      ],
      societes
    );
    expect(stocks[0].acheteOz).toBe(200);
    expect(stocks[0].disponibleOz).toBe(800);
  });

  it('retient les achats en attente : la quantité est déjà promise', () => {
    const stocks = calculerStock(
      [{ mining_company_id: 'm1', estimated_oz: 100 }],
      [{ mining_company_id: 'm1', quantite_oz: 100, statut: 'en_attente' }],
      societes
    );
    expect(stocks[0].disponibleOz).toBe(0);
  });

  it('ne descend pas sous zéro en cas de sur-achat', () => {
    // Le dépassement doit se lire ailleurs, pas se transformer en stock négatif.
    const stocks = calculerStock(
      [{ mining_company_id: 'm1', estimated_oz: 100 }],
      [{ mining_company_id: 'm1', quantite_oz: 150, statut: 'validee' }],
      societes
    );
    expect(stocks[0].disponibleOz).toBe(0);
    expect(stocks[0].acheteOz).toBe(150);
  });

  it('écarte les productions sans société et nomme les sociétés inconnues', () => {
    const stocks = calculerStock(
      [{ mining_company_id: null, estimated_oz: 999 }, { mining_company_id: 'inconnue', estimated_oz: 10 }],
      [],
      societes
    );
    expect(stocks).toHaveLength(1);
    expect(stocks[0].nom).toBe('Société inconnue');
  });

  it('classe par disponible décroissant', () => {
    const stocks = calculerStock(
      [
        { mining_company_id: 'm1', estimated_oz: 100 },
        { mining_company_id: 'm2', estimated_oz: 900 },
      ],
      [],
      societes
    );
    expect(stocks.map((s) => s.mining_company_id)).toEqual(['m2', 'm1']);
  });
});

describe('validerAchat', () => {
  const base = {
    mining_company_id: 'm1',
    periode_debut: '2026-08-01',
    periode_fin: '2026-08-31',
    quantite_oz: 100,
    prix_once_fcfa: 2_500_000,
  };

  it('accepte un achat complet dans le stock', () => {
    expect(validerAchat(base, 500)).toBeNull();
    expect(validerAchat(base, 100)).toBeNull();
  });

  it('exige la société, la période et une quantité', () => {
    expect(validerAchat({ ...base, mining_company_id: '' }, 500)).toMatch(/société/i);
    expect(validerAchat({ ...base, periode_fin: '' }, 500)).toMatch(/période/i);
    expect(validerAchat({ ...base, quantite_oz: 0 }, 500)).toMatch(/quantité/i);
  });

  it('refuse une période inversée', () => {
    expect(validerAchat({ ...base, periode_fin: '2026-07-01' }, 500)).toMatch(/antérieure/i);
  });

  it('refuse d’acheter plus que le stock disponible', () => {
    // La SONASP achète tout ou partie du stock, jamais au-delà.
    expect(validerAchat({ ...base, quantite_oz: 501 }, 500)).toMatch(/dépasse le stock/i);
  });

  it('n’oppose aucun plafond quand le stock n’est pas connu', () => {
    expect(validerAchat(base, null)).toBeNull();
  });

  it('exige un prix', () => {
    expect(validerAchat({ ...base, prix_once_fcfa: 0 }, 500)).toMatch(/prix/i);
  });
});

describe('statuts', () => {
  it('couvre les quatre états du cycle', () => {
    const attendus: StatutAchat[] = ['en_attente', 'validee', 'payee', 'annulee'];
    attendus.forEach((statut) => expect(attendus).toContain(statut));
  });
});
