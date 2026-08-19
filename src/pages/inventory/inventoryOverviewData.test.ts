import { describe, expect, it } from 'vitest';
import {
  GRAMMES_PAR_ONCE,
  grouperParMine,
  lireLignes,
  ozVersKg,
  somme,
  venduNonPaye,
} from './inventoryOverviewData';

const ligne = (over: Record<string, unknown> = {}) => ({
  mining_company_id: 'm1' as string | null,
  final_fine_oz: 100,
  quantity_available_oz: 60,
  quantity_allocated_oz: 30,
  quantity_sold_oz: 10,
  ...over,
});

describe('conversions', () => {
  it('convertit les onces en kilogrammes', () => {
    expect(ozVersKg(1000)).toBeCloseTo((1000 * GRAMMES_PAR_ONCE) / 1000, 6);
    expect(ozVersKg(0)).toBe(0);
  });
});

describe('lireLignes', () => {
  it('rend les lignes d’un résultat abouti', () => {
    const resultat = { status: 'fulfilled' as const, value: { data: [{ a: 1 }], error: null } };
    expect(lireLignes(resultat)).toEqual([{ a: 1 }]);
  });

  it('rend null sur un échec, une erreur ou un contenu inattendu', () => {
    // Une source en échec ne doit pas se confondre avec une source vide.
    expect(lireLignes({ status: 'rejected', reason: new Error('x') } as never)).toBeNull();
    expect(lireLignes({ status: 'fulfilled', value: { data: null, error: { message: 'x' } } })).toBeNull();
    expect(lireLignes({ status: 'fulfilled', value: { data: 'pas un tableau', error: null } })).toBeNull();
  });
});

describe('somme', () => {
  it('ignore les valeurs absentes', () => {
    expect(somme([{ v: 1 }, { v: null }, { v: 3 }], (l) => Number(l.v))).toBe(4);
  });
});

describe('grouperParMine', () => {
  const societes = [
    { id: 'm1', name: 'Essakane SA' },
    { id: 'm2', name: 'Bissa Gold' },
  ];

  it('cumule le stock par société et ordonne par volume', () => {
    const groupes = grouperParMine(
      [ligne(), ligne(), ligne({ mining_company_id: 'm2', final_fine_oz: 500, quantity_available_oz: 500, quantity_allocated_oz: 0, quantity_sold_oz: 0 })],
      societes
    );

    expect(groupes.map((g) => g.nom)).toEqual(['Bissa Gold', 'Essakane SA']);
    expect(groupes[1].totalOz).toBe(200);
    expect(groupes[1].disponibleOz).toBe(120);
    expect(groupes[1].lignes).toBe(2);
  });

  it('range à part les lignes sans société plutôt que de les écarter', () => {
    // Les ignorer ferait mentir le total par mine face au total national.
    const groupes = grouperParMine([ligne({ mining_company_id: null })], societes);
    expect(groupes[0].nom).toBe('Sans société rattachée');
    expect(groupes[0].totalOz).toBe(100);
  });

  it('nomme les sociétés absentes du référentiel', () => {
    const groupes = grouperParMine([ligne({ mining_company_id: 'inconnue' })], societes);
    expect(groupes[0].nom).toBe('Société inconnue');
  });
});

describe('venduNonPaye', () => {
  const ventes = [
    { id: 'v1', quantity_oz: 100, total_amount: 1_000, currency: 'USD' },
    { id: 'v2', quantity_oz: 50, total_amount: 500, currency: 'USD' },
    { id: 'v3', quantity_oz: 25, total_amount: 250, currency: 'USD' },
  ];

  it('écarte les ventes réglées', () => {
    const resultat = venduNonPaye(ventes, [{ sale_id: 'v1', status: 'approved' }]);
    expect(resultat.nombre).toBe(2);
    expect(resultat.quantiteOz).toBe(75);
    expect(resultat.montant).toBe(750);
    expect(resultat.devise).toBe('USD');
  });

  it('compte une vente sans paiement comme non réglée', () => {
    // C'est de l'or sorti du stock sans contrepartie constatée.
    expect(venduNonPaye(ventes, []).nombre).toBe(3);
  });

  it('ne tient pas un paiement en attente pour un règlement', () => {
    expect(venduNonPaye(ventes, [{ sale_id: 'v1', status: 'pending' }]).nombre).toBe(3);
  });

  it('refuse d’additionner des devises différentes', () => {
    const resultat = venduNonPaye(
      [ventes[0], { id: 'v4', quantity_oz: 10, total_amount: 100, currency: 'XOF' }],
      []
    );
    expect(resultat.devise).toBeNull();
  });
});
