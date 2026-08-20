import { describe, expect, it } from 'vitest';
import {
  agregerBalanceAgee,
  arrondirMontant,
  arrondirQuantite,
  joursDeRetard,
  repartirParPourcentage,
  repartirParQuantiteCible,
  simulerAffectationFifo,
  trancheAnciennete,
  validerLigne,
  valoriserLigne,
} from './achatsIndustrielsCalculs';

const mine = (id: string, eligible: number) => ({
  mining_company_id: id,
  production_eligible_oz: eligible,
});

describe('répartition par pourcentage', () => {
  it('applique le taux à la production éligible de chaque mine', () => {
    const parts = repartirParPourcentage(
      [mine('a', 1000), mine('b', 500), mine('c', 250)],
      40
    );
    expect(parts.map((p) => p.quantite_proposee_oz)).toEqual([400, 200, 100]);
    expect(parts.every((p) => p.pourcentage_applique === 40)).toBe(true);
  });

  it('n’attribue rien à une mine sans production éligible', () => {
    const [part] = repartirParPourcentage([mine('a', 0)], 40);
    expect(part.quantite_proposee_oz).toBe(0);
    // Un pourcentage sur une assiette nulle ne veut rien dire : il reste vide.
    expect(part.pourcentage_applique).toBeNull();
  });

  it('borne le taux à cent pour cent', () => {
    const [part] = repartirParPourcentage([mine('a', 800)], 250);
    expect(part.quantite_proposee_oz).toBe(800);
  });

  it('ignore une production négative plutôt que de la propager', () => {
    const [part] = repartirParPourcentage([mine('a', -300)], 40);
    expect(part.quantite_proposee_oz).toBe(0);
  });
});

describe('répartition d’une quantité nationale', () => {
  it('répartit au prorata de la production éligible', () => {
    const parts = repartirParQuantiteCible([mine('a', 600), mine('b', 400)], 1000);
    expect(parts[0].quantite_proposee_oz).toBe(600);
    expect(parts[1].quantite_proposee_oz).toBe(400);
  });

  it('retombe exactement sur la cible malgré les arrondis', () => {
    // Trois parts égales d'une cible indivisible : la somme des arrondis
    // manquerait la cible si le reliquat n'était pas replacé.
    const parts = repartirParQuantiteCible(
      [mine('a', 1), mine('b', 1), mine('c', 1)],
      100
    );
    const total = parts.reduce((somme, part) => somme + part.quantite_proposee_oz, 0);
    expect(arrondirQuantite(total)).toBe(100);
  });

  it('verse le reliquat à la plus grosse ligne, pas à la première venue', () => {
    const parts = repartirParQuantiteCible(
      [mine('petite', 1), mine('grosse', 998), mine('moyenne', 1)],
      1000
    );
    const total = parts.reduce((somme, part) => somme + part.quantite_proposee_oz, 0);
    expect(arrondirQuantite(total)).toBe(1000);
    const grosse = parts.find((part) => part.mining_company_id === 'grosse');
    expect(grosse!.quantite_proposee_oz).toBeGreaterThan(990);
  });

  it('ne répartit rien quand aucune mine n’a de production', () => {
    const parts = repartirParQuantiteCible([mine('a', 0), mine('b', 0)], 500);
    expect(parts.every((part) => part.quantite_proposee_oz === 0)).toBe(true);
  });

  it('ne produit pas de quantité négative', () => {
    const parts = repartirParQuantiteCible([mine('a', 100)], -50);
    expect(parts[0].quantite_proposee_oz).toBe(0);
  });
});

describe('valorisation', () => {
  it('multiplie la quantité par le prix, au centime', () => {
    expect(valoriserLigne(878.0212, 2_600_000)).toBe(2_282_855_120);
  });

  it('refuse de valoriser une quantité négative', () => {
    expect(valoriserLigne(-10, 2_600_000)).toBe(0);
  });
});

describe('affectation automatique', () => {
  const factures = [
    { id: 'f2', numero_facture: 'FA-002', date_echeance: '2026-03-15', date_emission: '2026-02-15', reste_du_fcfa: 300 },
    { id: 'f1', numero_facture: 'FA-001', date_echeance: '2026-01-31', date_emission: '2026-01-01', reste_du_fcfa: 500 },
    { id: 'f3', numero_facture: 'FA-003', date_echeance: '2026-06-30', date_emission: '2026-06-01', reste_du_fcfa: 900 },
  ];

  it('solde d’abord la facture la plus ancienne', () => {
    const { affectations } = simulerAffectationFifo(600, factures);
    expect(affectations[0]).toMatchObject({ numero_facture: 'FA-001', montant_affecte_fcfa: 500 });
    expect(affectations[1]).toMatchObject({ numero_facture: 'FA-002', montant_affecte_fcfa: 100 });
  });

  it('couvre plusieurs factures avec un seul règlement', () => {
    const { affectations, soldeNonAffecte } = simulerAffectationFifo(800, factures);
    expect(affectations).toHaveLength(2);
    expect(soldeNonAffecte).toBe(0);
  });

  it('conserve le montant qui dépasse la dette', () => {
    const { affectations, soldeNonAffecte } = simulerAffectationFifo(2000, factures);
    expect(affectations).toHaveLength(3);
    // Le trop-perçu ne s'évapore pas : il reste disponible pour la suite.
    expect(soldeNonAffecte).toBe(300);
  });

  it('n’affecte rien quand tout est déjà soldé', () => {
    const { affectations, soldeNonAffecte } = simulerAffectationFifo(
      500,
      factures.map((facture) => ({ ...facture, reste_du_fcfa: 0 }))
    );
    expect(affectations).toHaveLength(0);
    expect(soldeNonAffecte).toBe(500);
  });

  it('départage deux factures de même échéance par leur date d’émission', () => {
    const { affectations } = simulerAffectationFifo(100, [
      { id: 'b', numero_facture: 'FA-B', date_echeance: '2026-05-01', date_emission: '2026-04-20', reste_du_fcfa: 60 },
      { id: 'a', numero_facture: 'FA-A', date_echeance: '2026-05-01', date_emission: '2026-04-02', reste_du_fcfa: 60 },
    ]);
    expect(affectations[0].numero_facture).toBe('FA-A');
  });
});

describe('ancienneté', () => {
  it('ne compte pas de retard avant l’échéance', () => {
    expect(joursDeRetard('2026-09-30', '2026-08-20')).toBe(0);
    expect(trancheAnciennete('2026-09-30', '2026-08-20')).toBe('non_echu');
  });

  it('classe le retard dans sa tranche', () => {
    expect(trancheAnciennete('2026-08-01', '2026-08-20')).toBe('j1_30');
    expect(trancheAnciennete('2026-07-01', '2026-08-20')).toBe('j31_60'); // 50 jours
    expect(trancheAnciennete('2026-06-06', '2026-08-20')).toBe('j61_90'); // 75 jours
    expect(trancheAnciennete('2026-03-01', '2026-08-20')).toBe('j91_180');
    expect(trancheAnciennete('2025-06-01', '2026-08-20')).toBe('plus_180');
  });

  it('traite l’échéance du jour comme non échue', () => {
    expect(trancheAnciennete('2026-08-20', '2026-08-20')).toBe('non_echu');
  });

  it('agrège un portefeuille par tranche', () => {
    const balance = agregerBalanceAgee(
      [
        { date_echeance: '2026-09-30', reste_du_fcfa: 1000 },
        { date_echeance: '2026-08-10', reste_du_fcfa: 500 },
        { date_echeance: '2026-06-01', reste_du_fcfa: 250 },
        { date_echeance: '2025-01-01', reste_du_fcfa: 125 },
      ],
      '2026-08-20'
    );
    expect(balance.non_echu).toBe(1000);
    expect(balance.j1_30).toBe(500);
    expect(balance.j61_90).toBe(250);
    expect(balance.plus_180).toBe(125);
    expect(balance.total).toBe(1875);
    expect(balance.nbFactures).toBe(4);
  });

  it('écarte les factures soldées du portefeuille', () => {
    const balance = agregerBalanceAgee(
      [{ date_echeance: '2026-01-01', reste_du_fcfa: 0 }],
      '2026-08-20'
    );
    expect(balance.total).toBe(0);
    expect(balance.nbFactures).toBe(0);
  });
});

describe('validation d’une ligne de plan', () => {
  it('accepte une ligne cohérente', () => {
    expect(validerLigne({
      quantite_proposee_oz: 400, production_eligible_oz: 1000, prix_once_fcfa: 2_600_000,
    })).toBeNull();
  });

  it('laisse passer une ligne à zéro : la mine peut n’être pas sollicitée', () => {
    expect(validerLigne({
      quantite_proposee_oz: 0, production_eligible_oz: 1000, prix_once_fcfa: 0,
    })).toBeNull();
  });

  it('refuse un dépassement de la production éligible', () => {
    expect(validerLigne({
      quantite_proposee_oz: 1200, production_eligible_oz: 1000, prix_once_fcfa: 2_600_000,
    })).toMatch(/dépasse la production éligible/);
  });

  it('refuse une quantité sans prix', () => {
    expect(validerLigne({
      quantite_proposee_oz: 400, production_eligible_oz: 1000, prix_once_fcfa: 0,
    })).toMatch(/prix à l’once/);
  });

  it('refuse une quantité négative', () => {
    expect(validerLigne({
      quantite_proposee_oz: -1, production_eligible_oz: 1000, prix_once_fcfa: 2_600_000,
    })).toMatch(/négative/);
  });
});

describe('arrondis', () => {
  it('arrondit au centime sans dériver', () => {
    expect(arrondirMontant(1.005)).toBe(1.01);
    expect(arrondirMontant(2.675)).toBe(2.68);
  });

  it('tient quatre décimales sur les onces', () => {
    expect(arrondirQuantite(878.02115)).toBe(878.0212);
  });
});
