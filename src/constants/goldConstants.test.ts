import { describe, it, expect } from 'vitest';
import {
  TROY_OZ_GRAMS,
  GRAMS_PER_TROY_OZ,
  GRAMS_PER_OZ_TROY,
  TROY_OZ_PER_KG,
  GOLD_ROYALTY_RATE,
  gramsToTroyOz,
  troyOzToGrams,
} from './goldConstants';

describe('goldConstants — source de vérité unique', () => {
  it('utilise la valeur EXACTE de l\'once troy (pas 31.1035)', () => {
    expect(TROY_OZ_GRAMS).toBe(31.1034768);
    expect(TROY_OZ_GRAMS).not.toBe(31.1035);
  });

  it('expose des alias cohérents pointant tous vers la valeur canonique', () => {
    expect(GRAMS_PER_TROY_OZ).toBe(TROY_OZ_GRAMS);
    expect(GRAMS_PER_OZ_TROY).toBe(TROY_OZ_GRAMS);
  });

  it('calcule correctement les onces troy par kg', () => {
    expect(TROY_OZ_PER_KG).toBeCloseTo(32.1507, 4);
  });

  it('fixe le taux de royalties à 3 %', () => {
    expect(GOLD_ROYALTY_RATE).toBe(0.03);
  });

  it('convertit g -> oz troy et retour sans perte (round-trip)', () => {
    const grams = 1000;
    const oz = gramsToTroyOz(grams);
    expect(oz).toBeCloseTo(32.1507, 4);
    expect(troyOzToGrams(oz)).toBeCloseTo(grams, 9);
  });

  it('1 once troy vaut exactement TROY_OZ_GRAMS grammes', () => {
    expect(troyOzToGrams(1)).toBe(31.1034768);
    expect(gramsToTroyOz(31.1034768)).toBe(1);
  });
});
