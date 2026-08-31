import { describe, expect, it } from 'vitest';
import { internationalPaymentFixture as fixture } from './internationalPayments.fixture';
import { EMPTY_PAYMENT_FILTERS, calendarDate, filterPayments, paymentCategory, paymentDays, paymentDueDate, paymentGroup, paymentMoney, paymentSummary, paymentTotals, paymentTrend, sortPayments } from './internationalPaymentsList';

const today = '2026-08-30';
describe('Payment ledger presentation', () => {
  it('uses the contractual due date without silently adding thirty days', () => {
    expect(paymentDueDate(fixture())).toBe('2026-08-15');
    expect(paymentDueDate(fixture({ virtual_due_date: '2026-09-10' }))).toBe('2026-09-10');
    expect(paymentDueDate(fixture({ is_virtual: false, virtual_due_date: '2026-09-10' }))).toBe('2026-08-15');
    expect(paymentDueDate(fixture({ due_date: null, expected_date: '2026-08-20' }))).toBe('2026-08-20');
  });
  it('rejects invalid or missing dates and counts calendar days including DST', () => {
    expect(calendarDate('2026-02-30')).toBeNull();
    expect(calendarDate('invalid')).toBeNull();
    expect(paymentDays(null, today)).toBeNull();
    expect(paymentDays('2026-08-31', today)).toBe(1);
    expect(paymentDays('2026-03-30', '2026-03-28')).toBe(2);
  });
  it('distinguishes every actual workflow status and never marks a confirmed receipt overdue', () => {
    expect(paymentCategory(fixture(), today)).toBe('overdue');
    expect(paymentCategory(fixture({ due_date: today }), today)).toBe('pending');
    for (const [status, category] of [['approved', 'paid'], ['processing', 'processing'], ['rejected', 'rejected'], ['cancelled', 'cancelled'], ['failed', 'failed'], ['new_status', 'unknown']]) {
      expect(paymentCategory(fixture({ status, is_virtual: false }), today)).toBe(category);
    }
    expect(paymentCategory(fixture({ status: 'approved', is_virtual: true }), today)).toBe('unknown');
  });
  it('separates receipts, remaining commitments and amounts still to confirm', () => {
    const rows = [fixture({ amount: 500 }), fixture({ id: 'paid', amount: 300, status: 'approved', is_virtual: false }), fixture({ id: 'processing', amount: 200, status: 'processing', is_virtual: false }), fixture({ id: 'void', amount: 1000, status: 'cancelled' })];
    const summary = paymentSummary(rows, today);
    expect(paymentTotals(summary.paid)[0].amount).toBe(300);
    expect(paymentTotals(summary.receivable)[0].amount).toBe(500);
    expect(paymentTotals(summary.processing)[0].amount).toBe(200);
    expect(summary.overdue).toHaveLength(1);
  });
  it('keeps currency subtotals separate and cents exact, including FCFA alias', () => {
    expect(paymentTotals([fixture(), fixture({ currency: 'EUR', amount: 200 }), fixture({ currency: 'FCFA', amount: 300 }), fixture({ currency: 'XOF', amount: 50 })])).toEqual([
      { currency: 'EUR', amount: 200 }, { currency: 'USD', amount: 1200.25 }, { currency: 'XOF', amount: 350 },
    ]);
    expect(paymentMoney(1200.25, 'USD')).toBe('1 200,25 USD');
  });
  it('never replaces absent or malformed amounts with a false zero', () => {
    expect(paymentTotals([fixture({ amount: NaN })])).toEqual([{ currency: 'USD', amount: null }]);
    expect(paymentMoney(null, 'USD')).toBe('—');
    expect(paymentTotals([])).toEqual([]);
  });
  it('combines client, status, currency, method, bank and inclusive due dates', () => {
    expect(filterPayments([fixture()], { ...EMPTY_PAYMENT_FILTERS, client: 'client-1', status: 'overdue', currency: 'USD', method: 'Virement bancaire', bank: 'Banque Export', from: '2026-08-15', to: '2026-08-15' }, today)).toHaveLength(1);
    expect(filterPayments([fixture()], { ...EMPTY_PAYMENT_FILTERS, client: 'other' }, today)).toEqual([]);
    expect(filterPayments([fixture()], { ...EMPTY_PAYMENT_FILTERS, from: '2026-09-01', to: '2026-08-01' }, today)).toEqual([]);
  });
  it('searches references and country without accents and bounds date periods', () => {
    expect(filterPayments([fixture()], { ...EMPTY_PAYMENT_FILTERS, search: 'SUISSE' }, today)).toHaveLength(1);
    expect(filterPayments([fixture()], { ...EMPTY_PAYMENT_FILTERS, search: 'REF-001', period: '30' }, today)).toHaveLength(1);
    expect(filterPayments([fixture()], { ...EMPTY_PAYMENT_FILTERS, period: 'upcoming' }, today)).toEqual([]);
    expect(filterPayments([fixture({ due_date: '2026-09-01' })], { ...EMPTY_PAYMENT_FILTERS, period: '30' }, today)).toEqual([]);
  });
  it('keeps distinct clients with identical names in distinct contiguous groups', () => {
    const a = fixture();
    const b = fixture({ id: 'p2', sale: { ...a.sale!, customer_id: 'client-2' } });
    expect(paymentGroup(a, 'client', today).key).not.toBe(paymentGroup(b, 'client', today).key);
    expect(sortPayments([b, a, fixture({ id: 'p3' })], 'recent', 'client', today).map((p) => p.id)).toEqual(['p3', 'payment-1', 'p2']);
  });
  it('uses real monthly data for sparklines and omits mixed-currency or absent data', () => {
    expect(paymentTrend([fixture({ amount: 200 })], today)).toEqual([0, 0, 0, 0, 0, 200]);
    expect(paymentTrend([fixture(), fixture({ currency: 'EUR' })], today)).toEqual([]);
    expect(paymentTrend([], today)).toEqual([]);
    expect(paymentTrend([fixture({ due_date: '2026-09-01' })], today)).toEqual([]);
  });
});
