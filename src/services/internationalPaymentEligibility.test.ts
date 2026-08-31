import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mock.from } }));
import { getSalesAwaitingPayment } from './paymentService';

describe('Eligible international payments', () => {
  const sale = { id: 'sale-a', currency: 'USD', final_proceeds: 1000, status: 'virtual_payment', shipping_preparation_id: 'shipment-a', customers: { name: 'Client autorisé', country: 'Suisse' } };
  const builders = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  let ledger: unknown[];
  let ledgerError: unknown;
  let shipmentError: unknown;
  beforeEach(() => {
    vi.clearAllMocks(); builders.clear(); ledgerError = null; shipmentError = null;
    ledger = [
      { id: 'confirmed', sale_id: 'sale-a', amount: 400, currency: 'USD', status: 'approved', is_virtual: false },
      { id: 'processing', sale_id: 'sale-a', amount: 100, currency: 'USD', status: 'processing', is_virtual: false },
      { id: 'commitment', sale_id: 'sale-a', amount: 500, currency: 'USD', status: 'pending', is_virtual: true, version: 3 },
    ];
    mock.from.mockImplementation((table: string) => {
      const builder = { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn((from: number, to: number) => Promise.resolve(table === 'sales' ? { data: [sale].slice(from, to + 1), error: null } : table === 'shipping_preparations' ? { data: [{ id: 'shipment-a', shipped_at: '2026-08-27' }].slice(from, to + 1), error: shipmentError } : { data: ledger.slice(from, to + 1), error: ledgerError })) };
      builders.set(table, builder); return builder;
    });
  });
  it('includes second installments, scopes the selected sale and subtracts reserved funds', async () => {
    const result = await getSalesAwaitingPayment('sale-a');
    expect(builders.get('sales')?.in).toHaveBeenCalledWith('status', ['waiting_for_payment', 'virtual_payment']);
    expect(builders.get('sales')?.eq).toHaveBeenCalledWith('seller_type', 'sonasp');
    expect(builders.get('sales')?.eq).toHaveBeenCalledWith('id', 'sale-a');
    expect(builders.get('payments')?.in).toHaveBeenCalledWith('sale_id', ['sale-a']);
    expect(result.data?.[0]).toMatchObject({ confirmed_amount: 400, processing_amount: 100, remaining_amount: 500, payment_id: 'commitment', payment_version: 3 });
  });
  it('paginates every installment instead of relying on an embedded capped ledger', async () => {
    ledger = Array.from({ length: 600 }, (_, i) => ({ id: String(i), sale_id: 'sale-a', amount: 1, currency: 'USD', status: 'approved', is_virtual: false }));
    const result = await getSalesAwaitingPayment();
    expect(result.data?.[0].remaining_amount).toBe(400);
    expect(builders.get('payments')?.range).toHaveBeenCalledWith(500, 999);
  });
  it('fails closed on a ledger error', async () => {
    ledgerError = { message: 'permission denied' };
    expect(await getSalesAwaitingPayment()).toEqual({ success: false, error: 'permission denied' });
  });
  it('excludes fully covered sales', async () => {
    ledger = [{ sale_id: 'sale-a', amount: 1000, currency: 'USD', status: 'processing', is_virtual: false }];
    expect((await getSalesAwaitingPayment()).data).toEqual([]);
  });
  it('reads shipping context only for already-authorized sales', async () => {
    const result = await getSalesAwaitingPayment('sale-a');
    expect(builders.get('shipping_preparations')?.in).toHaveBeenCalledWith('id', ['shipment-a']);
    expect(result.data?.[0]).toMatchObject({ customer_country: 'Suisse', shipment_date: '2026-08-27', shipment_context_unavailable: false });
  });
  it('does not block a permitted payment because optional shipping context is inaccessible', async () => {
    shipmentError = { message: 'permission denied' };
    const result = await getSalesAwaitingPayment('sale-a');
    expect(result.success).toBe(true);
    expect(result.data?.[0]).toMatchObject({ shipment_context_unavailable: true, shipment_date: null, remaining_amount: 500 });
  });
});
