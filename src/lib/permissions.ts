import { UserRole, UserProfile } from '@/types/auth';

export const PERMISSIONS = {
  // Chaque permission est qualifiée par son domaine. Des valeurs génériques
  // comme "view" accordaient auparavant un accès transversal involontaire.
  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_APPROVE: 'sales:approve',
  CUSTOMERS_VIEW: 'customers:view',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_EDIT: 'customers:edit',
  CUSTOMERS_MANAGE: 'customers:manage',
  LICENSES_VIEW: 'licenses:view',
  LICENSES_CREATE: 'licenses:create',
  LICENSES_REQUEST: 'licenses:request',
  LICENSES_APPROVE: 'licenses:approve',
  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',
  REPORTS_VIEW: 'reports:view',
  REPORTS_GENERATE: 'reports:generate',
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
  SYSTEM_SETTINGS_MANAGE: 'system_settings_manage',
  AUDIT_VIEW: 'audit:view',
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
  mine: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.LICENSES_VIEW,
    PERMISSIONS.LICENSES_REQUEST,
    PERMISSIONS.REPORTS_VIEW,
  ],
  manager: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.LICENSES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],
  management: FULL_ACCESS_PERMISSIONS,
  admin: FULL_ACCESS_PERMISSIONS,
};

function permissionsFor(user: UserProfile): string[] {
  // Les premiers comptes sociétés portaient historiquement le rôle `customer`.
  // Le rattachement autoritatif à une mine prévaut afin qu'ils reçoivent la
  // même matrice que les comptes `mine`, sans élargir les comptes clients.
  return user.mining_company_id
    ? ROLE_PERMISSIONS.mine
    : (ROLE_PERMISSIONS[user.role] || []);
}

export function hasPermission(user: UserProfile | null, permission: string): boolean {
  if (!user || !user.is_active) return false;

  const rolePermissions = permissionsFor(user);
  return rolePermissions.includes(permission);
}

export function hasAnyPermission(user: UserProfile | null, permissions: string[]): boolean {
  if (!user || !user.is_active) return false;

  const rolePermissions = permissionsFor(user);
  return permissions.some(permission => rolePermissions.includes(permission));
}

export function hasAllPermissions(user: UserProfile | null, permissions: string[]): boolean {
  if (!user || !user.is_active) return false;

  const rolePermissions = permissionsFor(user);
  return permissions.every(permission => rolePermissions.includes(permission));
}

/**
 * Le rôle Owner est le seul périmètre transversal de la plateforme.
 * Cette décision part toujours du profil autoritatif chargé par AuthContext,
 * jamais d'une valeur fournie par une route ou par le navigateur.
 */
export function hasGlobalPlatformAccess(user: UserProfile | null): boolean {
  return Boolean(user?.is_active && user.role === 'owner');
}

/**
 * L'administrateur peut ouvrir les modules nécessaires à l'administration et
 * au support opérationnel, mais ne reçoit jamais les prérogatives de propriété
 * (sélecteur global, promotion Owner, administration d'un Owner).
 */
export function hasAdministrativePlatformAccess(user: UserProfile | null): boolean {
  return Boolean(
    user?.is_active
    && user.role === 'admin'
    && user.mining_company_id === null,
  );
}

export function isManagement(user: UserProfile | null): boolean {
  return Boolean(user?.is_active && (user.role === 'owner' || user.role === 'management'));
}

/** Direction consultative : aucun droit de création, modification ou validation. */
export function isReadOnlyManager(user: UserProfile | null): boolean {
  return Boolean(user?.is_active && user.role === 'manager');
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

export function getDefaultRoute(role: UserRole, miningCompanyId: string | null = null): string {
  if (miningCompanyId) return '/portail-mine';

  switch (role) {
    case 'factory':
      return '/dashboard/factory';
    case 'airport':
      return '/dashboard/airport';
    case 'refinery':
      return '/dashboard/refinery';
    case 'customer':
      return '/dashboard/customer';
    case 'manager':
      return '/portail-direction';
    case 'mine':
      return '/portail-mine';
    case 'management':
    case 'owner':
    case 'admin':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}
