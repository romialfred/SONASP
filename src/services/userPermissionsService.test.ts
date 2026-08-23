import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_PERMISSION, userPermissionsService } from './userPermissionsService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

describe('userPermissionsService.save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it('remplace les habilitations dans une transaction serveur', async () => {
    const permission = {
      ...EMPTY_PERMISSION('module-1'),
      can_view: true,
      can_edit: true,
    };

    const result = await userPermissionsService.save('user-2', {}, { 'module-1': permission }, 'admin-1');

    expect(result).toEqual({ success: true });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_remplacer_habilitations_compte', {
      p_user_id: 'user-2',
      p_habilitations: [{
        module_id: 'module-1',
        can_view: true,
        can_create: false,
        can_edit: true,
        can_delete: false,
        can_approve: false,
        field_permissions: {},
      }],
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('retourne une erreur sans effectuer une écriture partielle', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Niveau de rôle insuffisant' } });

    const result = await userPermissionsService.save('owner-1', {}, {}, 'admin-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Niveau de rôle insuffisant');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
