import { describe, expect, it } from 'vitest';
import { canAccessSite, hasAllPermissions, hasPermission, PERMISSIONS } from './permissions';
import type { UserProfile } from '@/types/auth';

const owner: UserProfile = {
  id: 'owner-id',
  email: 'romuald.tiegnan@gmail.com',
  full_name: 'TIEGNAN Romuald',
  phone: null,
  role: 'owner',
  site_ids: [],
  is_active: true,
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
  });

  it('ne contourne pas la désactivation du compte', () => {
    const inactiveOwner = { ...owner, is_active: false };
    expect(hasPermission(inactiveOwner, PERMISSIONS.USERS_MANAGE)).toBe(false);
  });
});
