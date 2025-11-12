import { useState } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { TextArea } from './TextArea';

interface RejectCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  certificateName?: string;
  isSubmitting?: boolean;
}

export function RejectCertificateModal({
  isOpen,
  onClose,
  onConfirm,
  certificateName,
  isSubmitting = false,
}: RejectCertificateModalProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!rejectionReason.trim()) {
      setError('Veuillez fournir une raison pour le rejet');
      return;
    }

    if (rejectionReason.trim().length < 10) {
      setError('La raison doit contenir au moins 10 caractères');
      return;
    }

    onConfirm(rejectionReason.trim());
    setRejectionReason('');
    setError('');
  };

  const handleClose = () => {
    setRejectionReason('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Rejeter le Certificat"
      size="md"
    >
      <div className="space-y-6 p-2">
        {/* Warning Banner */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">
                Action Irréversible
              </h3>
              <p className="text-sm text-red-700">
                Vous êtes sur le point de rejeter ce certificat d'assay. Cette action sera enregistrée dans l'historique d'audit.
              </p>
            </div>
          </div>
        </div>

        {/* Certificate Name */}
        {certificateName && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Certificat</p>
            <p className="text-sm font-semibold text-gray-900">{certificateName}</p>
          </div>
        )}

        {/* Rejection Reason Input */}
        <div className="pt-1">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Raison du Rejet <span className="text-red-500">*</span>
          </label>
          <TextArea
            value={rejectionReason}
            onChange={(e) => {
              setRejectionReason(e.target.value);
              setError('');
            }}
            placeholder="Veuillez expliquer pourquoi vous rejetez ce certificat (minimum 10 caractères)..."
            rows={5}
            className={`w-full ${error ? 'border-red-300 focus:border-red-500' : ''}`}
            disabled={isSubmitting}
          />
          {error && (
            <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
              <XCircle className="w-4 h-4" />
              {error}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-500">
            {rejectionReason.length} / 500 caractères
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end pt-6 mt-2 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            size="lg"
            className="px-6"
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || !rejectionReason.trim()}
            loading={isSubmitting}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white px-6"
          >
            <XCircle className="w-5 h-5 mr-2" />
            Confirmer le Rejet
          </Button>
        </div>
      </div>
    </Modal>
  );
}
