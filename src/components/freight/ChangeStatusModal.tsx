import { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { FreightStatusBadge } from './FreightStatusBadge';
import { freightCustomsService, FreightCustomsOperation, FreightCustomsStatus } from '@/services/freightCustomsService';
import { useNotification } from '@/contexts/NotificationContext';

interface ChangeStatusModalProps {
  operation: FreightCustomsOperation;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangeStatusModal({ operation, onClose, onSuccess }: ChangeStatusModalProps) {
  const { showNotification } = useNotification();
  const [newStatus, setNewStatus] = useState<FreightCustomsStatus>(operation.status);
  const [formData, setFormData] = useState({
    // Customs fields
    customs_office: operation.customs_office || '',
    customs_officer_name: operation.customs_officer_name || '',
    customs_reference_number: operation.customs_reference_number || '',
    customs_approval_date: operation.customs_approval_date || '',

    // Transport fields
    freight_forwarder_contact: operation.freight_forwarder_contact || '',
    estimated_departure_date: operation.estimated_departure_date || '',

    // Shipping fields
    awb_number: operation.awb_number || '',
    tracking_number: operation.tracking_number || '',
    actual_departure_date: operation.actual_departure_date || '',

    notes: operation.notes || ''
  });
  const [saving, setSaving] = useState(false);

  const getAvailableStatuses = (): FreightCustomsStatus[] => {
    const statuses: FreightCustomsStatus[] = [
      'customs_pending',
      'customs_approved',
      'ready_for_transport',
      'shipped_to_refinery'
    ];

    const currentIndex = statuses.indexOf(operation.status);
    return statuses.filter((_, index) => index >= currentIndex);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (newStatus === 'customs_approved') {
      if (!formData.customs_approval_date) {
        showNotification('error', 'La date d\'approbation est requise');
        return;
      }
    }

    if (newStatus === 'shipped_to_refinery') {
      if (!formData.awb_number) {
        showNotification('error', 'Le numéro AWB est requis pour l\'expédition');
        return;
      }
    }

    try {
      setSaving(true);
      await freightCustomsService.updateStatus(operation.id, newStatus, formData);
      onSuccess();
    } catch (error: any) {
      showNotification('error', 'Erreur lors de la mise à jour: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Changer le Statut</h2>
            <p className="text-sm text-gray-600 mt-1">
              Référence: {operation.reference_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Statut actuel et nouveau */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-2">Statut actuel:</p>
                <FreightStatusBadge status={operation.status} />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 mb-2">Nouveau statut:</p>
                <FreightStatusBadge status={newStatus} />
              </div>
            </div>
          </div>

          {/* Sélection du nouveau statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau Statut <span className="text-red-500">*</span>
            </label>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as FreightCustomsStatus)}
              required
            >
              {getAvailableStatuses().map((status) => (
                <option key={status} value={status}>
                  {status === 'customs_pending' && 'En Attente Douane'}
                  {status === 'customs_approved' && 'Approuvé Douane'}
                  {status === 'ready_for_transport' && 'Prêt pour Transport'}
                  {status === 'shipped_to_refinery' && 'Expédié vers Raffinerie'}
                </option>
              ))}
            </Select>
          </div>

          {/* Champs conditionnels selon le statut */}
          {newStatus === 'customs_approved' && (
            <div className="space-y-4 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <h3 className="text-sm font-semibold text-emerald-900">Informations Douanières</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date d'Approbation <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formData.customs_approval_date?.split('T')[0] || ''}
                    onChange={(e) => setFormData({ ...formData, customs_approval_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Référence Douane
                  </label>
                  <Input
                    type="text"
                    value={formData.customs_reference_number}
                    onChange={(e) => setFormData({ ...formData, customs_reference_number: e.target.value })}
                    placeholder="Ex: DOU-2025-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bureau de Douane
                  </label>
                  <Input
                    type="text"
                    value={formData.customs_office}
                    onChange={(e) => setFormData({ ...formData, customs_office: e.target.value })}
                    placeholder="Ex: Bamako Central"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Officier de Douane
                  </label>
                  <Input
                    type="text"
                    value={formData.customs_officer_name}
                    onChange={(e) => setFormData({ ...formData, customs_officer_name: e.target.value })}
                    placeholder="Nom de l'officier"
                  />
                </div>
              </div>
            </div>
          )}

          {newStatus === 'ready_for_transport' && (
            <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900">Informations Transport</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Transitaire
                  </label>
                  <Input
                    type="text"
                    value={formData.freight_forwarder_contact}
                    onChange={(e) => setFormData({ ...formData, freight_forwarder_contact: e.target.value })}
                    placeholder="Nom et contact"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Départ Estimée
                  </label>
                  <Input
                    type="date"
                    value={formData.estimated_departure_date?.split('T')[0] || ''}
                    onChange={(e) => setFormData({ ...formData, estimated_departure_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {newStatus === 'shipped_to_refinery' && (
            <div className="space-y-4 bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="text-sm font-semibold text-purple-900">Informations Expédition</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AWB Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.awb_number}
                    onChange={(e) => setFormData({ ...formData, awb_number: e.target.value })}
                    placeholder="Ex: 123-45678901"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking Number
                  </label>
                  <Input
                    type="text"
                    value={formData.tracking_number}
                    onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                    placeholder="Numéro de suivi"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de Départ Réelle
                </label>
                <Input
                  type="date"
                  value={formData.actual_departure_date?.split('T')[0] || ''}
                  onChange={(e) => setFormData({ ...formData, actual_departure_date: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <TextArea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes ou observations..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? 'Mise à jour...' : 'Mettre à Jour le Statut'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
