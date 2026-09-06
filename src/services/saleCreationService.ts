import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { Affectation } from './tracabiliteVenteService';

const invokeExportSaleRpc = supabase.rpc.bind(supabase) as unknown as (
  functionName: 'snp_creer_vente_export_idempotent',
  parameters: Record<string, unknown>,
) => PromiseLike<PostgrestSingleResponse<unknown>>;

export interface CreateExportSaleInput {
  customerId: string;
  sellerId: string;
  quantityOz: number;
  londonAmRate: number;
  freightCost: number;
  otherCosts: number;
  mechanismType?: string;
  inProcessRefineryId?: string;
  lots: Affectation[];
  /** Clé stable à réutiliser lors d'une relance réseau du même ordre. */
  idempotencyKey?: string;
}

export interface CreatedExportSale {
  id: string;
  sale_number: string;
  status: string;
  approval_request_id: string;
}

export async function createExportSale(
  input: CreateExportSaleInput
): Promise<{ success: boolean; data?: CreatedExportSale; error?: string }> {
  try {
    const { data, error } = await invokeExportSaleRpc('snp_creer_vente_export_idempotent', {
      p_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
      p_customer_id: input.customerId,
      p_seller_id: input.sellerId,
      p_quantity_oz: input.quantityOz,
      p_london_am_rate: input.londonAmRate,
      p_freight_cost: input.freightCost,
      p_other_costs: input.otherCosts,
      p_mechanism_type: input.mechanismType?.trim() || null,
      p_in_process_refinery_id: input.inProcessRefineryId?.trim() || null,
      p_lots: input.lots.map((lot) => ({
        source_type: lot.source_type,
        source_id: lot.source_id,
        quantite_oz: lot.quantite_oz,
      })),
    });

    if (error) throw error;
    return { success: true, data: data as unknown as CreatedExportSale };
  } catch (reason) {
    return {
      success: false,
      error: errorMessage(
        reason,
        "La vente n'a pas pu être créée. Le stock et les écritures ont été laissés inchangés."
      ),
    };
  }
}

/**
 * Crée une vente portée par le compte mine connecté.
 *
 * L'identifiant vendeur n'est volontairement pas transmis : la fonction SQL le
 * déduit de auth.uid(), verrouille le stock de la mine et refuse tout reliquat
 * insuffisant dans la même transaction.
 */
export async function createMineExportSale(
  input: Omit<CreateExportSaleInput, 'sellerId' | 'lots'>
): Promise<{ success: boolean; data?: CreatedExportSale; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('snp_creer_vente_export_mine', {
      p_customer_id: input.customerId,
      p_quantity_oz: input.quantityOz,
      p_london_am_rate: input.londonAmRate,
      p_freight_cost: input.freightCost,
      p_other_costs: input.otherCosts,
      p_mechanism_type: input.mechanismType?.trim() || null,
      p_in_process_refinery_id: input.inProcessRefineryId?.trim() || null,
    });

    if (error) throw error;
    return { success: true, data: data as unknown as CreatedExportSale };
  } catch (reason) {
    return {
      success: false,
      error: errorMessage(
        reason,
        "La vente n'a pas pu être créée. Le reliquat exportable de la mine est resté inchangé."
      ),
    };
  }
}
