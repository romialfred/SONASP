import { describe, it, expect } from 'vitest';
import {
  GRAMS_PER_TROY_OZ,
  GRAMS_PER_OZ_TROY,
  gramsToOz,
  ozToGrams,
  convertWeight,
  formatWeightFromDB,
} from './weightConversion';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

describe('weightConversion — alignement sur la constante canonique', () => {
  it('GRAMS_PER_TROY_OZ provient de la source unique', () => {
    expect(GRAMS_PER_TROY_OZ).toBe(TROY_OZ_GRAMS);
    expect(GRAMS_PER_OZ_TROY).toBe(TROY_OZ_GRAMS);
  });

  it('gramsToOz / ozToGrams : round-trip sans dérive', () => {
    expect(gramsToOz(TROY_OZ_GRAMS)).toBeCloseTo(1, 9);
    expect(ozToGrams(1)).toBe(TROY_OZ_GRAMS);
    expect(ozToGrams(gramsToOz(1234.567))).toBeCloseTo(1234.567, 6);
  });

  it('convertWeight ozt <-> g utilise la valeur troy', () => {
    expect(convertWeight(1, 'ozt', 'g')).toBe(TROY_OZ_GRAMS);
    expect(convertWeight(TROY_OZ_GRAMS, 'g', 'ozt')).toBeCloseTo(1, 9);
  });

  it('formatWeightFromDB renvoie 0 pour null/undefined', () => {
    expect(formatWeightFromDB(null)).toBe(0);
    expect(formatWeightFromDB(TROY_OZ_GRAMS)).toBeCloseTo(1, 9);
  });
});
