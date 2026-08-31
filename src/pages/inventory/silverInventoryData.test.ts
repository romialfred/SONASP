import { describe, expect, it } from 'vitest';
import { deriveSilverPosition, type SilverBearingInventoryRow } from './silverInventoryData';

const base: SilverBearingInventoryRow = {
  id: 'lot-1',
  entry_date: '2026-08-29',
  certificate_number: 'CERT-001',
  processing_location: 'SONASP',
  weight_after_melting_grams: 1_000,
  final_fine_oz: 10,
  silver_percentage: 5,
  quantity_available_oz: 6,
  quantity_allocated_oz: 3,
  quantity_sold_oz: 1,
};

describe('deriveSilverPosition', () => {
  it('calcule la teneur argent depuis le poids fondu et le pourcentage certifie', () => {
    expect(deriveSilverPosition(base).silver_grams).toBe(50);
  });

  it('ventile proportionnellement sans inventer un second registre de quantites', () => {
    const result = deriveSilverPosition(base);
    expect(result.available_silver_grams).toBe(30);
    expect(result.allocated_silver_grams).toBe(15);
    expect(result.sold_silver_grams).toBe(5);
  });

  it('borne les donnees invalides pour ne jamais afficher un stock negatif ou superieur au lot', () => {
    const result = deriveSilverPosition({
      ...base,
      silver_percentage: 120,
      quantity_available_oz: 20,
      quantity_allocated_oz: -2,
    });
    expect(result.silver_grams).toBe(1_000);
    expect(result.available_silver_grams).toBe(1_000);
    expect(result.allocated_silver_grams).toBe(0);
  });
});
