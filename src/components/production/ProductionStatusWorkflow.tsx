import { useState } from 'react';
import { Check, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  PRODUCTION_STATUSES,
  ProductionStatus,
  STATUS_FLOW,
  getNextAllowedStatus
} from '@/constants/productionStatuses';
import { productionStatusService } from '@/services/productionStatusService';
import { ProductionStatusConfirmationModal } from './ProductionStatusConfirmationModal';

interface ProductionDetails {
  id: string;
  bar_reference: string | null;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  pure_gold_grams: number;
  estimated_oz: number;
  mining_company_name?: string;
  site_country?: string;
}

interface ProductionStatusWorkflowProps {
  productionId: string;
  currentStatus: ProductionStatus;
  production: ProductionDetails;
  userEmail?: string;
  onStatusChanged: () => void;
}

export function ProductionStatusWorkflow({
  productionId,
  currentStatus,
  production,
  userEmail,
  onStatusChanged
}: ProductionStatusWorkflowProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const nextStatus = getNextAllowedStatus(currentStatus);

  const handleUpdateStatus = async (notes?: string) => {
    if (!nextStatus) return;

    try {
      await productionStatusService.updateStatus(
        productionId,
        nextStatus,
        notes
      );
      onStatusChanged();
    } catch (error: any) {
      alert(error.message || 'Erreur lors de la mise à jour du statut');
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Flow Visualization */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STATUS_FLOW.map((status, index) => {
          const statusConfig = PRODUCTION_STATUSES[status];
          const isCompleted = STATUS_FLOW.indexOf(currentStatus) >= index;
          const isCurrent = currentStatus === status;

          return (
            <div key={status} className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
                  ${
                    isCurrent
                      ? `${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.color} font-semibold`
                      : isCompleted
                      ? 'bg-gray-100 border-gray-300 text-gray-700'
                      : 'bg-white border-gray-200 text-gray-400'
                  }
                `}
              >
                {isCompleted && !isCurrent && (
                  <Check className="w-4 h-4 text-emerald-600" />
                )}
                {!isCompleted && <Lock className="w-4 h-4" />}
                <span className="text-sm">{statusConfig.label}</span>
              </div>

              {index < STATUS_FLOW.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Status Info */}
      <div className={`p-4 rounded-lg border-2 ${PRODUCTION_STATUSES[currentStatus].bgColor} ${PRODUCTION_STATUSES[currentStatus].borderColor}`}>
        <h4 className={`text-sm font-semibold mb-1 ${PRODUCTION_STATUSES[currentStatus].color}`}>
          Statut Actuel: {PRODUCTION_STATUSES[currentStatus].label}
        </h4>
        <p className="text-sm text-gray-600">
          {PRODUCTION_STATUSES[currentStatus].description}
        </p>
      </div>

      {/* Action Button */}
      {nextStatus && (
        <div className="space-y-3">
          <Button
            onClick={() => setShowConfirmModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
            size="lg"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            Passer à: {PRODUCTION_STATUSES[nextStatus].label}
          </Button>
        </div>
      )}

      {/* Confirmation Modal */}
      {nextStatus && (
        <ProductionStatusConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleUpdateStatus}
          currentStatus={currentStatus}
          nextStatus={nextStatus}
          production={production}
          userEmail={userEmail}
        />
      )}

      {!nextStatus && currentStatus === 'shipped' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm text-emerald-800 font-medium">
            ✓ Cette production a été expédiée. La suite du processus se fait dans le module Expédition/Raffinerie.
          </p>
        </div>
      )}

      {currentStatus === 'cancelled' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium">
            ✗ Cette production a été annulée
          </p>
        </div>
      )}
    </div>
  );
}
