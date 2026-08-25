import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dailyProductionService } from './dailyProductionService';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: mocks }));

describe('dailyProductionService.updateProduction', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['status', 'created_by', 'created_at', 'updated_at', 'id'] as const)(
    'refuse le champ serveur %s avant tout appel PostgREST',
    async (field) => {
      const updates = {
        [field]: field === 'status' ? 'ready_for_customs' : 'forged',
      } as Parameters<typeof dailyProductionService.updateProduction>[1];
      await expect(dailyProductionService.updateProduction(
        'production-1',
        updates,
      )).rejects.toThrow('contrôlé par le serveur');

      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it('délègue aussi l’ancien point d’entrée de statut à la RPC atomique', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        production_id: 'production-1',
        previous_status: 'prepared',
        status: 'ready_for_customs',
        request_id: 'request-legacy-entrypoint',
        audit_id: 9,
        idempotent_replay: false,
      },
      error: null,
    });

    await dailyProductionService.updateProductionStatus(
      'production-1',
      'ready_for_customs',
      'Contrôle conforme',
      { expectedStatus: 'prepared', requestId: 'request-legacy-entrypoint' },
    );

    expect(mocks.rpc).toHaveBeenCalledWith('snp_transition_daily_production', {
      p_production_id: 'production-1',
      p_expected_status: 'prepared',
      p_new_status: 'ready_for_customs',
      p_request_id: 'request-legacy-entrypoint',
      p_notes: 'Contrôle conforme',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
