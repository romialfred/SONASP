import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';

export interface CustomerSaleDecisionView {
  id: string;
  sale_number: string;
  quantity_oz: number;
  london_am_rate: number;
  gross_proceeds: number;
  freight_cost: number;
  other_costs: number;
  net_proceeds: number;
  royalty_amount: number;
  final_proceeds: number;
  status: string;
  mechanism_type: string | null;
  created_at: string;
  customer: { name: string; email: string; country: string };
}

type DecisionResult = { success: boolean; paymentId?: string; error?: string };

export async function loadCustomerSaleForDecision(
  saleId: string
): Promise<{ success: boolean; data?: CustomerSaleDecisionView; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('snp_vente_a_valider_client', {
      p_vente_id: saleId,
    });
    if (error) throw error;
    return { success: true, data: data as unknown as CustomerSaleDecisionView };
  } catch (reason) {
    return {
      success: false,
      error: errorMessage(reason, "Cette vente n'est pas accessible ou n'attend plus votre décision."),
    };
  }
}

async function decideCustomerSale(
  saleId: string,
  decision: 'approve' | 'reject',
  reason?: string
): Promise<DecisionResult> {
  try {
    const { data, error } = await supabase.rpc('snp_repondre_vente_client', {
      p_vente_id: saleId,
      p_decision: decision,
      p_motif: reason?.trim() || null,
    });
    if (error) throw error;
    const result = data as { payment_id?: string | null } | null;
    return { success: true, paymentId: result?.payment_id || undefined };
  } catch (reasonCaught) {
    return {
      success: false,
      error: errorMessage(reasonCaught, "Votre décision n'a pas pu être enregistrée."),
    };
  }
}

export function approveCustomerSale(saleId: string): Promise<DecisionResult> {
  return decideCustomerSale(saleId, 'approve');
}

export function rejectCustomerSale(saleId: string, reason: string): Promise<DecisionResult> {
  if (reason.trim().length < 5) {
    return Promise.resolve({
      success: false,
      error: 'Le motif de refus doit comporter au moins 5 caractères.',
    });
  }
  return decideCustomerSale(saleId, 'reject', reason);
}
