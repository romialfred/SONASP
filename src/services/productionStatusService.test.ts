import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ProductionStatusConflictError,
  productionStatusService,
} from './productionStatusService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: mocks }));

const successResult = {
  production_id: 'production-1',
  previous_status: 'prepared' as const,
  status: 'ready_for_customs' as const,
  request_id: '10000000-0000-4000-8000-000000000001',
  audit_id: 42,
  idempotent_replay: false,
};

describe('productionStatusService.updateStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('délègue statut, audit et idempotence à la RPC sans UPDATE PostgREST', async () => {
    mocks.rpc.mockResolvedValue({ data: successResult, error: null });

    await expect(productionStatusService.updateStatus(
      'production-1',
      'ready_for_customs',
      '  Contrôle de teneur conforme  ',
      {
        expectedStatus: 'prepared',
        requestId: '10000000-0000-4000-8000-000000000001',
      },
    )).resolves.toEqual(successResult);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_transition_daily_production', {
      p_production_id: 'production-1',
      p_expected_status: 'prepared',
      p_new_status: 'ready_for_customs',
      p_request_id: '10000000-0000-4000-8000-000000000001',
      p_notes: 'Contrôle de teneur conforme',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('accepte le rejeu idempotent confirmé par le serveur', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...successResult, idempotent_replay: true },
      error: null,
    });

    await expect(productionStatusService.updateStatus(
      'production-1',
      'ready_for_customs',
      undefined,
      {
        expectedStatus: 'prepared',
        requestId: '10000000-0000-4000-8000-000000000001',
      },
    )).resolves.toMatchObject({ status: 'ready_for_customs', idempotent_replay: true });
  });

  it('refuse un saut de statut avant tout appel réseau', async () => {
    await expect(productionStatusService.updateStatus(
      'production-1',
      'ready_for_customs',
      undefined,
      { expectedStatus: 'cancelled' },
    )).rejects.toThrow('Transition de statut non autorisée');

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('convertit SQLSTATE 40001 en conflit métier', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '40001', message: 'Conflit optimiste' },
    });

    await expect(productionStatusService.updateStatus(
      'production-1',
      'ready_for_customs',
      undefined,
      { expectedStatus: 'prepared', requestId: 'request-conflict' },
    )).rejects.toBeInstanceOf(ProductionStatusConflictError);
  });

  it('propage un refus capability/AAL2 sans fallback DML', async () => {
    const refusal = { code: '42501', message: 'Capability et AAL2 requis' };
    mocks.rpc.mockResolvedValue({ data: null, error: refusal });

    await expect(productionStatusService.updateStatus(
      'production-1',
      'ready_for_customs',
      undefined,
      { expectedStatus: 'prepared', requestId: 'request-denied' },
    )).rejects.toBe(refusal);

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('refuse une réponse RPC qui ne confirme pas le statut cible', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...successResult, status: 'prepared' }, error: null });

    await expect(productionStatusService.updateStatus(
      'production-1',
      'ready_for_customs',
      undefined,
      { expectedStatus: 'prepared', requestId: 'request-invalid-result' },
    )).rejects.toThrow('n’a pas confirmé');
  });
});
