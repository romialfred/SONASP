import { describe, expect, it } from 'vitest';
import { currentPaymentEvents, currentPaymentProof, detailDate, detailStatus, paymentFinance, paymentHistory, paymentOverviewTimeline, paymentReference } from './internationalPaymentDetail';
import { detailPaymentFixture, paymentDetailFixture } from './internationalPaymentDetail.fixture';

describe('Payment detail financial and timeline model', () => {
  it('accounts for all confirmed receipts once and not just the final payment', () => {
    expect(paymentFinance(paymentDetailFixture())).toMatchObject({ confirmed: 4204127.86, otherConfirmed: 2162849, outstanding: 0, settled: true });
  });
  it('does not label a partial confirmed receipt as a fully paid sale', () => {
    const detail = paymentDetailFixture(); detail.payments = [detail.payment];
    expect(paymentFinance(detail)).toMatchObject({ outstanding: 2162849, settled: false, otherConfirmed: 0 });
  });
  it('excludes virtual commitments, processing and rejected amounts from confirmed funds', () => {
    const detail = paymentDetailFixture();
    detail.payment = detailPaymentFixture({ status: 'processing' });
    detail.payments = [detail.payment, detailPaymentFixture({ amount: 99, status: 'pending', is_virtual: true }), detailPaymentFixture({ amount: 800, status: 'rejected' })];
    expect(paymentFinance(detail)).toMatchObject({ confirmed: 0, processing: 2041278.86, settled: false });
    expect(detailStatus(detail.payment).label).toBe('À rapprocher');
  });
  it('does not fabricate balances if the ledger is unavailable or mixes currencies', () => {
    const detail = paymentDetailFixture(); detail.payments = null;
    expect(paymentFinance(detail).confirmed).toBeNull();
    detail.payments = [detailPaymentFixture({ currency: 'EUR' })];
    expect(paymentFinance(detail).outstanding).toBeNull();
  });
  it('does not silently mark a virtual approved payment as confirmed', () => {
    const payment = detailPaymentFixture({ is_virtual: true });
    expect(detailStatus(payment).label).toBe('À vérifier');
    expect(currentPaymentEvents(payment).some((event) => event.titre === 'Paiement confirmé')).toBe(false);
  });
  it('includes shipment, refinery, conciliation, sale and the current receipt', () => {
    expect(paymentOverviewTimeline(paymentDetailFixture()).map((event) => event.etape)).toEqual(['expedition', 'analyse', 'conciliation', 'vente', 'paiement']);
    expect(paymentHistory(paymentDetailFixture())).toHaveLength(7);
  });
  it('does not invent upstream events when the graph is unavailable', () => {
    const detail = paymentDetailFixture(); detail.dossier = null;
    expect(paymentHistory(detail).every((event) => event.etape === 'paiement')).toBe(true);
    expect(paymentOverviewTimeline(detail)).toHaveLength(1);
  });
  it('only offers the current payment proof, not the proof of a different receipt', () => {
    const detail = paymentDetailFixture();
    expect(currentPaymentProof(detail)?.id).toBe('doc-proof');
    detail.payment.proof_url = null;
    expect(currentPaymentProof(detail)).toBeUndefined();
  });
  it('does not manufacture an invoice reference or midnight payment time', () => {
    expect(paymentReference(detailPaymentFixture({ reference_number: null, transaction_id: null }))).toBe('payment-a');
    expect(detailDate('2026-06-09', true)).not.toContain('00:00');
    expect(detailDate(null)).toBe('Non renseignée');
  });
});
