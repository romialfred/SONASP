import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

vi.mock('@/services/productionStatusService', () => ({
  productionStatusService: { updateStatus: mocks.updateStatus },
}));

import { changeProductionStatus } from './unifiedStatusService';

describe('changeProductionStatus — point d’entrée unifié', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { status: 'prepared' },
            error: null,
          }),
        })),
      })),
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.updateStatus.mockResolvedValue({ status: 'ready_for_customs' });
  });

  it('conserve la validation UX puis délègue la mutation à la RPC atomique', async () => {
    await expect(changeProductionStatus(
      'production-1',
      'ready_for_customs',
      'production_management',
      'Contrôle conforme',
    )).resolves.toEqual({ success: true });

    expect(mocks.rpc).toHaveBeenCalledWith('can_change_status', {
      p_entity_type: 'production',
      p_entity_id: 'production-1',
      p_current_status: 'prepared',
      p_new_status: 'ready_for_customs',
      p_context: 'production_management',
    });
    expect(mocks.updateStatus).toHaveBeenCalledWith(
      'production-1',
      'ready_for_customs',
      'Contrôle conforme',
      { expectedStatus: 'prepared' },
    );
  });
});
