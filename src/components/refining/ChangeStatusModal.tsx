import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { FreightShipmentStatus } from '@/services/freightShipmentService';

interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newStatus: FreightShipmentStatus, notes: string) => Promise<void>;
  currentStatus: FreightShipmentStatus;
  shipmentReference: string;
  loading?: boolean;
}

const STATUS_TRANSITIONS: Record<FreightShipmentStatus, { next: FreightShipmentStatus[]; labels: Record<FreightShipmentStatus, string> }> = {
  pending: { next: [], labels: {} },
  approved: { next: [], labels: {} },
  shipped_to_refinery: { next: [], labels: {} },
  received_at_refinery: {
    next: ['processing'],
    labels: {
      processing: 'Commencer le Raffinage'
    }
  },
  processing: {
    next: ['processed'],
    labels: {
      processed: 'Marquer comme Raffiné'
    }
  },
  processed: {
    next: ['in_stock'],
    labels: {
      in_stock: 'Mettre en Stock'
    }
  },
  in_stock: { next: [], labels: {} }
};

export function ChangeStatusModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  shipmentReference,
  loading = false
}: ChangeStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<FreightShipmentStatus | null>(null);
  const [notes, setNotes] = useState('');

  const availableTransitions = STATUS_TRANSITIONS[currentStatus]?.next || [];

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

  if (availableTransitions.length === 0) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Changer le Statut">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">
            Expédition: <span className="font-semibold text-gray-900">{shipmentReference}</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nouveau Statut
          </label>
          <div className="space-y-2">
            {availableTransitions.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                  selectedStatus === status
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="font-medium text-gray-900">
                  {STATUS_TRANSITIONS[currentStatus].labels[status]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optionnel)
          </label>
          <TextArea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajoutez des notes sur cette étape du raffinage..."
            rows={4}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedStatus || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Enregistrement...' : 'Confirmer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
