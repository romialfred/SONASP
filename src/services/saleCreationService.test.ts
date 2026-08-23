import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createExportSale } from './saleCreationService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

describe('saleCreationService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confie la vente et ses lots à une transaction serveur unique', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: 'sale-1',
        sale_number: 'SL-2026-000001',
        status: 'pending_management_approval',
        approval_request_id: 'request-1',
      },
      error: null,
    });

    const result = await createExportSale({
      customerId: 'customer-1',
      sellerId: 'sonasp-1',
      quantityOz: 12.5,
      londonAmRate: 2500,
      freightCost: 100,
      otherCosts: 50,
      mechanismType: 'spot',
      inProcessRefineryId: undefined,
      lots: [
        {
          source_type: 'achat_mine',
          source_id: 'lot-1',
          reference: 'ACH-001',
          origine: 'Mine test',
          quantite_oz: 12.5,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_creer_vente_export', {
      p_customer_id: 'customer-1',
      p_seller_id: 'sonasp-1',
      p_quantity_oz: 12.5,
      p_london_am_rate: 2500,
      p_freight_cost: 100,
      p_other_costs: 50,
      p_mechanism_type: 'spot',
      p_in_process_refinery_id: null,
      p_lots: [{ source_type: 'achat_mine', source_id: 'lot-1', quantite_oz: 12.5 }],
    });
  });

  it('rend le refus serveur sans tenter une écriture de repli', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Un lot ne dispose plus de la quantité demandée." },
    });

    const result = await createExportSale({
      customerId: 'customer-1',
      sellerId: 'sonasp-1',
      quantityOz: 1,
      londonAmRate: 2500,
      freightCost: 0,
      otherCosts: 0,
      lots: [],
    });

    expect(result).toEqual({
      success: false,
      error: "Un lot ne dispose plus de la quantité demandée.",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('transmet la raffinerie obligatoire pour une vente en cours de traitement', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: 'sale-2',
        sale_number: 'SL-2026-000002',
        status: 'pending_management_approval',
        approval_request_id: 'request-2',
      },
      error: null,
    });

    await createExportSale({
      customerId: 'customer-2',
      sellerId: 'sonasp-1',
      quantityOz: 8,
      londonAmRate: 2480,
      freightCost: 40,
      otherCosts: 0,
      mechanismType: 'in_process',
      inProcessRefineryId: 'refinery-1',
      lots: [{
        source_type: 'achat_artisan',
        source_id: 'lot-2',
        reference: 'ART-002',
        origine: 'Comptoir agréé',
        quantite_oz: 8,
      }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      'snp_creer_vente_export',
      expect.objectContaining({
        p_mechanism_type: 'in_process',
        p_in_process_refinery_id: 'refinery-1',
      })
    );
  });
});
