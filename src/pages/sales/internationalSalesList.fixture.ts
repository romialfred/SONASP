import type { InternationalSaleRecord } from '@/services/internationalSalesListService';

/** Synthetic fixtures imported only by tests; never by the application. */
export function saleFixture(overrides: Partial<InternationalSaleRecord> = {}): InternationalSaleRecord {
  return {
    id: 'sale-a', sale_number: 'VE-2026-00038', status: 'waiting_for_payment',
    sale_date: '2026-08-27', created_at: '2026-08-26T10:00:00Z',
    customer_id: 'customer-a', seller_id: 'mine-a', seller_type: 'mining_company',
    quantity_oz: 20, final_proceeds: 48000, gross_proceeds: 50000,
    final_price_per_oz: null, london_am_rate: 2500, currency: 'USD',
    payment_amount: null, payment_received_at: null, shipping_preparation_id: 'shipment-a',
    customer: { id: 'customer-a', name: 'Métaux Export SA', country: 'Suisse' },
    companyName: 'Mine Alpha', shipmentDate: '2026-08-27T18:30:00Z',
    licenseNumber: 'EXP-2026-001', invoiceNumber: 'FACT-2026-001', payments: [], disputed: false,
    ...overrides,
  };
}

export function paymentFixture(overrides: Partial<InternationalSaleRecord['payments'][number]> = {}): InternationalSaleRecord['payments'][number] {
  return { id: 'payment-a', sale_id: 'sale-a', amount: 24000, currency: 'USD', status: 'approved', is_virtual: false, invoice_number: null, ...overrides };
}
