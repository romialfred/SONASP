import { CheckCircle, Clock, XCircle, DollarSign, Send, FileCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface WorkflowStep {
  status: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    status: 'pending',
    label: 'En attente d’approbation',
    description: 'Validation de la direction requise',
    icon: Clock
  },
  {
    status: 'approved',
    label: 'Approuvée par la direction',
    description: 'Vente validée par la direction',
    icon: CheckCircle
  },
  {
    status: 'customer_approved',
    label: 'Approuvée par le client',
    description: 'Vente acceptée par le client',
    icon: CheckCircle
  },
  {
    status: 'payment_received',
    label: 'Paiement reçu',
    description: 'Encaissement confirmé',
    icon: DollarSign
  },
  {
    status: 'completed',
    label: 'Terminée',
    description: 'Vente finalisée',
    icon: Send
  }
];

interface SalesWorkflowProgressPanelProps {
  currentStatus: string;
  className?: string;
}

export function SalesWorkflowProgressPanel({
  currentStatus,
  className = ''
}: SalesWorkflowProgressPanelProps) {
  const getCurrentStepIndex = () => {
    return WORKFLOW_STEPS.findIndex(step => step.status === currentStatus);
  };

  const isCompleted = (stepIndex: number) => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex === -1) return false;
    return currentIndex > stepIndex;
  };

  const isCurrent = (stepStatus: string) => {
    return stepStatus === currentStatus;
  };

  const isRejected = currentStatus === 'rejected' || currentStatus === 'customer_rejected';
  const currentStepIndex = getCurrentStepIndex();

  return (
    <Card className={`border-2 border-gray-200 ${className}`}>
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <CardTitle className="text-base flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-blue-600" />
          Progression du circuit de vente
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            const completed = isCompleted(index);
            const current = isCurrent(step.status);

            return (
              <div key={step.status} className="relative">
                {/* Connecting line */}
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div
                    className={`absolute left-5 top-10 w-0.5 h-8 ${
                      completed || (current && index < currentStepIndex)
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`}
                  />
                )}

                {/* Step content */}
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : current
                        ? 'bg-yellow-100 border-yellow-500 text-yellow-700 ring-4 ring-yellow-100'
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                    }`}
                  >
                    {completed ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 pt-1">
                    <p
                      className={`text-sm font-semibold ${
                        completed || current ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        completed || current ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    >
                      {step.description}
                    </p>
                    {current && (
                      <div className="mt-1 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                        <span className="text-xs text-yellow-700 font-medium">
                          Étape actuelle
                        </span>
                      </div>
                    )}
                    {completed && (
                      <div className="mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">
                          Terminée
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Rejected status (if applicable) */}
          {isRejected && (
            <div className="relative mt-4 pt-4 border-t border-red-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-red-500 border-red-500 text-white">
                  <XCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-semibold text-red-900">Rejetée</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    La vente a été rejetée.
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <span className="text-xs text-red-700 font-medium">
                      Étape actuelle
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress summary */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Progression</span>
            <span className="font-semibold text-gray-900">
              {isRejected ? (
                <span className="text-red-600">Rejetée</span>
              ) : (
                <>
                  {currentStepIndex + 1} / {WORKFLOW_STEPS.length}
                </>
              )}
            </span>
          </div>
          {!isRejected && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all duration-500 ease-out"
                style={{
                  width: `${((currentStepIndex + 1) / WORKFLOW_STEPS.length) * 100}%`
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
