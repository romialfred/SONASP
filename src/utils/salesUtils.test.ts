import { describe, it, expect } from 'vitest';
import {
  calculateGrossProceeds,
  calculateNetProceeds,
  calculateRoyalties,
  calculateSaleProceeds,
  convertGramsToOunces,
  convertOuncesToGrams,
  calculateFXSpread,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercentage,
  formatWeight,
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

describe('salesUtils — présentation française', () => {
  it('formate les nombres, poids et pourcentages avec la virgule décimale', () => {
    expect(formatNumber(1_234.5, 2)).toBe('1\u202f234,50');
    expect(formatWeight(TROY_OZ_GRAMS)).toBe(`1,000 oz (${formatNumber(TROY_OZ_GRAMS, 2)} g)`);
    expect(formatPercentage(99.5, 1)).toBe('99,5 %');
  });

  it('utilise les conventions françaises pour les devises et les dates', () => {
    expect(formatCurrency(1_234, 'USD')).toBe(new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(1_234));
    expect(formatDate('2026-01-15T12:00:00Z')).toContain('2026');
    expect(formatDate('2026-01-15T12:00:00Z').toLocaleLowerCase('fr-FR')).toContain('janv');
    expect(formatDateTime('2026-01-15T12:30:00Z')).toContain('12:30');
  });
});
