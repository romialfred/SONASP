import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  convertVirtualToActual,
  reconcileInternationalPayment,
} from './virtualPaymentService';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

const result = {
  payment_id: '10000000-0000-4000-8000-000000000001',
  sale_id: '20000000-0000-4000-8000-000000000001',
  payment_status: 'processing',
  sale_status: 'virtual_payment',
  version: 2,
  idempotency_key: '30000000-0000-4000-8000-000000000001',
  replayed: false,
  processed_at: '2026-08-25T00:00:00Z',
};

describe('virtualPaymentService — compatibilité RPC 4H', () => {
  beforeEach(() => vi.clearAllMocks());

  it('remplace l’ancienne conversion + UPDATE vente par une seule RPC atomique', async () => {
    mocks.rpc.mockResolvedValue({ data: result, error: null });

    await expect(convertVirtualToActual({
      saleId: result.sale_id,
      expectedSaleStatus: 'waiting_for_payment',
      expectedPaymentVersion: 1,
      paidAmount: 100,
      paymentCurrency: 'USD',
      customerBankId: '40000000-0000-4000-8000-000000000001',
      sellerBankId: '50000000-0000-4000-8000-000000000001',
      paymentDate: '2026-08-25',
      referenceNumber: 'BANK-001',
      idempotencyKey: result.idempotency_key,
    })).resolves.toMatchObject({ success: true, data: result });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe('snp_paiement_international_executer');
    expect(mocks.rpc.mock.calls[0][0]).not.toBe('convert_virtual_to_actual_payment');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('remplace Quick Approve par la décision 4H avec version et idempotence', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ...result,
        payment_status: 'rejected',
        sale_status: 'waiting_for_payment',
        version: 3,
        decision: 'reject',
        idempotency_key: '60000000-0000-4000-8000-000000000001',
      },
      error: null,
    });

    await expect(reconcileInternationalPayment({
      paymentId: result.payment_id,
      expectedVersion: 2,
      decision: 'reject',
      reason: 'Coordonnées bancaires non conformes',
      idempotencyKey: '60000000-0000-4000-8000-000000000001',
    })).resolves.toMatchObject({ success: true });

    expect(mocks.rpc).toHaveBeenCalledWith('snp_paiement_international_decider', {
      p_payment_id: result.payment_id,
      p_expected_status: 'processing',
      p_expected_version: 2,
      p_decision: 'reject',
      p_reason: 'Coordonnées bancaires non conformes',
      p_idempotency_key: '60000000-0000-4000-8000-000000000001',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('reste fermé sur une erreur capability/AAL2/SoD', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Double contrôle requis' } });
    await expect(reconcileInternationalPayment({
      paymentId: result.payment_id,
      expectedVersion: 2,
      decision: 'approve',
      idempotencyKey: '70000000-0000-4000-8000-000000000001',
    })).resolves.toEqual({ success: false, error: 'Double contrôle requis' });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
