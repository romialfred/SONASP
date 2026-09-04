import { useState, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { FreightStatusBadge } from './FreightStatusBadge';
import {
  freightCustomsService,
  FreightCustomsConflictError,
  type FreightCustomsOperation,
  type FreightTransitionDetails,
} from '@/services/freightCustomsService';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { getFreightTransitionAccess } from '@/lib/freightCustomsAccess';

interface ChangeStatusModalProps {
  operation: FreightCustomsOperation;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangeStatusModal({ operation, onClose, onSuccess }: ChangeStatusModalProps) {
  const { showError } = useNotification();
  const { user } = useAuth();
  const transitionAccess = getFreightTransitionAccess(user, operation);
  const newStatus = transitionAccess.nextStatus;
  const [formData, setFormData] = useState({
    customs_office: operation.customs_office || '',
    customs_officer_name: operation.customs_officer_name || '',
    customs_reference_number: operation.customs_reference_number || '',
    freight_forwarder_contact: operation.freight_forwarder_contact || '',
    awb_number: operation.awb_number || '',
    tracking_number: operation.tracking_number || '',
    notes: operation.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const transitionLock = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (transitionLock.current) return;
    if (!transitionAccess.allowed || !newStatus) {
      showError("Erreur", transitionAccess.reason || "Cette transition n’est pas autorisée.");
      return;
    }
    if (newStatus === 'shipped_to_refinery' && !formData.awb_number.trim()) {
      showError("Erreur", "Un numéro de lettre de transport aérien est obligatoire pour confirmer le départ.");
      return;
    }

    const details: FreightTransitionDetails = { notes: formData.notes.trim() || null };
    if (newStatus === 'customs_approved') {
      details.customs_office = formData.customs_office.trim() || null;
      details.customs_officer_name = formData.customs_officer_name.trim() || null;
      details.customs_reference_number = formData.customs_reference_number.trim() || null;
    } else if (newStatus === 'ready_for_transport') {
      details.freight_forwarder_contact = formData.freight_forwarder_contact.trim() || null;
    } else if (newStatus === 'shipped_to_refinery') {
      details.awb_number = formData.awb_number.trim();
      details.tracking_number = formData.tracking_number.trim() || null;
    }

    try {
      transitionLock.current = true;
      setSaving(true);
      await freightCustomsService.transitionStatus(
        operation.id,
        operation.status,
        newStatus,
        details,
      );
      onSuccess();
    } catch (error) {
      const message = error instanceof FreightCustomsConflictError
        ? error.message
        : error instanceof Error
          ? error.message
          : "La transition du fret a été refusée.";
      showError("Erreur", message);
    } finally {
      transitionLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Confirmer la prochaine étape du circuit</h2>
            <p className="text-sm text-gray-600 mt-1">Référence : {operation.reference_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-2">Statut actuel</p>
                <FreightStatusBadge status={operation.status} />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 mb-2">Prochaine étape autorisée</p>
                {newStatus ? <FreightStatusBadge status={newStatus} /> : <span className="text-sm">État final</span>}
              </div>
            </div>
          </div>

          {!transitionAccess.allowed && (
            <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {transitionAccess.reason}
            </div>
          )}

          {newStatus === 'customs_approved' && (
            <div className="space-y-4 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <h3 className="text-sm font-semibold text-emerald-900">Décision douanière</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="freight-customs-reference" className="block text-sm font-medium text-gray-700 mb-1">Référence douanière</label>
                  <Input
                    id="freight-customs-reference"
                    value={formData.customs_reference_number}
                    onChange={(event) => setFormData({ ...formData, customs_reference_number: event.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="freight-customs-office" className="block text-sm font-medium text-gray-700 mb-1">Bureau de douane</label>
                  <Input
                    id="freight-customs-office"
                    value={formData.customs_office}
                    onChange={(event) => setFormData({ ...formData, customs_office: event.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="freight-customs-officer" className="block text-sm font-medium text-gray-700 mb-1">Agent des douanes</label>
                  <Input
                    id="freight-customs-officer"
                    value={formData.customs_officer_name}
                    onChange={(event) => setFormData({ ...formData, customs_officer_name: event.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-emerald-800">
                Le serveur enregistre la date d’approbation et l’auteur habilité.
              </p>
            </div>
          )}

          {newStatus === 'ready_for_transport' && (
            <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900">Préparation du transport</h3>
              <div>
                <label htmlFor="freight-forwarder-contact" className="block text-sm font-medium text-gray-700 mb-1">Contact du transitaire</label>
                <Input
                  id="freight-forwarder-contact"
                  value={formData.freight_forwarder_contact}
                  onChange={(event) => setFormData({ ...formData, freight_forwarder_contact: event.target.value })}
                />
              </div>
            </div>
          )}

          {newStatus === 'shipped_to_refinery' && (
            <div className="space-y-4 bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="text-sm font-semibold text-purple-900">Confirmation du départ</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="freight-awb-number" className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro de LTA <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="freight-awb-number"
                    value={formData.awb_number}
                    onChange={(event) => setFormData({ ...formData, awb_number: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="freight-tracking-number" className="block text-sm font-medium text-gray-700 mb-1">Numéro de suivi</label>
                  <Input
                    id="freight-tracking-number"
                    value={formData.tracking_number}
                    onChange={(event) => setFormData({ ...formData, tracking_number: event.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-purple-800">
                Le serveur enregistre la date de départ effective et l’auteur habilité.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="freight-transition-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <TextArea
              id="freight-transition-notes"
              value={formData.notes}
              onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
              rows={3}
              maxLength={5000}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
            <Button type="submit" disabled={saving || !transitionAccess.allowed || !newStatus}>
              {saving ? "Confirmation de la transition…" : "Confirmer l’étape suivante"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
