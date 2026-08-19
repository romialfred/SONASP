import { UserRole, UserProfile } from '@/types/auth';

export const PERMISSIONS = {
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
  SYSTEM_SETTINGS_MANAGE: 'system_settings_manage',
  AUDIT_VIEW: 'view',
} as const;

const FULL_ACCESS_PERMISSIONS = [...new Set(Object.values(PERMISSIONS))];

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: FULL_ACCESS_PERMISSIONS,
  factory: [
    PERMISSIONS.LICENSES_VIEW,
    PERMISSIONS.LICENSES_REQUEST,
    PERMISSIONS.REPORTS_VIEW,
  ],
  airport: [
    PERMISSIONS.REPORTS_VIEW,
  ],
  refinery: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  customer: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  management: FULL_ACCESS_PERMISSIONS,
  admin: FULL_ACCESS_PERMISSIONS,
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
  return Boolean(user?.is_active && (user.role === 'owner' || user.role === 'management'));
}

/**
 * Habilité à approuver les ventes (or artisanal & international) avant facturation/paiement.
 * La direction dispose d'office du droit ; les autres utilisateurs doivent porter le drapeau
 * « Approbateur » accordé depuis la page Approbateurs.
 */
export function isSalesApprover(user: UserProfile | null): boolean {
  if (!user || !user.is_active) return false;
  return user.is_sales_approver === true || isManagement(user);
}

export function canAccessSite(user: UserProfile | null, siteId: string): boolean {
  if (!user || !user.is_active) return false;

  if (user.role === 'owner' || user.role === 'management') return true;

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
    case 'owner':
    case 'admin':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}
