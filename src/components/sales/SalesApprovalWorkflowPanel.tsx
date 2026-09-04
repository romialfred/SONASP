import { FileText, CheckCircle, Clock, AlertCircle, DollarSign, XCircle, Package } from 'lucide-react';

interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  icon: any;
  status: 'completed' | 'current' | 'pending' | 'rejected';
}

interface SalesApprovalWorkflowPanelProps {
  currentStatus: string;
  className?: string;
}

export function SalesApprovalWorkflowPanel({ currentStatus, className = '' }: SalesApprovalWorkflowPanelProps) {
  const getWorkflowSteps = (): WorkflowStep[] => {
    const statusOrder = [
      'create_sales',
      'pending_approval',
      'customer_approved',
      'waiting_for_payment',
      'virtual_payment',
      'payment_received',
      'completed'
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    const isRejected = currentStatus === 'customer_rejected';

    return [
      {
        id: 'create_sales',
        label: 'Création de la vente',
        description: 'Vente enregistrée',
        icon: FileText,
        status: currentIndex >= 0 ? 'completed' : 'pending'
      },
      {
        id: 'pending_approval',
        label: 'En attente d’approbation',
        description: 'Validation de la direction requise',
        icon: Clock,
        status: isRejected ? 'rejected' :
                currentIndex === 1 ? 'current' :
                currentIndex > 1 ? 'completed' : 'pending'
      },
      {
        id: 'customer_approved',
        label: 'Approuvée par la direction',
        description: 'Validation accordée et client informé',
        icon: CheckCircle,
        status: isRejected ? 'rejected' :
                currentIndex === 2 ? 'current' :
                currentIndex > 2 ? 'completed' : 'pending'
      },
      {
        id: 'waiting_for_payment',
        label: 'Confirmation du client',
        description: 'Engagement de paiement confirmé par le client',
        icon: AlertCircle,
        status: isRejected ? 'rejected' :
                currentIndex === 3 ? 'current' :
                currentIndex > 3 ? 'completed' : 'pending'
      },
      {
        id: 'virtual_payment',
        label: 'Engagement de paiement',
        description: 'Écriture d’engagement créée automatiquement',
        icon: Package,
        status: isRejected ? 'rejected' :
                currentIndex === 4 ? 'current' :
                currentIndex > 4 ? 'completed' : 'pending'
      },
      {
        id: 'payment_received',
        label: 'Paiement reçu',
        description: 'Encaissement confirmé',
        icon: DollarSign,
        status: isRejected ? 'rejected' :
                currentIndex === 5 ? 'current' :
                currentIndex > 5 ? 'completed' : 'pending'
      },
      {
        id: 'completed',
        label: 'Terminée',
        description: 'Vente finalisée',
        icon: CheckCircle,
        status: isRejected ? 'rejected' :
                currentIndex === 6 ? 'completed' : 'pending'
      }
    ];
  };

  const steps = getWorkflowSteps();
  const isRejected = currentStatus === 'customer_rejected';

  const getStepStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-emerald-50 border-emerald-200',
          icon: 'text-emerald-600 bg-emerald-100',
          text: 'text-emerald-900',
          desc: 'text-emerald-700',
          connector: 'bg-emerald-300'
        };
      case 'current':
        return {
          bg: 'bg-blue-50 border-blue-300 ring-2 ring-blue-100',
          icon: 'text-blue-600 bg-blue-100',
          text: 'text-blue-900 font-semibold',
          desc: 'text-blue-700',
          connector: 'bg-gray-200'
        };
      case 'rejected':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: 'text-red-600 bg-red-100',
          text: 'text-red-900',
          desc: 'text-red-700',
          connector: 'bg-red-200'
        };
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          icon: 'text-gray-400 bg-gray-100',
          text: 'text-gray-600',
          desc: 'text-gray-500',
          connector: 'bg-gray-200'
        };
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-gray-900">
              Progression du circuit de vente
            </h2>
            <p className="text-sm text-gray-600">Suivi des étapes d’approbation et de règlement</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {isRejected && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Vente rejetée</p>
              <p className="text-sm text-red-700 mt-1">
                Cette vente a été rejetée par la direction ou par le client.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const styles = getStepStyles(step.status);
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative">
                <div className={`rounded-lg border p-4 transition-all ${styles.bg}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${styles.icon}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${styles.text}`}>
                        {step.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${styles.desc}`}>
                        {step.description}
                      </p>
                      {step.status === 'current' && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                            En cours
                          </span>
                        </div>
                      )}
                    </div>
                    {step.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    )}
                  </div>
                </div>

                {!isLast && (
                  <div className="relative flex justify-center">
                    <div className={`w-0.5 h-3 ${styles.connector}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-100 rounded-full border border-emerald-300" />
              <span className="text-gray-600">Terminée</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 rounded-full border-2 border-blue-300" />
              <span className="text-gray-600">Étape actuelle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded-full border border-gray-300" />
              <span className="text-gray-600">En attente</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
