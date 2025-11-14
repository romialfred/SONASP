/**
 * Composant de Workflow en Lecture Seule
 *
 * Affiche le workflow de statut avec l'historique complet
 * Sans possibilité de modification - utilisable dans tous les modules
 */

import { ProductionStatusBadge } from '@/components/production/ProductionStatusBadge';
import { ProductionStatus, PRODUCTION_STATUSES } from '@/constants/productionStatuses';
import { getModuleResponsibilityMessage } from '@/services/statusTransitionControlService';
import { CheckCircle, Circle, Info } from 'lucide-react';

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string;
  notes: string | null;
  user_email?: string;
}

interface ReadOnlyStatusWorkflowProps {
  currentStatus: ProductionStatus;
  history: StatusHistoryEntry[];
  className?: string;
}

export function ReadOnlyStatusWorkflow({
  currentStatus,
  history,
  className = ''
}: ReadOnlyStatusWorkflowProps) {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  );

  const allStatuses = Object.keys(PRODUCTION_STATUSES) as ProductionStatus[];
  const currentStatusIndex = allStatuses.indexOf(currentStatus);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: ProductionStatus): string => {
    const config = PRODUCTION_STATUSES[status];
    return config?.color || 'text-gray-600';
  };

  const getStatusBgColor = (status: ProductionStatus): string => {
    const config = PRODUCTION_STATUSES[status];
    return config?.bgColor || 'bg-gray-100';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Statut Actuel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600 mb-1">Statut Actuel</p>
            <ProductionStatusBadge status={currentStatus} size="lg" showIcon />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600 mb-1">Module Responsable</p>
            <p className="text-sm font-semibold text-gray-900">
              {getModuleResponsibilityMessage(currentStatus).replace('Ce statut est géré par le module: ', '')}
            </p>
          </div>
        </div>

        {/* Message d'information */}
        <div className="mt-3 flex items-start gap-2 bg-blue-100 border border-blue-300 rounded p-2">
          <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-900">
            {getModuleResponsibilityMessage(currentStatus)}
          </p>
        </div>
      </div>

      {/* Ligne de Workflow Visuelle */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-gray-900 mb-3">Progression du Workflow</h4>
        <div className="flex items-center justify-between">
          {allStatuses.slice(0, 6).map((status, index) => {
            const isPast = index <= currentStatusIndex;
            const isCurrent = status === currentStatus;
            const config = PRODUCTION_STATUSES[status];

            return (
              <div key={status} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${isPast ? getStatusBgColor(status) : 'bg-gray-100'}
                      ${isCurrent ? 'ring-4 ring-blue-300' : ''}
                      transition-all
                    `}
                  >
                    {isPast ? (
                      <CheckCircle className={`w-5 h-5 ${getStatusColor(status)}`} />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <p
                    className={`
                      text-[9px] text-center mt-1 max-w-[60px]
                      ${isPast ? 'font-semibold text-gray-900' : 'text-gray-500'}
                    `}
                  >
                    {config?.label || status}
                  </p>
                </div>
                {index < allStatuses.slice(0, 6).length - 1 && (
                  <div
                    className={`
                      h-0.5 w-12 mx-1
                      ${index < currentStatusIndex ? 'bg-blue-500' : 'bg-gray-300'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Historique des Changements */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <h4 className="text-xs font-semibold text-gray-900">
            Historique des Changements ({sortedHistory.length})
          </h4>
        </div>

        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {sortedHistory.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">
              Aucun changement enregistré
            </div>
          ) : (
            sortedHistory.map((entry, index) => {
              const isLatest = index === sortedHistory.length - 1;

              return (
                <div
                  key={entry.id}
                  className={`p-3 ${isLatest ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.old_status && (
                          <>
                            <ProductionStatusBadge
                              status={entry.old_status as ProductionStatus}
                              size="sm"
                            />
                            <span className="text-gray-400">→</span>
                          </>
                        )}
                        <ProductionStatusBadge
                          status={entry.new_status as ProductionStatus}
                          size="sm"
                          showIcon
                        />
                        {isLatest && (
                          <span className="text-[9px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                            ACTUEL
                          </span>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded border border-gray-200">
                          {entry.notes}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-gray-500">
                        {formatDate(entry.changed_at)}
                      </p>
                      {entry.user_email && (
                        <p className="text-[10px] text-gray-700 font-medium mt-0.5">
                          {entry.user_email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
