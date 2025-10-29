import { useState } from 'react';
import { Check, Circle, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { BATCH_STATUSES, BATCH_STATUS_LABELS } from '@/constants/batchStatuses';

export interface StatusHistoryItem {
  status: string;
  changed_at: string;
  changed_by?: string;
  user_name?: string;
  user_role?: string;
  comments?: string;
}

export interface StatusFlowProps {
  currentStatus: string;
  statusHistory?: StatusHistoryItem[];
  className?: string;
}

interface FlowStep {
  dbStatus: string;
  label: string;
  shortLabel: string;
  description: string;
  group: 'factory' | 'transport' | 'airport' | 'refinery' | 'sales' | 'completed';
}

const flowSteps: FlowStep[] = [
  {
    dbStatus: BATCH_STATUSES.PENDING_FACTORY_APPROVAL,
    label: 'Created',
    shortLabel: 'Created',
    description: 'Batch registered',
    group: 'factory',
  },
  {
    dbStatus: BATCH_STATUSES.APPROVED_FOR_TRANSPORT,
    label: 'Validated',
    shortLabel: 'Validated',
    description: 'Ready for transport',
    group: 'factory',
  },
  {
    dbStatus: BATCH_STATUSES.WAITING_AIRPORT_RECEIPT,
    label: 'In Transit',
    shortLabel: 'To Airport',
    description: 'En route to airport',
    group: 'transport',
  },
  {
    dbStatus: BATCH_STATUSES.RECEIVED_AT_AIRPORT,
    label: 'Airport',
    shortLabel: 'Airport',
    description: 'Received at airport',
    group: 'airport',
  },
  {
    dbStatus: BATCH_STATUSES.VALIDATED_FOR_REFINERY,
    label: 'Airport OK',
    shortLabel: 'Validated',
    description: 'Airport validated',
    group: 'airport',
  },
  {
    dbStatus: BATCH_STATUSES.WAITING_REFINERY_RECEIPT,
    label: 'In Transit',
    shortLabel: 'To Refinery',
    description: 'En route to refinery',
    group: 'transport',
  },
  {
    dbStatus: BATCH_STATUSES.RECEIVED_AT_REFINERY,
    label: 'Refinery',
    shortLabel: 'Refinery',
    description: 'Received at refinery',
    group: 'refinery',
  },
  {
    dbStatus: BATCH_STATUSES.VALIDATED_FOR_PROCESSING,
    label: 'Refinery OK',
    shortLabel: 'Validated',
    description: 'Ready for processing',
    group: 'refinery',
  },
  {
    dbStatus: BATCH_STATUSES.PROCESSING,
    label: 'Processing',
    shortLabel: 'Processing',
    description: 'Refining in progress',
    group: 'refinery',
  },
  {
    dbStatus: BATCH_STATUSES.IN_INVENTORY,
    label: 'Inventory',
    shortLabel: 'Inventory',
    description: 'In inventory',
    group: 'refinery',
  },
  {
    dbStatus: BATCH_STATUSES.READY_FOR_SALE,
    label: 'Ready',
    shortLabel: 'Ready',
    description: 'Ready for sale',
    group: 'sales',
  },
  {
    dbStatus: BATCH_STATUSES.ALLOCATED_TO_SALE,
    label: 'Allocated',
    shortLabel: 'Allocated',
    description: 'Sale allocated',
    group: 'sales',
  },
  {
    dbStatus: BATCH_STATUSES.SOLD,
    label: 'Sold',
    shortLabel: 'Sold',
    description: 'Sale completed',
    group: 'completed',
  },
];

const groupColors = {
  factory: '#3b82f6',
  transport: '#8b5cf6',
  airport: '#f59e0b',
  refinery: '#ec4899',
  sales: '#10b981',
  completed: '#16a34a',
};

export function StatusFlow({ currentStatus, statusHistory = [], className }: StatusFlowProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const currentIndex = flowSteps.findIndex((step) => step.dbStatus === currentStatus);

  const getStepHistory = (dbStatus: string): StatusHistoryItem | undefined => {
    return statusHistory.find((item) => item.status === dbStatus);
  };

  const isStepCompleted = (index: number) => {
    return index <= currentIndex;
  };

  const isStepCurrent = (index: number) => {
    return index === currentIndex;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className={cn('w-full py-8 px-4', className)}>
      <div className="relative">
        {/* Progress line background */}
        <div className="absolute top-6 left-0 w-full h-1 bg-gray-200 rounded-full" />

        {/* Progress line filled */}
        <div
          className="absolute top-6 left-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full transition-all duration-700 ease-out"
          style={{
            width: currentIndex >= 0 ? `${(currentIndex / (flowSteps.length - 1)) * 100}%` : '0%',
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between items-start">
          {flowSteps.map((step, index) => {
            const completed = isStepCompleted(index);
            const current = isStepCurrent(index);
            const isPastStep = index < currentIndex;
            const stepHistory = getStepHistory(step.dbStatus);
            const hasHistory = !!stepHistory;
            const groupColor = groupColors[step.group];

            return (
              <div
                key={step.dbStatus}
                className="flex flex-col items-center relative"
                style={{ width: `${100 / flowSteps.length}%` }}
                onMouseEnter={() => setHoveredStep(index)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                {/* Step circle */}
                <div
                  className={cn(
                    'relative z-10 w-12 h-12 rounded-full border-3 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-sm',
                    isPastStep && 'border-gray-400 bg-gray-400',
                    current && 'border-4 ring-4 shadow-lg scale-110',
                    !completed && !current && 'border-gray-300 bg-white',
                    hasHistory && 'hover:scale-125 hover:shadow-xl'
                  )}
                  style={{
                    borderColor: current ? groupColor : isPastStep ? groupColor : undefined,
                    backgroundColor: current ? groupColor : isPastStep ? groupColor : undefined,
                    ringColor: current ? `${groupColor}40` : undefined,
                  }}
                >
                  {isPastStep ? (
                    <Check className="h-6 w-6 text-white" strokeWidth={3} />
                  ) : current ? (
                    <Clock className="h-6 w-6 text-white animate-pulse" strokeWidth={3} />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                </div>

                {/* Step label */}
                <div className="mt-3 text-center px-1">
                  <p
                    className={cn(
                      'text-xs font-bold transition-colors leading-tight',
                      completed || current ? 'text-gray-900' : 'text-gray-500'
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] mt-0.5 transition-colors',
                      completed || current ? 'text-gray-600' : 'text-gray-400'
                    )}
                  >
                    {step.description}
                  </p>
                </div>

                {/* Tooltip popup on hover */}
                {hoveredStep === index && hasHistory && stepHistory && (
                  <div
                    className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 min-w-[280px] max-w-[320px] animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{ marginTop: '0.5rem' }}
                  >
                    {/* Arrow pointer */}
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45" />

                    <div className="relative space-y-2">
                      {/* Status name */}
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: groupColor }}
                        />
                        <h4 className="font-bold text-sm text-gray-900">
                          {BATCH_STATUS_LABELS[step.dbStatus as keyof typeof BATCH_STATUS_LABELS]}
                        </h4>
                      </div>

                      {/* Date */}
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-gray-500">Date</p>
                          <p className="text-xs font-bold text-gray-900">
                            {formatDate(stepHistory.changed_at)}
                          </p>
                        </div>
                      </div>

                      {/* User info */}
                      {stepHistory.user_name && (
                        <div className="flex items-start gap-2">
                          <div className="h-4 w-4 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-blue-600">
                              {stepHistory.user_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">User</p>
                            <p className="text-xs font-bold text-gray-900">
                              {stepHistory.user_name}
                            </p>
                            {stepHistory.user_role && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {stepHistory.user_role}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Comments */}
                      {stepHistory.comments && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1">Comments</p>
                          <p className="text-xs text-gray-700 leading-relaxed">
                            {stepHistory.comments}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-gray-600">Current</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-gray-300" />
              <span className="text-gray-600">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 italic">Hover over completed steps for details</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
