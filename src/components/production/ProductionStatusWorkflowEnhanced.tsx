import { Check, Clock } from 'lucide-react';
import { ProductionStatus } from '@/constants/productionStatuses';

interface ProductionStatusWorkflowEnhancedProps {
  currentStatus: ProductionStatus;
  statusHistory: Array<{
    id: string;
    old_status: ProductionStatus | null;
    new_status: ProductionStatus;
    changed_at: string;
  }>;
}

const WORKFLOW_STEPS = [
  { key: 'prepared', label: 'Préparé', phase: 'Production' },
  { key: 'ready_for_customs', label: 'Prêt pour la Douane', phase: 'Production → Shipping' },
  { key: 'customs_approved', label: 'Approuvé par la Douane', phase: 'Shipping Preparation' },
  { key: 'ready_for_expedition', label: 'Prêt pour Expédition', phase: 'Shipping Preparation' },
  { key: 'shipped_to_refinery', label: 'Expédié à la Raffinerie', phase: 'Freight & Customs' },
  { key: 'in_refining', label: 'Raffinage Terminé', phase: 'Refinery' },
  { key: 'in_inventory', label: 'En Inventaire', phase: 'Inventory' },
  { key: 'in_sale', label: 'En Vente', phase: 'Sale' },
  { key: 'sold', label: 'Vendu', phase: 'Sale' },
  { key: 'paid', label: 'Payé', phase: 'Sale' },
];

export function ProductionStatusWorkflowEnhanced({
  currentStatus,
  statusHistory,
}: ProductionStatusWorkflowEnhancedProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex(s => s.key === currentStatus);

  // Calculate duration between two dates
  const calculateDuration = (fromDate: string, toDate: string): string => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffMs = to.getTime() - from.getTime();

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}j ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  // Get duration for a specific status
  const getDurationForStatus = (statusKey: string): string | null => {
    const statusIdx = WORKFLOW_STEPS.findIndex(s => s.key === statusKey);
    if (statusIdx === 0) return null;

    const currentEntry = statusHistory.find(h => h.new_status === statusKey);
    const previousStatus = WORKFLOW_STEPS[statusIdx - 1].key;
    const previousEntry = statusHistory.find(h => h.new_status === previousStatus);

    if (currentEntry && previousEntry) {
      return calculateDuration(previousEntry.changed_at, currentEntry.changed_at);
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-gray-50 border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-8 pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Workflow Complet</h2>
          <div className="text-sm text-gray-500 font-medium">
            Étape {currentIndex + 1} / {WORKFLOW_STEPS.length}
          </div>
        </div>

        {/* Steps - 2 rows layout */}
        <div className="space-y-8">
          {/* First row - 5 steps */}
          <div className="relative">
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200" />
            <div
              className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700 ease-out"
              style={{ width: currentIndex <= 4 ? `${(currentIndex / 4) * 100}%` : '100%' }}
            />

            <div className="relative grid grid-cols-5 gap-4">
              {WORKFLOW_STEPS.slice(0, 5).map((step, index) => {
                const isPast = index < currentIndex;
                const isCurrent = step.key === currentStatus;
                const duration = getDurationForStatus(step.key);

                return (
                  <div key={step.key} className="flex flex-col items-center">
                    <div className="relative z-10 mb-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
                          isPast
                            ? 'bg-emerald-500 border-emerald-200 shadow-lg shadow-emerald-500/30'
                            : isCurrent
                            ? 'bg-blue-600 border-blue-200 shadow-xl shadow-blue-600/40 scale-110'
                            : 'bg-white border-gray-300 shadow-sm'
                        }`}
                      >
                        {isPast ? (
                          <Check className="w-6 h-6 text-white" strokeWidth={3} />
                        ) : (
                          <div
                            className={`w-5 h-5 rounded-full ${
                              isCurrent ? 'bg-white' : 'bg-gray-300'
                            }`}
                          />
                        )}
                      </div>
                      {isCurrent && (
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-600 rounded-full animate-ping" />
                      )}
                    </div>

                    <div className="text-center space-y-1">
                      <div
                        className={`text-xs font-semibold transition-colors duration-300 leading-tight ${
                          isCurrent ? 'text-blue-700' : isPast ? 'text-gray-800' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium leading-tight">
                        {step.phase}
                      </div>
                      {duration && (isPast || isCurrent) && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded-full mt-1">
                          <Clock className="w-2.5 h-2.5 text-blue-600" />
                          <span className="text-[10px] font-semibold text-blue-700">{duration}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Second row - 5 steps */}
          <div className="relative">
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200" />
            <div
              className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-700 ease-out"
              style={{
                width: currentIndex > 4 ? `${((currentIndex - 5) / 4) * 100}%` : '0%'
              }}
            />

            <div className="relative grid grid-cols-5 gap-4">
              {WORKFLOW_STEPS.slice(5, 10).map((step, index) => {
                const actualIndex = index + 5;
                const isPast = actualIndex < currentIndex;
                const isCurrent = step.key === currentStatus;
                const duration = getDurationForStatus(step.key);

                return (
                  <div key={step.key} className="flex flex-col items-center">
                    <div className="relative z-10 mb-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
                          isPast
                            ? 'bg-emerald-500 border-emerald-200 shadow-lg shadow-emerald-500/30'
                            : isCurrent
                            ? 'bg-blue-600 border-blue-200 shadow-xl shadow-blue-600/40 scale-110'
                            : 'bg-white border-gray-300 shadow-sm'
                        }`}
                      >
                        {isPast ? (
                          <Check className="w-6 h-6 text-white" strokeWidth={3} />
                        ) : (
                          <div
                            className={`w-5 h-5 rounded-full ${
                              isCurrent ? 'bg-white' : 'bg-gray-300'
                            }`}
                          />
                        )}
                      </div>
                      {isCurrent && (
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-600 rounded-full animate-ping" />
                      )}
                    </div>

                    <div className="text-center space-y-1">
                      <div
                        className={`text-xs font-semibold transition-colors duration-300 leading-tight ${
                          isCurrent ? 'text-blue-700' : isPast ? 'text-gray-800' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium leading-tight">
                        {step.phase}
                      </div>
                      {duration && (isPast || isCurrent) && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded-full mt-1">
                          <Clock className="w-2.5 h-2.5 text-blue-600" />
                          <span className="text-[10px] font-semibold text-blue-700">{duration}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
