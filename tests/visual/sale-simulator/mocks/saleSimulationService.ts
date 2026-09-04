import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

// Données strictement synthétiques pour le contrôle visuel local ; aucune API n'est appelée.
export const visualContext = {
  sellerId: 'visual-sonasp',
  sellerName: 'Société Nationale des Substances Précieuses',
  sellerProfile: 'tous',
  availableStockOz: 159_133.109,
  goldPrice: {
    price: 2_848.87,
    timestamp: Date.parse('2026-09-04T16:58:37Z'),
    source: 'Référentiel SONASP — scénario visuel',
    currency: 'USD',
    change24h: 11.87,
    changePercent24h: 0.42,
    openPrice: 2_837,
    high24h: 2_855.87,
    low24h: 2_839.87,
  },
  usdXofRate: 598.42,
  fxRateDate: '2026-09-04',
  fxSource: 'Référentiel SONASP — scénario visuel',
  counterparties: [
    { key: 'refinery:visual-1', id: 'visual-1', type: 'refinery', name: 'Rand Refinery', detail: 'Afrique du Sud' },
    { key: 'customer:visual-2', id: 'visual-2', type: 'customer', name: 'Auramet Trading LLC', detail: 'États-Unis' },
  ],
  suggestedTaxRatePct: 1.25,
  taxRulesAvailable: true,
};

export type SimulationWeightUnit = 'oz' | 'g';
export type SaleSimulationContext = typeof visualContext;
export type SaleSimulationInputs = {
  quantity: number;
  unit: SimulationWeightUnit;
  referencePriceUsdOz: number;
  usdXofRate: number;
  premiumDiscountPct: number;
  logisticsCostUsd: number;
  taxRatePct: number;
};
export type SaleSimulationResult = ReturnType<typeof calculateSaleSimulation>;
export type SaveSaleSimulationCommand = {
  context: SaleSimulationContext;
  inputs: SaleSimulationInputs;
  result: SaleSimulationResult;
  counterparty: SaleSimulationContext['counterparties'][number];
  valueDate: string;
  settlementCurrency: 'USD';
};
export type SavedSaleSimulation = ReturnType<typeof savedSimulation>;

export const toTroyOunces = (quantity: number, unit: SimulationWeightUnit) => {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La quantité doit être supérieure à zéro.');
  return unit === 'g' ? quantity / TROY_OZ_GRAMS : quantity;
};

export function calculateSaleSimulation(inputs: SaleSimulationInputs) {
  const quantityOz = toTroyOunces(inputs.quantity, inputs.unit);
  const grossValueUsd = quantityOz * inputs.referencePriceUsdOz;
  const premiumDiscountAmountUsd = grossValueUsd * inputs.premiumDiscountPct / 100;
  const adjustedValueUsd = grossValueUsd + premiumDiscountAmountUsd;
  const taxAmountUsd = adjustedValueUsd * inputs.taxRatePct / 100;
  const netProceedsUsd = adjustedValueUsd - inputs.logisticsCostUsd - taxAmountUsd;
  return {
    quantityOz,
    quantityGrams: quantityOz * TROY_OZ_GRAMS,
    grossValueUsd,
    premiumDiscountAmountUsd,
    adjustedValueUsd,
    taxAmountUsd,
    netProceedsUsd,
    grossValueXof: grossValueUsd * inputs.usdXofRate,
    premiumDiscountAmountXof: premiumDiscountAmountUsd * inputs.usdXofRate,
    logisticsCostXof: inputs.logisticsCostUsd * inputs.usdXofRate,
    taxAmountXof: taxAmountUsd * inputs.usdXofRate,
    netProceedsXof: netProceedsUsd * inputs.usdXofRate,
    netPriceXofOz: netProceedsUsd * inputs.usdXofRate / quantityOz,
    netMarginPct: grossValueUsd > 0 ? netProceedsUsd / grossValueUsd * 100 : 0,
  };
}

function savedSimulation(command: SaveSaleSimulationCommand) {
  return {
    id: 'visual-simulation',
    simulation_reference: 'SIM-2026-000001',
    created_at: new Date().toISOString(),
    ...command.result,
  };
}

export const loadSaleSimulationContext = async () => visualContext;
export const saveSaleSimulation = async (command: SaveSaleSimulationCommand) => savedSimulation(command);
export const exportSaleSimulationCsv = () => undefined;
