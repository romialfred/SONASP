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

const INTERACTIVE_ACCOUNT_ROLE_SET = new Set<string>(INTERACTIVE_ACCOUNT_ROLES);

export function isInteractiveAccountRole(role: string): boolean {
  return INTERACTIVE_ACCOUNT_ROLE_SET.has(role);
}
