import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mock.from } }));
import { listInternationalSales, readAllSalesPages } from './internationalSalesListService';

describe('RLS-bound international sales reads', () => {
  beforeEach(() => vi.clearAllMocks());
  it('paginates beyond the API limit', async () => {
    const query = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null })
      .mockResolvedValueOnce({ data: [{ id: 500 }], error: null });
    expect(await readAllSalesPages(query)).toHaveLength(501);
    expect(query.mock.calls).toEqual([[0, 499], [500, 999]]);
  });
  it('fails closed instead of exporting a truncated successful prefix', async () => {
    const query = vi.fn().mockResolvedValueOnce({ data: Array(500).fill({ id: 1 }), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'permission denied', code: '42501' } });
    await expect(readAllSalesPages(query)).rejects.toMatchObject({ code: '42501' });
  });
  it('does not query global catalogues when RLS returns no sales', async () => {
    const builder = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }) };
    mock.from.mockReturnValue(builder);
    const signal = new AbortController().signal;
    expect(await listInternationalSales(signal)).toEqual([]);
    expect(mock.from.mock.calls).toEqual([['sales']]);
    expect(builder.abortSignal).toHaveBeenCalledWith(signal);
    expect(builder.select.mock.calls[0][0]).not.toContain('*');
  });
  it('limits related reads to the sales and shipments already authorized by RLS', async () => {
    const builders = new Map<string, { in: ReturnType<typeof vi.fn> }>();
    mock.from.mockImplementation((table: string) => {
      const data = table === 'sales' ? [{ id: 'authorized-sale', seller_id: 'mine-a', seller_type: 'mining_company', shipping_preparation_id: 'shipment-a' }]
        : table === 'shipping_preparations' ? [{ id: 'shipment-a', export_license_id: 'license-a', license_id: null, shipped_at: null }]
        : [];
      const builder = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockResolvedValue({ data, error: null }) };
      builders.set(table, builder); return builder;
    });
    await listInternationalSales(new AbortController().signal);
    for (const table of ['payments', 'sales_documents', 'snp_conciliations']) expect(builders.get(table)?.in).toHaveBeenCalledWith('sale_id', ['authorized-sale']);
    expect(builders.get('mining_companies')?.in).toHaveBeenCalledWith('id', ['mine-a']);
    expect(builders.get('shipping_preparations')?.in).toHaveBeenCalledWith('id', ['shipment-a']);
    expect(builders.get('export_licenses')?.in).toHaveBeenCalledWith('id', ['license-a']);
    expect(mock.from).not.toHaveBeenCalledWith('customers');
  });
});
