import { useState } from 'react';
import { CheckCircle2, Flame, Archive, ArrowRight, AlertCircle, FileText } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { FreightShipmentStatus } from '@/services/freightShipmentService';

interface RefiningStatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newStatus: FreightShipmentStatus, notes: string) => Promise<void>;
  currentStatus: FreightShipmentStatus;
  shipmentReference: string;
  totalGoldOz?: number;
  totalValueUsd?: number;
  loading?: boolean;
}

interface StatusOption {
  value: FreightShipmentStatus;
  label: string;
  description: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
}

const STATUS_WORKFLOW: Record<FreightShipmentStatus, StatusOption[]> = {
  pending: [],
  approved: [],
  shipped_to_refinery: [],
  received_at_refinery: [
    {
      value: 'processing',
      label: 'Commencer le Raffinage',
      description: 'Démarrer le processus de fonte et raffinage',
      icon: Flame,
      color: 'text-orange-700',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-300'
    }
  ],
  processing: [
    {
      value: 'processed',
      label: 'Marquer comme Raffiné',
      description: 'Le raffinage est terminé avec succès',
      icon: CheckCircle2,
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-300'
    }
  ],
  processed: [
    {
      value: 'in_stock',
      label: 'Mettre en Stock',
      description: 'Transférer l\'or raffiné vers l\'inventaire',
      icon: Archive,
      color: 'text-purple-700',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-300'
    }
  ],
  in_stock: []
};

const STATUS_LABELS: Record<FreightShipmentStatus, string> = {
  pending: 'En Attente',
  approved: 'Approuvé',
  shipped_to_refinery: 'Expédié à la Raffinerie',
  received_at_refinery: 'Reçu à la Raffinerie',
  processing: 'En Cours de Raffinage',
  processed: 'Raffiné',
  in_stock: 'En Stock'
};

export function RefiningStatusChangeModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  shipmentReference,
  totalGoldOz,
  totalValueUsd,
  loading = false
}: RefiningStatusChangeModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<FreightShipmentStatus | null>(null);
  const [notes, setNotes] = useState('');

  const availableOptions = STATUS_WORKFLOW[currentStatus] || [];
  const selectedOption = availableOptions.find(opt => opt.value === selectedStatus);

  const handleSubmit = async () => {
    if (!selectedStatus) return;
    await onConfirm(selectedStatus, notes);
    setNotes('');
    setSelectedStatus(null);
  };

  const handleClose = () => {
    setNotes('');
    setSelectedStatus(null);
    onClose();
  };

  if (availableOptions.length === 0) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="">
      <div className="space-y-6">
        {/* Header avec infos expédition */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Changement de Statut
              </h3>
              <p className="text-sm text-gray-600">
                Expédition: <span className="font-mono font-semibold text-blue-700">{shipmentReference}</span>
              </p>
            </div>
            {totalGoldOz && totalValueUsd && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Quantité</p>
                <p className="text-lg font-bold text-amber-700">{totalGoldOz.toFixed(3)} oz</p>
                <p className="text-xs text-gray-500">${totalValueUsd.toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Workflow visual */}
          <div className="mt-4 flex items-center gap-2">
            <div className="px-3 py-1 bg-white rounded-full border border-blue-300">
              <span className="text-xs font-medium text-gray-700">
                {STATUS_LABELS[currentStatus]}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full">
              <span className="text-xs font-medium">
                {selectedOption ? selectedOption.label : 'Sélectionner...'}
              </span>
            </div>
          </div>
        </div>

        {/* Options de statut */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Sélectionner la prochaine étape
          </label>
          <div className="space-y-3">
            {availableOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedStatus === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedStatus(option.value)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? `${option.borderColor} ${option.bgColor} shadow-md scale-[1.02]`
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                      isSelected ? option.bgColor : 'bg-gray-50'
                    }`}>
                      <Icon className={`w-6 h-6 ${isSelected ? option.color : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${isSelected ? option.color : 'text-gray-900'}`}>
                          {option.label}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className={`w-4 h-4 ${option.color} flex-shrink-0`} />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes avec style amélioré */}
        {selectedStatus && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-gray-600" />
              <label htmlFor="notes" className="text-sm font-semibold text-gray-900">
                Notes et Commentaires
              </label>
              <span className="text-xs text-gray-500">(optionnel)</span>
            </div>
            <TextArea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajoutez des détails sur cette étape: conditions de raffinage, observations, résultats qualité..."
              rows={4}
              className="bg-white"
            />
            <p className="text-xs text-gray-500 mt-2">
              Ces notes seront ajoutées à l'historique et visibles dans les rapports
            </p>
          </div>
        )}

        {/* Alert d'information */}
        {selectedStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Confirmation requise
                </p>
                <p className="text-sm text-blue-700">
                  Cette action mettra à jour le statut de l'expédition et sera enregistrée dans l'historique.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
            className="px-6"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedStatus || loading}
            className={`px-6 ${
              selectedOption
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                : 'bg-gray-400'
            } text-white shadow-md hover:shadow-lg transition-all`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Enregistrement...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmer le Changement
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
