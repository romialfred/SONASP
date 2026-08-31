import { describe, expect, it } from 'vitest';
import {
  GRAMMES_PAR_ONCE,
  construireTendanceStock,
  construireHistoriqueMouvements,
  grouperParMine,
  lireLignes,
  orFin,
  ozVersKg,
  somme,
  STATUT_A_REINTEGRER,
  STATUTS_AEROPORT,
  STATUTS_EN_ROUTE,
  STATUTS_TRANSIT,
  venduNonPaye,
} from './inventoryOverviewData';

const ligne = (over: Record<string, unknown> = {}) => ({
  mining_company_id: 'm1' as string | null,
  final_fine_oz: 100,
  quantity_available_oz: 60,
  quantity_allocated_oz: 30,
  quantity_sold_oz: 10,
  quantity_national_reserve_oz: 0,
  ...over,
});

describe('conversions', () => {
  it('convertit les onces en kilogrammes', () => {
    expect(ozVersKg(1000)).toBeCloseTo((1000 * GRAMMES_PAR_ONCE) / 1000, 6);
    expect(ozVersKg(0)).toBe(0);
  });
});

describe('construireTendanceStock', () => {
  it('regroupe les entrées réelles sur les six derniers mois et conserve les mois vides', () => {
    const tendance = construireTendanceStock(
      [
        { entry_date: '2026-08-04', final_fine_oz: 120 },
        { entry_date: '2026-08-18', final_fine_oz: 30 },
        { entry_date: '2026-06-01', final_fine_oz: 75 },
        { entry_date: '2025-12-01', final_fine_oz: 999 },
      ],
      new Date('2026-08-24T00:00:00Z')
    );

    expect(tendance.map((point) => point.cle)).toEqual([
      '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ]);
    expect(tendance.map((point) => point.valeurOz)).toEqual([0, 0, 0, 75, 0, 150]);
  });

  it('ignore une date invalide', () => {
    const tendance = construireTendanceStock(
      [{ entry_date: 'date-invalide', final_fine_oz: 100 }],
      new Date('2026-08-24T00:00:00Z')
    );
    expect(tendance.every((point) => point.valeurOz === 0)).toBe(true);
  });
});

describe('construireHistoriqueMouvements', () => {
  it('classe les allocations et retours dans le poste correspondant', () => {
    const historique = construireHistoriqueMouvements([
      { id: 'm1', transaction_type: 'allocation', transaction_date: '2026-08-22', transaction_reference: 'VTE-001', quantity_oz: -40 },
      { id: 'm2', transaction_type: 'deallocation', transaction_date: '2026-08-23', transaction_reference: 'VTE-001', quantity_oz: 10 },
      { id: 'm3', transaction_type: 'exit', transaction_date: '2026-08-24', transaction_reference: 'VTE-002', quantity_oz: -25 },
    ]);

    expect(historique.map((ligne) => ligne.poste)).toEqual(['alloue', 'disponible']);
    expect(historique[0].quantiteOz).toBe(40);
    expect(historique.some((ligne) => ligne.id === 'm3')).toBe(false);
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
    expect(groupes[1].totalOz).toBe(180);
    expect(groupes[1].disponibleOz).toBe(120);
    expect(groupes[1].lignes).toBe(2);
  });

  it('range à part les lignes sans société plutôt que de les écarter', () => {
    // Les ignorer ferait mentir le total par mine face au total national.
    const groupes = grouperParMine([ligne({ mining_company_id: null })], societes);
    expect(groupes[0].nom).toBe('Sans société rattachée');
    expect(groupes[0].totalOz).toBe(90);
  });

  it('nomme les sociétés absentes du référentiel', () => {
    const groupes = grouperParMine([ligne({ mining_company_id: 'inconnue' })], societes);
    expect(groupes[0].nom).toBe('Société inconnue');
  });
});

describe('venduNonPaye', () => {
  const ventes = [
    { id: 'v1', quantity_oz: 100, total_amount: 1_000, currency: 'USD', status: 'sold' },
    { id: 'v2', quantity_oz: 50, total_amount: 500, currency: 'USD', status: 'sold' },
    { id: 'v3', quantity_oz: 25, total_amount: 250, currency: 'USD', status: 'sold' },
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
      [ventes[0], { id: 'v4', quantity_oz: 10, total_amount: 100, currency: 'XOF', status: 'sold' }],
      []
    );
    expect(resultat.devise).toBeNull();
  });

  it('ignore une vente annulée ou encore au brouillon', () => {
    expect(venduNonPaye([
      { id: 'draft', quantity_oz: 50, total_amount: 500, currency: 'USD', status: 'draft' },
      { id: 'cancelled', quantity_oz: 50, total_amount: 500, currency: 'USD', status: 'cancelled' },
    ], []).nombre).toBe(0);
  });
});


describe('libellés d’énumération', () => {
  it('emploie exactement les valeurs de `shipping_preparation_status`', () => {
    // Un seul caractère de trop ou de moins fait échouer la requête entière :
    // PostgREST refuse la valeur, la source passe en « indisponible », et
    // l’aéroport affiche 0 oz alors que des lots y attendent (A197).
    expect([...STATUTS_AEROPORT]).toEqual([
      'waiting_for_customs_approval',
      'approved_by_customs',
      'ready_for_expedition',
    ]);
  });

  it('sépare l’or en route de l’or raffiné à réintégrer', () => {
    // Le premier n’appelle aucun geste ; le second attend une saisie d’entrée.
    expect([...STATUTS_EN_ROUTE]).not.toContain(STATUT_A_REINTEGRER);
    expect([...STATUTS_TRANSIT]).toEqual([...STATUTS_EN_ROUTE, STATUT_A_REINTEGRER]);
  });
});

describe('or fin d’un lot artisanal', () => {
  it('applique le carat comme vingt-quatrième de métal fin', () => {
    expect(orFin({ quantite_grammes: 240, purete_karat: 18 })).toBeCloseTo(180, 6);
    expect(orFin({ quantite_grammes: 100, purete_karat: 24 })).toBeCloseTo(100, 6);
  });

  it('ne suppose pas un lot pur faute de pureté déclarée', () => {
    expect(orFin({ quantite_grammes: 500, purete_karat: null })).toBe(0);
    expect(orFin({ quantite_grammes: 500 })).toBe(0);
  });
});
