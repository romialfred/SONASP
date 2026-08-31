export const INTERACTIVE_ACCOUNT_ROLES = [
  'owner',
  'admin',
  'management',
  'dgmg',
  'dgi',
  'mine',
  'comptoir',
  'collector',
  'customer',
] as const;

export const ACCOUNT_MANAGEMENT_CAPABILITY = 'accounts.manage';

const INTERACTIVE_ACCOUNT_ROLE_SET = new Set<string>(INTERACTIVE_ACCOUNT_ROLES);

const ACCOUNT_ROLE_LEVELS: Readonly<Record<string, number>> = {
  owner: 100,
  admin: 80,
  management: 60,
  dgmg: 50,
  dgi: 50,
  manager: 40,
  mine: 30,
  comptoir: 30,
  collector: 20,
  factory: 30,
  airport: 30,
  refinery: 30,
  customer: 10,
};

export function isInteractiveAccountRole(role: string): boolean {
  return INTERACTIVE_ACCOUNT_ROLE_SET.has(role);
}

/** Type du rattachement validé ensuite par le RPC autoritatif. */
export function accountOrganizationType(role: string): string {
  if (['owner', 'admin', 'management'].includes(role)) return 'sonasp';
  return role === 'collector' ? 'comptoir' : role;
}

/**
 * Miroir défensif de `snp_peut_administrer_compte` pour filtrer les résultats
 * lus avec la clé de service. La mutation reste systématiquement autorisée par
 * le RPC avec le JWT de l'acteur : cette fonction ne remplace jamais la base.
 */
export function canManageAccountTarget(input: {
  actorId: string;
  actorRole: string;
  targetId: string;
  targetRole: string;
}): boolean {
  const actorRole = input.actorRole.toLowerCase();
  const targetRole = input.targetRole.toLowerCase();
  const actorLevel = ACCOUNT_ROLE_LEVELS[actorRole] ?? -1;
  const targetLevel = ACCOUNT_ROLE_LEVELS[targetRole] ?? -1;

  return input.actorId !== input.targetId
    && (actorRole === 'owner' || actorRole === 'admin')
    && targetLevel >= 0
    && (actorRole === 'owner' || targetLevel < actorLevel);
}

/** Catalogue et hiérarchie doivent être vérifiés avant toute création Auth. */
export function canCreateAccountRole(actorRole: string, targetRole: string): boolean {
  return isInteractiveAccountRole(targetRole)
    && canManageAccountTarget({ actorId: 'actor', actorRole, targetId: 'new-account', targetRole });
}
