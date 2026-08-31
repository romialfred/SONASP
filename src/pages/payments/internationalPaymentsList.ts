import type { InternationalPaymentRecord } from '@/services/internationalPaymentsListService';

export type PaymentCategory = 'paid' | 'pending' | 'overdue' | 'processing' | 'rejected' | 'cancelled' | 'failed' | 'unknown';
export const PAYMENT_LABELS: Record<PaymentCategory, string> = {
  paid: 'Payé', pending: 'En attente', overdue: 'En retard', processing: 'À confirmer',
  rejected: 'Rejeté', cancelled: 'Annulé', failed: 'Échec', unknown: 'À vérifier',
};
export const PAYMENT_TONES = { paid: 'success', pending: 'warning', overdue: 'danger', processing: 'info', rejected: 'danger', cancelled: 'neutral', failed: 'danger', unknown: 'neutral' } as const;
export type Grouping = '' | 'client' | 'status' | 'bank' | 'currency';
export type PaymentSort = 'recent' | 'due' | 'amount' | 'client';
export interface PaymentFilters {
  search: string; status: string; period: string; from: string; to: string;
  client: string; currency: string; bank: string; method: string;
}
export const EMPTY_PAYMENT_FILTERS: PaymentFilters = { search: '', status: '', period: '', from: '', to: '', client: '', currency: '', bank: '', method: '' };
const DAY = 86_400_000;
export const paymentCurrency = (value: string | null) => value?.trim().toUpperCase() === 'FCFA' ? 'XOF' : value?.trim().toUpperCase() || '';
export function paymentAmount(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function paymentMoney(value: number | null, currency: string) {
  return value === null || !currency ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} ${currency === 'XOF' ? 'FCFA' : currency}`;
}
/** Calendar dates, not elapsed local hours (DST must not change the day count). */
export function calendarDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return null;
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null;
}
export function paymentDate(value: string | null) {
  const day = calendarDate(value);
  return day ? new Date(`${day}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Non renseignée';
}
export function paymentDueDate(payment: InternationalPaymentRecord) {
  // Due dates are supplied by the workflow. Do not invent an additional 30 days.
  return calendarDate(payment.is_virtual ? payment.virtual_due_date : null)
    || calendarDate(payment.due_date) || calendarDate(payment.expected_date);
}
export function paymentDays(date: string | null, today: string): number | null {
  const due = calendarDate(date); const reference = calendarDate(today);
  return due && reference ? Math.round((Date.parse(due) - Date.parse(reference)) / DAY) : null;
}
export function paymentCategory(payment: InternationalPaymentRecord, today: string): PaymentCategory {
  if (payment.status === 'approved') return payment.is_virtual === false ? 'paid' : 'unknown';
  if (payment.status === 'processing') return payment.is_virtual === false ? 'processing' : 'unknown';
  if (payment.status === 'pending') return (paymentDays(paymentDueDate(payment), today) ?? 0) < 0 ? 'overdue' : 'pending';
  if (payment.status === 'rejected') return 'rejected';
  if (payment.status === 'cancelled') return 'cancelled';
  if (payment.status === 'failed') return 'failed';
  return 'unknown';
}
export function paymentMethod(payment: InternationalPaymentRecord) {
  const value = payment.payment_method || payment.sale?.payment_method;
  const names: Record<string, string> = { bank_transfer: 'Virement bancaire', wire_transfer: 'Virement bancaire', swift: 'Virement SWIFT', cash: 'Espèces', check: 'Chèque', cheque: 'Chèque', mobile_money: 'Mobile money' };
  return value ? names[value] || value : 'Mode non renseigné';
}
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
export function filterPayments(rows: InternationalPaymentRecord[], filters: PaymentFilters, today: string) {
  if (filters.from && filters.to && filters.from > filters.to) return [];
  const search = normalized(filters.search.trim());
  return rows.filter((p) => {
    const date = paymentDueDate(p);
    const days = paymentDays(date, today);
    const customer = p.sale?.customer;
    return (!search || [p.sale?.sale_number, p.invoice_number, customer?.name, customer?.country, p.reference_number, p.bank_name].some((v) => v && normalized(v).includes(search)))
      && (!filters.status || paymentCategory(p, today) === filters.status)
      && (!filters.client || p.sale?.customer_id === filters.client)
      && (!filters.currency || paymentCurrency(p.currency) === filters.currency)
      && (!filters.bank || p.bank_name === filters.bank)
      && (!filters.method || paymentMethod(p) === filters.method)
      && (!filters.from || Boolean(date && date >= filters.from))
      && (!filters.to || Boolean(date && date <= filters.to))
      && (!filters.period || (days !== null && (filters.period === 'upcoming' ? days >= 0 && days <= 30
        : filters.period === 'month' ? date!.slice(0, 7) === today.slice(0, 7) : days <= 0 && days >= -Number(filters.period))));
  });
}
export function paymentGroup(payment: InternationalPaymentRecord, grouping: Grouping, today: string) {
  if (grouping === 'client') return { key: payment.sale?.customer_id || 'unknown', label: payment.sale?.customer?.name || 'Client non renseigné' };
  if (grouping === 'status') { const category = paymentCategory(payment, today); return { key: category, label: PAYMENT_LABELS[category] }; }
  if (grouping === 'bank') return { key: payment.bank_name || 'unknown', label: payment.bank_name || 'Banque non renseignée' };
  if (grouping === 'currency') { const currency = paymentCurrency(payment.currency); return { key: currency, label: currency || 'Devise non renseignée' }; }
  return { key: '', label: '' };
}
export function sortPayments(rows: InternationalPaymentRecord[], sort: PaymentSort, grouping: Grouping, today: string) {
  const compare = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true });
  return [...rows].sort((a, b) => {
    const ga = paymentGroup(a, grouping, today); const gb = paymentGroup(b, grouping, today);
    if (ga.key !== gb.key) return compare(ga.label, gb.label) || compare(ga.key, gb.key);
    let order = 0;
    if (sort === 'client') order = compare(a.sale?.customer?.name || '\uffff', b.sale?.customer?.name || '\uffff');
    else if (sort === 'due') order = compare(paymentDueDate(a) || '\uffff', paymentDueDate(b) || '\uffff');
    // Different currencies are sorted separately, never compared as equal units.
    else if (sort === 'amount') order = compare(paymentCurrency(a.currency), paymentCurrency(b.currency)) || (paymentAmount(b.amount) ?? -1) - (paymentAmount(a.amount) ?? -1);
    else order = compare(b.created_at || '', a.created_at || '');
    return order || compare(a.id, b.id);
  });
}
export interface PaymentTotal { currency: string; amount: number | null }
export function paymentTotals(rows: InternationalPaymentRecord[]): PaymentTotal[] {
  const sums = new Map<string, number | null>();
  for (const row of rows) {
    const currency = paymentCurrency(row.currency);
    const amount = paymentAmount(row.amount);
    const current = sums.get(currency);
    sums.set(currency, current === null || amount === null || !currency ? null : (current ?? 0) + amount);
  }
  return [...sums].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: amount === null ? null : Math.round((amount + Number.EPSILON) * 100) / 100 }));
}
export function paymentSummary(rows: InternationalPaymentRecord[], today: string) {
  const paid = rows.filter((p) => paymentCategory(p, today) === 'paid');
  const receivable = rows.filter((p) => ['pending', 'overdue'].includes(paymentCategory(p, today)));
  const processing = rows.filter((p) => paymentCategory(p, today) === 'processing');
  const overdue = rows.filter((p) => paymentCategory(p, today) === 'overdue');
  return { paid, receivable, processing, overdue };
}
/** Six monthly buckets of actual records, not a decorative or historical balance. */
export function paymentTrend(rows: InternationalPaymentRecord[], today: string, received = false, count = false): number[] {
  if (!count && (paymentTotals(rows).length !== 1 || paymentTotals(rows)[0]?.amount === null)) return [];
  const end = new Date(`${today}T00:00:00Z`);
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5 + i, 1)).toISOString().slice(0, 7));
  const sums = months.map(() => 0);
  for (const row of rows) {
    const date = received ? calendarDate(row.actual_date) || calendarDate(row.approved_at) : paymentDueDate(row);
    const index = date ? months.indexOf(date.slice(0, 7)) : -1;
    if (index >= 0 && date! <= today) sums[index] += count ? 1 : paymentAmount(row.amount) ?? 0;
  }
  return sums.some((value) => value > 0) ? sums : [];
}
