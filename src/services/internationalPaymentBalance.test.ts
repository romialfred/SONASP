import { describe, expect, it } from 'vitest';
import { internationalPaymentBalance, isPayableSaleStatus, type SettlementPayment } from './internationalPaymentBalance';
const payment = (overrides: Partial<SettlementPayment> = {}): SettlementPayment => ({ amount: 200, currency: 'USD', status: 'approved', is_virtual: false, ...overrides });
describe('International payment balance', () => {
  it('excludes commitments and rejected payments, reserves processing amounts', () => {
    expect(internationalPaymentBalance(1000, 'USD', [payment(), payment({ status: 'processing', amount: 300 }), payment({ status: 'pending', is_virtual: true, amount: 500 }), payment({ status: 'rejected', amount: 600 })]))
      .toEqual({ confirmed: 200, processing: 300, outstanding: 800, available: 500 });
  });
  it('handles multiple partial confirmed receipts without closing too soon', () => {
    expect(internationalPaymentBalance(1000, 'USD', [payment(), payment()])).toMatchObject({ confirmed: 400, outstanding: 600, available: 600 });
  });
  it('retains an overpayment as a credit, but forbids further entry', () => {
    expect(internationalPaymentBalance(1000, 'USD', [payment({ amount: 1001 })])).toMatchObject({ outstanding: -1, available: 0 });
  });
  it.each([payment({ currency: 'EUR' }), payment({ amount: null }), payment({ amount: '' }), payment({ amount: -1 }), payment({ amount: NaN }), payment({ is_virtual: true })])('fails closed on ambiguous settlement data %j', (row) => {
    expect(internationalPaymentBalance(1000, 'USD', [row]).available).toBeNull();
  });
  it('does not count raw received_amount in another currency', () => {
    const row = { ...payment(), received_amount: 900000, payment_currency: 'XOF' };
    expect(internationalPaymentBalance(1000, 'USD', [row]).confirmed).toBe(200);
  });
  it('supports the state after the first partial receipt, not unapproved sales', () => {
    expect(isPayableSaleStatus('virtual_payment')).toBe(true);
    expect(isPayableSaleStatus('waiting_for_payment')).toBe(true);
    for (const state of ['completed', 'create_sales', 'management_approved', 'pending_for_customer_approval', 'customer_rejected']) expect(isPayableSaleStatus(state)).toBe(false);
  });
});
