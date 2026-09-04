import type { AccessPermissionCode } from '@/types/accessGovernance';

export interface EffectiveAccessFactors {
  accountActive: boolean;
  sessionActive: boolean;
  portalActive: boolean;
  roleActive: boolean;
  roleBelongsToPortal: boolean;
  moduleGloballyActive: boolean;
  moduleActiveForPortal: boolean;
  moduleActiveForRole: boolean;
  permissionApplicable: boolean;
  permissionGrantedToRole: boolean;
  individualGrantWithinCeiling: boolean;
  individuallyDenied: boolean;
}

export interface EffectiveAccessDecision {
  allowed: boolean;
  permission: AccessPermissionCode;
  failedFactor: keyof EffectiveAccessFactors | null;
}

const FACTOR_ORDER: readonly (keyof EffectiveAccessFactors)[] = [
  'accountActive',
  'sessionActive',
  'portalActive',
  'roleActive',
  'roleBelongsToPortal',
  'moduleGloballyActive',
  'moduleActiveForPortal',
  'moduleActiveForRole',
  'permissionApplicable',
  'permissionGrantedToRole',
  'individualGrantWithinCeiling',
];

/**
 * Projection frontend de la règle serveur. Elle sert à expliquer les refus et
 * à tester la matrice ; la décision de sécurité reste toujours recalculée en base.
 */
export function evaluateEffectiveAccess(
  permission: AccessPermissionCode,
  factors: EffectiveAccessFactors,
): EffectiveAccessDecision {
  const failedFactor = FACTOR_ORDER.find((factor) => factors[factor] !== true) ?? null;
  if (failedFactor) return { allowed: false, permission, failedFactor };
  if (factors.individuallyDenied) {
    return { allowed: false, permission, failedFactor: 'individuallyDenied' };
  }
  return { allowed: true, permission, failedFactor: null };
}

export function permissionTone(allowed: boolean): 'success' | 'danger' {
  return allowed ? 'success' : 'danger';
}
