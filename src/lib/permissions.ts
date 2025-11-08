import { UserRole, UserProfile } from '@/types/auth';

export const PERMISSIONS = {
  BATCHES_VIEW: 'view',
  BATCHES_CREATE: 'create',
  BATCHES_UPDATE: 'update',
  BATCHES_DELETE: 'delete',
  SALES_VIEW: 'view',
  SALES_CREATE: 'create',
  SALES_APPROVE: 'approve',
  CUSTOMERS_VIEW: 'view',
  CUSTOMERS_CREATE: 'create',
  CUSTOMERS_EDIT: 'edit',
  CUSTOMERS_MANAGE: 'manage',
  LICENSES_VIEW: 'view',
  LICENSES_CREATE: 'create',
  LICENSES_REQUEST: 'request',
  LICENSES_APPROVE: 'approve',
  USERS_VIEW: 'view',
  USERS_MANAGE: 'manage',
  REPORTS_VIEW: 'view',
  REPORTS_GENERATE: 'generate',
  SETTINGS_VIEW: 'view',
  SETTINGS_MANAGE: 'manage',
  AUDIT_VIEW: 'view',
} as const;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  factory: [
    PERMISSIONS.BATCHES_VIEW,
    PERMISSIONS.BATCHES_CREATE,
    PERMISSIONS.BATCHES_UPDATE,
    PERMISSIONS.LICENSES_VIEW,
    PERMISSIONS.LICENSES_REQUEST,
    PERMISSIONS.REPORTS_VIEW,
  ],
  airport: [
    PERMISSIONS.BATCHES_VIEW,
    PERMISSIONS.BATCHES_UPDATE,
    PERMISSIONS.REPORTS_VIEW,
  ],
  refinery: [
    PERMISSIONS.BATCHES_VIEW,
    PERMISSIONS.BATCHES_UPDATE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  customer: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  management: [
    PERMISSIONS.BATCHES_VIEW,
    PERMISSIONS.BATCHES_CREATE,
    PERMISSIONS.BATCHES_UPDATE,
    PERMISSIONS.BATCHES_DELETE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_APPROVE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_EDIT,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.LICENSES_VIEW,
    PERMISSIONS.LICENSES_CREATE,
    PERMISSIONS.LICENSES_REQUEST,
    PERMISSIONS.LICENSES_APPROVE,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  ],
};

export function hasPermission(user: UserProfile | null, permission: string): boolean {
  if (!user || !user.is_active) return false;

  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return rolePermissions.includes(permission);
}

export function hasAnyPermission(user: UserProfile | null, permissions: string[]): boolean {
  if (!user || !user.is_active) return false;

  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.some(permission => rolePermissions.includes(permission));
}

export function hasAllPermissions(user: UserProfile | null, permissions: string[]): boolean {
  if (!user || !user.is_active) return false;

  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.every(permission => rolePermissions.includes(permission));
}

export function isManagement(user: UserProfile | null): boolean {
  return user?.role === 'management' && user.is_active;
}

export function canAccessSite(user: UserProfile | null, siteId: string): boolean {
  if (!user || !user.is_active) return false;

  if (user.role === 'management') return true;

  return user.site_ids.includes(siteId);
}

export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'factory':
      return '/dashboard/factory';
    case 'airport':
      return '/dashboard/airport';
    case 'refinery':
      return '/dashboard/refinery';
    case 'customer':
      return '/dashboard/customer';
    case 'management':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}
