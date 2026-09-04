import type { UserProfile } from '@/types/auth';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import { supabase } from '@/lib/supabase';
import { getLatestReferentialFxRate } from '@/services/fxRateReferential';
import { getAuthorizedCustomersForMine } from '@/services/goldSalesSettingsService';
import { getApprovedRefineries } from '@/services/goldTradeSpaceService';
import { fetchLiveGoldPrice, type LiveGoldPrice } from '@/services/liveGoldPriceService';
import { mineStockService } from '@/services/mineStockService';
import {
  reglesFiscalesService,
  type CodeTaxe,
  type ProfilVendeur,
} from '@/services/reglesFiscalesService';
import { stockSonaspService } from '@/services/stockSonaspService';

export type SimulationWeightUnit = 'oz' | 'g';
export type SimulationCounterpartyType = 'customer' | 'refinery';

export interface SimulationCounterparty {
  key: string;
  id: string;
  type: SimulationCounterpartyType;
  name: string;
  detail: string | null;
}

export interface SaleSimulationContext {
  sellerId: string;
  sellerName: string;
  sellerProfile: ProfilVendeur;
  availableStockOz: number;
  goldPrice: LiveGoldPrice | null;
  usdXofRate: number | null;
  fxRateDate: string | null;
  fxSource: string | null;
  counterparties: SimulationCounterparty[];
  suggestedTaxRatePct: number | null;
  taxRulesAvailable: boolean;
}

export interface SaleSimulationInputs {
  quantity: number;
  unit: SimulationWeightUnit;
  referencePriceUsdOz: number;
  usdXofRate: number;
  premiumDiscountPct: number;
  logisticsCostUsd: number;
  taxRatePct: number;
}

export interface SaleSimulationResult {
  quantityOz: number;
  quantityGrams: number;
  grossValueUsd: number;
  premiumDiscountAmountUsd: number;
  adjustedValueUsd: number;
  taxAmountUsd: number;
  netProceedsUsd: number;
  grossValueXof: number;
  premiumDiscountAmountXof: number;
  logisticsCostXof: number;
  taxAmountXof: number;
  netProceedsXof: number;
  netPriceXofOz: number;
  netMarginPct: number;
}

export interface SaveSaleSimulationCommand {
  context: SaleSimulationContext;
  inputs: SaleSimulationInputs;
  result: SaleSimulationResult;
  counterparty: SimulationCounterparty;
  valueDate: string;
  settlementCurrency: 'USD';
}

export interface SavedSaleSimulation {
  id: string;
  simulation_reference: string;
  created_at: string;
  created_by: string;
  seller_id: string;
  seller_name_snapshot: string;
  counterparty_id: string;
  counterparty_type: SimulationCounterpartyType;
  counterparty_name_snapshot: string;
  stock_available_oz: number;
  quantity_oz: number;
  input_unit: SimulationWeightUnit;
  reference_price_usd_oz: number;
  usd_xof_rate: number;
  settlement_currency: string;
  premium_discount_pct: number;
  logistics_cost_usd: number;
  tax_rate_pct: number;
  tax_amount_usd: number;
  gross_value_usd: number;
  adjusted_value_usd: number;
  net_proceeds_usd: number;
  net_proceeds_xof: number;
  net_price_xof_oz: number;
  net_margin_pct: number;
  value_date: string;
  status: 'completed';
  gold_price_source: string | null;
  fx_source: string | null;
}

const TAX_CODES: CodeTaxe[] = [
  'tva',
  'royalties',
  'fndl',
  'retenue_source',
  'taxe_communale',
];

const finite = (value: number, field: string) => {
  if (!Number.isFinite(value)) throw new Error(`${field} doit être un nombre valide.`);
  return value;
};

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function toTroyOunces(quantity: number, unit: SimulationWeightUnit): number {
  finite(quantity, 'La quantité');
  if (quantity <= 0) throw new Error('La quantité doit être strictement positive.');
  return unit === 'oz' ? quantity : quantity / TROY_OZ_GRAMS;
}

/**
 * Calcul financier pur. Aucune chaîne formatée n'entre dans ce calcul et tous
 * les taux sont exprimés en pourcentage utilisateur (1,25 = 1,25 %).
 */
export function calculateSaleSimulation(inputs: SaleSimulationInputs): SaleSimulationResult {
  const quantityOz = toTroyOunces(inputs.quantity, inputs.unit);
  const price = finite(inputs.referencePriceUsdOz, 'Le prix de référence');
  const fx = finite(inputs.usdXofRate, 'Le taux USD/XOF');
  const premium = finite(inputs.premiumDiscountPct, 'La prime ou décote');
  const logistics = finite(inputs.logisticsCostUsd, 'Les frais logistiques');
  const taxRate = finite(inputs.taxRatePct, 'Le taux de prélèvements');

  if (price <= 0) throw new Error('Le prix de référence doit être strictement positif.');
  if (fx <= 0) throw new Error('Le taux USD/XOF doit être strictement positif.');
  if (logistics < 0) throw new Error('Les frais logistiques ne peuvent pas être négatifs.');
  if (taxRate < 0 || taxRate > 100) throw new Error('Le taux de prélèvements doit être compris entre 0 et 100 %.');

  const grossValueUsd = quantityOz * price;
  const premiumDiscountAmountUsd = grossValueUsd * (premium / 100);
  const adjustedValueUsd = grossValueUsd + premiumDiscountAmountUsd;
  if (adjustedValueUsd < 0) throw new Error('La décote ne peut pas rendre la valeur ajustée négative.');

  const taxAmountUsd = adjustedValueUsd * (taxRate / 100);
  const netProceedsUsd = adjustedValueUsd - logistics - taxAmountUsd;

  return {
    quantityOz: round(quantityOz),
    quantityGrams: round(quantityOz * TROY_OZ_GRAMS),
    grossValueUsd: round(grossValueUsd),
    premiumDiscountAmountUsd: round(premiumDiscountAmountUsd),
    adjustedValueUsd: round(adjustedValueUsd),
    taxAmountUsd: round(taxAmountUsd),
    netProceedsUsd: round(netProceedsUsd),
    grossValueXof: round(grossValueUsd * fx),
    premiumDiscountAmountXof: round(premiumDiscountAmountUsd * fx),
    logisticsCostXof: round(logistics * fx),
    taxAmountXof: round(taxAmountUsd * fx),
    netProceedsXof: round(netProceedsUsd * fx),
    netPriceXofOz: round(netProceedsUsd * fx / quantityOz),
    netMarginPct: round(grossValueUsd === 0 ? 0 : netProceedsUsd / grossValueUsd * 100),
  };
}

async function suggestedTaxRate(
  valueDate: string,
  referencePriceUsdOz: number,
  profile: ProfilVendeur,
): Promise<number | null> {
  const settled = await Promise.allSettled(
    TAX_CODES.map((code) => reglesFiscalesService.resoudre(
      code,
      valueDate,
      referencePriceUsdOz,
      'standard',
      profile,
    )),
  );
  const rules = settled.flatMap((entry) => entry.status === 'fulfilled' && entry.value ? [entry.value] : []);
  if (rules.length === 0) return null;
  return round(rules.reduce((total, rule) => total + Number(rule.taux ?? 0), 0) * 100, 4);
}

async function sellerFor(user: UserProfile) {
  if (user.mining_company_id) {
    const { data, error } = await supabase
      .from('mining_companies')
      .select('id, name')
      .eq('id', user.mining_company_id)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('La société minière rattachée au compte est indisponible.');
    return { id: data.id, name: data.name, profile: 'mine_industrielle' as const };
  }

  const sonasp = await stockSonaspService.identifiant();
  if (!sonasp) throw new Error('La SONASP active est absente du référentiel des organisations.');
  return { id: sonasp.id, name: sonasp.name, profile: 'tous' as const };
}

export async function loadSaleSimulationContext(
  user: UserProfile,
  valueDate = new Date().toISOString().slice(0, 10),
): Promise<SaleSimulationContext> {
  const seller = await sellerFor(user);
  const stockPromise = user.mining_company_id
    ? mineStockService.stock().then((stock) => stock.availableOz)
    : stockSonaspService.stock(seller.id).then((stock) => stock.disponibleOz);

  const [stock, gold, fx, customers, refineries] = await Promise.all([
    stockPromise,
    fetchLiveGoldPrice(),
    getLatestReferentialFxRate('USD', 'XOF'),
    getAuthorizedCustomersForMine(seller.id),
    getApprovedRefineries(),
  ]);

  const customerOptions: SimulationCounterparty[] = customers.success
    ? customers.data.map((customer) => ({
        key: `customer:${customer.customer_id}`,
        id: customer.customer_id,
        type: 'customer',
        name: customer.customer_name,
        detail: 'Acheteur international habilité',
      }))
    : [];
  const refineryOptions: SimulationCounterparty[] = refineries.success
    ? (refineries.data ?? []).map((refinery) => ({
        key: `refinery:${refinery.id}`,
        id: refinery.id,
        type: 'refinery',
        name: refinery.refinery_name,
        detail: refinery.refinery_location || null,
      }))
    : [];
  const counterparties = [...customerOptions, ...refineryOptions]
    .filter((option, index, all) => all.findIndex((candidate) => candidate.key === option.key) === index)
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));

  const suggestedTaxRatePct = gold
    ? await suggestedTaxRate(valueDate, gold.price, seller.profile)
    : null;

  return {
    sellerId: seller.id,
    sellerName: seller.name,
    sellerProfile: seller.profile,
    availableStockOz: stock,
    goldPrice: gold,
    usdXofRate: fx?.rate ?? null,
    fxRateDate: fx?.rate_date ?? null,
    fxSource: fx?.source ?? null,
    counterparties,
    suggestedTaxRatePct,
    taxRulesAvailable: suggestedTaxRatePct !== null,
  };
}

export async function saveSaleSimulation(command: SaveSaleSimulationCommand): Promise<SavedSaleSimulation> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('La session utilisateur est indisponible.');

  const { context, inputs, result, counterparty, valueDate, settlementCurrency } = command;
  const { data, error } = await supabase
    .from('sale_simulations')
    .insert({
      created_by: auth.user.id,
      seller_id: context.sellerId,
      seller_name_snapshot: context.sellerName,
      counterparty_id: counterparty.id,
      counterparty_type: counterparty.type,
      counterparty_name_snapshot: counterparty.name,
      stock_available_oz: context.availableStockOz,
      quantity_oz: result.quantityOz,
      input_unit: inputs.unit,
      reference_price_usd_oz: inputs.referencePriceUsdOz,
      usd_xof_rate: inputs.usdXofRate,
      settlement_currency: settlementCurrency,
      premium_discount_pct: inputs.premiumDiscountPct,
      logistics_cost_usd: inputs.logisticsCostUsd,
      tax_rate_pct: inputs.taxRatePct,
      tax_amount_usd: result.taxAmountUsd,
      gross_value_usd: result.grossValueUsd,
      adjusted_value_usd: result.adjustedValueUsd,
      net_proceeds_usd: result.netProceedsUsd,
      net_proceeds_xof: result.netProceedsXof,
      net_price_xof_oz: result.netPriceXofOz,
      net_margin_pct: result.netMarginPct,
      value_date: valueDate,
      status: 'completed',
      gold_price_source: context.goldPrice?.source ?? null,
      fx_source: context.fxSource,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as SavedSaleSimulation;
}

export async function listSaleSimulations(limit = 100): Promise<SavedSaleSimulation[]> {
  const { data, error } = await supabase
    .from('sale_simulations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SavedSaleSimulation[];
}

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function exportSaleSimulationCsv(
  simulation: SavedSaleSimulation | null,
  command: SaveSaleSimulationCommand,
): void {
  const { context, inputs, result, counterparty, valueDate } = command;
  const rows: Array<[string, unknown]> = [
    ['Référence', simulation?.simulation_reference ?? 'Simulation non enregistrée'],
    ['Date de valeur', valueDate],
    ['Vendeur', context.sellerName],
    ['Acheteur / Raffineur', counterparty.name],
    ['Stock disponible (oz)', context.availableStockOz],
    ['Quantité simulée (oz)', result.quantityOz],
    ['Quantité simulée (g)', result.quantityGrams],
    ['Cours de référence (USD/oz)', inputs.referencePriceUsdOz],
    ['Taux USD/XOF', inputs.usdXofRate],
    ['Prime / Décote (%)', inputs.premiumDiscountPct],
    ['Frais logistiques (USD)', inputs.logisticsCostUsd],
    ['Taxes et prélèvements (%)', inputs.taxRatePct],
    ['Valeur brute (USD)', result.grossValueUsd],
    ['Produit net (USD)', result.netProceedsUsd],
    ['Produit net (FCFA)', result.netProceedsXof],
    ['Prix net moyen (FCFA/oz)', result.netPriceXofOz],
    ['Marge nette (%)', result.netMarginPct],
  ];
  const content = `\uFEFF${rows.map(([label, value]) => `${csvCell(label)};${csvCell(value)}`).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${simulation?.simulation_reference ?? 'simulation-vente'}-${valueDate}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
