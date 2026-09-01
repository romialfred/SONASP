import type { UserProfile } from '@/types/auth';
import type {
  FreightCustomsOperation,
  FreightCustomsStatus,
} from '@/services/freightCustomsService';

export const FREIGHT_CAPABILITIES = {
  READ: 'freight.read',
  PREPARE: 'freight.prepare',
  CUSTOMS_APPROVE: 'freight.customs.approve',
  TRANSPORT_DISPATCH: 'freight.transport.dispatch',
  INVOICE_MANAGE: 'freight.invoice.manage',
  HISTORY_READ: 'workflow.history.read',
} as const;

export type FreightCapability = typeof FREIGHT_CAPABILITIES[keyof typeof FREIGHT_CAPABILITIES];

export interface FreightTransitionAccess {
  allowed: boolean;
  nextStatus: FreightCustomsStatus | null;
  reason?: string;
}

/**
 * Les capacités fret sont sensibles (AAL2 côté serveur). L'interface ne les
 * déduit jamais d'un rôle ou d'un statut owner : la liste autoritative de la
 * session doit les contenir explicitement.
 */
export function hasFreightCapability(
  user: UserProfile | null | undefined,
  capability: FreightCapability,
): boolean {
  return Boolean(
    user?.is_active
    && Array.isArray(user.capabilities)
    && user.capabilities.includes(capability),
  );
}

/** Aligné sur snp_historique_peut_consulter_tenant : une mine AAL2 peut lire
 * l'historique de son propre tenant via mine.operate, toujours sous RLS. */
export function canReadFreightHistory(user: UserProfile | null | undefined): boolean {
  return hasFreightCapability(user, FREIGHT_CAPABILITIES.HISTORY_READ)
    || Boolean(
      user?.is_active
      && Array.isArray(user.capabilities)
      && user.capabilities.includes('mine.operate'),
    );
}

export function nextFreightStatus(
  currentStatus: FreightCustomsStatus,
): FreightCustomsStatus | null {
  switch (currentStatus) {
    case 'customs_pending':
      return 'customs_approved';
    case 'customs_approved':
      return 'ready_for_transport';
    case 'ready_for_transport':
    case 'ready_for_expedition':
      return 'shipped_to_refinery';
    case 'shipped_to_refinery':
      return null;
  }
}

export function getFreightTransitionAccess(
  user: UserProfile | null | undefined,
  operation: Pick<
    FreightCustomsOperation,
    'status' | 'created_by' | 'prepared_by' | 'customs_approved_by'
  >,
): FreightTransitionAccess {
  const nextStatus = nextFreightStatus(operation.status);
  if (!nextStatus) {
    return { allowed: false, nextStatus: null, reason: 'This file is already in its final state.' };
  }

  const capability = operation.status === 'customs_pending'
    ? FREIGHT_CAPABILITIES.CUSTOMS_APPROVE
    : operation.status === 'customs_approved'
      ? FREIGHT_CAPABILITIES.PREPARE
      : FREIGHT_CAPABILITIES.TRANSPORT_DISPATCH;

  if (!hasFreightCapability(user, capability)) {
    return {
      allowed: false,
      nextStatus,
      reason: 'The verified AAL2 session does not have the capability required for this step.',
    };
  }

  if (
    operation.status === 'customs_pending'
    && user?.id === (operation.prepared_by ?? operation.created_by)
  ) {
    return {
      allowed: false,
      nextStatus,
      reason: 'The preparer cannot approve their own customs file.',
    };
  }

  if (
    operation.status === 'customs_approved'
    && user?.id === operation.customs_approved_by
  ) {
    return {
      allowed: false,
      nextStatus,
      reason: 'The customs approver cannot also prepare transport.',
    };
  }

  if (
    nextStatus === 'shipped_to_refinery'
    && user?.id === (operation.customs_approved_by ?? operation.created_by)
  ) {
    return {
      allowed: false,
      nextStatus,
      reason: 'The approver or creator cannot confirm dispatch alone.',
    };
  }

  return { allowed: true, nextStatus };
}
