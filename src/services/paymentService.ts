import { supabase } from '@/lib/supabase';
import { getLatestReferentialFxRate, getReferentialFxRates } from '@/services/fxRateReferential';

export type InternationalPaymentStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'failed';

export type InternationalPaymentDecision = 'approve' | 'reject';

export interface InternationalPaymentMutationResult {
  payment_id: string;
  sale_id: string;
  payment_status: InternationalPaymentStatus;
  sale_status: string;
  version: number;
  idempotency_key: string;
  replayed: boolean;
  processed_at: string;
  decision?: InternationalPaymentDecision;
  paid_amount?: number;
  payment_currency?: string;
  settlement_amount?: number;
  settlement_currency?: string;
  fx_rate?: number;
  fx_rate_date?: string;
  fx_rate_source?: string;
}

export interface ExecuteInternationalPaymentData {
  saleId: string;
  expectedSaleStatus: 'waiting_for_payment' | 'virtual_payment';
  expectedPaymentVersion: number | null;
  paidAmount: number;
  paymentCurrency: string;
  customerBankId: string;
  sellerBankId: string;
  paymentDate: string;
  referenceNumber: string;
  transactionId?: string;
  notes?: string;
  idempotencyKey: string;
}

export interface DecideInternationalPaymentData {
  paymentId: string;
  expectedVersion: number;
  decision: InternationalPaymentDecision;
  reason?: string;
  idempotencyKey: string;
}

export interface CancelInternationalPaymentData {
  paymentId: string;
  expectedStatus: 'pending' | 'processing';
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
}

export interface SaleAwaitingPayment {
  id: string;
  sale_number: string;
  customer_id: string;
  customer_name: string;
  quantity_oz: number;
  sale_date: string;
  mechanism_type?: string;
  gross_proceeds: number;
  net_proceeds: number;
  final_proceeds: number;
  currency: string;
  seller_type: string;
  seller_id: string;
  status: string;
  payment_id: string | null;
  payment_version: number | null;
}

export interface CustomerBank {
  id: string;
  bank_name: string;
  country: string;
  currency: string;
  account_number: string;
  swift_code?: string;
  is_primary: boolean;
}

export interface SellerBank {
  id: string;
  stakeholder_type: string;
  stakeholder_id: string;
  account_name: string;
  bank_name: string;
  bank_country: string;
  account_currency: string;
  swift_code?: string;
  is_primary: boolean;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  currency: string;
  fx_rate: number;
  expected_date: string;
  actual_date?: string;
  bank_name: string;
  account_number?: string;
  reference_number: string;
  proof_url?: string;
  status: string;
  version?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface PaymentRpcError {
  code?: string;
  message?: string;
}

type PaymentRpcName =
  | 'snp_paiement_international_executer'
  | 'snp_paiement_international_decider'
  | 'snp_paiement_international_annuler';

const paymentRpc = supabase as unknown as {
  rpc(
    functionName: PaymentRpcName,
    parameters: Record<string, unknown>,
  ): PromiseLike<{
    data: InternationalPaymentMutationResult | null;
    error: PaymentRpcError | null;
  }>;
};

export class InternationalPaymentConflictError extends Error {
  constructor() {
    super('Le paiement ou sa vente a changé entre-temps. Actualisez le dossier avant de réessayer.');
    this.name = 'InternationalPaymentConflictError';
  }
}

export function createPaymentIdempotencyKey(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Le navigateur ne fournit pas de générateur UUID sécurisé.');
  }
  return globalThis.crypto.randomUUID();
}

function isOptimisticConflict(error: PaymentRpcError): boolean {
  return error.code === '40001' || error.message?.includes('Conflit optimiste') === true;
}

function assertMutationResult(
  data: InternationalPaymentMutationResult | null,
  expectedStatuses: InternationalPaymentStatus[],
  expectedSaleStatuses: string[],
  expectedIdempotencyKey: unknown,
): InternationalPaymentMutationResult {
  if (!data?.payment_id || !data.sale_id || !data.idempotency_key
      || !Number.isInteger(data.version) || data.version < 0
      || !expectedStatuses.includes(data.payment_status)
      || !expectedSaleStatuses.includes(data.sale_status)
      || data.idempotency_key !== expectedIdempotencyKey) {
    throw new Error('Le serveur n’a pas confirmé l’opération de paiement attendue.');
  }
  return data;
}

async function callPaymentRpc(
  functionName: PaymentRpcName,
  parameters: Record<string, unknown>,
  expectedStatuses: InternationalPaymentStatus[],
  expectedSaleStatuses: string[],
): Promise<InternationalPaymentMutationResult> {
  const { data, error } = await paymentRpc.rpc(functionName, parameters);
  if (error) {
    if (isOptimisticConflict(error)) throw new InternationalPaymentConflictError();
    throw error;
  }
  return assertMutationResult(
    data,
    expectedStatuses,
    expectedSaleStatuses,
    parameters.p_idempotency_key,
  );
}

export async function executeInternationalPayment(
  input: ExecuteInternationalPaymentData,
): Promise<InternationalPaymentMutationResult> {
  return callPaymentRpc('snp_paiement_international_executer', {
    p_sale_id: input.saleId,
    p_expected_sale_status: input.expectedSaleStatus,
    p_expected_payment_version: input.expectedPaymentVersion,
    p_paid_amount: input.paidAmount,
    p_payment_currency: input.paymentCurrency.trim().toUpperCase(),
    p_customer_bank_id: input.customerBankId,
    p_seller_bank_id: input.sellerBankId,
    p_payment_date: input.paymentDate,
    p_reference_number: input.referenceNumber.trim(),
    p_transaction_id: input.transactionId?.trim() || null,
    // Aucun chemin/URL libre n'est accepté. Un gateway privé dédié
    // rattachera ultérieurement la preuve avant le rapprochement positif.
    p_proof_path: null,
    p_notes: input.notes?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  }, ['processing'], ['virtual_payment']);
}

export async function decideInternationalPayment(
  input: DecideInternationalPaymentData,
): Promise<InternationalPaymentMutationResult> {
  return callPaymentRpc('snp_paiement_international_decider', {
    p_payment_id: input.paymentId,
    p_expected_status: 'processing',
    p_expected_version: input.expectedVersion,
    p_decision: input.decision,
    p_reason: input.reason?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  },
  input.decision === 'approve' ? ['approved'] : ['rejected'],
  input.decision === 'approve' ? ['payment_received'] : ['waiting_for_payment']);
}

export async function cancelInternationalPayment(
  input: CancelInternationalPaymentData,
): Promise<InternationalPaymentMutationResult> {
  return callPaymentRpc('snp_paiement_international_annuler', {
    p_payment_id: input.paymentId,
    p_expected_status: input.expectedStatus,
    p_expected_version: input.expectedVersion,
    p_reason: input.reason.trim(),
    p_idempotency_key: input.idempotencyKey,
  }, ['cancelled'], ['waiting_for_payment']);
}

export interface FXRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  source: string;
}

export async function getPaymentById(
  paymentId: string
): Promise<{ success: boolean; data?: Payment; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        sale:sales(
          id,
          sale_number,
          customer_id,
          quantity_oz,
          final_proceeds,
          customer:customers(id, name, email, country)
        )
      `)
      .eq('id', paymentId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPaymentsBySale(
  saleId: string
): Promise<{ success: boolean; data?: Payment[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function uploadPaymentProof(
  file: File,
  paymentId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${paymentId}-${Date.now()}.${fileExt}`;
    const filePath = `payment-proofs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('payments')
      .update({ proof_url: publicUrl })
      .eq('id', paymentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, url: publicUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCurrentFXRate(
  fromCurrency: string,
  toCurrency: string = 'USD'
): Promise<{ success: boolean; data?: FXRate; error?: string }> {
  try {
    const data = await getLatestReferentialFxRate(fromCurrency, toCurrency);
    if (!data) return { success: false, error: 'Taux de change indisponible' };
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getFXRateHistory(
  fromCurrency: string,
  toCurrency: string = 'USD',
  dateFrom?: string,
  dateTo?: string
): Promise<{ success: boolean; data?: FXRate[]; error?: string }> {
  try {
    const rates = await getReferentialFxRates(fromCurrency, toCurrency, 366);
    const data = rates.filter((rate) => (
      (!dateFrom || rate.rate_date >= dateFrom)
      && (!dateTo || rate.rate_date <= dateTo)
    ));
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function compareFXRates(
  fromCurrency: string,
  toCurrency: string = 'USD'
): Promise<{
  success: boolean;
  data?: {
    current_rate: number;
    previous_rate: number;
    current_date: string;
    previous_date: string;
    change_percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
  error?: string;
}> {
  try {
    const data = await getReferentialFxRates(fromCurrency, toCurrency, 2);
    if (data.length < 2) {
      return { success: false, error: 'Insufficient data for comparison' };
    }

    const currentRate = data[0].rate;
    const previousRate = data[1].rate;
    const changePercentage = ((currentRate - previousRate) / previousRate) * 100;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changePercentage > 0.1) trend = 'up';
    else if (changePercentage < -0.1) trend = 'down';

    return {
      success: true,
      data: {
        current_rate: currentRate,
        previous_rate: previousRate,
        current_date: data[0].rate_date,
        previous_date: data[1].rate_date,
        change_percentage: changePercentage,
        trend,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSalesAwaitingPayment(): Promise<{
  success: boolean;
  data?: SaleAwaitingPayment[];
  error?: string;
}> {
  try {
    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        id,
        sale_number,
        customer_id,
        quantity_oz,
        sale_date,
        mechanism_type,
        gross_proceeds,
        net_proceeds,
        final_proceeds,
        currency,
        seller_type,
        seller_id,
        status,
        customers(id, name),
        payments(id, status, version, is_virtual, created_at)
      `)
      .eq('status', 'waiting_for_payment')
      .eq('seller_type', 'sonasp')
      .order('sale_date', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const formattedSales: SaleAwaitingPayment[] = (sales || []).map((sale: any) => {
      const pendingPayments = (Array.isArray(sale.payments) ? sale.payments : [])
        .filter((payment: any) => payment.status === 'pending')
        .sort((left: any, right: any) => {
          if (Boolean(left.is_virtual) !== Boolean(right.is_virtual)) {
            return left.is_virtual ? -1 : 1;
          }
          return String(right.created_at || '').localeCompare(String(left.created_at || ''));
        });
      const pendingPayment = pendingPayments[0] || null;

      return {
        id: sale.id,
        sale_number: sale.sale_number,
        customer_id: sale.customer_id,
        customer_name: sale.customers?.name || 'Unknown',
        quantity_oz: sale.quantity_oz,
        sale_date: sale.sale_date,
        mechanism_type: sale.mechanism_type,
        gross_proceeds: sale.gross_proceeds,
        net_proceeds: sale.net_proceeds,
        final_proceeds: sale.final_proceeds,
        currency: sale.currency || 'USD',
        seller_type: sale.seller_type,
        seller_id: sale.seller_id,
        status: sale.status,
        payment_id: pendingPayment?.id || null,
        payment_version: Number.isInteger(pendingPayment?.version)
          ? pendingPayment.version
          : null,
      };
    });

    return { success: true, data: formattedSales };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCustomerBanks(
  customerId: string
): Promise<{ success: boolean; data?: CustomerBank[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('customer_banks')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSellerBanks(
  stakeholderType: string = 'mining_company',
  stakeholderId?: string,
): Promise<{ success: boolean; data?: SellerBank[]; error?: string }> {
  try {
    let query = supabase
      .from('stakeholder_bank_accounts')
      .select('*')
      .eq('stakeholder_type', stakeholderType)
      .eq('is_active', true)
      .eq('verification_status', 'verified');

    if (stakeholderId) {
      query = query.eq('stakeholder_id', stakeholderId);
    }

    const { data, error } = await query
      .order('is_primary', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPaymentStatistics(filters?: {
  date_from?: string;
  date_to?: string;
}): Promise<{
  success: boolean;
  data?: {
    total_payments: number;
    total_amount: number;
    pending_approvals: number;
    approved_payments: number;
  };
  error?: string;
}> {
  try {
    let query = supabase
      .from('payments')
      .select('amount, currency, fx_rate, status');

    if (filters?.date_from) {
      query = query.gte('expected_date', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('expected_date', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const payments = data || [];
    const totalPayments = payments.length;

    const totalAmount = payments.reduce((sum, p) => {
      const amountInUsd = p.currency === 'USD' ? p.amount : (p.amount / (p.fx_rate || 1));
      return sum + amountInUsd;
    }, 0);

    const pendingApprovals = payments.filter(p => p.status === 'pending').length;
    const approvedPayments = payments.filter(p => p.status === 'approved').length;

    return {
      success: true,
      data: {
        total_payments: totalPayments,
        total_amount: totalAmount,
        pending_approvals: pendingApprovals,
        approved_payments: approvedPayments,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
