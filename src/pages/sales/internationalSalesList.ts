import type { InternationalSaleRecord } from '@/services/internationalSalesListService';

export const GRAMS_PER_TROY_OUNCE = 31.1034768;
export type SalesCategory = 'all' | 'unpaid' | 'partial' | 'paid' | 'disputed' | 'cancelled' | 'approval' | 'rejected' | 'unconfirmed';
export interface SalesFilters {
  search: string;
  category: SalesCategory;
  customer: string;
  seller: string;
  from: string;
  to: string;
  currency: string;
  workflow: string;
}
export const EMPTY_SALES_FILTERS: SalesFilters = {
  search: '', category: 'all', customer: '', seller: '', from: '', to: '', currency: '', workflow: '',
};

export function finiteAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCurrency(value: string | null): string | null {
  const currency = value?.trim().toUpperCase();
  return currency === 'FCFA' ? 'XOF' : currency || null;
}

export function saleCurrency(sale: Pick<InternationalSaleRecord, 'currency'>): string | null {
  return normalizeCurrency(sale.currency);
}

/** amount is the settlement amount, in payments.currency, in the canonical RPC.
 * received_amount is the original foreign-currency transfer and MUST NOT be summed.
 * Processing, virtual and rejected payments are not confirmed receipts.
 */
export function confirmedPaidAmount(sale: Pick<InternationalSaleRecord, 'currency' | 'payments' | 'status' | 'payment_amount' | 'payment_received_at'>): number | null {
  const confirmed = sale.payments.filter((p) => p.status === 'approved' && p.is_virtual === false);
  if (confirmed.length) {
    if (confirmed.some((p) => !saleCurrency(sale) || normalizeCurrency(p.currency) !== saleCurrency(sale)
      || finiteAmount(p.amount) === null || Number(p.amount) < 0)) return null;
    return confirmed.reduce((total, p) => total + Number(p.amount), 0);
  }
  // Do not add the legacy sale summary to the ledger (double-counting).
  if (['payment_received', 'completed'].includes(sale.status)) {
    const legacy = finiteAmount(sale.payment_amount);
    return sale.payment_received_at && legacy !== null && legacy >= 0 ? legacy : null;
  }
  return 0;
}

export function paymentPercent(sale: InternationalSaleRecord): number | null {
  const amount = confirmedPaidAmount(sale);
  const total = finiteAmount(sale.final_proceeds);
  return amount !== null && total !== null && total > 0 ? amount / total * 100 : null;
}

export function salesCategory(sale: InternationalSaleRecord): Exclude<SalesCategory, 'all'> {
  const status: string = sale.status;
  if (['cancelled', 'canceled', 'annulee'].includes(status)) return 'cancelled';
  if (['management_rejected', 'customer_rejected', 'rejected'].includes(status)) return 'rejected';
  if (sale.disputed) return 'disputed';
  const paid = confirmedPaidAmount(sale);
  const total = finiteAmount(sale.final_proceeds);
  if (paid !== null && total !== null && total > 0 && paid >= total - 0.005) return 'paid';
  if (paid !== null && paid > 0) return 'partial';
  if (['payment_received', 'completed'].includes(status)) return 'unconfirmed';
  if (['waiting_for_payment', 'virtual_payment', 'customer_approved'].includes(status)) return 'unpaid';
  if (['create_sales', 'pending_management_approval', 'management_approved', 'pending_for_customer_approval', 'pending', 'approved'].includes(status)) return 'approval';
  return 'unconfirmed';
}

export function sellerKey(sale: InternationalSaleRecord) {
  return sale.seller_type === 'sonasp' ? 'sonasp' : `${sale.seller_type || 'unknown'}:${sale.seller_id || ''}`;
}

export function quantityGrams(sale: InternationalSaleRecord): number | null {
  const ounces = finiteAmount(sale.quantity_oz);
  return ounces === null ? null : ounces * GRAMS_PER_TROY_OUNCE;
}

export function pricePerGram(sale: InternationalSaleRecord): number | null {
  const price = finiteAmount(sale.final_price_per_oz) ?? finiteAmount(sale.london_am_rate);
  return price === null ? null : price / GRAMS_PER_TROY_OUNCE;
}

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
export function filterInternationalSales(sales: InternationalSaleRecord[], filters: SalesFilters) {
  if (filters.from && filters.to && filters.from > filters.to) return [];
  const search = normalized(filters.search);
  return sales.filter((sale) => {
    if (filters.category !== 'all' && salesCategory(sale) !== filters.category) return false;
    if (filters.customer && sale.customer_id !== filters.customer) return false;
    if (filters.seller && sellerKey(sale) !== filters.seller) return false;
    if (filters.currency && saleCurrency(sale) !== filters.currency) return false;
    if (filters.workflow && sale.status !== filters.workflow) return false;
    // Never substitute the creation/sale date for the actual shipping date.
    const day = sale.shipmentDate?.slice(0, 10);
    if (filters.from && (!day || day < filters.from)) return false;
    if (filters.to && (!day || day > filters.to)) return false;
    return !search || normalized([sale.sale_number, sale.invoiceNumber, sale.customer?.name,
      sale.customer?.country, sale.companyName, sale.licenseNumber].filter(Boolean).join(' ')).includes(search);
  });
}

export function salesPageNumbers(page: number, total: number): (number | 'ellipsis-left' | 'ellipsis-right')[] {
  const visible = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4, 5].forEach((n) => visible.add(n));
  if (page >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => visible.add(n));
  const pages = [...visible].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const result: ReturnType<typeof salesPageNumbers> = [];
  pages.forEach((n, index) => {
    if (index && n - pages[index - 1] > 1) result.push(n <= page ? 'ellipsis-left' : 'ellipsis-right');
    result.push(n);
  });
  return result;
}
