/**
 * Composant de Workflow Unifié - Affichage Complet
 * Visible dans TOUS les modules sans possibilité de modification
 */

import { Check, Circle } from 'lucide-react';

// Import depuis les constantes unifiées
import {
  UnifiedStatus,
  UNIFIED_STATUS_CONFIG,
  COMPLETE_STATUS_FLOW,
  isStatusCompleted,
  getProgressPercentage
} from '@/constants/unifiedStatuses';

interface UnifiedStatusFlowProps {
  currentStatus: string;
  className?: string;
  compact?: boolean;
}

export function UnifiedStatusFlow({
  currentStatus,
  className = '',
  compact = false
}: UnifiedStatusFlowProps) {
  // Cast du statut pour TypeScript
  const status = currentStatus as UnifiedStatus;
  const statusConfig = UNIFIED_STATUS_CONFIG[status];
  
  // Si le statut n'est pas reconnu, utiliser les valeurs par défaut
  if (!statusConfig) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          Statut non reconnu: {currentStatus}
        </p>
      </div>
    );
  }

  const progressPercentage = getProgressPercentage(status);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* En-tête Statut Actuel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{statusConfig.icon}</span>
            <div>
              <p className="text-xs text-gray-600">Statut Actuel</p>
              <p className={`text-lg font-bold ${statusConfig.color}`}>
                {statusConfig.label}
              </p>
            </div>
          </div>

          {/* Progression */}
          <div className="text-right">
            <p className="text-xs text-gray-600 mb-1">Progression</p>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs font-bold">{progressPercentage}%</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-700">{statusConfig.description}</p>
        <p className="text-[10px] text-gray-600 mt-1">Phase: {statusConfig.phase}</p>
      </div>

      {/* Workflow Complet */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-gray-900 mb-3">
          Workflow Complet
        </h4>

        <div className="space-y-2">
          {COMPLETE_STATUS_FLOW.map((flowStatus, index) => {
            const config = UNIFIED_STATUS_CONFIG[flowStatus];
            const isCompleted = isStatusCompleted(flowStatus, status);
            const isCurrent = flowStatus === status;
            const isPast = isCompleted && !isCurrent;

            return (
              <div key={flowStatus} className="flex items-center gap-3">
                {/* Icône */}
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${isCurrent ? `${config.bgColor} ${config.borderColor} border-2` : ''}
                      ${isPast ? 'bg-green-100 border-green-300 border' : ''}
                      ${!isCompleted ? 'bg-gray-100 border-gray-200 border' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <Check className={`w-4 h-4 ${isCurrent ? config.color : 'text-green-600'}`} />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-400" />
                    )}
                  </div>

                  {/* Ligne de connexion */}
                  {index < COMPLETE_STATUS_FLOW.length - 1 && (
                    <div className={`w-0.5 h-6 ${isPast ? 'bg-green-500' : 'bg-gray-300'}`} />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>{config.icon}</span>
                    <span className={`text-sm ${isCurrent ? 'font-bold ' + config.color : isPast ? 'text-gray-700' : 'text-gray-500'}`}>
                      {config.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        ACTUEL
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 ml-7">{config.phase}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
