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

describe('userPermissionsService.listModules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inclut les modules désactivés lorsqu’on examine les droits permanents Owner', async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
        data: [{ id: 'inactive', name: 'gold_inventory', is_active: false }], error: null,
      })),
    };
    mocks.from.mockReturnValue(query);
    const result = await userPermissionsService.listModules(true);
    expect(query.eq).not.toHaveBeenCalled();
    expect(result.modules).toEqual([expect.objectContaining({ id: 'inactive', is_active: false })]);
  });

  it('charge le domaine et l’ordre du référentiel autoritatif', async () => {
    const orderBySort = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'module-reserve',
          name: 'gold_inventory',
          display_name: 'Réserve d’or nationale',
          description: 'Position consolidée',
          category: 'mines_industrielles',
          sort_order: 25,
          access_domain: 'inventory',
        },
        {
          id: 'legacy-silver',
          name: 'silver_inventory',
          display_name: 'Silver Inventory',
          description: null,
          category: 'refinery_inventory',
          sort_order: 41,
          access_domain: 'inventory',
        },
      ],
      error: null,
    });
    const orderByCategory = vi.fn().mockReturnValue({ order: orderBySort });
    const inFilter = vi.fn().mockReturnValue({ order: orderByCategory });
    const eq = vi.fn().mockReturnValue({ in: inFilter });
    const select = vi.fn().mockReturnValue({ eq });
    mocks.from.mockReturnValue({ select });

    const result = await userPermissionsService.listModules();

    expect(mocks.from).toHaveBeenCalledWith('modules');
    expect(select).toHaveBeenCalledWith('id, name, display_name, description, category, sort_order, access_domain, is_active');
    expect(inFilter).toHaveBeenCalledWith('name', expect.arrayContaining(['gold_inventory', 'administration']));
    expect(orderByCategory).toHaveBeenCalledWith('category');
    expect(orderBySort).toHaveBeenCalledWith('sort_order');
    expect(result).toEqual({
      modules: [{
        id: 'module-reserve',
        name: 'gold_inventory',
        display_name: 'Réserve d’or nationale',
        description: 'Position consolidée',
        category: 'mines_industrielles',
        sort_order: 25,
        access_domain: 'inventory',
      }],
    });
    expect(result.modules.map((module) => module.name)).not.toContain('silver_inventory');
  });
});
