import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import { readAllSalesPages } from './internationalSalesListService';
import { getSaleDocuments } from './saleDocumentsService';
import { tracabiliteVenteService } from './tracabiliteVenteService';

/** Load the parent first. Every subsequent read is limited to its related IDs,
 * through the signed-in client's RLS; a URL never supplies a tenant override. */
export async function getInternationalSaleDetail(id: string, signal: AbortSignal) {
  const { data: sale, error } = await supabase.from('sales').select(`
    id,sale_number,status,created_at,updated_at,created_by,sale_date,customer_id,seller_id,seller_type,
    quantity_oz,london_am_rate,final_price_per_oz,gross_proceeds,freight_cost,other_costs,net_proceeds,
    royalty_amount,final_proceeds,currency,payment_method,payment_terms,mechanism_type,
    payment_amount,payment_received_at,shipping_preparation_id,management_approved_at,customer_approved_at,
    management_rejected_at,customer_rejected_at,completed_at,
    customer:customers!sales_customer_id_fkey(id,name,country,email,phone)
  `).eq('id', id).abortSignal(signal).maybeSingle();
  if (error) throw error;
  if (!sale) throw new Error('Vente introuvable ou inaccessible dans votre périmètre.');

  const unavailable: string[] = [];
  async function optional<T>(name: string, request: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
    try {
      const result = await request;
      if (result.error) throw result.error;
      return result.data;
    } catch {
      unavailable.push(name);
      return null;
    }
  }
  const [payments, documents, shipment, company, creator, conciliations, origins] = await Promise.all([
    // Payment failure is blocking: a missing ledger must never mean a zero balance.
    readAllSalesPages((from, to) => supabase.from('payments')
      .select('id,sale_id,amount,currency,status,is_virtual,invoice_number,expected_date,actual_date,created_at,approved_at,executed_at,reference_number,payment_type,version')
      .eq('sale_id', id).order('created_at').order('id').range(from, to).abortSignal(signal)),
    getSaleDocuments(id).then((r) => { if (!r.success) unavailable.push('documents'); return r.success ? r.data ?? [] : null; }),
    sale.shipping_preparation_id ? optional<Pick<Tables<'shipping_preparations'>, 'id' | 'expedition_lot_number' | 'shipped_at' | 'prepared_at' | 'export_license_id' | 'license_id' | 'status' | 'shipped_to_company' | 'shipped_to_country' | 'shipped_to_address' | 'total_boxes' | 'total_gross_weight_grams' | 'total_net_weight_grams' | 'seal_number'>>('shipment', supabase.from('shipping_preparations')
      .select('id,expedition_lot_number,shipped_at,prepared_at,export_license_id,license_id,status,shipped_to_company,shipped_to_country,shipped_to_address,total_boxes,total_gross_weight_grams,total_net_weight_grams,seal_number')
      .eq('id', sale.shipping_preparation_id).abortSignal(signal).maybeSingle()) : null,
    sale.seller_id ? optional<Pick<Tables<'mining_companies'>, 'id' | 'name'>>('company', supabase.from('mining_companies').select('id,name')
      .eq('id', sale.seller_id).abortSignal(signal).maybeSingle()) : null,
    sale.created_by ? optional<Pick<Tables<'user_profiles'>, 'id' | 'full_name'>>('creator', supabase.from('user_profiles').select('id,full_name')
      .eq('id', sale.created_by).abortSignal(signal).maybeSingle()) : null,
    optional('conciliation', supabase.from('snp_conciliations')
      .select('id,sale_id,reference,statut,ca_initial,ca_final,devise_initiale,devise_finale,or_fin_initial_g,or_fin_final_g,created_at,updated_at')
      .eq('sale_id', id).order('created_at', { ascending: false }).abortSignal(signal)),
    tracabiliteVenteService.lotsDeVente(id).catch(() => { unavailable.push('origins'); return null; }),
  ]);
  const licenseId = shipment?.export_license_id || shipment?.license_id;
  const license = licenseId ? await optional<Pick<Tables<'export_licenses'>, 'license_number'>>('license', supabase.from('export_licenses').select('license_number')
    .eq('id', licenseId).abortSignal(signal).maybeSingle()) : null;
  return { sale: { ...sale, customer: sale.customer as typeof sale.customer | null }, payments, documents, shipment,
    companyName: company?.name || (sale.seller_type === 'sonasp' ? 'SONASP' : null),
    creatorName: creator?.full_name || null, licenseNumber: license?.license_number || null,
    conciliations, origins, unavailable };
}

export type InternationalSaleDetail = Awaited<ReturnType<typeof getInternationalSaleDetail>>;
