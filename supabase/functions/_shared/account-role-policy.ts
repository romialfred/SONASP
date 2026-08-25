export const INTERACTIVE_ACCOUNT_ROLES = [
  'admin',
  'management',
  'manager',
  'mine',
  'factory',
  'airport',
  'refinery',
  'customer',
] as const;

export const ACCOUNT_MANAGEMENT_CAPABILITY = 'accounts.manage';

const INTERACTIVE_ACCOUNT_ROLE_SET = new Set<string>(INTERACTIVE_ACCOUNT_ROLES);

const ACCOUNT_ROLE_LEVELS: Readonly<Record<string, number>> = {
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

export function isInteractiveAccountRole(role: string): boolean {
  return INTERACTIVE_ACCOUNT_ROLE_SET.has(role);
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
    && targetRole !== 'owner'
    && !(actorRole === 'admin' && targetRole === 'admin')
    && targetLevel >= 0
    && targetLevel <= actorLevel;
}
