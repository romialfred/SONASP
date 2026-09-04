import { CheckCircle, Clock, XCircle, AlertCircle, DollarSign, Send, FileCheck } from 'lucide-react';
import { SALES_STATUSES } from '@/constants/salesStatuses';

interface WorkflowStep {
  status: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    status: SALES_STATUSES.CREATE_SALES,
    label: 'Création de la vente',
    description: 'Vente enregistrée',
    icon: FileCheck,
    color: 'blue'
  },
  {
    status: SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL,
    label: 'Validation de la direction',
    description: 'Approbation de la direction requise',
    icon: Clock,
    color: 'yellow'
  },
  {
    status: SALES_STATUSES.MANAGEMENT_APPROVED,
    label: 'Approuvée par la direction',
    description: 'Validation accordée par la direction',
    icon: CheckCircle,
    color: 'green'
  },
  {
    status: SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL,
    label: 'Validation du client',
    description: 'Approbation du client requise',
    icon: Clock,
    color: 'blue'
  },
  {
    status: SALES_STATUSES.CUSTOMER_APPROVED,
    label: 'Approuvée par le client',
    description: 'Vente acceptée par le client',
    icon: CheckCircle,
    color: 'green'
  },
  {
    status: SALES_STATUSES.WAITING_FOR_PAYMENT,
    label: 'En attente de paiement',
    description: 'Confirmation de l’encaissement requise',
    icon: Clock,
    color: 'orange'
  },
  {
    status: SALES_STATUSES.VIRTUAL_PAYMENT,
    label: 'Engagement de paiement',
    description: 'Écriture d’engagement créée automatiquement',
    icon: AlertCircle,
    color: 'slate'
  },
  {
    status: SALES_STATUSES.PAYMENT_RECEIVED,
    label: 'Paiement reçu',
    description: 'Encaissement confirmé',
    icon: DollarSign,
    color: 'emerald'
  },
  {
    status: SALES_STATUSES.COMPLETED,
    label: 'Terminée',
    description: 'Vente finalisée',
    icon: Send,
    color: 'gray'
  }
];

const REJECTED_STEPS: WorkflowStep[] = [
  {
    status: SALES_STATUSES.MANAGEMENT_REJECTED,
    label: 'Rejetée par la direction',
    description: 'Refus prononcé par la direction',
    icon: XCircle,
    color: 'red'
  },
  {
    status: SALES_STATUSES.CUSTOMER_REJECTED,
    label: 'Rejetée par le client',
    description: 'Refus prononcé par le client',
    icon: XCircle,
    color: 'red'
  }
];

interface SalesWorkflowVisualizerProps {
  currentStatus: string;
  compact?: boolean;
  showRejected?: boolean;
  className?: string;
}

export function SalesWorkflowVisualizer({
  currentStatus,
  compact = false,
  showRejected = true,
  className = ''
}: SalesWorkflowVisualizerProps) {
  const getCurrentStepIndex = () => {
    return WORKFLOW_STEPS.findIndex(step => step.status === currentStatus);
  };

  const isCompleted = (stepIndex: number) => {
    const currentIndex = getCurrentStepIndex();
    return currentIndex >= stepIndex;
  };

  const isCurrent = (stepStatus: string) => {
    return stepStatus === currentStatus;
  };

  const isRejected = currentStatus === SALES_STATUSES.CUSTOMER_REJECTED || currentStatus === SALES_STATUSES.MANAGEMENT_REJECTED;
  const rejectedStep = REJECTED_STEPS.find(step => step.status === currentStatus);

  const getStepColor = (step: WorkflowStep, stepIndex: number) => {
    if (isCurrent(step.status)) {
      return `border-${step.color}-500 bg-${step.color}-50`;
    }
    if (isCompleted(stepIndex)) {
      return 'border-green-500 bg-green-50';
    }
    return 'border-gray-300 bg-gray-50';
  };

  const getIconColor = (step: WorkflowStep, stepIndex: number) => {
    if (isCurrent(step.status)) {
      return `text-${step.color}-600`;
    }
    if (isCompleted(stepIndex)) {
      return 'text-green-600';
    }
    return 'text-gray-400';
  };

  const getConnectorColor = (stepIndex: number) => {
    if (isCompleted(stepIndex + 1)) {
      return 'bg-green-500';
    }
    return 'bg-gray-300';
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon;
          const currentIndex = getCurrentStepIndex();

          return (
            <div key={step.status} className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center border-2
                  ${currentIndex >= index ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}
                  ${isCurrent(step.status) ? 'ring-2 ring-offset-2 ring-blue-400' : ''}
                `}
                title={step.label}
              >
                <Icon className={`h-4 w-4 ${currentIndex >= index ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${currentIndex >= index + 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main workflow */}
      <div className="relative">
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === WORKFLOW_STEPS.length - 1;

          return (
            <div key={step.status} className="relative">
              <div className="flex items-start gap-4">
                {/* Step indicator */}
                <div className="relative">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all
                      ${getStepColor(step, index)}
                      ${isCurrent(step.status) ? 'ring-4 ring-blue-200 shadow-lg' : ''}
                    `}
                  >
                    <Icon className={`h-6 w-6 ${getIconColor(step, index)}`} />
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 w-0.5 h-12 transition-all ${getConnectorColor(
                        index
                      )}`}
                    />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 pb-12">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`font-semibold ${
                        isCurrent(step.status) ? 'text-blue-900' : isCompleted(index) ? 'text-green-900' : 'text-gray-600'
                      }`}
                    >
                      {step.label}
                    </h3>
                    {isCurrent(step.status) && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        Étape actuelle
                      </span>
                    )}
                    {isCompleted(index) && !isCurrent(step.status) && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rejected path */}
      {showRejected && isRejected && (
        <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900">{rejectedStep?.label || 'Rejetée'}</h3>
              <p className="text-sm text-red-700 mt-1">{rejectedStep?.description || 'Vente rejetée'}</p>
              <p className="text-xs text-red-600 mt-2">
                {currentStatus === SALES_STATUSES.MANAGEMENT_REJECTED
                  ? 'La vente a été rejetée par la direction et doit être révisée avant une nouvelle soumission.'
                  : 'La vente a été rejetée par le client et doit être réexaminée ou annulée.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed indicator */}
      {currentStatus === SALES_STATUSES.COMPLETED && (
        <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">
              Cette vente a franchi avec succès toutes les étapes du circuit de traitement.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
