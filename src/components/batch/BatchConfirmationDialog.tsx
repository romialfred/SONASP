import { Package, Calendar, Scale, MapPin, User, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { formatWeight, convertGramsToOunces } from '@/utils/batchUtils';
import { getBatchStatusLabel } from '@/constants/batchStatuses';

interface BatchConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  batch: {
    id: string;
    batch_number: string;
    weight_grams: number;
    status: string;
    shipping_date?: string;
    mining_company?: {
      name: string;
      country?: string;
    };
    created_by_name?: string;
    airport_received_weight_grams?: number;
    refinery_received_weight_grams?: number;
  };
  action: {
    title: string;
    description: string;
    confirmButtonText?: string;
    confirmButtonVariant?: 'primary' | 'success' | 'warning' | 'danger';
    warningMessage?: string;
  };
  isLoading?: boolean;
}

export function BatchConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  batch,
  action,
  isLoading = false,
}: BatchConfirmationDialogProps) {
  const weightGrams = batch.refinery_received_weight_grams || batch.airport_received_weight_grams || batch.weight_grams;
  const weightOunces = convertGramsToOunces(weightGrams);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={action.title}
      maxWidth="max-w-3xl"
    >
      <div className="p-6 space-y-6">
        {/* Description */}
        <p className="text-gray-700 text-base leading-relaxed">{action.description}</p>

        {/* Warning Message */}
        {action.warningMessage && (
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">{action.warningMessage}</p>
          </div>
        )}

        {/* Batch Details Card */}
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Details</h3>

          {/* Batch Number */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Batch Number</p>
              <p className="text-sm font-semibold text-gray-900">{batch.batch_number}</p>
            </div>
          </div>

          {/* Weight */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Weight</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatWeight(weightGrams)} ({weightOunces.toFixed(2)} oz)
              </p>
            </div>
          </div>

          {/* Current Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Current Status</p>
              <p className="text-sm font-semibold text-gray-900">{getBatchStatusLabel(batch.status)}</p>
            </div>
          </div>

          {/* Shipping Date */}
          {batch.shipping_date && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Shipping Date</p>
                <p className="text-sm font-semibold text-gray-900">
                  {new Date(batch.shipping_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Mining Company */}
          {batch.mining_company && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Mining Company</p>
                <p className="text-sm font-semibold text-gray-900">
                  {batch.mining_company.name}
                  {batch.mining_company.country && (
                    <span className="text-gray-600"> ({batch.mining_company.country})</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Created By */}
          {batch.created_by_name && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
                <User className="w-5 h-5 text-pink-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Created By</p>
                <p className="text-sm font-semibold text-gray-900">{batch.created_by_name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={action.confirmButtonVariant || 'primary'}
            onClick={onConfirm}
            disabled={isLoading}
            loading={isLoading}
          >
            {action.confirmButtonText || 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
