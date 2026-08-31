import type { UserRole } from '@/types/auth';

/**
 * Hiérarchie d'administration des comptes.
 *
 * Cette échelle ne remplace pas les habilitations métier. Elle répond à une
 * seule question de sécurité : « cet acteur peut-il attribuer ou administrer
 * ce rôle ? ». Owner peut gérer un autre Owner ; Admin uniquement un niveau
 * strictement inférieur. L'auto-administration est toujours interdite.
 */
export const ROLE_LEVEL: Record<UserRole, number> = {
  owner: 100,
  admin: 80,
  management: 60,
  manager: 40,
  dgmg: 50,
  dgi: 50,
  mine: 30,
  comptoir: 30,
  collector: 20,
  factory: 30,
  airport: 30,
  refinery: 30,
  customer: 10,
};

export const ACCOUNT_ADMIN_ROLES: UserRole[] = ['owner', 'admin'];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROLE_LEVEL, value);
}

export function canAssignRole(actorRole: UserRole | null | undefined, targetRole: UserRole): boolean {
  if (!actorRole || !ACCOUNT_ADMIN_ROLES.includes(actorRole)) return false;
  if (targetRole === 'owner') return actorRole === 'owner';
  if (actorRole === 'admin' && targetRole === 'admin') return false;
  return ROLE_LEVEL[targetRole] <= ROLE_LEVEL[actorRole];
}

export function canManageAccount(
  actorRole: UserRole | null | undefined,
  targetRole: UserRole,
  actorId?: string | null,
  targetId?: string | null,
): boolean {
  if (actorId && targetId && actorId === targetId) return false;
  return canAssignRole(actorRole, targetRole);
}

export function assignableRoles(actorRole: UserRole | null | undefined, roles: UserRole[]): UserRole[] {
  return roles.filter((role) => canAssignRole(actorRole, role));
}
