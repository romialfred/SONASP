import { describe, expect, it } from 'vitest';
import { comparer } from './coherenceStockService';

const vente = (id: string, quantite: number, status = 'completed') => ({
  id,
  sale_number: `SL-2026-${id}`,
  quantity_oz: quantite,
  status,
});

describe('comparer', () => {
  it('déclare cohérent un stock entièrement tracé', () => {
    const resultat = comparer(
      [vente('001', 100), vente('002', 50)],
      [
        { sale_id: '001', quantite_oz: 60 },
        { sale_id: '001', quantite_oz: 40 },
        { sale_id: '002', quantite_oz: 50 },
      ]
    );
    expect(resultat.coherent).toBe(true);
    expect(resultat.ecartOz).toBe(0);
    expect(resultat.ventesSansOrigine).toHaveLength(0);
  });

  it('nomme la vente dont l’origine manque', () => {
    const resultat = comparer([vente('001', 100)], []);
    expect(resultat.coherent).toBe(false);
    expect(resultat.ecartOz).toBe(100);
    expect(resultat.ventesSansOrigine[0]).toMatchObject({
      numero: 'SL-2026-001',
      quantiteOz: 100,
      traceeOz: 0,
      manquantOz: 100,
    });
  });

  it('signale une vente partiellement tracée', () => {
    const resultat = comparer([vente('001', 100)], [{ sale_id: '001', quantite_oz: 70 }]);
    expect(resultat.ventesSansOrigine[0].manquantOz).toBe(30);
    expect(resultat.traceeOz).toBe(70);
  });

  it('écarte les ventes annulées : elles n’entament aucun stock', () => {
    const resultat = comparer([vente('001', 100, 'cancelled')], []);
    expect(resultat.venduOz).toBe(0);
    expect(resultat.coherent).toBe(true);
  });

  it('ne compte pas un excès de lots comme une avance de traçabilité', () => {
    // 150 oz affectées pour 100 oz vendues : le surplus ne compense pas une
    // autre vente non tracée.
    const resultat = comparer(
      [vente('001', 100), vente('002', 100)],
      [{ sale_id: '001', quantite_oz: 150 }]
    );
    expect(resultat.traceeOz).toBe(100);
    expect(resultat.ecartOz).toBe(100);
    expect(resultat.ventesSansOrigine.map((v) => v.numero)).toEqual(['SL-2026-002']);
  });

  it('classe les manques du plus grand au plus petit', () => {
    const resultat = comparer(
      [vente('001', 10), vente('002', 90)],
      [{ sale_id: '002', quantite_oz: 20 }]
    );
    expect(resultat.ventesSansOrigine.map((v) => v.numero)).toEqual(['SL-2026-002', 'SL-2026-001']);
  });

  it('tolère l’absence de vente', () => {
    expect(comparer([], [])).toMatchObject({ venduOz: 0, traceeOz: 0, ecartOz: 0, coherent: true });
  });

  it('nomme une vente sans numéro plutôt que d’afficher un vide', () => {
    const resultat = comparer([{ id: 'x', sale_number: null, quantity_oz: 5, status: 'sold' }], []);
    expect(resultat.ventesSansOrigine[0].numero).toBe('Vente sans numéro');
  });
});
