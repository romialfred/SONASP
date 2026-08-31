import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mock.from } }));
import { listInternationalPayments } from './internationalPaymentsListService';

describe('Authorized payment register reads', () => {
  beforeEach(() => vi.clearAllMocks());
  function builder(data: unknown[], error: unknown = null) {
    return { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockResolvedValue({ data: error ? null : data, error }) };
  }
  it('reads explicit columns with an authorized parent and abort signal, not a global customer list', async () => {
    const query = builder([]); mock.from.mockReturnValue(query);
    const signal = new AbortController().signal;
    expect(await listInternationalPayments(signal)).toEqual([]);
    expect(mock.from.mock.calls).toEqual([['payments']]);
    expect(query.select.mock.calls[0][0]).toContain('payments_sale_id_fkey!inner');
    expect(query.select.mock.calls[0][0]).not.toContain('*');
    expect(query.abortSignal).toHaveBeenCalledWith(signal);
  });
  it('paginates the ledger beyond the PostgREST limit', async () => {
    const query = builder([]);
    query.abortSignal.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => ({ id: `p${i}`, sale_id: 'sale-a' })), error: null }).mockResolvedValueOnce({ data: [{ id: 'p501', sale_id: 'sale-a' }], error: null });
    mock.from.mockImplementation((table) => table === 'payments' ? query : builder([]));
    expect(await listInternationalPayments(new AbortController().signal)).toHaveLength(501);
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });
  it('limits invoice lookups to authorized sale IDs and never invents a missing invoice', async () => {
    const invoices = builder([{ id: 'doc', sale_id: 'sale-a', document_number: 'FACT-A', status: 'active' }]);
    mock.from.mockImplementation((table) => table === 'payments' ? builder([{ id: 'p1', sale_id: 'sale-a', invoice_number: null }, { id: 'p2', sale_id: 'sale-b', invoice_number: null }]) : invoices);
    const rows = await listInternationalPayments(new AbortController().signal);
    expect(rows[0].invoice_number).toBe('FACT-A');
    expect(rows[1].invoice_number).toBeNull();
    expect(invoices.in).toHaveBeenCalledWith('sale_id', ['sale-a', 'sale-b']);
    expect(mock.from).not.toHaveBeenCalledWith('customers');
  });
  it('propagates a failed related query instead of silently erasing invoice context', async () => {
    mock.from.mockImplementation((table) => table === 'payments' ? builder([{ id: 'p1', sale_id: 'sale-a' }]) : builder([], { message: 'permission denied', code: '42501' }));
    await expect(listInternationalPayments(new AbortController().signal)).rejects.toMatchObject({ code: '42501' });
  });
});
