import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  changeStatus: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

vi.mock('@/services/shippingStatusService', () => ({
  shippingStatusService: { changeStatus: mocks.changeStatus },
}));

import {
  SHIPPING_STATUS_FLOW,
  changeShippingStatus,
  getNextStatuses,
} from './unifiedStatusService';

describe('changeShippingStatus — point d’entrée unifié', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { status: 'waiting_for_customs_approval' },
            error: null,
          }),
        })),
      })),
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.changeStatus.mockResolvedValue('approved_by_customs');
  });

  it('utilise exclusivement la clé de statut canonique de la base', () => {
    expect(SHIPPING_STATUS_FLOW).not.toHaveProperty('waiting_customs_approval');
    expect(getNextStatuses(
      'shipping',
      'waiting_for_customs_approval',
      'shipping_management',
    )).toEqual(['approved_by_customs']);
  });

  it('conserve la validation UX puis délègue la mutation à la RPC atomique', async () => {
    await expect(changeShippingStatus(
      'shipping-1',
      'approved_by_customs',
      'shipping_management',
    )).resolves.toEqual({ success: true });

    expect(mocks.rpc).toHaveBeenCalledWith('can_change_status', {
      p_entity_type: 'shipping',
      p_entity_id: 'shipping-1',
      p_current_status: 'waiting_for_customs_approval',
      p_new_status: 'approved_by_customs',
      p_context: 'shipping_management',
    });
    expect(mocks.changeStatus).toHaveBeenCalledWith(
      'shipping-1',
      'waiting_for_customs_approval',
      'approved_by_customs',
    );
  });
});
