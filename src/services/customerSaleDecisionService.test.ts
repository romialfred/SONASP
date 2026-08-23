import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveCustomerSale,
  loadCustomerSaleForDecision,
  rejectCustomerSale,
} from './customerSaleDecisionService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

describe('customerSaleDecisionService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('charge la vue filtrée côté serveur sans requête directe sur sales', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'sale-1' }, error: null });
    const result = await loadCustomerSaleForDecision('sale-1');
    expect(result.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_vente_a_valider_client', { p_vente_id: 'sale-1' });
  });

  it('enregistre confirmation et engagement de paiement dans une seule RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: { payment_id: 'payment-1' }, error: null });
    const result = await approveCustomerSale('sale-1');
    expect(result).toMatchObject({ success: true, paymentId: 'payment-1' });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_repondre_vente_client', {
      p_vente_id: 'sale-1',
      p_decision: 'approve',
      p_motif: null,
    });
  });

  it('refuse un motif de rejet trop court sans appeler la base', async () => {
    const result = await rejectCustomerSale('sale-1', 'non');
    expect(result.success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
