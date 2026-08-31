import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentDetailFixture } from '@/pages/payments/internationalPaymentDetail.fixture';
const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), sign: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mock.from, rpc: mock.rpc } }));
vi.mock('@/lib/privateStorage', async (original) => ({ ...await original<typeof import('@/lib/privateStorage')>(), createPrivateSignedUrl: mock.sign }));
import { downloadPaymentDocument, getInternationalPaymentDetail, paymentDocumentLocation, paymentDocuments } from './internationalPaymentDetailService';

const builders: { table: string; eq: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; abortSignal: ReturnType<typeof vi.fn> }[] = [];
function install(options: { parentMissing?: boolean; saleMissing?: boolean; ledgerError?: boolean; dossierError?: boolean } = {}) {
  const fixture = paymentDetailFixture();
  let paymentQueries = 0;
  mock.from.mockImplementation((table: string) => {
    const parent = table === 'payments' && paymentQueries++ === 0;
    const data = table === 'payments' ? parent ? options.parentMissing ? null : fixture.payment : fixture.payments
      : table === 'sales' ? options.saleMissing ? null : fixture.sale
      : table === 'customer_banks' ? fixture.customerBank : table === 'stakeholder_bank_accounts' ? fixture.receivingBank : [{ id: 'author-a', full_name: 'TIEGNAN Romuald' }];
    const response = { data, error: table === 'payments' && !parent && options.ledgerError ? { message: 'denied' } : null };
    const builder = { table, select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(response), then: (resolve: (value: unknown) => void) => Promise.resolve(response).then(resolve) };
    builders.push(builder); return builder;
  });
  mock.rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ data: fixture.dossier, error: options.dossierError ? { message: 'RPC absent' } : null }) });
}
describe('RLS-bound payment detail reads', () => {
  beforeEach(() => { vi.clearAllMocks(); builders.length = 0; install(); });
  it('reads the payment first and bounds every related query to its trusted IDs', async () => {
    const signal = new AbortController().signal;
    const detail = await getInternationalPaymentDetail('payment-a', signal);
    expect(detail.payment.id).toBe('payment-a');
    expect(builders[0].eq).toHaveBeenCalledWith('id', 'payment-a');
    expect(builders[1].eq).toHaveBeenCalledWith('id', 'sale-a');
    expect(builders.filter((b) => b.table === 'payments')[1].eq).toHaveBeenCalledWith('sale_id', 'sale-a');
    expect(builders.find((b) => b.table === 'customer_banks')?.eq).toHaveBeenCalledWith('customer_id', 'customer-a');
    expect(builders.find((b) => b.table === 'stakeholder_bank_accounts')?.eq).toHaveBeenCalledWith('id', 'receiver-a');
    expect(mock.rpc).toHaveBeenCalledWith('snp_dossier_complet', { p_type: 'paiement', p_id: 'payment-a' });
    for (const builder of builders) { expect(builder.abortSignal).toHaveBeenCalledWith(signal); expect(builder.select.mock.calls[0][0]).not.toContain('*'); }
  });
  it('does not read a sale or graph if the payment is hidden by RLS', async () => {
    install({ parentMissing: true }); await expect(getInternationalPaymentDetail('hidden', new AbortController().signal)).rejects.toThrow('Paiement introuvable');
    expect(mock.from).toHaveBeenCalledTimes(1); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('does not read the graph or banks if the related sale is inaccessible', async () => {
    install({ saleMissing: true }); await expect(getInternationalPaymentDetail('payment-a', new AbortController().signal)).rejects.toThrow('vente associée');
    expect(mock.from).toHaveBeenCalledTimes(2); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('preserves null ledger on failure, not an empty zero balance', async () => {
    install({ ledgerError: true }); const detail = await getInternationalPaymentDetail('payment-a', new AbortController().signal);
    expect(detail.payments).toBeNull(); expect(detail.unavailable).toContain('ledger');
  });
  it('reports missing graph without synthesizing successful upstream steps', async () => {
    install({ dossierError: true }); const detail = await getInternationalPaymentDetail('payment-a', new AbortController().signal);
    expect(detail.dossier).toBeNull(); expect(detail.unavailable).toContain('dossier');
  });
});
describe('Payment private document handling', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('deduplicates a payment proof already included in the dossier', () => {
    expect(paymentDocuments(paymentDetailFixture())).toHaveLength(4);
  });
  it('rejects arbitrary URLs, traversal and the closed freight bucket', () => {
    const document = paymentDetailFixture().dossier!.documents[1];
    expect(paymentDocumentLocation({ ...document, chemin: 'https://evil.test/invoice.pdf' })).toBeNull();
    expect(paymentDocumentLocation({ ...document, chemin: '../invoice.pdf' })).toBeNull();
    expect(paymentDocumentLocation({ ...document, source: 'freight_shipments' })).toBeNull();
  });
  it('re-signs legacy storage URLs rather than opening a permanent public link', () => {
    const document = paymentDetailFixture().dossier!.documents[1];
    expect(paymentDocumentLocation({ ...document, chemin: 'https://old.test/storage/v1/object/public/sales-documents/sale-a/invoice.pdf' })).toEqual({ bucket: 'sales-documents', path: 'sale-a/invoice.pdf' });
  });
  it('never signs or downloads an unknown source', async () => {
    const document = { ...paymentDetailFixture().dossier!.documents[1], source: 'unknown' };
    await expect(downloadPaymentDocument(document, new AbortController().signal)).rejects.toThrow('référence');
    expect(mock.sign).not.toHaveBeenCalled();
  });
  it('cancels a download if the account scope changed while obtaining the signed URL', async () => {
    const abort = new AbortController();
    mock.sign.mockImplementation(async () => { abort.abort(); return 'https://signed.test/document'; });
    await expect(downloadPaymentDocument(paymentDetailFixture().dossier!.documents[0], abort.signal)).rejects.toThrow();
    expect(mock.sign).toHaveBeenCalledWith('payment-proofs', 'payment-a/confirmation.pdf', 300);
  });
});
