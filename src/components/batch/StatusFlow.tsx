import { Check, Circle } from 'lucide-react';
import { cn } from '@/utils/cn';

export type BatchStatus =
  | 'created'
  | 'shipped'
  | 'received_airport'
  | 'shipped_refinery'
  | 'received_refinery'
  | 'processing'
  | 'processed'
  | 'approved'
  | 'ready_for_sale';

export interface StatusFlowProps {
  currentStatus: BatchStatus;
  completedSteps?: BatchStatus[];
  className?: string;
}

const statusSteps: { status: BatchStatus; label: string; description: string }[] = [
  { status: 'created', label: 'Created', description: 'Batch registered' },
  { status: 'shipped', label: 'Shipped', description: 'En route to airport' },
  { status: 'received_airport', label: 'Airport', description: 'Received at airport' },
  { status: 'shipped_refinery', label: 'To Refinery', description: 'Shipped to refinery' },
  { status: 'received_refinery', label: 'Refinery', description: 'Received at refinery' },
  { status: 'processing', label: 'Processing', description: 'Refining in progress' },
  { status: 'processed', label: 'Processed', description: 'Refining completed' },
  { status: 'approved', label: 'Approved', description: 'Ready for sale' },
];

export function StatusFlow({ currentStatus, completedSteps = [], className }: StatusFlowProps) {
  const currentIndex = statusSteps.findIndex((step) => step.status === currentStatus);

  const isStepCompleted = (index: number, status: BatchStatus) => {
    return index < currentIndex || completedSteps.includes(status);
  };

  const isStepCurrent = (status: BatchStatus) => {
    return status === currentStatus;
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
