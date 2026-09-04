import { describe, expect, it } from 'vitest';
import type { PortalConfiguration } from '@/services/accessGovernanceService';
import { portalConfigurationImpact } from './AccessPortalsPage';

const configuration = (activeGroup: boolean, activeModule: boolean): PortalConfiguration => ({
  portal: null,
  groups: [{ code: 'pilotage', name: 'Pilotage', sort_order: 1, is_active: activeGroup, is_visible: activeGroup }],
  modules: [{
    id: 'module-1', code: 'dashboard', name: 'Tableau de bord', description: null,
    route: '/dashboard', parent_id: null, group_code: 'pilotage', group_name: 'Pilotage',
    sort_order: 1, is_globally_active: true, is_portal_active: activeModule,
    is_portal_visible: activeModule, permissions: ['view'],
  }],
});

describe('portalConfigurationImpact', () => {
  it('annonce les coupures de groupes et modules avant leur enregistrement', () => {
    expect(portalConfigurationImpact(configuration(true, true), configuration(false, false))).toEqual({
      activeGroups: 0,
      activeModules: 0,
      disabledGroups: 1,
      disabledModules: 1,
    });
  });

  it('ne présente pas une activation comme une coupure', () => {
    expect(portalConfigurationImpact(configuration(false, false), configuration(true, true))).toEqual({
      activeGroups: 1,
      activeModules: 1,
      disabledGroups: 0,
      disabledModules: 0,
    });
  });
});
