import { supabase } from '@/lib/supabase';
import { readAllSalesPages } from './internationalSalesListService';

// Read only the signed-in user's ledger and its authorized sale. Never accept a
// tenant override, and never fetch a global customer catalogue for UI filters.
const COLUMNS = 'id,sale_id,amount,currency,status,is_virtual,invoice_number,expected_date,due_date,virtual_due_date,actual_date,approved_at,created_at,bank_name,payment_method,reference_number,sale:sales!payments_sale_id_fkey!inner(id,sale_number,customer_id,status,seller_type,payment_method,customer:customers!sales_customer_id_fkey(id,name,country))';

export async function listInternationalPayments(signal: AbortSignal) {
  const payments = await readAllSalesPages((from, to) => supabase.from('payments')
    .select(COLUMNS).order('created_at', { ascending: false, nullsFirst: false }).order('id')
    .range(from, to).abortSignal(signal));
  const saleIds = [...new Set(payments.map((payment) => payment.sale_id))];
  const invoices = new Map<string, string>();
  // A partial installment may not repeat the invoice stored on its sale.
  for (let offset = 0; offset < saleIds.length; offset += 100) {
    const documents = await readAllSalesPages((from, to) => supabase.from('sales_documents')
      .select('id,sale_id,document_number,status').eq('document_type', 'invoice')
      .in('sale_id', saleIds.slice(offset, offset + 100))
      .order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(signal));
    for (const doc of documents) {
      if (doc.status !== 'archived' && doc.document_number && !invoices.has(doc.sale_id)) {
        invoices.set(doc.sale_id, doc.document_number);
      }
    }
  }
  return payments.map((payment) => ({ ...payment,
    invoice_number: payment.invoice_number || invoices.get(payment.sale_id) || null,
    sale: payment.sale as typeof payment.sale | null,
  }));
}

export type InternationalPaymentRecord = Awaited<ReturnType<typeof listInternationalPayments>>[number];
