/** Settlement amounts only: received_amount can be denominated in another currency. */
export interface SettlementPayment {
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  is_virtual: boolean | null;
}

export function internationalPaymentBalance(total: number | null, currency: string | null, payments: SettlementPayment[]) {
  const relevant = payments.filter((p) => ['processing', 'approved'].includes(p.status || ''));
  const valid = total !== null && Number.isFinite(total) && total > 0 && Boolean(currency)
    && relevant.every((p) => p.is_virtual === false && p.amount !== null && p.amount !== ''
      && Number.isFinite(Number(p.amount)) && Number(p.amount) >= 0
      && p.currency?.toUpperCase() === currency?.toUpperCase());
  if (!valid) return { confirmed: null, processing: null, outstanding: null, available: null };
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const confirmed = round(relevant.filter((p) => p.status === 'approved').reduce((n, p) => n + Number(p.amount), 0));
  const processing = round(relevant.filter((p) => p.status === 'processing').reduce((n, p) => n + Number(p.amount), 0));
  return { confirmed, processing, outstanding: round(total! - confirmed), available: Math.max(0, round(total! - confirmed - processing)) };
}

export const isPayableSaleStatus = (status: string): status is 'waiting_for_payment' | 'virtual_payment' =>
  status === 'waiting_for_payment' || status === 'virtual_payment';
