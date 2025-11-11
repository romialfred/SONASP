import { useState } from 'react';
import { Check, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import {
  PRODUCTION_STATUSES,
  ProductionStatus,
  STATUS_FLOW,
  getNextAllowedStatus
} from '@/constants/productionStatuses';
import { productionStatusService } from '@/services/productionStatusService';

interface ProductionStatusWorkflowProps {
  productionId: string;
  currentStatus: ProductionStatus;
  onStatusChanged: () => void;
}

export function ProductionStatusWorkflow({
  productionId,
  currentStatus,
  onStatusChanged
}: ProductionStatusWorkflowProps) {
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);

  const nextStatus = getNextAllowedStatus(currentStatus);

  const handleUpdateStatus = async () => {
    if (!nextStatus) return;

    try {
      setUpdating(true);
      await productionStatusService.updateStatus(
        productionId,
        nextStatus,
        notes || undefined
      );
      setNotes('');
      setShowNotesInput(false);
      onStatusChanged();
    } catch (error: any) {
      alert(error.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdating(false);
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
          {!showNotesInput ? (
            <div className="flex gap-2">
              <Button
                onClick={handleUpdateStatus}
                disabled={updating}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {updating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Mise à jour...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Passer à: {PRODUCTION_STATUSES[nextStatus].label}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNotesInput(true)}
                disabled={updating}
              >
                Ajouter des notes
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Notes (optionnel)
              </label>
              <TextArea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter des détails sur ce changement de statut..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateStatus}
                  disabled={updating}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {updating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Mise à jour...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Confirmer: {PRODUCTION_STATUSES[nextStatus].label}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNotesInput(false);
                    setNotes('');
                  }}
                  disabled={updating}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!nextStatus && currentStatus === 'sold' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm text-emerald-800 font-medium">
            ✓ Cette production a atteint son statut final
          </p>
        </div>
      )}
    </div>
  );
}
