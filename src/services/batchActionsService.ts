import {
  CheckCircle,
  Eye,
  Edit,
  Truck,
  Package,
  AlertCircle,
  PlayCircle,
  XCircle,
  LucideIcon
} from 'lucide-react';
import { BATCH_STATUSES } from '@/constants/batchStatuses';

export interface BatchAction {
  id: string;
  label: string;
  icon: LucideIcon;
  variant: 'primary' | 'success' | 'warning' | 'danger' | 'outline' | 'ghost';
  handler: (batchId: string) => void | Promise<void>;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  visible: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export type ModuleContext = 'factory' | 'shipping' | 'receiving' | 'refining' | 'details' | 'list';

interface Batch {
  id: string;
  status: string;
  batch_number: string;
  [key: string]: any;
}

interface UserContext {
  role: string;
  permissions?: string[];
}

/**
 * Get available actions for a batch based on status, user role, and module context
 */
export function getAvailableBatchActions(
  batch: Batch,
  user: UserContext,
  module: ModuleContext,
  handlers: {
    onApproveForTransport?: (batchId: string) => Promise<void>;
    onConfirmReceipt?: (batchId: string) => void;
    onValidateForRefinery?: (batchId: string) => Promise<void>;
    onViewDetails?: (batchId: string) => void;
    onEdit?: (batchId: string) => void;
    onCancel?: (batchId: string) => Promise<void>;
    onStartProcessing?: (batchId: string) => void;
    onTrackShipment?: (batchId: string) => void;
  }
): BatchAction[] {
  const actions: BatchAction[] = [];
  const { status } = batch;
  const { role } = user;

  // Check if user is a manager
  const isManager = ['factory_manager', 'manager', 'admin', 'management'].some(r =>
    role?.toLowerCase().includes(r)
  );

  // Factory Module Actions
  if (module === 'factory' || module === 'list') {
    if (status === BATCH_STATUSES.PENDING_FACTORY_APPROVAL && isManager) {
      actions.push({
        id: 'approve_transport',
        label: 'Validate for Transportation',
        icon: CheckCircle,
        variant: 'primary',
        handler: handlers.onApproveForTransport || (() => {}),
        requiresConfirmation: true,
        confirmationMessage: 'Are you sure you want to approve this batch for transportation?',
        visible: true,
      });
    }

    if (status === BATCH_STATUSES.APPROVED_FOR_TRANSPORT) {
      actions.push({
        id: 'track_shipment',
        label: 'Track Shipment',
        icon: Truck,
        variant: 'outline',
        handler: handlers.onTrackShipment || handlers.onViewDetails || (() => {}),
        requiresConfirmation: false,
        visible: true,
      });
    }

    // View details action available for all statuses in factory
    if (handlers.onViewDetails) {
      actions.push({
        id: 'view_details',
        label: 'View Details',
        icon: Eye,
        variant: 'ghost',
        handler: handlers.onViewDetails,
        requiresConfirmation: false,
        visible: true,
      });
    }
  }

  // Shipping/Airport Module Actions
  if (module === 'shipping' || module === 'receiving') {
    const isAirportStaff = ['airport', 'management'].some(r =>
      role?.toLowerCase().includes(r)
    );

    // Receive Batch action for APPROVED_FOR_TRANSPORT status
    if (status === BATCH_STATUSES.APPROVED_FOR_TRANSPORT && isAirportStaff) {
      actions.push({
        id: 'receive_batch',
        label: 'Receive Batch',
        icon: Package,
        variant: 'primary',
        handler: handlers.onConfirmReceipt || (() => {}),
        requiresConfirmation: false,
        visible: true,
      });
    }

    if (status === BATCH_STATUSES.WAITING_AIRPORT_RECEIPT && isAirportStaff) {
      actions.push({
        id: 'confirm_receipt',
        label: 'Confirm Receipt',
        icon: Package,
        variant: 'primary',
        handler: handlers.onConfirmReceipt || (() => {}),
        requiresConfirmation: false,
        visible: true,
      });
    }

    if (status === BATCH_STATUSES.RECEIVED_AT_AIRPORT && isAirportStaff) {
      actions.push({
        id: 'validate_for_refinery',
        label: 'Validate for Refinery',
        icon: CheckCircle,
        variant: 'success',
        handler: handlers.onValidateForRefinery || (() => {}),
        requiresConfirmation: true,
        confirmationMessage: 'Validate this batch for refinery transport? This action is irreversible.',
        visible: true,
      });
    }

    // View Details action - always available
    if (handlers.onViewDetails) {
      actions.push({
        id: 'view_details',
        label: 'View Details',
        icon: Eye,
        variant: 'ghost',
        handler: handlers.onViewDetails,
        requiresConfirmation: false,
        visible: true,
      });
    }
  }

  // Refining Module Actions
  if (module === 'refining') {
    const isRefineryStaff = ['refinery', 'management'].some(r =>
      role?.toLowerCase().includes(r)
    );

    if (status === BATCH_STATUSES.WAITING_REFINERY_RECEIPT && isRefineryStaff) {
      actions.push({
        id: 'confirm_refinery_receipt',
        label: 'Confirm Receipt',
        icon: Package,
        variant: 'primary',
        handler: handlers.onConfirmReceipt || (() => {}),
        requiresConfirmation: false,
        visible: true,
      });
    }

    if (status === BATCH_STATUSES.RECEIVED_AT_REFINERY && isRefineryStaff) {
      actions.push({
        id: 'validate_refinery_receipt',
        label: 'Validate & Start Processing',
        icon: CheckCircle,
        variant: 'success',
        handler: handlers.onStartProcessing || (() => {}),
        requiresConfirmation: true,
        confirmationMessage: 'Validate receipt and move batch to processing status?',
        visible: true,
      });
    }

    if (status === BATCH_STATUSES.VALIDATED_FOR_PROCESSING && isRefineryStaff) {
      actions.push({
        id: 'start_processing',
        label: 'Start Processing',
        icon: PlayCircle,
        variant: 'primary',
        handler: handlers.onStartProcessing || (() => {}),
        requiresConfirmation: true,
        confirmationMessage: 'Start processing this batch at the refinery?',
        visible: true,
      });
    }
  }

  // Details Page - Show all relevant actions
  if (module === 'details') {
    // Add specific actions based on status and role
    if (status === BATCH_STATUSES.PENDING_FACTORY_APPROVAL && isManager) {
      actions.push({
        id: 'approve_transport',
        label: 'Validate for Transportation',
        icon: CheckCircle,
        variant: 'primary',
        handler: handlers.onApproveForTransport || (() => {}),
        requiresConfirmation: true,
        confirmationMessage: 'Are you sure you want to approve this batch for transportation?',
        visible: true,
      });
    }

    // Edit action for pending batches
    if (status === BATCH_STATUSES.PENDING_FACTORY_APPROVAL && handlers.onEdit) {
      actions.push({
        id: 'edit',
        label: 'Edit Batch',
        icon: Edit,
        variant: 'outline',
        handler: handlers.onEdit,
        requiresConfirmation: false,
        visible: true,
      });
    }
  }

  return actions.filter(action => action.visible);
}

/**
 * Get a human-readable status info message
 */
export function getBatchStatusInfo(status: string, module: ModuleContext): {
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
} {
  const infoMap: Record<string, { message: string; type: 'info' | 'warning' | 'success' | 'error' }> = {
    [BATCH_STATUSES.PENDING_FACTORY_APPROVAL]: {
      message: 'Waiting for factory manager approval',
      type: 'warning',
    },
    [BATCH_STATUSES.APPROVED_FOR_TRANSPORT]: {
      message: module === 'factory'
        ? 'Batch approved and ready for shipment to airport'
        : 'Batch ready to be shipped from factory',
      type: 'info',
    },
    [BATCH_STATUSES.WAITING_AIRPORT_RECEIPT]: {
      message: 'Batch in transit to airport',
      type: 'info',
    },
    [BATCH_STATUSES.RECEIVED_AT_AIRPORT]: {
      message: 'Batch received at airport, awaiting validation',
      type: 'warning',
    },
    [BATCH_STATUSES.VALIDATED_FOR_REFINERY]: {
      message: 'Batch validated at airport, ready for refinery',
      type: 'success',
    },
    [BATCH_STATUSES.WAITING_REFINERY_RECEIPT]: {
      message: 'Batch in transit to refinery',
      type: 'info',
    },
    [BATCH_STATUSES.RECEIVED_AT_REFINERY]: {
      message: 'Batch received at refinery, awaiting validation',
      type: 'warning',
    },
    [BATCH_STATUSES.VALIDATED_FOR_PROCESSING]: {
      message: 'Batch validated, ready for processing',
      type: 'success',
    },
    [BATCH_STATUSES.PROCESSING]: {
      message: 'Batch currently being processed',
      type: 'info',
    },
    [BATCH_STATUSES.IN_INVENTORY]: {
      message: 'Batch processed and in inventory',
      type: 'success',
    },
    [BATCH_STATUSES.READY_FOR_SALE]: {
      message: 'Batch ready for sale',
      type: 'success',
    },
    [BATCH_STATUSES.ALLOCATED_TO_SALE]: {
      message: 'Batch allocated to a sale',
      type: 'info',
    },
    [BATCH_STATUSES.SOLD]: {
      message: 'Batch has been sold',
      type: 'success',
    },
    [BATCH_STATUSES.CANCELLED]: {
      message: 'Batch has been cancelled',
      type: 'error',
    },
  };

  return infoMap[status] || { message: 'Unknown status', type: 'info' };
}

/**
 * Check if user can perform an action on a batch
 */
export function canPerformAction(
  actionId: string,
  batch: Batch,
  user: UserContext
): { allowed: boolean; reason?: string } {
  const { status } = batch;
  const { role } = user;

  const isManager = ['factory_manager', 'manager', 'admin', 'management'].some(r =>
    role?.toLowerCase().includes(r)
  );

  const isAirportStaff = ['airport', 'management'].some(r =>
    role?.toLowerCase().includes(r)
  );

  const isRefineryStaff = ['refinery', 'management'].some(r =>
    role?.toLowerCase().includes(r)
  );

  // Check action permissions
  switch (actionId) {
    case 'approve_transport':
      if (!isManager) {
        return { allowed: false, reason: 'Only factory managers can approve batches' };
      }
      if (status !== BATCH_STATUSES.PENDING_FACTORY_APPROVAL) {
        return { allowed: false, reason: 'Batch is not in pending approval status' };
      }
      break;

    case 'confirm_receipt':
    case 'validate_receipt':
      if (!isAirportStaff) {
        return { allowed: false, reason: 'Only airport staff can confirm receipt' };
      }
      break;

    case 'confirm_refinery_receipt':
    case 'validate_refinery_receipt':
    case 'start_processing':
      if (!isRefineryStaff) {
        return { allowed: false, reason: 'Only refinery staff can perform this action' };
      }
      break;
  }

  return { allowed: true };
}
