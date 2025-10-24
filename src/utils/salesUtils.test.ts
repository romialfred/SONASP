import { describe, it, expect } from 'vitest';
import { calculateSaleProceeds, formatCurrency, calculateFXSpread, calculateCustomerPerformance } from './salesUtils';

describe('salesUtils', () => {
  describe('calculateSaleProceeds', () => {
    it('should calculate all sales metrics correctly', () => {
      const result = calculateSaleProceeds(10, 2000, 500, 300);

      expect(result.quantity).toBe(10);
      expect(result.londonAMRate).toBe(2000);
      expect(result.grossProceeds).toBe(20000);
      expect(result.totalCosts).toBe(800);
      expect(result.netProceeds).toBe(19200);
      expect(result.royalties).toBeCloseTo(576, 2);
      expect(result.finalProceeds).toBeCloseTo(18624, 2);
    });

    it('should handle zero costs', () => {
      const result = calculateSaleProceeds(10, 2000);

      expect(result.grossProceeds).toBe(20000);
      expect(result.totalCosts).toBe(0);
      expect(result.netProceeds).toBe(20000);
      expect(result.royalties).toBe(600);
      expect(result.finalProceeds).toBe(19400);
    });

    it('should calculate 3% royalties correctly', () => {
      const result = calculateSaleProceeds(100, 1000, 0, 0);

      expect(result.netProceeds).toBe(100000);
      expect(result.royalties).toBe(3000);
      expect(result.netSmeltedRoyalties).toBe(3000);
    });

    it('should handle minimal transaction', () => {
      const result = calculateSaleProceeds(1, 1000);

      expect(result.grossProceeds).toBe(1000);
      expect(result.netProceeds).toBe(1000);
      expect(result.royalties).toBe(30);
      expect(result.finalProceeds).toBe(970);
    });

    it('should handle large transaction', () => {
      const result = calculateSaleProceeds(1000, 2500, 5000, 2000);

      expect(result.grossProceeds).toBe(2500000);
      expect(result.totalCosts).toBe(7000);
      expect(result.netProceeds).toBe(2493000);
      expect(result.royalties).toBeCloseTo(74790, 0);
      expect(result.finalProceeds).toBeCloseTo(2418210, 0);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format other currencies', () => {
      const eur = formatCurrency(1000, 'EUR');
      expect(eur).toContain('1,000.00');
    });
  });

  describe('calculateFXSpread', () => {
    it('should calculate FX spread correctly', () => {
      const spread = calculateFXSpread(100, 102);
      expect(spread).toBeCloseTo(0.02, 4);
    });

    it('should handle negative spreads', () => {
      const spread = calculateFXSpread(100, 98);
      expect(spread).toBeCloseTo(0.02, 4);
    });

    it('should handle zero spread', () => {
      const spread = calculateFXSpread(100, 100);
      expect(spread).toBe(0);
    });
  });

  describe('calculateCustomerPerformance', () => {
    it('should calculate performance metrics correctly', () => {
      const purchases = [
        {
          amount: 1000,
          paymentDate: new Date('2025-01-01'),
          expectedPaymentDate: new Date('2025-01-05')
        },
        {
          amount: 2000,
          paymentDate: new Date('2025-01-10'),
          expectedPaymentDate: new Date('2025-01-15')
        }
      ];

      const result = calculateCustomerPerformance(purchases);

      expect(result.totalPurchases).toBe(2);
      expect(result.totalSpent).toBe(3000);
      expect(result.averageOrderValue).toBe(1500);
      expect(result.onTimePaymentRate).toBe(1);
    });

    it('should handle empty purchases array', () => {
      const result = calculateCustomerPerformance([]);

      expect(result.totalPurchases).toBe(0);
      expect(result.totalSpent).toBe(0);
      expect(result.averageOrderValue).toBe(0);
      expect(result.onTimePaymentRate).toBe(0);
      expect(result.lastPurchaseDate).toBeNull();
    });

    it('should calculate on-time payment rate correctly', () => {
      const purchases = [
        {
          amount: 1000,
          paymentDate: new Date('2025-01-01'),
          expectedPaymentDate: new Date('2025-01-01')
        },
        {
          amount: 2000,
          paymentDate: new Date('2025-01-20'),
          expectedPaymentDate: new Date('2025-01-15')
        }
      ];

      const result = calculateCustomerPerformance(purchases);
      expect(result.onTimePaymentRate).toBe(0.5);
    });
  });
});
