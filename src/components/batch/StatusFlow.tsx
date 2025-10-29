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
  // Normalize status to lowercase and handle variations
  const normalizedStatus = dbStatus?.toLowerCase().trim();

  const statusMap: Record<string, BatchStatus> = {
    'pending_factory_approval': 'created',
    'approved_for_transport': 'validated',
    'waiting_airport_receipt': 'validated',
    'received_at_airport': 'airport',
    'validated_for_refinery': 'airport',
    'waiting_refinery_receipt': 'airport',
    'received_at_refinery': 'refinery',
    'validated_for_processing': 'refinery',
    'processing': 'processed',
    'in_inventory': 'processed',
    'ready_for_sale': 'approved',
    'allocated_to_sale': 'sell',
    'sold': 'paid',
    'cancelled': 'created',
  };

  const mapped = statusMap[normalizedStatus];

  // Debug log to help troubleshoot
  if (!mapped) {
    console.warn('StatusFlow: Unknown status:', dbStatus, '| Normalized:', normalizedStatus);
  }

  return mapped || 'created';
}

export function StatusFlow({ currentStatus, completedSteps = [], className }: StatusFlowProps) {
  const mappedStatus = mapDatabaseStatusToFlowStatus(currentStatus);
  const currentIndex = statusSteps.findIndex((step) => step.status === mappedStatus);

  // Debug log
  console.log('StatusFlow Debug:', {
    currentStatus,
    mappedStatus,
    currentIndex,
    statusSteps: statusSteps.map(s => s.status)
  });

  const isStepCompleted = (index: number, status: BatchStatus) => {
    // A step is completed if it's before or at the current step
    const completed = index <= currentIndex || completedSteps.includes(status);
    return completed;
  };

  const isStepCurrent = (status: BatchStatus) => {
    const isCurrent = status === mappedStatus;
    return isCurrent;
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
            const isPastStep = index < currentIndex;

            return (
              <div key={step.status} className="flex flex-col items-center" style={{ width: '12.5%' }}>
                <div
                  className={cn(
                    'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 bg-white',
                    isPastStep && 'border-primary-500 bg-primary-500',
                    current && !isPastStep && 'border-primary-500 bg-primary-500 ring-4 ring-primary-200',
                    !completed && 'border-gray-300'
                  )}
                >
                  {completed ? (
                    <Check className="h-5 w-5 text-white" />
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
