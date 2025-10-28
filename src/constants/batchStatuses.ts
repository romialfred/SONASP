/**
 * Batch Status Definitions
 *
 * This file contains the centralized definition of all batch statuses
 * that match the database constraint batches_status_check
 */

export const BATCH_STATUSES = {
  PENDING_FACTORY_APPROVAL: 'pending_factory_approval',
  APPROVED_FOR_TRANSPORT: 'approved_for_transport',
  WAITING_AIRPORT_RECEIPT: 'waiting_airport_receipt',
  RECEIVED_AT_AIRPORT: 'received_at_airport',
  VALIDATED_FOR_REFINERY: 'validated_for_refinery',
  WAITING_REFINERY_RECEIPT: 'waiting_refinery_receipt',
  RECEIVED_AT_REFINERY: 'received_at_refinery',
  VALIDATED_FOR_PROCESSING: 'validated_for_processing',
  PROCESSING: 'processing',
  IN_INVENTORY: 'in_inventory',
  READY_FOR_SALE: 'ready_for_sale',
  ALLOCATED_TO_SALE: 'allocated_to_sale',
  SOLD: 'sold',
  CANCELLED: 'cancelled',
} as const;

export type BatchStatus = typeof BATCH_STATUSES[keyof typeof BATCH_STATUSES];

/**
 * Human-readable labels for batch statuses
 */
export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  [BATCH_STATUSES.PENDING_FACTORY_APPROVAL]: 'Pending Factory Approval',
  [BATCH_STATUSES.APPROVED_FOR_TRANSPORT]: 'Approved for Transport',
  [BATCH_STATUSES.WAITING_AIRPORT_RECEIPT]: 'In Transit to Airport',
  [BATCH_STATUSES.RECEIVED_AT_AIRPORT]: 'Received at Airport',
  [BATCH_STATUSES.VALIDATED_FOR_REFINERY]: 'Validated for Refinery',
  [BATCH_STATUSES.WAITING_REFINERY_RECEIPT]: 'In Transit to Refinery',
  [BATCH_STATUSES.RECEIVED_AT_REFINERY]: 'Received at Refinery',
  [BATCH_STATUSES.VALIDATED_FOR_PROCESSING]: 'Ready for Processing',
  [BATCH_STATUSES.PROCESSING]: 'Processing',
  [BATCH_STATUSES.IN_INVENTORY]: 'In Inventory',
  [BATCH_STATUSES.READY_FOR_SALE]: 'Ready for Sale',
  [BATCH_STATUSES.ALLOCATED_TO_SALE]: 'Allocated to Sale',
  [BATCH_STATUSES.SOLD]: 'Sold',
  [BATCH_STATUSES.CANCELLED]: 'Cancelled',
};

/**
 * Status badge variants for UI display
 */
export const BATCH_STATUS_VARIANTS: Record<BatchStatus, 'default' | 'pending' | 'info' | 'warning' | 'success' | 'error'> = {
  [BATCH_STATUSES.PENDING_FACTORY_APPROVAL]: 'pending',
  [BATCH_STATUSES.APPROVED_FOR_TRANSPORT]: 'info',
  [BATCH_STATUSES.WAITING_AIRPORT_RECEIPT]: 'info',
  [BATCH_STATUSES.RECEIVED_AT_AIRPORT]: 'warning',
  [BATCH_STATUSES.VALIDATED_FOR_REFINERY]: 'info',
  [BATCH_STATUSES.WAITING_REFINERY_RECEIPT]: 'info',
  [BATCH_STATUSES.RECEIVED_AT_REFINERY]: 'warning',
  [BATCH_STATUSES.VALIDATED_FOR_PROCESSING]: 'info',
  [BATCH_STATUSES.PROCESSING]: 'warning',
  [BATCH_STATUSES.IN_INVENTORY]: 'success',
  [BATCH_STATUSES.READY_FOR_SALE]: 'success',
  [BATCH_STATUSES.ALLOCATED_TO_SALE]: 'info',
  [BATCH_STATUSES.SOLD]: 'success',
  [BATCH_STATUSES.CANCELLED]: 'error',
};

/**
 * Get human-readable label for a batch status
 */
export function getBatchStatusLabel(status: string): string {
  return BATCH_STATUS_LABELS[status as BatchStatus] || status;
}

/**
 * Get badge variant for a batch status
 */
export function getBatchStatusVariant(status: string): 'default' | 'pending' | 'info' | 'warning' | 'success' | 'error' {
  return BATCH_STATUS_VARIANTS[status as BatchStatus] || 'default';
}

/**
 * Get all statuses as an array for dropdowns/filters
 */
export function getAllBatchStatuses() {
  return Object.values(BATCH_STATUSES);
}

/**
 * Get status options for select dropdowns
 */
export function getBatchStatusOptions() {
  return getAllBatchStatuses().map(status => ({
    value: status,
    label: getBatchStatusLabel(status),
  }));
}

/**
 * Check if a status is valid
 */
export function isValidBatchStatus(status: string): status is BatchStatus {
  return getAllBatchStatuses().includes(status as BatchStatus);
}
