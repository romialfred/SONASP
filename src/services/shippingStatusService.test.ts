import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusTransitionError } from './statusTransitionControlService';
import {
  shippingStatusService,
  ShippingStatusConflictError,
} from './shippingStatusService';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

describe('shippingStatusService.changeStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('valide puis délègue la transition et le verrou optimiste au RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        previous_status: 'waiting_for_customs_approval',
        status: 'approved_by_customs',
      },
      error: null,
    });

    await expect(shippingStatusService.changeStatus(
      'shipping-1',
      'waiting_for_customs_approval',
      'approved_by_customs',
    )).resolves.toBe('approved_by_customs');

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'snp_transition_shipping_preparation',
      {
        p_shipping_id: 'shipping-1',
        p_expected_status: 'waiting_for_customs_approval',
        p_new_status: 'approved_by_customs',
      },
    );
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('refuse un saut de statut avant tout appel réseau', async () => {
    await expect(shippingStatusService.changeStatus(
      'shipping-1',
      'waiting_for_customs_approval',
      'ready_for_expedition',
    )).rejects.toBeInstanceOf(StatusTransitionError);

    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('convertit le SQLSTATE 40001 en conflit métier', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { code: '40001', message: 'serialization failure' },
    });

    await expect(shippingStatusService.changeStatus(
      'shipping-1',
      'approved_by_customs',
      'ready_for_expedition',
    )).rejects.toBeInstanceOf(ShippingStatusConflictError);
  });

  it('convertit aussi le message serveur de conflit optimiste', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Conflit optimiste : statut courant inattendu.' },
    });

    await expect(shippingStatusService.changeStatus(
      'shipping-1',
      'approved_by_customs',
      'ready_for_expedition',
    )).rejects.toBeInstanceOf(ShippingStatusConflictError);
  });

  it('conserve l’erreur retournée par la base', async () => {
    const databaseError = { code: '42501', message: 'écriture refusée' };
    supabaseMock.rpc.mockResolvedValue({ data: null, error: databaseError });

    await expect(shippingStatusService.changeStatus(
      'shipping-1',
      'approved_by_customs',
      'ready_for_expedition',
    )).rejects.toBe(databaseError);
  });

  it('refuse une réponse RPC sans statut confirmé', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: {}, error: null });

    await expect(shippingStatusService.changeStatus(
      'shipping-1',
      'approved_by_customs',
      'ready_for_expedition',
    )).rejects.toThrow('did not confirm the new shipment status');
  });
});
