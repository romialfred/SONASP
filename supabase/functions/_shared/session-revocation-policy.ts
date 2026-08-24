import { canManageAccountTarget } from './account-role-policy.ts';

export interface SessionRevocationPolicyInput {
  actorId: string;
  actorRole: string;
  actorIsActive: boolean;
  actorMiningCompanyId: string | null;
  actorHasMfa: boolean;
  actorAal: 'aal1' | 'aal2';
  targetId: string;
  targetRole: string | null;
  hasAccountManagementCapability: boolean;
  hierarchyAllowsTarget: boolean;
}

/**
 * Politique pure utilisée en complément des RPC autoritaires : une révocation
 * self reste possible pour les profils partenaires, tandis qu'une révocation
 * tierce est réservée à l'administration nationale AAL2.
 */
export function canRequestSessionRevocation(input: SessionRevocationPolicyInput): boolean {
  if (!input.actorIsActive || !input.actorHasMfa || input.actorAal !== 'aal2') return false;
  if (input.actorId === input.targetId) return true;

  return input.actorMiningCompanyId === null
    && input.hasAccountManagementCapability
    && input.hierarchyAllowsTarget
    && input.targetRole !== null
    && canManageAccountTarget({
      actorId: input.actorId,
      actorRole: input.actorRole,
      targetId: input.targetId,
      targetRole: input.targetRole,
    });
}
