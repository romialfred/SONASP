import { Check, Circle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { BATCH_STATUSES } from '@/constants/batchStatuses';

export type BatchStatus =
  | 'created'
  | 'validated'
  | 'airport'
  | 'refinery'
  | 'processed'
  | 'approved'
  | 'sell'
  | 'paid';

export interface StatusFlowProps {
  currentStatus: string;
  completedSteps?: string[];
  className?: string;
}

const statusSteps: { status: BatchStatus; label: string; description: string }[] = [
  { status: 'created', label: 'Created', description: 'Batch registered' },
  { status: 'validated', label: 'Validated', description: 'Ready for transport' },
  { status: 'airport', label: 'Airport', description: 'Received at airport' },
  { status: 'refinery', label: 'Refinery', description: 'Received at refinery' },
  { status: 'processed', label: 'Processed', description: 'Refining completed' },
  { status: 'approved', label: 'Approved', description: 'Ready for sale' },
  { status: 'sell', label: 'Sell', description: 'Sale completed' },
  { status: 'paid', label: 'Paid', description: 'Payment received' },
];

function mapDatabaseStatusToFlowStatus(dbStatus: string): BatchStatus {
  const statusMap: Record<string, BatchStatus> = {
    [BATCH_STATUSES.PENDING_FACTORY_APPROVAL]: 'created',
    [BATCH_STATUSES.APPROVED_FOR_TRANSPORT]: 'validated',
    [BATCH_STATUSES.WAITING_AIRPORT_RECEIPT]: 'validated',
    [BATCH_STATUSES.RECEIVED_AT_AIRPORT]: 'airport',
    [BATCH_STATUSES.VALIDATED_FOR_REFINERY]: 'airport',
    [BATCH_STATUSES.WAITING_REFINERY_RECEIPT]: 'airport',
    [BATCH_STATUSES.RECEIVED_AT_REFINERY]: 'refinery',
    [BATCH_STATUSES.VALIDATED_FOR_PROCESSING]: 'refinery',
    [BATCH_STATUSES.PROCESSING]: 'processed',
    [BATCH_STATUSES.IN_INVENTORY]: 'processed',
    [BATCH_STATUSES.READY_FOR_SALE]: 'approved',
    [BATCH_STATUSES.ALLOCATED_TO_SALE]: 'sell',
    [BATCH_STATUSES.SOLD]: 'paid',
    [BATCH_STATUSES.CANCELLED]: 'created',
  };

  return statusMap[dbStatus] || 'created';
}

export function StatusFlow({ currentStatus, completedSteps = [], className }: StatusFlowProps) {
  const mappedStatus = mapDatabaseStatusToFlowStatus(currentStatus);
  const currentIndex = statusSteps.findIndex((step) => step.status === mappedStatus);

  const isStepCompleted = (index: number, status: BatchStatus) => {
    return index < currentIndex || completedSteps.includes(status);
  };

  const isStepCurrent = (status: BatchStatus) => {
    return status === mappedStatus;
  };

  return (
    <div className={cn('w-full py-6', className)}>
      <div className="relative">
        <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200" />

        <div
          className="absolute top-5 left-0 h-0.5 bg-primary-500 transition-all duration-500"
          style={{
            width: `${(currentIndex / (statusSteps.length - 1)) * 100}%`,
          }}
        />

        <div className="relative flex justify-between">
          {statusSteps.map((step, index) => {
            const completed = isStepCompleted(index, step.status);
            const current = isStepCurrent(step.status);

            return (
              <div key={step.status} className="flex flex-col items-center" style={{ width: '12.5%' }}>
                <div
                  className={cn(
                    'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 bg-white',
                    completed && 'border-primary-500 bg-primary-500',
                    current && 'border-primary-500 bg-primary-100 ring-4 ring-primary-100',
                    !completed && !current && 'border-gray-300'
                  )}
                >
                  {completed ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : current ? (
                    <Circle className="h-5 w-5 text-primary-500 fill-current" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </div>

                <div className="mt-3 text-center">
                  <p
                    className={cn(
                      'text-xs font-medium transition-colors',
                      completed || current ? 'text-gray-900' : 'text-gray-500'
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className={cn(
                      'text-xs mt-0.5 transition-colors',
                      completed || current ? 'text-gray-600' : 'text-gray-400'
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
