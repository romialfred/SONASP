import { describe, it, expect } from 'vitest';
import { gramsToOunces, ouncesToGrams, calculateVariance, generateBatchNumber, formatWeight, calculateFinalFine } from './batchUtils';

describe('batchUtils', () => {
  describe('gramsToOunces', () => {
    it('should convert grams to ounces correctly', () => {
      expect(gramsToOunces(1000)).toBeCloseTo(35.27, 2);
      expect(gramsToOunces(100)).toBeCloseTo(3.53, 2);
      expect(gramsToOunces(0)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(gramsToOunces(155.5)).toBeCloseTo(5.48, 1);
    });
  });

  describe('ouncesToGrams', () => {
    it('should convert ounces to grams correctly', () => {
      expect(ouncesToGrams(35.27)).toBeCloseTo(1000, 0);
      expect(ouncesToGrams(3.53)).toBeCloseTo(100, 0);
      expect(ouncesToGrams(0)).toBe(0);
    });

    it('should be inverse of gramsToOunces', () => {
      const grams = 500;
      const ounces = gramsToOunces(grams);
      const backToGrams = ouncesToGrams(ounces);
      expect(backToGrams).toBeCloseTo(grams, 1);
    });
  });

  describe('calculateVariance', () => {
    it('should calculate positive variance', () => {
      const result = calculateVariance(100, 110);
      expect(result.percentage).toBeCloseTo(10, 2);
      expect(result.difference).toBeCloseTo(10, 2);
    });

    it('should calculate negative variance', () => {
      const result = calculateVariance(100, 90);
      expect(result.percentage).toBeCloseTo(-10, 2);
      expect(result.difference).toBeCloseTo(-10, 2);
    });

    it('should return 0 for no variance', () => {
      const result = calculateVariance(100, 100);
      expect(result.percentage).toBe(0);
      expect(result.difference).toBe(0);
    });

    it('should handle zero expected value', () => {
      const result = calculateVariance(0, 10);
      expect(result.percentage).toBe(0);
    });

    it('should flag significant variance over 2%', () => {
      const result = calculateVariance(100, 103);
      expect(result.isSignificant).toBe(true);
    });
  });

  describe('generateBatchNumber', () => {
    it('should generate batch numbers with format', () => {
      const batch = generateBatchNumber('GN');
      expect(batch).toMatch(/^BT-\d{6}-GN-\d{4}$/);
    });

    it('should generate unique batch numbers', () => {
      const batch1 = generateBatchNumber('GN');
      const batch2 = generateBatchNumber('GN');
      expect(batch1).not.toBe(batch2);
    });

    it('should include country code', () => {
      expect(generateBatchNumber('GN')).toContain('-GN-');
      expect(generateBatchNumber('CI')).toContain('-CI-');
      expect(generateBatchNumber('ML')).toContain('-ML-');
    });

    it('should include current year and month', () => {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      expect(generateBatchNumber('GN')).toContain(`BT-${year}${month}`);
    });
  });

  describe('formatWeight', () => {
    it('should format weight with both units', () => {
      const result = formatWeight(100);
      expect(result).toContain('100.00g');
      expect(result).toContain('oz');
    });

    it('should format weight with grams only', () => {
      const result = formatWeight(100, false);
      expect(result).toBe('100.00g');
      expect(result).not.toContain('oz');
    });
  });

  describe('calculateFinalFine', () => {
    it('should calculate final fine correctly', () => {
      const result = calculateFinalFine(1000, 95, 98);
      expect(result.finalFineGrams).toBeCloseTo(931, 0);
      expect(result.finalFineOunces).toBeCloseTo(32.83, 1);
    });

    it('should handle 100% fineness and retention', () => {
      const result = calculateFinalFine(1000, 100, 100);
      expect(result.finalFineGrams).toBe(1000);
    });
  });
});
