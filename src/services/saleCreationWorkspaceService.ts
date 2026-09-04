import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import { supabase } from '@/lib/supabase';
import { getLatestReferentialFxRate } from '@/services/fxRateReferential';
import { fetchLiveGoldPrice } from '@/services/liveGoldPriceService';

const CONFIRMED_SALE_STATUSES = new Set([
  'customer_approved',
  'waiting_for_payment',
  'virtual_payment',
  'payment_received',
  'completed',
]);

const ACTIVE_CONTRACT_STATUSES = new Set(['active', 'approved', 'signed']);

export type SaleWeightUnit = 'oz' | 'g';
export type SaleFixingMethod = 'spot' | 'forward' | 'in_process';

export interface SaleCreationInputs {
  customerId: string;
  sellerId: string;
  quantity: number;
  unit: SaleWeightUnit;
  proposedPriceUsdOz: number;
  fixingDate: string;
  settlementCurrency: 'USD';
  freightCostUsd: number;
  otherCostsUsd: number;
  fixingMethod: SaleFixingMethod;
  paymentTermDays: number;
  customerContractId: string | null;
  inProcessRefineryId: string | null;
}

export interface SaleCreationSummary {
  quantityOz: number;
  quantityGrams: number;
  grossUsd: number;
  costsUsd: number;
  royaltyRatePct: number;
  royaltyUsd: number;
  netUsd: number;
  grossXof: number;
  netXof: number;
  netMarginPct: number;
}

export interface CustomerContractContext {
  id: string;
  contractNumber: string;
  contractType: string;
  pricingModel: string;
  priceAdjustmentPct: number | null;
  maximumOrderOz: number | null;
  minimumOrderOz: number | null;
  annualVolumeCommitmentOz: number | null;
  creditLimitUsd: number | null;
  paymentTerms: string;
  validFrom: string;
  validUntil: string;
  status: string;
}

export interface CustomerPerformanceContext {
  confirmedQuantityOz: number;
  weightedAveragePriceUsdOz: number | null;
  confirmedSalesCount: number;
  confirmedPaymentsUsd: number;
  outstandingUsd: number;
  onTimePaymentPct: number | null;
  averagePaymentDelayDays: number | null;
  averagePaymentTermDays: number | null;
  riskLabel: string;
  riskReason: string;
}

export interface CustomerSaleContext {
  id: string;
  name: string;
  country: string;
  status: string;
  isActive: boolean;
  creditLimitUsd: number | null;
  paymentTerms: string | null;
  contracts: CustomerContractContext[];
  performance: CustomerPerformanceContext;
}

export interface GoldPricePoint {
  date: string;
  priceUsdOz: number;
  source: string | null;
}

export interface SaleMarketContext {
  spotPriceUsdOz: number | null;
  previousCloseUsdOz: number | null;
  goldPriceSource: string | null;
  goldPriceUpdatedAt: string | null;
  usdXofRate: number | null;
  fxSource: string | null;
  fxRateDate: string | null;
  royaltyRatePct: number | null;
  history: GoldPricePoint[];
  projections: null;
}

export interface SaleDraftRecord {
  id: string;
  draftNumber: string;
  version: number;
  status: 'draft' | 'submitted';
  submittedSaleId: string | null;
  updatedAt: string;
}

export interface SaleSubmissionRecord {
  saleId: string;
  saleNumber: string;
  status: string;
  approvalRequestId: string | null;
  replayed: boolean;
}

export interface SaleWorkspaceFailure {
  code: string;
  message: string;
  field?: keyof SaleCreationInputs;
}

interface CustomerRow {
  id: string;
  name: string;
  country: string;
  status: string | null;
  is_active: boolean | null;
  credit_limit: number | null;
  payment_terms: string | null;
}

interface SaleRow {
  id: string;
  quantity_oz: number;
  london_am_rate: number;
  final_price_per_oz: number | null;
  final_proceeds: number;
  currency: string | null;
  status: string;
}

interface PaymentRow {
  sale_id: string;
  amount: number;
  currency: string;
  status: string | null;
  is_virtual: boolean | null;
  due_date: string | null;
  expected_date: string;
  actual_date: string | null;
  approved_at: string | null;
}

interface RpcError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcInvoker = (name: string, args: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcInvoker;

const finite = (value: number, label: string) => {
  if (!Number.isFinite(value)) throw new Error(`${label} doit être un nombre valide.`);
  return value;
};

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const numberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return value === null || value === undefined || !Number.isFinite(parsed) ? null : parsed;
};

const dateDiffDays = (from: string, to: string) => {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 86_400_000) : null;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La réponse du serveur est invalide.');
  }
  return value as Record<string, unknown>;
};

export function quantityToOunces(quantity: number, unit: SaleWeightUnit): number {
  finite(quantity, 'La quantité');
  return unit === 'oz' ? quantity : quantity / TROY_OZ_GRAMS;
}

/**
 * Calcul d'aperçu aligné sur les RPC de création : redevance appliquée au
 * produit après déduction des frais. Le serveur recalcule toujours ces valeurs.
 */
export function calculateSaleCreationSummary(
  inputs: SaleCreationInputs,
  royaltyRatePct: number,
  usdXofRate: number,
): SaleCreationSummary {
  const quantityOz = quantityToOunces(inputs.quantity, inputs.unit);
  const price = finite(inputs.proposedPriceUsdOz, 'Le prix proposé');
  const freight = finite(inputs.freightCostUsd, 'Les frais de transport');
  const other = finite(inputs.otherCostsUsd, 'Les autres frais');
  const royalty = finite(royaltyRatePct, 'Le taux de redevance');
  const fx = finite(usdXofRate, 'Le taux USD/XOF');

  if (quantityOz <= 0) throw new Error('La quantité doit être strictement positive.');
  if (price <= 0) throw new Error('Le prix proposé doit être strictement positif.');
  if (freight < 0 || other < 0) throw new Error('Les frais ne peuvent pas être négatifs.');
  if (royalty < 0 || royalty >= 100) throw new Error('Le taux de redevance est invalide.');
  if (fx <= 0) throw new Error('Le taux USD/XOF doit être strictement positif.');

  const grossUsd = quantityOz * price;
  const costsUsd = freight + other;
  const taxableUsd = grossUsd - costsUsd;
  if (taxableUsd <= 0) throw new Error('Le produit après frais doit être strictement positif.');
  const royaltyUsd = taxableUsd * royalty / 100;
  const netUsd = taxableUsd - royaltyUsd;

  return {
    quantityOz: round(quantityOz),
    quantityGrams: round(quantityOz * TROY_OZ_GRAMS),
    grossUsd: round(grossUsd, 2),
    costsUsd: round(costsUsd, 2),
    royaltyRatePct: round(royalty, 4),
    royaltyUsd: round(royaltyUsd, 2),
    netUsd: round(netUsd, 2),
    grossXof: round(grossUsd * fx, 2),
    netXof: round(netUsd * fx, 2),
    netMarginPct: round(netUsd / grossUsd * 100, 4),
  };
}

export function validateSaleCreationInputs(
  inputs: SaleCreationInputs,
  availableStockOz: number,
  contract?: CustomerContractContext | null,
): Partial<Record<keyof SaleCreationInputs, string>> {
  const errors: Partial<Record<keyof SaleCreationInputs, string>> = {};
  const quantityOz = Number.isFinite(inputs.quantity) && inputs.quantity > 0
    ? quantityToOunces(inputs.quantity, inputs.unit)
    : 0;

  if (!inputs.customerId) errors.customerId = 'Sélectionnez un client international autorisé.';
  if (!inputs.sellerId) errors.sellerId = 'Le vendeur rattaché à votre compte est indisponible.';
  if (quantityOz <= 0) errors.quantity = 'Saisissez une quantité strictement positive.';
  else if (quantityOz > availableStockOz + 0.000001) errors.quantity = 'La quantité dépasse le stock exportable disponible.';
  if (!Number.isFinite(inputs.proposedPriceUsdOz) || inputs.proposedPriceUsdOz <= 0) errors.proposedPriceUsdOz = 'Saisissez un prix proposé valide.';
  if (!inputs.fixingDate) errors.fixingDate = 'Renseignez la date de fixation du prix.';
  if (inputs.freightCostUsd < 0) errors.freightCostUsd = 'Les frais de transport ne peuvent pas être négatifs.';
  if (inputs.otherCostsUsd < 0) errors.otherCostsUsd = 'Les autres frais ne peuvent pas être négatifs.';
  if (!Number.isInteger(inputs.paymentTermDays) || inputs.paymentTermDays < 0 || inputs.paymentTermDays > 365) {
    errors.paymentTermDays = 'Le délai de paiement doit être compris entre 0 et 365 jours.';
  }
  if (inputs.fixingMethod === 'in_process' && !inputs.inProcessRefineryId) {
    errors.inProcessRefineryId = 'Sélectionnez une raffinerie agréée.';
  }
  if (contract) {
    if (contract.minimumOrderOz !== null && quantityOz < contract.minimumOrderOz) {
      errors.quantity = `La quantité minimale du contrat est de ${contract.minimumOrderOz.toLocaleString('fr-FR')} oz.`;
    }
    if (contract.maximumOrderOz !== null && quantityOz > contract.maximumOrderOz) {
      errors.quantity = `Le plafond par commande du contrat est de ${contract.maximumOrderOz.toLocaleString('fr-FR')} oz.`;
    }
  }
  return errors;
}

function contractIsActive(status: string | null, validFrom: string, validUntil: string, today: string) {
  return ACTIVE_CONTRACT_STATUSES.has(String(status ?? '').toLowerCase())
    && validFrom <= today
    && validUntil >= today;
}

function buildPerformance(sales: SaleRow[], payments: PaymentRow[], creditLimit: number | null): CustomerPerformanceContext {
  const confirmedSales = sales.filter((sale) => CONFIRMED_SALE_STATUSES.has(String(sale.status)));
  const confirmedQuantityOz = confirmedSales.reduce((total, sale) => total + Number(sale.quantity_oz || 0), 0);
  const weightedValue = confirmedSales.reduce((total, sale) => {
    const price = numberOrNull(sale.final_price_per_oz) ?? numberOrNull(sale.london_am_rate) ?? 0;
    return total + price * Number(sale.quantity_oz || 0);
  }, 0);
  const saleIds = new Set(confirmedSales.map((sale) => sale.id));
  const confirmedPayments = payments.filter((payment) => (
    saleIds.has(payment.sale_id)
    && payment.status === 'approved'
    && payment.is_virtual === false
  ));
  const confirmedPaymentsUsd = confirmedPayments
    .filter((payment) => payment.currency === 'USD')
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const confirmedSalesUsd = confirmedSales
    .filter((sale) => (sale.currency ?? 'USD') === 'USD')
    .reduce((total, sale) => total + Number(sale.final_proceeds || 0), 0);
  const delays = confirmedPayments.flatMap((payment) => {
    const due = payment.due_date || payment.expected_date;
    const paid = payment.actual_date || payment.approved_at;
    const delay = due && paid ? dateDiffDays(due, paid) : null;
    return delay === null ? [] : [delay];
  });
  const terms = confirmedPayments.flatMap((payment) => {
    const paid = payment.actual_date || payment.approved_at;
    const term = payment.expected_date && paid ? dateDiffDays(payment.expected_date, paid) : null;
    return term === null ? [] : [Math.abs(term)];
  });
  const onTime = delays.filter((delay) => delay <= 0).length;
  const outstandingUsd = Math.max(0, confirmedSalesUsd - confirmedPaymentsUsd);
  const hasConfiguredCreditControl = creditLimit !== null && creditLimit > 0;

  return {
    confirmedQuantityOz: round(confirmedQuantityOz, 3),
    weightedAveragePriceUsdOz: confirmedQuantityOz > 0 ? round(weightedValue / confirmedQuantityOz, 2) : null,
    confirmedSalesCount: confirmedSales.length,
    confirmedPaymentsUsd: round(confirmedPaymentsUsd, 2),
    outstandingUsd: round(outstandingUsd, 2),
    onTimePaymentPct: delays.length > 0 ? round(onTime / delays.length * 100, 2) : null,
    averagePaymentDelayDays: delays.length > 0 ? round(delays.reduce((total, delay) => total + delay, 0) / delays.length, 1) : null,
    averagePaymentTermDays: terms.length > 0 ? round(terms.reduce((total, term) => total + term, 0) / terms.length, 1) : null,
    riskLabel: hasConfiguredCreditControl && outstandingUsd > creditLimit! ? 'Plafond de crédit dépassé' : 'Non évalué',
    riskReason: hasConfiguredCreditControl && outstandingUsd > creditLimit!
      ? `L’encours confirmé dépasse le plafond configuré de ${creditLimit!.toLocaleString('fr-FR')} USD.`
      : 'Aucun modèle de risque client validé n’est configuré ; aucun niveau artificiel n’est affiché.',
  };
}

export async function loadCustomerSaleContext(customerId: string): Promise<CustomerSaleContext> {
  const today = new Date().toISOString().slice(0, 10);
  const [customerResult, contractsResult, salesResult] = await Promise.all([
    supabase.from('customers').select('id,name,country,status,is_active,credit_limit,payment_terms').eq('id', customerId).maybeSingle(),
    supabase.from('customer_contracts').select('id,contract_number,contract_type,pricing_model,base_price_adjustment,maximum_order_oz,minimum_order_oz,annual_volume_commitment_oz,credit_limit,payment_terms,valid_from,valid_until,status').eq('customer_id', customerId).order('valid_until', { ascending: false }),
    supabase.from('sales').select('id,quantity_oz,london_am_rate,final_price_per_oz,final_proceeds,currency,status').eq('customer_id', customerId),
  ]);

  if (customerResult.error) throw customerResult.error;
  if (!customerResult.data) throw new Error('Le client sélectionné est introuvable.');
  if (contractsResult.error) throw contractsResult.error;
  if (salesResult.error) throw salesResult.error;

  const customer = customerResult.data as CustomerRow;
  const sales = (salesResult.data ?? []) as SaleRow[];
  const saleIds = sales.map((sale) => sale.id);
  let payments: PaymentRow[] = [];
  if (saleIds.length > 0) {
    const paymentResult = await supabase
      .from('payments')
      .select('sale_id,amount,currency,status,is_virtual,due_date,expected_date,actual_date,approved_at')
      .in('sale_id', saleIds);
    if (paymentResult.error) throw paymentResult.error;
    payments = (paymentResult.data ?? []) as PaymentRow[];
  }

  const contracts = (contractsResult.data ?? [])
    .filter((contract) => contractIsActive(contract.status, contract.valid_from, contract.valid_until, today))
    .map((contract): CustomerContractContext => ({
      id: contract.id,
      contractNumber: contract.contract_number,
      contractType: contract.contract_type,
      pricingModel: contract.pricing_model,
      priceAdjustmentPct: numberOrNull(contract.base_price_adjustment),
      maximumOrderOz: numberOrNull(contract.maximum_order_oz),
      minimumOrderOz: numberOrNull(contract.minimum_order_oz),
      annualVolumeCommitmentOz: numberOrNull(contract.annual_volume_commitment_oz),
      creditLimitUsd: numberOrNull(contract.credit_limit),
      paymentTerms: contract.payment_terms,
      validFrom: contract.valid_from,
      validUntil: contract.valid_until,
      status: contract.status ?? 'active',
    }));

  return {
    id: customer.id,
    name: customer.name,
    country: customer.country,
    status: customer.status ?? (customer.is_active === false ? 'inactive' : 'active'),
    isActive: customer.is_active !== false && customer.status !== 'inactive',
    creditLimitUsd: numberOrNull(customer.credit_limit),
    paymentTerms: customer.payment_terms,
    contracts,
    performance: buildPerformance(sales, payments, numberOrNull(customer.credit_limit)),
  };
}

export async function loadSaleMarketContext(): Promise<SaleMarketContext> {
  const [gold, fx, historyResult, royaltyResult] = await Promise.all([
    fetchLiveGoldPrice(),
    getLatestReferentialFxRate('USD', 'XOF'),
    supabase.from('gold_prices_daily').select('price_date,spot_price,london_pm_rate,london_am_rate,source').order('price_date', { ascending: false }).limit(30),
    supabase.from('business_rules').select('rule_value,updated_at').eq('rule_key', 'gold_royalty_percentage').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (historyResult.error) throw historyResult.error;
  if (royaltyResult.error) throw royaltyResult.error;

  const history = (historyResult.data ?? []).flatMap((row): GoldPricePoint[] => {
    const price = numberOrNull(row.spot_price) ?? numberOrNull(row.london_pm_rate) ?? numberOrNull(row.london_am_rate);
    return price && price > 0 ? [{ date: row.price_date, priceUsdOz: price, source: row.source }] : [];
  }).reverse();
  const ruleValue = numberOrNull(royaltyResult.data?.rule_value);
  const royaltyRatePct = ruleValue === null ? null : ruleValue > 1 ? ruleValue : ruleValue * 100;

  return {
    spotPriceUsdOz: gold?.price ?? history.at(-1)?.priceUsdOz ?? null,
    previousCloseUsdOz: history.length > 1 ? history.at(-2)?.priceUsdOz ?? null : gold?.openPrice ?? null,
    goldPriceSource: gold?.source ?? history.at(-1)?.source ?? null,
    goldPriceUpdatedAt: gold ? new Date(gold.timestamp).toISOString() : history.at(-1)?.date ?? null,
    usdXofRate: fx?.rate ?? null,
    fxSource: fx?.source ?? null,
    fxRateDate: fx?.rate_date ?? null,
    royaltyRatePct,
    history,
    projections: null,
  };
}

export function normalizeSaleWorkspaceError(error: unknown): SaleWorkspaceFailure {
  const candidate = error && typeof error === 'object' ? error as RpcError : {};
  const rawMessage = candidate.message || (error instanceof Error ? error.message : 'Une erreur inattendue est survenue.');
  const message = rawMessage.replace(/^.*?exception:\s*/iu, '').trim();
  const lower = message.toLowerCase();
  const field = lower.includes('quantit') || lower.includes('stock') || lower.includes('lot')
    ? 'quantity'
    : lower.includes('client') ? 'customerId'
      : lower.includes('prix') || lower.includes('cours') ? 'proposedPriceUsdOz'
        : lower.includes('contrat') ? 'customerContractId'
          : undefined;
  return { code: candidate.code || 'SALE_WORKSPACE_ERROR', message, field };
}

export async function saveSaleDraft(command: {
  draftId: string | null;
  expectedVersion: number | null;
  idempotencyKey: string;
  inputs: SaleCreationInputs;
  snapshot: Record<string, unknown>;
}): Promise<SaleDraftRecord> {
  const response = await rpc('snp_enregistrer_brouillon_vente_export', {
    p_draft_id: command.draftId,
    p_expected_version: command.expectedVersion,
    p_idempotency_key: command.idempotencyKey,
    p_payload: command.inputs,
    p_context_snapshot: command.snapshot,
  });
  if (response.error) throw normalizeSaleWorkspaceError(response.error);
  const data = asRecord(response.data);
  return {
    id: String(data.id),
    draftNumber: String(data.draft_number),
    version: Number(data.version),
    status: data.status === 'submitted' ? 'submitted' : 'draft',
    submittedSaleId: data.submitted_sale_id ? String(data.submitted_sale_id) : null,
    updatedAt: String(data.updated_at),
  };
}

export async function submitSaleDraft(command: {
  draftId: string;
  expectedVersion: number;
  lots: Array<{ source_type: string; source_id: string; quantite_oz: number }>;
}): Promise<SaleSubmissionRecord> {
  const response = await rpc('snp_soumettre_brouillon_vente_export', {
    p_draft_id: command.draftId,
    p_expected_version: command.expectedVersion,
    p_lots: command.lots,
  });
  if (response.error) throw normalizeSaleWorkspaceError(response.error);
  const data = asRecord(response.data);
  return {
    saleId: String(data.id),
    saleNumber: String(data.sale_number),
    status: String(data.status),
    approvalRequestId: data.approval_request_id ? String(data.approval_request_id) : null,
    replayed: data.replayed === true,
  };
}
