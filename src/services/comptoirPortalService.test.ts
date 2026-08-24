import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  result: { data: [] as any[] | null, error: null as any },
  rpc: vi.fn(),
}));

function queryBuilder() {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    then: (resolve: (value: typeof database.result) => unknown) =>
      Promise.resolve(database.result).then(resolve),
  };
  return query;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => queryBuilder()),
    rpc: database.rpc,
  },
}));

import { comptoirPortalService } from './comptoirPortalService';

describe('comptoirPortalService', () => {
  beforeEach(() => {
    database.result = { data: [], error: null };
    database.rpc.mockReset();
  });

  it('remonte une indisponibilité de la base au lieu de présenter un faux stock nul', async () => {
    database.result = { data: null, error: new Error('relation unavailable') };

    await expect(comptoirPortalService.getStock('org-comptoir')).rejects.toThrow('relation unavailable');
  });

  it('convertit le journal append-only en mouvements de stock', async () => {
    database.result = {
      error: null,
      data: [{
        id: 'movement-1',
        created_at: '2026-08-24T10:00:00Z',
        direction: 'in',
        quantity_grams: '125.500',
        movement_type: 'purchase',
        business_reference: 'ACH-001',
      }],
    };

    await expect(comptoirPortalService.getStock('org-comptoir')).resolves.toEqual([{
      id: 'movement-1',
      date: '2026-08-24T10:00:00Z',
      direction: 'in',
      quantityGrams: 125.5,
      type: 'purchase',
      reference: 'ACH-001',
    }]);
  });

  it('soumet exclusivement la RPC de cession SONASP', async () => {
    database.rpc.mockResolvedValue({ data: 'sale-1', error: null });

    await expect(comptoirPortalService.submitSaleToSonasp({
      quantityGrams: 100,
      unitPriceFcfa: 45_000,
      notes: '  Lot certifié  ',
    })).resolves.toBe('sale-1');

    expect(database.rpc).toHaveBeenCalledWith('snp_submit_comptoir_sale_to_sonasp', {
      p_quantity_grams: 100,
      p_unit_price_fcfa: 45_000,
      p_notes: 'Lot certifié',
    });
  });
});
