import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn(), documents: vi.fn(), origins: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mock.from } }));
vi.mock('./saleDocumentsService', () => ({ getSaleDocuments: mock.documents }));
vi.mock('./tracabiliteVenteService', () => ({ tracabiliteVenteService: { lotsDeVente: mock.origins } }));
import { getInternationalSaleDetail } from './internationalSaleDetailService';

describe('International sale detail — parent-scoped reads', () => {
  const builders = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const results = new Map<string, { data: unknown; error: unknown }>();
  beforeEach(() => {
    vi.clearAllMocks(); builders.clear(); results.clear();
    mock.documents.mockResolvedValue({ success: true, data: [] });
    mock.origins.mockResolvedValue([]);
    results.set('sales', { data: { id: 'sale-a', seller_id: 'mine-a', created_by: 'author-a', shipping_preparation_id: 'shipment-a' }, error: null });
    results.set('shipping_preparations', { data: { id: 'shipment-a', export_license_id: 'license-a' }, error: null });
    mock.from.mockImplementation((table: string) => {
      const response = () => Promise.resolve(results.get(table) || { data: [], error: null });
      const builder = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), maybeSingle: vi.fn(response), then: vi.fn((resolve) => response().then(resolve)) };
      builders.set(table, builder); return builder;
    });
  });
  it('does not query any related table for an inaccessible sale', async () => {
    results.set('sales', { data: null, error: null });
    await expect(getInternationalSaleDetail('foreign-id', new AbortController().signal)).rejects.toThrow('inaccessible');
    expect(mock.from.mock.calls).toEqual([['sales']]);
    expect(mock.documents).not.toHaveBeenCalled();
    expect(mock.origins).not.toHaveBeenCalled();
  });
  it('uses only IDs authorized by the parent and propagates cancellation', async () => {
    const signal = new AbortController().signal;
    await getInternationalSaleDetail('sale-a', signal);
    for (const table of ['payments', 'snp_conciliations']) expect(builders.get(table)?.eq).toHaveBeenCalledWith('sale_id', 'sale-a');
    for (const [table, id] of [['mining_companies', 'mine-a'], ['user_profiles', 'author-a'], ['shipping_preparations', 'shipment-a'], ['export_licenses', 'license-a']]) {
      expect(builders.get(table)?.eq).toHaveBeenCalledWith('id', id);
      expect(builders.get(table)?.abortSignal).toHaveBeenCalledWith(signal);
    }
    expect(mock.documents).toHaveBeenCalledWith('sale-a');
    expect(mock.origins).toHaveBeenCalledWith('sale-a');
    expect(mock.from).not.toHaveBeenCalledWith('customers');
  });
  it('rejects a failed ledger rather than presenting a zero paid amount', async () => {
    results.set('payments', { data: null, error: { code: '42501', message: 'denied' } });
    await expect(getInternationalSaleDetail('sale-a', new AbortController().signal)).rejects.toMatchObject({ code: '42501' });
  });
  it('distinguishes unavailable supporting information from an empty collection', async () => {
    mock.documents.mockResolvedValue({ success: false });
    mock.origins.mockRejectedValue(new Error('offline'));
    results.set('snp_conciliations', { data: null, error: { code: '42501' } });
    const detail = await getInternationalSaleDetail('sale-a', new AbortController().signal);
    expect(detail.documents).toBeNull(); expect(detail.origins).toBeNull(); expect(detail.conciliations).toBeNull();
    expect(detail.unavailable).toEqual(expect.arrayContaining(['documents', 'origins', 'conciliation']));
    expect(detail.payments).toEqual([]);
  });
});
