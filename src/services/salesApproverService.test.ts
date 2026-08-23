import { beforeEach, describe, expect, it, vi } from 'vitest';
import { salesApproverService } from './salesApproverService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

describe('salesApproverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it('passe par le RPC sécurisé pour désigner un approbateur', async () => {
    await salesApproverService.setApprover('user-2', true);

    expect(mocks.rpc).toHaveBeenCalledWith('snp_definir_approbateur_ventes', {
      p_user_id: 'user-2',
      p_active: true,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('propage une erreur serveur sans écrire directement dans le profil', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Auto-administration interdite' } });

    await expect(salesApproverService.setApprover('self', true)).rejects.toMatchObject({
      message: 'Auto-administration interdite',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
