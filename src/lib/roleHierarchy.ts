import type { UserRole } from '@/types/auth';

/**
 * Hiérarchie d'administration des comptes.
 *
 * Cette échelle ne remplace pas les habilitations métier. Elle répond à une
 * seule question de sécurité : « cet acteur peut-il attribuer ou administrer
 * ce rôle ? ». Un niveau élevé peut gérer un niveau égal ou inférieur, jamais
 * un niveau supérieur.
 */
export const ROLE_LEVEL: Record<UserRole, number> = {
  owner: 100,
  admin: 80,
  management: 60,
  manager: 40,
  mine: 20,
  factory: 20,
  airport: 20,
  refinery: 20,
  customer: 20,
};

export const ACCOUNT_ADMIN_ROLES: UserRole[] = ['owner', 'admin', 'management'];

export function canAssignRole(actorRole: UserRole | null | undefined, targetRole: UserRole): boolean {
  if (!actorRole || !ACCOUNT_ADMIN_ROLES.includes(actorRole)) return false;
  if (targetRole === 'owner' && actorRole !== 'owner') return false;
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
