import type { InternationalPaymentRecord } from '@/services/internationalPaymentsListService';

/** Synthetic test/visual harness data. Never imported by the authenticated page. */
export function internationalPaymentFixture(overrides: Partial<InternationalPaymentRecord> = {}): InternationalPaymentRecord {
  return {
    id: 'payment-1', sale_id: 'sale-1', amount: 1200.25, currency: 'USD', status: 'pending', is_virtual: true,
    invoice_number: 'FA-2026-001', expected_date: '2026-08-15', due_date: '2026-08-15', virtual_due_date: null,
    actual_date: null, approved_at: null, created_at: '2026-08-01T09:00:00Z', bank_name: 'Banque Export',
    payment_method: 'bank_transfer', reference_number: 'REF-001',
    sale: { id: 'sale-1', sale_number: 'SL-2026-001', customer_id: 'client-1', status: 'virtual_payment', seller_type: 'sonasp', payment_method: 'bank_transfer', customer: { id: 'client-1', name: 'Client Export', country: 'Suisse' } },
    ...overrides,
  };
}
