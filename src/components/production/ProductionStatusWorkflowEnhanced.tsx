import { Check, Circle, Clock, Package, FileCheck, Plane, CheckCircle2, Sparkles, Archive, ShoppingCart, BadgeDollarSign, CreditCard } from 'lucide-react';
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

// Configuration COMPLÈTE du workflow (tous les statuts de bout en bout)
const COMPLETE_WORKFLOW = [
  { key: 'prepared', label: 'Préparé', phase: 'Production', icon: Package },
  { key: 'ready_for_customs', label: 'Prêt pour la Douane', phase: 'Production → Shipping', icon: FileCheck },
  { key: 'customs_approved', label: 'Approuvé par la Douane', phase: 'Shipping Preparation', icon: CheckCircle2 },
  { key: 'ready_for_expedition', label: 'Prêt pour Expédition', phase: 'Shipping Preparation', icon: Package },
  { key: 'shipped', label: 'Expédié', phase: 'Freight & Customs', icon: Plane },
  { key: 'shipped_to_refinery', label: 'Expédié à la Raffinerie', phase: 'Freight & Customs', icon: Plane },
  { key: 'in_refining', label: 'Raffinage Terminé', phase: 'Refinery', icon: Sparkles },
  { key: 'in_inventory', label: 'En Inventaire', phase: 'Inventory', icon: Archive },
  { key: 'in_sale', label: 'En Vente', phase: 'Sale', icon: ShoppingCart },
  { key: 'sold', label: 'Vendu', phase: 'Sale', icon: BadgeDollarSign },
  { key: 'paid', label: 'Payé', phase: 'Sale', icon: CreditCard },
];

export function ProductionStatusWorkflowEnhanced({
  currentStatus,
  statusHistory,
}: ProductionStatusWorkflowEnhancedProps) {
  const currentIndex = COMPLETE_WORKFLOW.findIndex(s => s.key === currentStatus);

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
    const statusIdx = COMPLETE_WORKFLOW.findIndex(s => s.key === statusKey);
    if (statusIdx === 0) return null;

    const currentEntry = statusHistory.find(h => h.new_status === statusKey);
    const previousStatus = COMPLETE_WORKFLOW[statusIdx - 1].key;
    const previousEntry = statusHistory.find(h => h.new_status === previousStatus);

    if (currentEntry && previousEntry) {
      return calculateDuration(previousEntry.changed_at, currentEntry.changed_at);
    }
    return null;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-6 py-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Workflow Complet</h2>
        <div className="text-xs text-gray-500">
          Étape {currentIndex + 1}/{COMPLETE_WORKFLOW.length}
        </div>
      </div>

      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
        {/* Progress bar fill */}
        <div
          className="absolute top-4 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${(currentIndex / (COMPLETE_WORKFLOW.length - 1)) * 100}%` }}
        />

        {/* Status steps - horizontal scroll if needed */}
        <div className="relative flex items-start gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
          {COMPLETE_WORKFLOW.map((status, index) => {
            const Icon = status.icon;
            const isPast = index < currentIndex;
            const isCurrent = status.key === currentStatus;
            const isFuture = index > currentIndex;
            const duration = getDurationForStatus(status.key);

            return (
              <div key={status.key} className="flex flex-col items-center min-w-[85px]">
                {/* Icon circle */}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isPast
                      ? 'bg-emerald-500 border-emerald-600'
                      : isCurrent
                      ? 'bg-blue-500 border-blue-600 ring-4 ring-blue-100'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {isPast ? (
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  ) : isCurrent ? (
                    <Circle className="w-3 h-3 fill-white text-white" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>

                {/* Label */}
                <div className="mt-2 text-center px-1">
                  {isCurrent && (
                    <div className="mb-1 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-blue-500 text-white">
                      ACTUEL
                    </div>
                  )}
                  <div
                    className={`text-[10px] font-semibold leading-tight ${
                      isCurrent
                        ? 'text-blue-700'
                        : isPast
                        ? 'text-gray-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {status.label}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">
                    {status.phase}
                  </div>

                  {/* Duration */}
                  {duration && (isPast || isCurrent) && (
                    <div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-blue-600">
                      <Clock className="w-2.5 h-2.5" />
                      <span className="font-medium">{duration}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
