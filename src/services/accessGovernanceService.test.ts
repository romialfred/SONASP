import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: rpcMock } }));

import { accessGovernanceService } from './accessGovernanceService';

describe('accessGovernanceService', () => {
  beforeEach(() => rpcMock.mockReset());

  it('borne la pagination de la recherche de ressources', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await accessGovernanceService.searchResources('mine', 'essa', 0, 500);
    expect(rpcMock).toHaveBeenCalledWith('snp_access_resources_search', {
      p_category_code: 'mine',
      p_query: 'essa',
      p_offset: 0,
      p_limit: 50,
    });
  });

  it('transmet une matrice de rôle sans accorder de permission implicite', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'role-1' }, error: null });
    await accessGovernanceService.saveRole({
      portalId: 'portal-1',
      code: 'dgi-royalties',
      name: 'DGI – Royalties',
      legacyRole: 'dgi',
      isActive: true,
      categoryCodes: ['administration'],
      permissions: [{ module_id: 'module-1', permission_code: 'view', allowed: false }],
      reason: 'Configuration initiale du rôle DGI',
    });
    expect(rpcMock).toHaveBeenCalledWith('snp_access_role_save', expect.objectContaining({
      p_legacy_role: 'dgi',
      p_permissions: [{ module_id: 'module-1', permission_code: 'view', allowed: false }],
    }));
  });

  it('remonte un message serveur explicite', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Création réservée au Super Administrateur.' } });
    await expect(accessGovernanceService.savePortal({
      code: 'dgi',
      name: 'DGI',
      isActive: true,
      groups: [],
      modules: [],
      reason: 'Tentative de création du portail DGI',
    })).rejects.toThrow('Création réservée au Super Administrateur.');
  });
});
