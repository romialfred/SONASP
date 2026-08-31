import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

import {
  MODULE_CATALOG_UPDATED_EVENT,
  modulesService,
} from './modulesService';

describe('modulesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('charge la vue de cohérence commune aux menus et habilitations', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'navigation-reserve',
          code: 'gold_inventory',
          nom: 'Réserve d’or nationale',
          ordre: 25,
          est_actif: true,
          est_visible_menu: true,
          permissions_requises: [],
          permission_module_id: 'permission-reserve',
          access_domain: 'inventory',
          catalog_consistent: true,
        },
        {
          id: 'legacy-payments',
          code: 'payments',
          nom: 'Paiements (ancien)',
          ordre: 99,
          est_actif: true,
          est_visible_menu: true,
          permissions_requises: [],
          permission_module_id: 'permission-payments',
          access_domain: 'payments',
          catalog_consistent: true,
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ order });
    mocks.from.mockReturnValue({ select });

    const modules = await modulesService.getAll();

    expect(mocks.from).toHaveBeenCalledWith('snp_module_catalog_admin');
    expect(modules[0]).toMatchObject({
      code: 'gold_inventory',
      permission_module_id: 'permission-reserve',
      catalog_consistent: true,
    });
    expect(modules).toHaveLength(1);
  });

  it('projette l’état de visibilité utilisé par la sidebar', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        { code: 'gold_inventory', est_actif: true, est_visible_menu: true },
        { code: 'shipping', est_actif: false, est_visible_menu: true },
      ],
      error: null,
    });
    mocks.from.mockReturnValue({ select });

    await expect(modulesService.getNavigationAvailability()).resolves.toEqual({
      gold_inventory: { isActive: true, isVisibleInMenu: true },
      shipping: { isActive: false, isVisibleInMenu: true },
    });
  });

  it('modifie les deux référentiels via un RPC transactionnel et notifie le layout', async () => {
    const listener = vi.fn();
    window.addEventListener(MODULE_CATALOG_UPDATED_EVENT, listener);
    mocks.rpc.mockResolvedValue({
      data: {
        id: 'navigation-reserve',
        code: 'gold_inventory',
        nom: 'Réserve d’or nationale',
        ordre: 25,
        est_actif: false,
        est_visible_menu: true,
        permissions_requises: [],
      },
      error: null,
    });

    await modulesService.update('navigation-reserve', { est_actif: false });

    expect(mocks.rpc).toHaveBeenCalledWith('snp_update_module_catalog', expect.objectContaining({
      p_module_id: 'navigation-reserve',
      p_est_actif: false,
    }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(MODULE_CATALOG_UPDATED_EVENT, listener);
  });
});
