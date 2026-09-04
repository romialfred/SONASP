import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/types/auth';
import {
  NAVIGATION_SECTIONS,
  getNavigationSectionsForUser,
} from '@/components/layout/sidebarNavigation';
import {
  ACCESS_GOVERNANCE_SUBMODULE_CATALOG,
  ADMINISTRATION_SUBMODULE_CATALOG,
  PLATFORM_MODULE_BY_CODE,
  PLATFORM_MODULE_CATALOG,
  platformModuleCodeForPath,
  type ModuleAvailabilityMap,
} from './platformModuleCatalog';

const owner: UserProfile = {
  id: 'owner-catalogue',
  email: 'owner@example.bf',
  full_name: 'Owner SONASP',
  phone: null,
  role: 'owner',
  mining_company_id: null,
  site_ids: [],
  is_active: true,
  is_sales_approver: false,
  two_factor_enabled: true,
  language: 'fr',
  email_notifications: true,
  batch_notifications: true,
  approval_notifications: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const administrator: UserProfile = {
  ...owner,
  id: 'admin-catalogue',
  role: 'admin',
  capabilities: ['accounts.manage', 'referentials.manage', 'audit.read'],
  module_codes: ['administration', 'gold_inventory'],
};

describe('catalogue fonctionnel des modules', () => {
  it('rattache chaque groupe visuel à un module canonique sans dupliquer les permissions', () => {
    const groupes = NAVIGATION_SECTIONS.flatMap((section) => section.groups);

    expect(groupes).not.toHaveLength(0);
    groupes.forEach((groupe) => {
      expect(groupe.moduleCode, groupe.id).toBeTruthy();
      const module = PLATFORM_MODULE_BY_CODE.get(groupe.moduleCode!);
      expect(module, groupe.id).toBeDefined();
      expect(module?.accessDomain).not.toBe('unknown');
      expect(platformModuleCodeForPath(groupe.path)).toBe(groupe.moduleCode);
    });

    // Un même module peut être présenté en plusieurs groupes métier (production,
    // puis prévisions/licences), mais garde une seule racine de catalogue.
    PLATFORM_MODULE_CATALOG.forEach((module) => {
      const canonical = groupes.find((groupe) => groupe.id === module.navigationGroupId);
      if (!canonical) return;
      expect(canonical.moduleCode).toBe(module.code);
      expect(canonical.path).toBe(module.route);
    });
  });

  it('interdit les codes ou rattachements de navigation en doublon', () => {
    const codes = PLATFORM_MODULE_CATALOG.map((module) => module.code);
    const groupes = PLATFORM_MODULE_CATALOG.map((module) => module.navigationGroupId);

    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(groupes).size).toBe(groupes.length);
  });

  it('sépare la gouvernance des accès de l’administration technique', () => {
    const administration = NAVIGATION_SECTIONS
      .flatMap((section) => section.groups)
      .find((group) => group.id === 'administration');

    expect(administration?.children?.map((item) => ({
      code: item.catalogCode,
      label: item.label,
      route: item.path,
    }))).toEqual(ADMINISTRATION_SUBMODULE_CATALOG.map((module) => ({
      code: module.code,
      label: module.label,
      route: module.route,
    })));
    expect(new Set(ADMINISTRATION_SUBMODULE_CATALOG.map(({ route }) => route)).size)
      .toBe(ADMINISTRATION_SUBMODULE_CATALOG.length);
    const governance = NAVIGATION_SECTIONS.flatMap((section) => section.groups)
      .find((group) => group.id === 'access-governance');
    expect(governance?.children?.map((item) => ({ code: item.catalogCode, label: item.label, route: item.path })))
      .toEqual(ACCESS_GOVERNANCE_SUBMODULE_CATALOG.map((module) => ({ code: module.code, label: module.label, route: module.route })));
  });

  it('masque un sous-module Administration pour les autres rôles, mais jamais pour le Owner', () => {
    const availability: ModuleAvailabilityMap = Object.fromEntries([
      ...PLATFORM_MODULE_CATALOG.map((module) => [
        module.code,
        { isActive: true, isVisibleInMenu: true },
      ] as const),
      ...ADMINISTRATION_SUBMODULE_CATALOG.map((module) => [
        module.code,
        { isActive: true, isVisibleInMenu: true },
      ] as const),
      ...ACCESS_GOVERNANCE_SUBMODULE_CATALOG.map((module) => [
        module.code,
        { isActive: true, isVisibleInMenu: module.code !== 'admin-audit' },
      ] as const),
    ]);
    const administration = getNavigationSectionsForUser(administrator, availability)
      .flatMap((section) => section.groups)
      .find((group) => group.id === 'access-governance');

    expect(administration).toBeDefined();
    expect(administration?.children?.map(({ catalogCode }) => catalogCode)).not.toContain('admin-audit');
    expect(administration?.children?.map(({ catalogCode }) => catalogCode)).toContain('admin-roles');
    const ownerAdministration = getNavigationSectionsForUser(owner, availability)
      .flatMap((section) => section.groups).find((group) => group.id === 'access-governance');
    expect(ownerAdministration?.children?.map(({ catalogCode }) => catalogCode)).toContain('admin-audit');
  });

  it('expose séparément les stocks et la Réserve nationale au Owner actif', () => {
    const availability: ModuleAvailabilityMap = Object.fromEntries(PLATFORM_MODULE_CATALOG.map((module) => [
      module.code,
      { isActive: true, isVisibleInMenu: true },
    ]));

    const groupes = getNavigationSectionsForUser(owner, availability)
      .flatMap((section) => section.groups);

    expect(groupes).toContainEqual(expect.objectContaining({
      id: 'inventory',
      moduleCode: 'gold_inventory',
      label: 'Suivi du stock d’or',
      path: '/inventory',
    }));
    expect(groupes).toContainEqual(expect.objectContaining({
      id: 'national-reserve',
      moduleCode: 'national_reserve',
      label: 'Réserve nationale d’or',
      path: '/national-reserve',
    }));
  });

  it('ne masque pas les contrats et paiements d’un module attribué à Admin à cause d’un domaine secondaire', () => {
    const user = { ...administrator, module_codes: ['gold_purchases', 'sales'], module_domains: ['purchases', 'sales'] };
    const paths = getNavigationSectionsForUser(user).flatMap(({ groups }) => groups.flatMap(group => [
      group.path, ...(group.children || []).map(child => child.path),
    ]));
    expect(paths).toContain('/contrats');
    expect(paths).toContain('/payments');
    expect(paths).not.toContain('/refining');
  });

  it('retire un module masqué pour les autres rôles et conserve l’accès Owner', () => {
    const availability: ModuleAvailabilityMap = Object.fromEntries(PLATFORM_MODULE_CATALOG.map((module) => [
      module.code,
      { isActive: true, isVisibleInMenu: true },
    ]));
    availability.gold_inventory = { isActive: true, isVisibleInMenu: false };

    const groupes = getNavigationSectionsForUser(administrator, availability)
      .flatMap((section) => section.groups);

    expect(groupes.map((groupe) => groupe.id)).not.toContain('inventory');
    expect(getNavigationSectionsForUser(owner, availability).flatMap((section) => section.groups)
      .map((group) => group.id)).toContain('inventory');
  });

  it('rattache chaque famille de routes au bon module canonique', () => {
    expect(platformModuleCodeForPath('/artisan-minier/ventes-or/nouvelle')).toBe('artisan_gold_market');
    expect(platformModuleCodeForPath('/artisan-minier/liste')).toBe('artisan-minier');
    expect(platformModuleCodeForPath('/national-reserve/allocations/new')).toBe('national_reserve');
    expect(platformModuleCodeForPath('/admin/permissions')).toBe('administration');
    expect(platformModuleCodeForPath('/analytics/production')).toBe('production_analytics');
    expect(platformModuleCodeForPath('/profile')).toBeNull();
  });
});
