import { useState } from 'react';
import { ArrowRight, Lock, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  PRODUCTION_STATUSES,
  ProductionStatus,
  getNextAllowedStatus
} from '@/constants/productionStatuses';
import {
  createProductionTransitionRequestId,
  productionStatusService,
} from '@/services/productionStatusService';
import { ProductionStatusConfirmationModal } from './ProductionStatusConfirmationModal';
import {
  WorkflowModule,
  useStatusTransitionControl
} from '@/hooks/useStatusTransitionControl';
import { UnifiedStatusFlow } from '@/components/common/UnifiedStatusFlow';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';

interface ProductionDetails {
  id: string;
  bar_reference: string | null;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  pure_gold_grams: number;
  estimated_oz: number;
  estimated_silver_pct?: number;
  mining_company_name?: string;
  site_country?: string;
}

interface ProductionStatusWorkflowProps {
  productionId: string;
  currentStatus: ProductionStatus;
  production: ProductionDetails;
  userEmail?: string;
  onStatusChanged: () => void;
  compactButton?: boolean;
}

export function ProductionStatusWorkflow({
  productionId,
  currentStatus,
  production,
  userEmail,
  onStatusChanged,
  compactButton = false
}: ProductionStatusWorkflowProps) {
  const { user } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [transitionRequestId, setTransitionRequestId] = useState<string | null>(null);

  // Contrôle des transitions - MODULE PRODUCTION uniquement
  const transitionControl = useStatusTransitionControl(
    WorkflowModule.PRODUCTION,
    currentStatus
  );

  const nextStatus = getNextAllowedStatus(currentStatus);

  const canValidateProduction =
    hasSensitiveCapability(user, CAPABILITIES.MINE_OPERATE)
    || hasSensitiveCapability(user, CAPABILITIES.SONASP_APPROVE);

  // Le serveur reste l'autorité ; le bouton échoue fermé tant que la session
  // n'expose pas une capability sensible effective (donc AAL2 validé).
  const isLocked = !transitionControl.canChangeStatus || !canValidateProduction;
  const isReadyForCustoms = currentStatus === 'ready_for_customs';

  const openConfirmation = () => {
    setTransitionRequestId(createProductionTransitionRequestId());
    setShowConfirmModal(true);
  };

  const closeConfirmation = () => {
    setShowConfirmModal(false);
    setTransitionRequestId(null);
  };

  const handleUpdateStatus = async (notes?: string) => {
    if (!nextStatus) return;

    try {
      await productionStatusService.updateStatus(
        productionId,
        nextStatus,
        notes,
        {
          expectedStatus: currentStatus,
          requestId: transitionRequestId || createProductionTransitionRequestId(),
        },
      );
      setTransitionRequestId(null);
      onStatusChanged();
    } catch (error: any) {
      alert(error.message || 'Erreur lors de la mise à jour du statut');
      throw error;
    }
  };

  // Mode compact - seulement le bouton d'action
  if (compactButton) {
    return (
      <>
        {nextStatus && !isLocked && transitionControl.checkTransition(nextStatus) && (
          <Button
            onClick={openConfirmation}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            Passer à: {PRODUCTION_STATUSES[nextStatus].label}
          </Button>
        )}

        {nextStatus && isLocked && (
          <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600 font-medium">
              Statut verrouillé
            </span>
          </div>
        )}

        {nextStatus && (
          <ProductionStatusConfirmationModal
            isOpen={showConfirmModal}
            onClose={closeConfirmation}
            onConfirm={handleUpdateStatus}
            currentStatus={currentStatus}
            nextStatus={nextStatus}
            production={production}
            userEmail={userEmail}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerte de verrouillage */}
      {isLocked && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Statut verrouillé pour le module Production
              </p>
              <p className="text-xs text-amber-800">
                {transitionControl.responsibilityMessage}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Les modifications de statut doivent être effectuées depuis le module approprié.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Prêt pour Douane */}
      {isReadyForCustoms && !isLocked && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Dernière étape modifiable depuis Production
              </p>
              <p className="text-xs text-blue-800">
                Après validation, la production sera gérée par le module <strong>Préparation d'Expédition</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Workflow Unifié - Affiche TOUS les statuts possibles */}
      <UnifiedStatusFlow currentStatus={currentStatus} />

      {/* Action Button - Contrôlé */}
      {nextStatus && !isLocked && transitionControl.checkTransition(nextStatus) && (
        <div className="space-y-3">
          <Button
          onClick={openConfirmation}
            className="w-full bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
            size="lg"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            Passer à: {PRODUCTION_STATUSES[nextStatus].label}
          </Button>
        </div>
      )}

      {/* Bouton verrouillé */}
      {nextStatus && isLocked && (
        <div className="p-4 bg-gray-100 border-2 border-gray-300 rounded-lg flex items-center justify-center gap-2">
          <Lock className="w-5 h-5 text-gray-500" />
          <span className="text-sm text-gray-600 font-medium">
            Changement de statut verrouillé - Géré par un autre module
          </span>
        </div>
      )}

      {/* Confirmation Modal */}
      {nextStatus && (
        <ProductionStatusConfirmationModal
          isOpen={showConfirmModal}
          onClose={closeConfirmation}
          onConfirm={handleUpdateStatus}
          currentStatus={currentStatus}
          nextStatus={nextStatus}
          production={production}
          userEmail={userEmail}
        />
      )}

      {!nextStatus && currentStatus === 'validated_for_refinery' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm text-emerald-800 font-medium">
            ✓ Cette production a été validée pour la raffinerie. La suite du processus se fait dans le module Expédition/Raffinerie.
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
