import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// All reads use the signed-in client's RLS. In particular, never accept a tenant
// override from a filter, use a service key, or read a security-definer list view.
const SALE_COLUMNS = 'id,sale_number,status,sale_date,created_at,customer_id,seller_id,seller_type,quantity_oz,final_proceeds,gross_proceeds,final_price_per_oz,london_am_rate,currency,payment_amount,payment_received_at,shipping_preparation_id,customer:customers!sales_customer_id_fkey(id,name,country)';
const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 100;

function groupBySale<T extends { sale_id: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const group = grouped.get(row.sale_id);
    if (group) group.push(row);
    else grouped.set(row.sale_id, [row]);
  }
  return grouped;
}

type PageQuery<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

/** PostgREST's row limit must not silently truncate counts or exports. */
export async function readAllSalesPages<T>(query: (from: number, to: number) => PageQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data) throw new Error('Réponse du registre des ventes indisponible.');
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function readRelated<T>(ids: string[], query: (batch: string[], from: number, to: number) => PageQuery<T>) {
  const rows: T[] = [];
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += ID_BATCH_SIZE) {
    const batch = unique.slice(offset, offset + ID_BATCH_SIZE);
    rows.push(...await readAllSalesPages((from, to) => query(batch, from, to)));
  }
  return rows;
}

export async function listInternationalSales(signal: AbortSignal) {
  const sales = await readAllSalesPages((from, to) => supabase.from('sales')
    .select(SALE_COLUMNS)
    .order('sale_date', { ascending: false, nullsFirst: false }).order('id')
    .range(from, to).abortSignal(signal));
  const saleIds = sales.map((sale) => sale.id);
  // Related catalogues are restricted to IDs of sales already returned by RLS.
  // A global customer/company catalogue is not needed for this screen's filters.
  const [payments, documents, conciliations, companies, shipments] = await Promise.all([
    readRelated(saleIds, (ids, from, to) => supabase.from('payments')
      .select('id,sale_id,amount,currency,status,is_virtual,invoice_number')
      .in('sale_id', ids).order('id').range(from, to).abortSignal(signal)),
    readRelated(saleIds, (ids, from, to) => supabase.from('sales_documents')
      .select('id,sale_id,document_type,document_number,status,created_at')
      .in('sale_id', ids).order('created_at', { ascending: false }).order('id')
      .range(from, to).abortSignal(signal)),
    readRelated(saleIds, (ids, from, to) => supabase.from('snp_conciliations')
      .select('id,sale_id,statut').in('sale_id', ids).order('id')
      .range(from, to).abortSignal(signal)),
    readRelated(sales.filter((s) => s.seller_type === 'mining_company' && s.seller_id)
      .map((s) => s.seller_id as string), (ids, from, to) => supabase.from('mining_companies')
      .select('id,name').in('id', ids).order('id').range(from, to).abortSignal(signal)),
    readRelated(sales.flatMap((s) => s.shipping_preparation_id ? [s.shipping_preparation_id] : []),
      (ids, from, to) => supabase.from('shipping_preparations')
        .select('id,shipped_at,export_license_id,license_id').in('id', ids)
        .order('id').range(from, to).abortSignal(signal)),
  ]);
  const licenses = await readRelated(shipments.flatMap((s) => {
    const id = s.export_license_id || s.license_id;
    return id ? [id] : [];
  }), (ids, from, to) => supabase.from('export_licenses').select('id,license_number')
    .in('id', ids).order('id').range(from, to).abortSignal(signal));

  const companiesById = new Map(companies.map((item) => [item.id, item.name]));
  const shipmentsById = new Map(shipments.map((item) => [item.id, item]));
  const licensesById = new Map(licenses.map((item) => [item.id, item.license_number]));
  const paymentsBySale = groupBySale(payments);
  const documentsBySale = groupBySale(documents);
  const disputedSales = new Set(conciliations.filter((item) => item.statut === 'contestee').map((item) => item.sale_id));
  return sales.map((sale) => {
    const shipment = shipmentsById.get(sale.shipping_preparation_id || '');
    const saleDocuments = documentsBySale.get(sale.id) ?? [];
    const salePayments = paymentsBySale.get(sale.id) ?? [];
    const invoice = saleDocuments.find((doc) => doc.document_type === 'invoice'
      && doc.status !== 'archived' && doc.document_number)?.document_number
      || salePayments.find((payment) => payment.invoice_number)?.invoice_number || null;
    return {
      ...sale,
      // PostgREST can return a null embedded relation when the parent is visible
      // but its related catalogue row is filtered by RLS.
      customer: sale.customer as typeof sale.customer | null,
      companyName: sale.seller_type === 'sonasp' ? 'SONASP' : companiesById.get(sale.seller_id || '') || null,
      shipmentDate: shipment?.shipped_at ?? null,
      licenseNumber: licensesById.get(shipment?.export_license_id || shipment?.license_id || '') ?? null,
      invoiceNumber: invoice,
      payments: salePayments,
      disputed: disputedSales.has(sale.id),
    };
  });
}

export type InternationalSaleRecord = Awaited<ReturnType<typeof listInternationalSales>>[number];
