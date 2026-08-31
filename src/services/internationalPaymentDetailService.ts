import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { DocumentDossier, DossierComplet } from './dossierService';
import { readAllSalesPages } from './internationalSalesListService';
import { createPrivateSignedUrl, PRIVATE_STORAGE_BUCKETS, storageObjectPath } from '@/lib/privateStorage';

export type DetailPayment = Pick<Tables<'payments'>,
  'id' | 'sale_id' | 'amount' | 'currency' | 'status' | 'is_virtual' | 'expected_date' | 'actual_date' | 'due_date' |
  'created_at' | 'created_by' | 'executed_at' | 'executed_by' | 'approved_at' | 'approved_by' | 'verified_at' | 'verified_by' |
  'rejected_at' | 'rejection_reason' | 'cancelled_at' | 'cancellation_reason' | 'invoice_number' | 'reference_number' |
  'transaction_id' | 'payment_method' | 'payment_type' | 'bank_name' | 'account_number' | 'customer_bank_id' | 'seller_bank_id' |
  'received_amount' | 'payment_currency' | 'receiving_currency' | 'fx_rate' | 'fx_rate_date' | 'fx_rate_source' | 'notes' |
  'proof_url' | 'payment_proof_url'>;
export type DetailSale = Pick<Tables<'sales'>, 'id' | 'sale_number' | 'final_proceeds' | 'currency' | 'customer_id' | 'status' | 'seller_type'> & {
  customer: Pick<Tables<'customers'>, 'id' | 'name' | 'country' | 'email' | 'phone'> | null;
};
export interface InternationalPaymentDetail {
  payment: DetailPayment;
  sale: DetailSale;
  payments: DetailPayment[] | null;
  dossier: DossierComplet | null;
  customerBank: Pick<Tables<'customer_banks'>, 'id' | 'customer_id' | 'bank_name' | 'account_number' | 'iban' | 'swift_code' | 'currency'> | null;
  receivingBank: Pick<Tables<'stakeholder_bank_accounts'>, 'id' | 'bank_name' | 'account_name' | 'account_number' | 'iban' | 'swift_code' | 'account_currency'> | null;
  actors: Record<string, string>;
  unavailable: string[];
}
const PAYMENT_COLUMNS = 'id,sale_id,amount,currency,status,is_virtual,expected_date,actual_date,due_date,created_at,created_by,executed_at,executed_by,approved_at,approved_by,verified_at,verified_by,rejected_at,rejection_reason,cancelled_at,cancellation_reason,invoice_number,reference_number,transaction_id,payment_method,payment_type,bank_name,account_number,customer_bank_id,seller_bank_id,received_amount,payment_currency,receiving_currency,fx_rate,fx_rate_date,fx_rate_source,notes,proof_url,payment_proof_url';

/** Parent-first, read-only, signed-in client. No tenant supplied by the URL,
 * global document scan, service-role credential or synthetic financial fallback. */
export async function getInternationalPaymentDetail(id: string, signal: AbortSignal): Promise<InternationalPaymentDetail> {
  const { data: payment, error } = await supabase.from('payments').select(PAYMENT_COLUMNS).eq('id', id).abortSignal(signal).maybeSingle();
  if (error) throw error;
  if (!payment) throw new Error('Paiement introuvable ou inaccessible dans votre périmètre.');
  const { data: sale, error: saleError } = await supabase.from('sales')
    .select('id,sale_number,final_proceeds,currency,customer_id,status,seller_type,customer:customers!sales_customer_id_fkey(id,name,country,email,phone)')
    .eq('id', payment.sale_id).abortSignal(signal).maybeSingle();
  if (saleError) throw saleError;
  if (!sale) throw new Error('La vente associée est inaccessible dans votre périmètre.');
  const unavailable: string[] = [];
  async function optional<T>(name: string, request: PromiseLike<T>): Promise<T | null> {
    try { return await request; } catch (reason) {
      if (signal.aborted) throw reason;
      unavailable.push(name); return null;
    }
  }
  async function result<T>(request: PromiseLike<{ data: T | null; error: unknown }>) {
    const response = await request;
    if (response.error) throw response.error;
    if (response.data === null) throw new Error('Donnée liée indisponible.');
    return response.data;
  }
  const actorIds = [...new Set([payment.created_by, payment.executed_by, payment.approved_by, payment.verified_by].filter((value): value is string => Boolean(value)))];
  const [payments, dossier, customerBank, receivingBank, profiles] = await Promise.all([
    optional('ledger', readAllSalesPages((from, to) => supabase.from('payments').select(PAYMENT_COLUMNS)
      .eq('sale_id', sale.id).order('created_at').order('id').range(from, to).abortSignal(signal))),
    optional('dossier', result(supabase.rpc('snp_dossier_complet', { p_type: 'paiement', p_id: id }).abortSignal(signal)).then((data) => {
      const value = data as unknown as DossierComplet;
      if (value?.ancre?.id !== id || value.ancre.type !== 'paiement' || !Array.isArray(value.documents) || !Array.isArray(value.chronologie) || !value.chaine) throw new Error('Dossier incomplet.');
      return value;
    })),
    payment.customer_bank_id ? optional('customerBank', result(supabase.from('customer_banks')
      .select('id,customer_id,bank_name,account_number,iban,swift_code,currency')
      .eq('id', payment.customer_bank_id).eq('customer_id', sale.customer_id).abortSignal(signal).maybeSingle())) : null,
    payment.seller_bank_id ? optional('receivingBank', result(supabase.from('stakeholder_bank_accounts')
      .select('id,bank_name,account_name,account_number,iban,swift_code,account_currency')
      .eq('id', payment.seller_bank_id).abortSignal(signal).maybeSingle())) : null,
    actorIds.length ? optional('actors', result(supabase.from('user_profiles').select('id,full_name').in('id', actorIds).abortSignal(signal))) : [],
  ]);
  // A filtered/truncated ledger cannot be mistaken for a complete zero balance.
  const ledger = payments?.some((row) => row.id === payment.id) ? payments : null;
  if (payments && !ledger) unavailable.push('ledger');
  return { payment, sale: { ...sale, customer: sale.customer as DetailSale['customer'] }, payments: ledger,
    dossier, customerBank, receivingBank, actors: Object.fromEntries((profiles || []).filter((p) => p.full_name).map((p) => [p.id, p.full_name!])), unavailable };
}

const DOCUMENT_BUCKETS: Record<string, string> = {
  production_documents: PRIVATE_STORAGE_BUCKETS.productionDocuments,
  snp_requisitions_documents: 'contrats-documents',
  shipping_documents: PRIVATE_STORAGE_BUCKETS.shippingDocuments,
  shipping_preparations: PRIVATE_STORAGE_BUCKETS.shippingDocuments,
  assay_certificates: PRIVATE_STORAGE_BUCKETS.assayCertificates,
  snp_payment_proofs: PRIVATE_STORAGE_BUCKETS.paymentProofs,
  payments: PRIVATE_STORAGE_BUCKETS.paymentProofs,
  sales_documents: 'sales-documents',
};
export function paymentDocumentLocation(document: DocumentDossier) {
  const bucket = DOCUMENT_BUCKETS[document.source];
  const path = bucket ? storageObjectPath(document.chemin, bucket) : null;
  return bucket && path ? { bucket, path } : null;
}
export function paymentDocuments(detail: InternationalPaymentDetail): DocumentDossier[] {
  const documents = [...(detail.dossier?.documents || [])];
  for (const reference of [detail.payment.proof_url, detail.payment.payment_proof_url]) {
    if (reference) documents.push({ id: `proof-${detail.payment.id}-${documents.length}`, source: 'payments', etape: 'paiement',
      nom: 'Justificatif de ce paiement', chemin: reference, date: detail.payment.executed_at || detail.payment.created_at });
  }
  const seen = new Set<string>();
  return documents.filter((doc) => {
    const location = paymentDocumentLocation(doc);
    const key = location ? `${location.bucket}/${location.path}` : `${doc.source}:${doc.id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
/** Sign only when requested; external URLs and unknown/closed buckets never open. */
export async function downloadPaymentDocument(document: DocumentDossier, signal: AbortSignal): Promise<void> {
  const location = paymentDocumentLocation(document);
  if (!location) throw new Error('Cette pièce est une référence sans fichier téléchargeable.');
  const url = await createPrivateSignedUrl(location.bucket, location.path, 300);
  signal.throwIfAborted();
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Le document ne peut pas être téléchargé. Réessayez.');
  const blob = await response.blob();
  signal.throwIfAborted();
  const objectUrl = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = objectUrl;
  link.download = location.path.split('/').pop() || document.nom || 'document';
  window.document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
