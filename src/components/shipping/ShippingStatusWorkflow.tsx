import { useState } from 'react';
import { Check, X, Clock, Package, Truck, Building2, TrendingUp, DollarSign, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface ShippingStatusWorkflowProps {
  currentStatus: string;
  onStatusChange: (newStatus: string, notes?: string) => Promise<void>;
  disabled?: boolean;
}

const STATUS_CONFIG = {
  pending: {
    label: 'En Attente',
    color: 'slate',
    icon: Clock,
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
    next: ['prepared', 'cancelled']
  },
  prepared: {
    label: 'Préparée',
    color: 'blue',
    icon: Package,
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    next: ['validated_for_refinery', 'cancelled']
  },
  validated_for_refinery: {
    label: 'Validée pour Raffinerie',
    color: 'amber',
    icon: Check,
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    next: ['in_refining', 'cancelled']
  },
  in_refining: {
    label: 'En Raffinage',
    color: 'orange',
    icon: Building2,
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    next: ['refined', 'cancelled']
  },
  refined: {
    label: 'Raffinée',
    color: 'teal',
    icon: Check,
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-300',
    next: ['in_sale', 'cancelled']
  },
  in_sale: {
    label: 'En Vente',
    color: 'cyan',
    icon: TrendingUp,
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-300',
    next: ['sold', 'cancelled']
  },
  sold: {
    label: 'Vendue',
    color: 'emerald',
    icon: DollarSign,
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    next: []
  },
  cancelled: {
    label: 'Annulée',
    color: 'red',
    icon: XCircle,
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    next: []
  }
};

export function ShippingStatusWorkflow({ currentStatus, onStatusChange, disabled }: ShippingStatusWorkflowProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const currentConfig = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG];
  const CurrentIcon = currentConfig?.icon || Clock;

  const handleStatusClick = (newStatus: string) => {
    setSelectedStatus(newStatus);
    setShowModal(true);
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onStatusChange(selectedStatus, notes);
      setShowModal(false);
      setNotes('');
    } catch (error) {
      console.error('Error changing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  };

  return (
    <>
      <div className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${currentConfig.bgColor} rounded-xl p-3`}>
              <CurrentIcon className={`w-5 h-5 ${currentConfig.textColor}`} />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Statut Actuel</div>
              <div className={`text-lg font-bold ${currentConfig.textColor}`}>
                {currentConfig.label}
              </div>
            </div>
          </div>
        </div>

        {/* Next Possible Actions */}
        {currentConfig.next && currentConfig.next.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Actions Disponibles
            </div>
            <div className="flex flex-wrap gap-2">
              {currentConfig.next.map((nextStatus) => {
                const config = getStatusConfig(nextStatus);
                const Icon = config.icon;
                return (
                  <Button
                    key={nextStatus}
                    onClick={() => handleStatusClick(nextStatus)}
                    disabled={disabled || loading}
                    className={`flex items-center gap-2 ${config.bgColor} ${config.textColor} border ${config.borderColor} hover:shadow-md transition-all`}
                    variant="secondary"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => !loading && setShowModal(false)}
        title="Confirmer le Changement de Statut"
      >
        <div className="space-y-6 p-2">
          {/* New Status Display */}
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
            {selectedStatus && (() => {
              const config = getStatusConfig(selectedStatus);
              const Icon = config.icon;
              return (
                <>
                  <div className={`${config.bgColor} rounded-lg p-3`}>
                    <Icon className={`w-6 h-6 ${config.textColor}`} />
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Nouveau statut</div>
                    <div className={`text-lg font-bold ${config.textColor}`}>
                      {config.label}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Document Verification Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-900 mb-2">
                  Veuillez vérifier les documents ci-dessous :
                </h4>
                <ul className="text-sm text-amber-800 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                    Intention d'Exportation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                    Compagnie de Transport
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                    Autres documents nécessaires
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes (optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ajouter des notes sur ce changement de statut..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowModal(false)}
              disabled={loading}
              className="px-6"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading}
              className="px-6"
            >
              {loading ? 'Traitement...' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
