import { describe, expect, it } from 'vitest';
import { confirmedPaidAmount, EMPTY_SALES_FILTERS, filterInternationalSales, finiteAmount, paymentPercent, pricePerGram, quantityGrams, salesCategory, salesPageNumbers } from './internationalSalesList';
import { paymentFixture, saleFixture } from './internationalSalesList.fixture';

describe('International sales settlement and units', () => {
  it('converts troy ounces and their unit price to grams consistently', () => {
    const sale = saleFixture();
    expect(quantityGrams(sale)).toBeCloseTo(622.069536, 6);
    expect(pricePerGram(sale)! * quantityGrams(sale)!).toBeCloseTo(50000, 2);
  });
  it('uses the final ounce price when provided, not a fictitious reference price', () => {
    expect(pricePerGram(saleFixture({ final_price_per_oz: 2400 }))).toBeCloseTo(2400 / 31.1034768);
  });
  it('does not silently turn absent or invalid values into zero', () => {
    for (const value of [null, undefined, '', 'invalid', Infinity]) expect(finiteAmount(value)).toBeNull();
    expect(finiteAmount('0')).toBe(0);
  });
  it('adds approved real payments without double-counting sale.payment_amount', () => {
    const sale = saleFixture({ payment_amount: 48000, payments: [paymentFixture(), paymentFixture({ id: 'payment-b', amount: 12000 })] });
    expect(confirmedPaidAmount(sale)).toBe(36000);
    expect(paymentPercent(sale)).toBe(75);
    expect(salesCategory(sale)).toBe('partial');
  });
  it.each(['pending', 'processing', 'rejected', 'cancelled', 'failed'])('excludes %s payments', (status) => {
    expect(confirmedPaidAmount(saleFixture({ payments: [paymentFixture({ status })] }))).toBe(0);
  });
  it('never counts virtual commitments as receipts', () => {
    expect(confirmedPaidAmount(saleFixture({ status: 'virtual_payment', payment_amount: 48000, payments: [paymentFixture({ is_virtual: true })] }))).toBe(0);
  });
  it('does not add currencies or invent an exchange rate', () => {
    const sale = saleFixture({ payments: [paymentFixture({ currency: 'EUR' })] });
    expect(confirmedPaidAmount(sale)).toBeNull();
    expect(paymentPercent(sale)).toBeNull();
  });
  it('recognizes FCFA and XOF as the same currency without conversion', () => {
    expect(confirmedPaidAmount(saleFixture({ currency: 'XOF', payments: [paymentFixture({ currency: 'FCFA' })] }))).toBe(24000);
    expect(confirmedPaidAmount(saleFixture({ currency: 'FCFA', payments: [paymentFixture({ currency: 'XOF' })] }))).toBe(24000);
  });
  it('does not declare a closed legacy sale paid without an amount and receipt date', () => {
    expect(confirmedPaidAmount(saleFixture({ status: 'completed' }))).toBeNull();
    expect(salesCategory(saleFixture({ status: 'completed' }))).toBe('unconfirmed');
    expect(confirmedPaidAmount(saleFixture({ status: 'payment_received', payment_amount: 48000, payment_received_at: '2026-08-28' }))).toBe(48000);
  });
  it('classifies paid, disputed, rejected and pending approvals separately', () => {
    expect(salesCategory(saleFixture({ payments: [paymentFixture({ amount: 48000 })] }))).toBe('paid');
    expect(salesCategory(saleFixture({ disputed: true }))).toBe('disputed');
    expect(salesCategory(saleFixture({ status: 'management_rejected' }))).toBe('rejected');
    expect(salesCategory(saleFixture({ status: 'pending_management_approval' }))).toBe('approval');
  });
  it('does not hide overpayment by capping the displayed percentage', () => {
    expect(paymentPercent(saleFixture({ payments: [paymentFixture({ amount: 60000 })] }))).toBe(125);
  });
});

describe('International sales filters and pagination', () => {
  const sales = [saleFixture(), saleFixture({ id: 'sale-b', seller_id: 'mine-b', companyName: 'Mine Bêta', shipmentDate: null })];
  it('combines tenant selector, customer, status, search and inclusive shipment dates', () => {
    expect(filterInternationalSales(sales, { ...EMPTY_SALES_FILTERS, seller: 'mining_company:mine-a', customer: 'customer-a', category: 'unpaid', search: 'metaux', from: '2026-08-27', to: '2026-08-27' })).toHaveLength(1);
  });
  it('searches invoices and export licences', () => {
    expect(filterInternationalSales(sales, { ...EMPTY_SALES_FILTERS, search: 'FACT-2026-001' })).toHaveLength(2);
    expect(filterInternationalSales(sales, { ...EMPTY_SALES_FILTERS, search: 'EXP-2026-001' })).toHaveLength(2);
  });
  it('never substitutes sale dates for missing shipment dates', () => {
    expect(filterInternationalSales([sales[1]], { ...EMPTY_SALES_FILTERS, from: '2026-08-01' })).toHaveLength(0);
  });
  it('rejects inverted dates and inaccessible seller IDs', () => {
    expect(filterInternationalSales(sales, { ...EMPTY_SALES_FILTERS, from: '2026-09-01', to: '2026-08-01' })).toHaveLength(0);
    expect(filterInternationalSales(sales, { ...EMPTY_SALES_FILTERS, seller: 'mining_company:another-tenant' })).toHaveLength(0);
  });
  it('retains filters on actual currency and workflow', () => {
    expect(filterInternationalSales(sales, { ...EMPTY_SALES_FILTERS, currency: 'EUR' })).toHaveLength(0);
    expect(filterInternationalSales(sales, { ...EMPTY_SALES_FILTERS, workflow: 'completed' })).toHaveLength(0);
  });
  it('produces bounded accessible page navigation without duplicate keys', () => {
    expect(salesPageNumbers(1, 1)).toEqual([1]);
    expect(salesPageNumbers(1, 13)).toEqual([1, 2, 3, 4, 5, 'ellipsis-right', 13]);
    expect(salesPageNumbers(7, 13)).toEqual([1, 'ellipsis-left', 6, 7, 8, 'ellipsis-right', 13]);
  });
});
