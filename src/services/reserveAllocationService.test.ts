import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reserveAllocationService } from './reserveAllocationService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    storage: { from: vi.fn() },
  },
}));

vi.mock('@/services/sensitiveUploadGateway', () => ({
  deleteSensitiveResource: vi.fn(),
  uploadSensitiveFile: vi.fn(),
}));

describe('reserveAllocationService.transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('utilise la transition générique pour les étapes qui précèdent l’activation', async () => {
    mocks.rpc.mockResolvedValue({ data: 'RECONCILED', error: null });

    await reserveAllocationService.transition('allocation-1', 'RECONCILED', 'Contrôle terminé');

    expect(mocks.rpc).toHaveBeenCalledWith('snp_transition_reserve_allocation', {
      p_allocation_id: 'allocation-1',
      p_target_status: 'RECONCILED',
      p_comment: 'Contrôle terminé',
    });
  });

  it('active exclusivement via la RPC dédiée avec une clé idempotente persistée', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: { code: '57014', message: 'réponse interrompue' } })
      .mockResolvedValueOnce({ data: 'ACTIVE', error: null });

    await expect(reserveAllocationService.transition('allocation-2', 'ACTIVE'))
      .rejects.toMatchObject({ code: '57014' });
    const firstKey = mocks.rpc.mock.calls[0][1].p_request_key;

    await expect(reserveAllocationService.transition('allocation-2', 'ACTIVE'))
      .resolves.toBeUndefined();
    const secondKey = mocks.rpc.mock.calls[1][1].p_request_key;

    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondKey).toBe(firstKey);
    expect(mocks.rpc).toHaveBeenLastCalledWith('snp_activate_reserve_allocation', {
      p_allocation_id: 'allocation-2',
      p_request_key: firstKey,
      p_comment: null,
    });
    expect(sessionStorage.getItem('sonasp:reserve-activation:allocation-2')).toBeNull();
  });
});
