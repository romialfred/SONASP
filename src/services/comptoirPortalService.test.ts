import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

import {
  ComptoirSaleTransitionConflictError,
  ComptoirStockConflictError,
  comptoirPortalService,
  computeComptoirStockSummary,
} from './comptoirPortalService';

function queryResult(data: any[] = [], error: any = null) {
  const result = Promise.resolve({ data, error });
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => result),
    then: result.then.bind(result),
  };
  return query;
}

describe('comptoirPortalService — cessions Comptoir → SONASP', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.rpc.mockReset();
  });

  it('remonte une indisponibilité de la base au lieu de présenter un faux stock nul', async () => {
    mocks.from.mockReturnValueOnce(queryResult([], new Error('relation unavailable')));

    await expect(comptoirPortalService.getStock('org-comptoir')).rejects.toThrow('relation unavailable');
  });

  it('convertit le journal append-only en mouvements de stock', async () => {
    mocks.from.mockReturnValueOnce(queryResult([{
      id: 'movement-1', created_at: '2026-08-24T10:00:00Z', direction: 'in',
      quantity_grams: '125.500', movement_type: 'purchase', business_reference: 'ACH-001',
    }]));

    await expect(comptoirPortalService.getStock('org-comptoir')).resolves.toEqual([{
      id: 'movement-1', date: '2026-08-24T10:00:00Z', direction: 'in',
      quantityGrams: 125.5, type: 'purchase', reference: 'ACH-001',
    }]);
  });

  it('calcule le stock physique, réservé et libre sans réserver les décisions terminées', () => {
    expect(computeComptoirStockSummary(
      [
        { id: 'in', date: '', direction: 'in', quantityGrams: 120, type: 'purchase', reference: 'A' },
        { id: 'out', date: '', direction: 'out', quantityGrams: 20, type: 'sale', reference: 'B' },
      ],
      [
        { id: '1', reference: 'S1', date: '', quantityGrams: 30, unitPriceFcfa: 1, totalFcfa: 30, status: 'submitted' },
        { id: '2', reference: 'S2', date: '', quantityGrams: 10, unitPriceFcfa: 1, totalFcfa: 10, status: 'rejected' },
      ],
    )).toEqual({ physicalGrams: 100, reservedGrams: 30, availableGrams: 70 });
  });

  it('soumet par le RPC existant et convertit une course sur le stock', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'Stock disponible insuffisant : 0 g libres.' } });

    await expect(comptoirPortalService.submitSaleToSonasp({ quantityGrams: 15, unitPriceFcfa: 42 }))
      .rejects.toBeInstanceOf(ComptoirStockConflictError);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_submit_comptoir_sale_to_sonasp', {
      p_quantity_grams: 15,
      p_unit_price_fcfa: 42,
      p_notes: null,
    });
  });

  it('soumet exclusivement le RPC de cession avec la note normalisée', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 'sale-1', error: null });

    await expect(comptoirPortalService.submitSaleToSonasp({
      quantityGrams: 100,
      unitPriceFcfa: 45_000,
      notes: '  Lot certifié  ',
    })).resolves.toBe('sale-1');

    expect(mocks.rpc).toHaveBeenCalledWith('snp_submit_comptoir_sale_to_sonasp', {
      p_quantity_grams: 100,
      p_unit_price_fcfa: 45_000,
      p_notes: 'Lot certifié',
    });
  });

  it('transite uniquement par le RPC avec le commentaire normalisé', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await comptoirPortalService.transitionSaleToSonasp('sale-1', 'accepted', '  contrôle conforme  ');

    expect(mocks.rpc).toHaveBeenCalledWith('snp_transition_comptoir_sale_to_sonasp', {
      p_sale_id: 'sale-1',
      p_target_status: 'accepted',
      p_notes: 'contrôle conforme',
    });
  });

  it('rend explicite une concurrence signalée par le RPC de transition', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Seule une cession soumise peut être acceptée ou rejetée.' } });

    await expect(comptoirPortalService.transitionSaleToSonasp('sale-1', 'rejected'))
      .rejects.toBeInstanceOf(ComptoirSaleTransitionConflictError);
  });

  it('charge la file inter-comptoirs et son historique de workflow', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult([{
        id: 'sale-1', comptoir_organization_id: 'org-1', reference_vente: 'CESS-1',
        date_vente: '2026-08-24', quantity_grams: 12.5, unit_price_fcfa: 40000,
        total_fcfa: 500000, status: 'submitted', created_at: '2026-08-24T10:00:00Z',
        comptoir: { code: 'CPT-1', name: 'Comptoir Central' },
      }]))
      .mockReturnValueOnce(queryResult([{
        id: 1, aggregate_id: 'sale-1', action: 'submitted', status_before: null,
        status_after: 'submitted', actor_role: 'customer', capability_code: 'comptoir.manage',
        reason: 'offre initiale', occurred_at: '2026-08-24T10:00:00Z',
      }]));

    const sales = await comptoirPortalService.getSonaspSalesInbox();
    const events = await comptoirPortalService.getSonaspSaleHistory(['sale-1']);

    expect(sales[0]).toMatchObject({ id: 'sale-1', comptoirName: 'Comptoir Central', quantityGrams: 12.5 });
    expect(events[0]).toMatchObject({ saleId: 'sale-1', statusAfter: 'submitted', reason: 'offre initiale' });
    expect(mocks.from).toHaveBeenNthCalledWith(1, 'snp_comptoir_ventes_sonasp');
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'snp_workflow_audit');
  });
});
