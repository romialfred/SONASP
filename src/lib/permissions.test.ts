import { describe, expect, it } from 'vitest';
import {
  canAccessSite,
  getDefaultRoute,
  hasAdministrativePlatformAccess,
  hasAllPermissions,
  hasGlobalPlatformAccess,
  hasPermission,
  isReadOnlyManager,
  PERMISSIONS,
} from './permissions';
import type { UserProfile } from '@/types/auth';

const owner: UserProfile = {
  id: 'owner-id',
  email: 'romuald.tiegnan@gmail.com',
  full_name: 'TIEGNAN Romuald',
  phone: null,
  role: 'owner',
  mining_company_id: null,
  site_ids: [],
  is_active: true,
  is_sales_approver: false,
  two_factor_enabled: false,
  language: 'fr',
  email_notifications: true,
  batch_notifications: true,
  approval_notifications: true,
  created_at: '2026-08-17T00:00:00.000Z',
  updated_at: '2026-08-17T00:00:00.000Z',
};

describe('permissions Owner', () => {
  it('accorde toutes les permissions applicatives et tous les sites', () => {
    expect(hasAllPermissions(owner, Object.values(PERMISSIONS))).toBe(true);
    expect(hasPermission(owner, PERMISSIONS.SYSTEM_SETTINGS_MANAGE)).toBe(true);
    expect(canAccessSite(owner, 'nimporte-quel-site')).toBe(true);
    expect(hasGlobalPlatformAccess(owner)).toBe(true);
  });

  it('ne contourne pas la désactivation du compte', () => {
    const inactiveOwner = { ...owner, is_active: false };
    expect(hasPermission(inactiveOwner, PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasGlobalPlatformAccess(inactiveOwner)).toBe(false);
  });

  it('limite l’administrateur au socle sans le rendre propriétaire ni acteur métier', () => {
    const admin = { ...owner, id: 'admin-id', role: 'admin' as const };
    expect(hasAdministrativePlatformAccess(admin)).toBe(true);
    expect(hasGlobalPlatformAccess(admin)).toBe(false);
    expect(hasPermission(admin, PERMISSIONS.USERS_MANAGE)).toBe(true);
    expect(hasPermission(admin, PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
    expect(hasPermission(admin, PERMISSIONS.SALES_CREATE)).toBe(false);
    expect(hasPermission(admin, PERMISSIONS.SALES_APPROVE)).toBe(false);
  });

  it('dirige tout représentant de mine vers le portail dédié', () => {
    expect(getDefaultRoute('mine')).toBe('/portail-mine');
    expect(getDefaultRoute('customer', 'mine-123')).toBe('/portail-mine');
    expect(getDefaultRoute('management', 'mine-123')).toBe('/portail-mine');
    expect(getDefaultRoute('customer')).toBe('/dashboard/customer');
  });

  it('réserve au Manager un portail consultatif distinct', () => {
    const manager = { ...owner, id: 'manager-id', email: 'direction@sonasp.bf', role: 'manager' as const };
    expect(getDefaultRoute('manager')).toBe('/portail-direction');
    expect(isReadOnlyManager(manager)).toBe(true);
    expect(hasPermission(manager, PERMISSIONS.REPORTS_VIEW)).toBe(true);
    expect(hasPermission(manager, PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasPermission(manager, PERMISSIONS.SALES_APPROVE)).toBe(false);
    expect(hasGlobalPlatformAccess(manager)).toBe(false);
  });

  it('isole strictement les permissions de chaque domaine fonctionnel', () => {
    const factory = { ...owner, id: 'factory-id', role: 'factory' as const };

    expect(hasPermission(factory, PERMISSIONS.LICENSES_VIEW)).toBe(true);
    expect(hasPermission(factory, PERMISSIONS.REPORTS_VIEW)).toBe(true);
    expect(hasPermission(factory, PERMISSIONS.SALES_VIEW)).toBe(false);
    expect(hasPermission(factory, PERMISSIONS.CUSTOMERS_VIEW)).toBe(false);
    expect(hasPermission(factory, PERMISSIONS.SETTINGS_VIEW)).toBe(false);
    expect(hasPermission(factory, PERMISSIONS.AUDIT_VIEW)).toBe(false);
  });

  it('n’utilise aucune valeur de permission ambiguë ou dupliquée', () => {
    const values = Object.values(PERMISSIONS);
    expect(new Set(values).size).toBe(values.length);
  });
});
