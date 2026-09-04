import { describe, expect, it, vi } from 'vitest';
import {
  calculateSaleSimulation,
  exportSaleSimulationCsv,
  toTroyOunces,
  type SaveSaleSimulationCommand,
} from './saleSimulationService';

const baseInputs = {
  quantity: 25_000,
  unit: 'oz' as const,
  referencePriceUsdOz: 2_848.87,
  usdXofRate: 598.42,
  premiumDiscountPct: -0.35,
  logisticsCostUsd: 185_000,
  taxRatePct: 1.25,
};

describe('saleSimulationService', () => {
  it('convertit les grammes en onces troy avec la constante canonique', () => {
    expect(toTroyOunces(31.1034768, 'g')).toBeCloseTo(1, 10);
    expect(toTroyOunces(12.5, 'oz')).toBe(12.5);
  });

  it('calcule la valeur brute sur des nombres non formatés', () => {
    const result = calculateSaleSimulation(baseInputs);
    expect(result.grossValueUsd).toBe(71_221_750);
    expect(result.quantityGrams).toBe(777_586.92);
  });

  it('applique une décote signée sur la valeur brute', () => {
    const result = calculateSaleSimulation(baseInputs);
    expect(result.premiumDiscountAmountUsd).toBeCloseTo(-249_276.125, 3);
    expect(result.adjustedValueUsd).toBeCloseTo(70_972_473.875, 3);
  });

  it('calcule les prélèvements sur la valeur ajustée', () => {
    const result = calculateSaleSimulation(baseInputs);
    expect(result.taxAmountUsd).toBeCloseTo(887_155.923438, 6);
  });

  it('déduit les frais et prélèvements du produit net', () => {
    const result = calculateSaleSimulation(baseInputs);
    expect(result.netProceedsUsd).toBeCloseTo(69_900_317.951562, 6);
  });

  it('convertit chaque agrégat USD en FCFA avec le taux autoritatif', () => {
    const result = calculateSaleSimulation(baseInputs);
    expect(result.netProceedsXof).toBeCloseTo(result.netProceedsUsd * 598.42, 3);
    expect(result.logisticsCostXof).toBe(110_707_700);
  });

  it('calcule le prix net moyen et la marge nette', () => {
    const result = calculateSaleSimulation(baseInputs);
    expect(result.netPriceXofOz).toBeCloseTo(result.netProceedsXof / 25_000, 5);
    expect(result.netMarginPct).toBeCloseTo(result.netProceedsUsd / result.grossValueUsd * 100, 5);
  });

  it('accepte une prime positive', () => {
    const result = calculateSaleSimulation({ ...baseInputs, premiumDiscountPct: 2 });
    expect(result.premiumDiscountAmountUsd).toBe(result.grossValueUsd * 0.02);
  });

  it.each([
    [{ ...baseInputs, quantity: 0 }, 'strictement positive'],
    [{ ...baseInputs, referencePriceUsdOz: 0 }, 'prix de référence'],
    [{ ...baseInputs, usdXofRate: 0 }, 'taux USD/XOF'],
    [{ ...baseInputs, logisticsCostUsd: -1 }, 'frais logistiques'],
    [{ ...baseInputs, taxRatePct: 101 }, 'compris entre 0 et 100'],
    [{ ...baseInputs, premiumDiscountPct: -101 }, 'valeur ajustée négative'],
  ])('refuse les paramètres financiers invalides', (inputs, message) => {
    expect(() => calculateSaleSimulation(inputs)).toThrow(message);
  });

  it('gère les montants importants sans produire NaN ou Infinity', () => {
    const result = calculateSaleSimulation({ ...baseInputs, quantity: 1_000_000 });
    expect(Number.isFinite(result.netProceedsXof)).toBe(true);
    expect(Number.isFinite(result.netPriceXofOz)).toBe(true);
  });

  it('produit un fichier CSV réellement téléchargeable', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:scenario');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const result = calculateSaleSimulation(baseInputs);
    const command = {
      context: {
        sellerId: 'seller-1', sellerName: 'SONASP', sellerProfile: 'tous', availableStockOz: 100_000,
        goldPrice: { price: 2_848.87, timestamp: Date.now(), source: 'Référentiel SONASP', currency: 'USD' },
        usdXofRate: 598.42, fxRateDate: '2026-09-04', fxSource: 'Référentiel SONASP',
        counterparties: [], suggestedTaxRatePct: 1.25, taxRulesAvailable: true,
      },
      inputs: baseInputs,
      result,
      counterparty: { key: 'refinery:1', id: '1', type: 'refinery', name: 'Raffinerie agréée', detail: null },
      valueDate: '2026-09-04',
      settlementCurrency: 'USD',
    } satisfies SaveSaleSimulationCommand;

    exportSaleSimulationCsv(null, command);

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:scenario');
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });
});
