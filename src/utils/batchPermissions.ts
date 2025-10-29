import { BATCH_STATUSES } from '@/constants/batchStatuses';

/**
 * Check if a batch can be edited based on its status
 * Once a batch is received at airport or beyond, it cannot be edited at factory
 */
export function canEditBatch(status: string, userRole?: string): boolean {
  // Batches can only be edited when in pending approval or approved for transport
  // Once received at airport or beyond, they are locked
  const editableStatuses = [
    BATCH_STATUSES.PENDING_FACTORY_APPROVAL,
  ];

  // Managers can edit up until airport receipt
  if (userRole && ['management', 'manager', 'admin'].some(r => userRole.toLowerCase().includes(r))) {
    return [...editableStatuses, BATCH_STATUSES.APPROVED_FOR_TRANSPORT].includes(status);
  }

  return editableStatuses.includes(status);
}

/**
 * Check if a batch can be deleted based on its status
 */
export function canDeleteBatch(status: string): boolean {
  // Only pending batches can be deleted
  return status === BATCH_STATUSES.PENDING_FACTORY_APPROVAL;
}

/**
 * Check if batch can be approved for transport
 */
export function canApproveBatch(status: string, userRole?: string): boolean {
  if (!userRole) return false;

  const isManager = ['management', 'manager', 'admin', 'factory_manager'].some(r =>
    userRole.toLowerCase().includes(r)
  );

  return isManager && status === BATCH_STATUSES.PENDING_FACTORY_APPROVAL;
}

/**
 * Get human-readable reason why batch cannot be edited
 */
export function getEditRestrictionReason(status: string): string {
  if (status === BATCH_STATUSES.RECEIVED_AT_AIRPORT || status === BATCH_STATUSES.VALIDATED_FOR_REFINERY) {
    return 'Batch has been received at airport and cannot be modified.';
  }

  if (status === BATCH_STATUSES.RECEIVED_AT_REFINERY || status === BATCH_STATUSES.PROCESSING) {
    return 'Batch is at refinery and cannot be modified.';
  }

  if (status === BATCH_STATUSES.IN_INVENTORY || status === BATCH_STATUSES.READY_FOR_SALE) {
    return 'Batch has been processed and is in inventory. Cannot be modified.';
  }

  if (status === BATCH_STATUSES.SOLD) {
    return 'Batch has been sold and cannot be modified.';
  }

  return 'Batch cannot be edited in current status.';
}

/**
 * Check which fields can be edited in a given status
 */
export function getEditableFields(status: string): string[] {
  switch (status) {
    case BATCH_STATUSES.PENDING_FACTORY_APPROVAL:
      // All fields editable
      return ['weight_grams', 'shipping_date', 'metal_type', 'mining_company_id', 'comments'];

    case BATCH_STATUSES.APPROVED_FOR_TRANSPORT:
      // Only comments can be updated
      return ['comments'];

    default:
      // No fields editable
      return [];
  }
}
