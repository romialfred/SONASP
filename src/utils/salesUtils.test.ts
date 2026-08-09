import { describe, it, expect } from 'vitest';
import {
  calculateGrossProceeds,
  calculateNetProceeds,
  calculateRoyalties,
  calculateSaleProceeds,
  convertGramsToOunces,
  convertOuncesToGrams,
  calculateFXSpread,
} from './salesUtils';
import { TROY_OZ_GRAMS, GOLD_ROYALTY_RATE } from '@/constants/goldConstants';

describe('salesUtils — conversions (once troy canonique)', () => {
  it('convertit grammes <-> onces avec la constante canonique', () => {
    expect(convertGramsToOunces(TROY_OZ_GRAMS)).toBeCloseTo(1, 9);
    expect(convertOuncesToGrams(1)).toBe(TROY_OZ_GRAMS);
  });

  it('round-trip g -> oz -> g sans dérive', () => {
    const grams = 5000;
    expect(convertOuncesToGrams(convertGramsToOunces(grams))).toBeCloseTo(grams, 6);
  });
});

describe('salesUtils — calcul des proceeds & royalties', () => {
  it('gross = poids x prix', () => {
    expect(calculateGrossProceeds(100, 2000)).toBe(200000);
  });

  it('net = gross - freight - autres coûts', () => {
    expect(calculateNetProceeds(200000, 500, 300)).toBe(199200);
  });

  it('royalties = net x 3 % par défaut (source unique)', () => {
    expect(calculateRoyalties(199200)).toBeCloseTo(199200 * GOLD_ROYALTY_RATE, 9);
    expect(calculateRoyalties(199200)).toBeCloseTo(5976, 6);
  });

  it('calculateSaleProceeds est cohérent de bout en bout', () => {
    const r = calculateSaleProceeds(100, 2000, 500, 300);
    expect(r.grossProceeds).toBe(200000);
    expect(r.netProceeds).toBe(199200);
    // assiette des royalties = net proceeds (règle unique, audit F3)
    expect(r.royalties).toBeCloseTo(199200 * 0.03, 9);
    expect(r.finalAmount).toBeCloseTo(r.netProceeds - r.royalties, 9);
  });

  it('respecte un taux de royalties explicite si fourni', () => {
    const r = calculateSaleProceeds(100, 2000, 0, 0, 0.05);
    expect(r.royalties).toBeCloseTo(200000 * 0.05, 9);
  });
});

describe('salesUtils — FX spread', () => {
  it('calcule l\'écart en % et protège la division par zéro', () => {
    expect(calculateFXSpread(610, 600)).toBeCloseTo((10 / 600) * 100, 9);
    expect(calculateFXSpread(610, 0)).toBe(0);
  });
});
