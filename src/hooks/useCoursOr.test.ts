import { describe, expect, it } from 'vitest';
import { GRAMMES_PAR_ONCE, ecartAuCours, prixGrammeDepuisOnce } from './useCoursOr';

describe('prixGrammeDepuisOnce', () => {
  it('convertit l’once en gramme au taux du référentiel', () => {
    // 4 448,88 USD/oz à 600 FCFA/USD → 2 669 328 FCFA/oz → 85 821 FCFA/g
    const prix = prixGrammeDepuisOnce(4_448.88, 600);
    expect(prix).not.toBeNull();
    expect(Math.round(prix as number)).toBe(Math.round((4_448.88 * 600) / GRAMMES_PAR_ONCE));
  });

  it('ne convertit rien sans cours ou sans taux', () => {
    // Une conversion approximative vaut moins que pas de conversion du tout.
    expect(prixGrammeDepuisOnce(null, 600)).toBeNull();
    expect(prixGrammeDepuisOnce(4_448.88, null)).toBeNull();
    expect(prixGrammeDepuisOnce(0, 600)).toBeNull();
    expect(prixGrammeDepuisOnce(4_448.88, 0)).toBeNull();
  });
});

describe('ecartAuCours', () => {
  it('mesure la prime et la décote', () => {
    expect(ecartAuCours(110, 100)).toBeCloseTo(10, 6);
    expect(ecartAuCours(90, 100)).toBeCloseTo(-10, 6);
    expect(ecartAuCours(100, 100)).toBe(0);
  });

  it('n’annonce aucun écart sans référence ni sans prix', () => {
    expect(ecartAuCours(100, null)).toBeNull();
    expect(ecartAuCours(0, 100)).toBeNull();
    expect(ecartAuCours(100, 0)).toBeNull();
  });
});
