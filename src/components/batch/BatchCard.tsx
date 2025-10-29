import { useState } from 'react';
import { Package, Calendar, Weight, MapPin, Building2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import Button from '@/components/ui/Button';
import { getBatchStatusLabel, getBatchStatusVariant } from '@/constants/batchStatuses';
import { formatWeight } from '@/utils/batchUtils';
import { BatchAction } from '@/services/batchActionsService';
import { BatchConfirmationDialog } from './BatchConfirmationDialog';
import { cn } from '@/utils/cn';

export interface BatchCardProps {
  batch: {
    id: string;
    batch_number: string;
    status: string;
    weight_grams: number;
    weight_ounces?: number;
    metal_type?: string;
    shipping_date: string;
    mining_company?: { name: string; country?: string };
    comments?: string;
    created_at: string;
    [key: string]: any;
  };
  actions: BatchAction[];
  variant?: 'compact' | 'expanded';
  showStatus?: boolean;
  showWeight?: boolean;
  showMiningCompany?: boolean;
  onActionClick?: (actionId: string, batchId: string) => void;
  className?: string;
  statusInfo?: {
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
  };
}

export function BatchCard({
  batch,
  actions,
  variant = 'compact',
  showStatus = true,
  showWeight = true,
  showMiningCompany = true,
  onActionClick,
  className,
  statusInfo,
}: BatchCardProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: BatchAction | null;
  }>({ isOpen: false, action: null });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const hasActions = actions.length > 0;
  const statusVariant = getBatchStatusVariant(batch.status);

  // Border color based on status variant
  const borderColorClass = {
    default: 'border-gray-200',
    pending: 'border-yellow-300',
    info: 'border-blue-300',
    warning: 'border-orange-300',
    success: 'border-green-300',
    error: 'border-red-300',
  }[statusVariant];

  // Background color for status info
  const statusInfoBgClass = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-orange-50 border-orange-200 text-orange-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  }[statusInfo?.type || 'info'];

  const handleActionClick = (actionId: string) => {
    const action = actions.find(a => a.id === actionId);
    if (!action) return;

    if (action.requiresConfirmation) {
      // Open custom confirmation dialog
      setConfirmDialog({ isOpen: true, action });
    } else {
      // Execute action immediately if no confirmation needed
      executeAction(action);
    }
  };

  const executeAction = async (action: BatchAction) => {
    setIsActionLoading(true);
    try {
      if (onActionClick) {
        onActionClick(action.id, batch.id);
      } else {
        action.handler(batch.id);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.action) return;

    await executeAction(confirmDialog.action);
    setConfirmDialog({ isOpen: false, action: null });
  };

  const handleCloseDialog = () => {
    setConfirmDialog({ isOpen: false, action: null });
  };

  // Generate action config for confirmation dialog
  const getActionConfig = (action: BatchAction) => {
    const configs: Record<string, any> = {
      validate_refinery: {
        title: 'Validate Receipt and Start Processing',
        description: 'This will validate the refinery receipt and move the batch to processing status. Please review the batch details before confirming.',
        confirmButtonText: 'Validate & Start Processing',
        confirmButtonVariant: 'success' as const,
        warningMessage: 'Once validated, the batch will be ready for refining operations.',
      },
      start_processing: {
        title: 'Start Processing',
        description: 'This will start the refining process for this batch. Make sure all preparations are complete.',
        confirmButtonText: 'Start Processing',
        confirmButtonVariant: 'primary' as const,
      },
      complete_processing: {
        title: 'Mark Processing as Completed',
        description: 'This will mark the refining process as completed and move the batch to inventory. The batch will be available for sale once in inventory.',
        confirmButtonText: 'Process Completed',
        confirmButtonVariant: 'success' as const,
        warningMessage: 'Once completed, the batch will be moved to inventory and ready for sale transactions.',
      },
      approve_transport: {
        title: 'Approve for Transport',
        description: 'This will approve the batch for transportation. Please verify all details are correct.',
        confirmButtonText: 'Approve Transport',
        confirmButtonVariant: 'success' as const,
      },
    };

    return configs[action.id] || {
      title: action.label,
      description: action.confirmationMessage || 'Please review the batch details and confirm this action.',
      confirmButtonText: 'Confirm',
      confirmButtonVariant: 'primary' as const,
    };
  };

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md border-2',
        borderColorClass,
        hasActions && 'hover:border-primary-400',
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Package className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{batch.batch_number}</h3>
              {showStatus && (
                <div className="mt-1">
                  <StatusBadge
                    label={getBatchStatusLabel(batch.status)}
                    variant={statusVariant}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Required Badge */}
          {hasActions && (
            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
              Action Required
            </span>
          )}
        </div>

        {/* Status Info Message */}
        {statusInfo && (
          <div className={cn('mb-3 p-2 rounded-lg border text-sm flex items-start gap-2', statusInfoBgClass)}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{statusInfo.message}</span>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {showWeight && (
            <div className="flex items-start gap-2">
              <Weight className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-gray-600">Weight</p>
                <p className="font-medium text-gray-900">
                  {formatWeight(batch.weight_grams)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-gray-600">Shipping Date</p>
              <p className="font-medium text-gray-900">
                {new Date(batch.shipping_date).toLocaleDateString()}
              </p>
            </div>
          </div>

          {showMiningCompany && batch.mining_company && (
            <div className="flex items-start gap-2 col-span-2">
              <MapPin className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-gray-600">Mining Company</p>
                <p className="font-medium text-gray-900">
                  {batch.mining_company.name}
                  {batch.mining_company.country && (
                    <span className="text-gray-500 ml-1">
                      ({batch.mining_company.country})
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {variant === 'expanded' && batch.metal_type && (
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-gray-600">Metal Type</p>
                <p className="font-medium text-gray-900 capitalize">
                  {batch.metal_type}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Comments */}
        {variant === 'expanded' && batch.comments && (
          <div className="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
            <p className="text-gray-600 text-xs mb-1">Comments:</p>
            <p>{batch.comments}</p>
          </div>
        )}

        {/* Actions */}
        {hasActions && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant={action.variant}
                  size="sm"
                  onClick={() => handleActionClick(action.id)}
                  disabled={action.disabled || isActionLoading}
                  loading={isActionLoading}
                  className="gap-2"
                  title={action.disabledReason}
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && confirmDialog.action && (
        <BatchConfirmationDialog
          isOpen={confirmDialog.isOpen}
          onClose={handleCloseDialog}
          onConfirm={handleConfirmAction}
          batch={batch}
          action={getActionConfig(confirmDialog.action)}
          isLoading={isActionLoading}
        />
      )}
    </Card>
  );
}

/**
 * Compact version of BatchCard for list views
 */
export function BatchCardCompact(props: BatchCardProps) {
  return <BatchCard {...props} variant="compact" />;
}

/**
 * Expanded version of BatchCard for detailed views
 */
export function BatchCardExpanded(props: BatchCardProps) {
  return <BatchCard {...props} variant="expanded" />;
}
