import { ArrowRight, Check, Circle, Clock, Package, Truck, FileCheck, Plane, Building2, CheckCircle, Archive, ShoppingCart, DollarSign, CreditCard } from 'lucide-react';
import { ProductionStatus, PRODUCTION_STATUSES } from '@/constants/productionStatuses';

interface ProductionStatusWorkflowEnhancedProps {
  currentStatus: ProductionStatus;
  statusHistory: Array<{
    id: string;
    old_status: ProductionStatus | null;
    new_status: ProductionStatus;
    changed_at: string;
  }>;
  compact?: boolean;
}

// Configuration complète des statuts
const STATUS_CONFIG: Record<string, {
  label: string;
  phase: string;
  icon: any;
  bgColor: string;
  textColor: string;
  description: string;
}> = {
  prepared: {
    label: 'Préparé',
    phase: 'Production',
    icon: Package,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    description: 'Production créée et en attente'
  },
  ready_for_customs: {
    label: 'Prêt pour la Douane',
    phase: 'Production → Shipping',
    icon: FileCheck,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    description: 'Validé pour expédition'
  },
  shipped: {
    label: 'Expédié',
    phase: 'Freight & Customs',
    icon: Plane,
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    description: 'En route vers raffinerie'
  },
  cancelled: {
    label: 'Annulé',
    phase: 'Annulé',
    icon: CheckCircle,
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    description: 'Production annulée'
  }
};

const getStatusConfig = (status: string) => {
  return STATUS_CONFIG[status] || STATUS_CONFIG.prepared;
};

export function ProductionStatusWorkflowEnhanced({
  currentStatus,
  statusHistory,
  compact = false,
}: ProductionStatusWorkflowEnhancedProps) {
  const allStatuses: ProductionStatus[] = ['prepared', 'ready_for_customs', 'shipped'];

  const currentIndex = allStatuses.indexOf(currentStatus);

  // Calculate durations between steps
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

  // Get duration for each status
  const getDurationForStatus = (status: ProductionStatus): string | null => {
    const statusIdx = allStatuses.indexOf(status);
    if (statusIdx === 0) return null;

    const currentEntry = statusHistory.find(h => h.new_status === status);
    const previousStatus = allStatuses[statusIdx - 1];
    const previousEntry = statusHistory.find(h => h.new_status === previousStatus);

    if (currentEntry && previousEntry) {
      return calculateDuration(previousEntry.changed_at, currentEntry.changed_at);
    }
    return null;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Workflow Complet</h2>
        <div className="text-xs text-gray-500">
          Étape {currentIndex + 1}/{allStatuses.length}
        </div>
      </div>

      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute top-[18px] left-0 right-0 h-0.5 bg-gray-200" />
        {/* Progress bar fill */}
        <div
          className="absolute top-[18px] left-0 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${(currentIndex / (allStatuses.length - 1)) * 100}%` }}
        />

        {/* Status steps */}
        <div className="relative flex items-start justify-between">
          {allStatuses.map((status, index) => {
            const config = getStatusConfig(status);
            const Icon = config.icon;
            const isPast = index < currentIndex;
            const isCurrent = status === currentStatus;
            const isFuture = index > currentIndex;
            const duration = getDurationForStatus(status);

            return (
              <div key={status} className="flex flex-col items-center" style={{ flex: 1 }}>
                {/* Icon circle */}
                <div
                  className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isPast
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600'
                      : isCurrent
                      ? `${config.bgColor} border-current ${config.textColor} ring-4 ring-opacity-20`
                      : 'bg-white border-gray-300'
                  }`}
                  style={
                    isCurrent
                      ? { boxShadow: `0 0 0 4px ${config.bgColor.replace('bg-', 'rgba(')}20)` }
                      : undefined
                  }
                >
                  {isPast ? (
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  ) : isCurrent ? (
                    <Circle className="w-3 h-3 fill-current" />
                  ) : (
                    <Icon className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {/* Label and status info */}
                <div className="mt-2 text-center max-w-[100px]">
                  {isCurrent && (
                    <div className="mb-1 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700">
                      ACTUEL
                    </div>
                  )}
                  <div
                    className={`text-[10px] font-semibold leading-tight ${
                      isCurrent
                        ? config.textColor
                        : isPast
                        ? 'text-gray-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {config.label}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">
                    {config.phase}
                  </div>

                  {/* Duration indicator */}
                  {duration && (isPast || isCurrent) && (
                    <div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      <span className="font-medium">{duration}</span>
                    </div>
                  )}
                </div>

                {/* Connector arrow (except for last item) */}
                {index < allStatuses.length - 1 && (
                  <div className="absolute top-[18px] left-1/2 w-full flex items-center justify-center pointer-events-none">
                    <ArrowRight
                      className={`w-3 h-3 ${
                        index < currentIndex ? 'text-emerald-500' : 'text-gray-300'
                      }`}
                      style={{ marginLeft: '50%' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status description */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-start gap-3">
          <div className={`${getStatusConfig(currentStatus).bgColor} rounded-lg p-2`}>
            {(() => {
              const Icon = getStatusConfig(currentStatus).icon;
              return <Icon className={`w-4 h-4 ${getStatusConfig(currentStatus).textColor}`} />;
            })()}
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-900 mb-1">
              Statut Actuel: {getStatusConfig(currentStatus).label}
            </div>
            <div className="text-xs text-gray-600 leading-relaxed">
              {getStatusConfig(currentStatus).description}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
