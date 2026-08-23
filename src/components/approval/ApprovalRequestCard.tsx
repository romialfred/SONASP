import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import TextArea from '@/components/ui/TextArea';
import { approveRequest, rejectRequest, type ApprovalRequest } from '@/services/approvalService';
import { useAlert } from '@/hooks/useAlert';

interface ApprovalRequestCardProps {
  approval: ApprovalRequest;
  onApproved?: () => void;
  onRejected?: () => void;
}

export function ApprovalRequestCard({ approval, onApproved, onRejected }: ApprovalRequestCardProps) {
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const alert = useAlert();

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      batch_receipt: 'Écart de réception',
      refining_process: 'Raffinage',
      sale: 'Validation de vente',
      sale_approval: 'Validation de vente',
      payment: 'Validation de paiement',
      payment_approval: 'Validation de paiement',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      batch_receipt: 'bg-amber-100 text-amber-800 border-amber-200',
      refining_process: 'bg-blue-100 text-blue-800 border-blue-200',
      sale: 'bg-green-100 text-green-800 border-green-200',
      sale_approval: 'bg-green-100 text-green-800 border-green-200',
      payment: 'bg-purple-100 text-purple-800 border-purple-200',
      payment_approval: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const handleApprove = async () => {
    setProcessing(true);

    try {
      const result = await approveRequest(approval.id);

      if (result.success) {
        alert.success('La décision a été enregistrée.');
        onApproved?.();
      } else {
        alert.error(result.error || "La demande n'a pas pu être approuvée.");
      }
    } catch {
      alert.error("La demande n'a pas pu être approuvée.");
    } finally {
      setProcessing(false);
      setShowApproveModal(false);
    }
  };

  const handleReject = async () => {
    if (rejectionReason.trim().length < 5) {
      alert.warning('Précisez un motif de rejet comportant au moins 5 caractères.');
      return;
    }

    setProcessing(true);

    try {
      const result = await rejectRequest(approval.id, undefined, rejectionReason);

      if (result.success) {
        alert.success('Le rejet a été enregistré.');
        onRejected?.();
      } else {
        alert.error(result.error || "La demande n'a pas pu être rejetée.");
      }
    } catch {
      alert.error("La demande n'a pas pu être rejetée.");
    } finally {
      setProcessing(false);
      setShowRejectModal(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-md border ${getTypeColor(approval.request_type)}`}>
                  {getTypeLabel(approval.request_type)}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {approval.requested_at ? new Date(approval.requested_at).toLocaleDateString('fr-FR') : '—'}
                </span>
              </div>
              <CardTitle className="text-lg">
                {approval.entity_type === 'batch' ? 'Validation du lot requise' : 'Validation requise'}
              </CardTitle>
            </div>
            {approval.status === 'pending' && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                En attente
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {approval.comments && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">{approval.comments}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Demandée par</p>
              <p className="font-medium text-gray-900">{approval.requested_by || 'Système'}</p>
            </div>
            <div>
              <p className="text-gray-600">Référence technique</p>
              <p className="font-medium text-gray-900 font-mono text-xs">
                {approval.entity_id.slice(0, 8)}...
              </p>
            </div>
          </div>

          {approval.status === 'pending' && (
            <div className="flex gap-2 pt-2 border-t border-gray-200">
              <Button
                variant="primary"
                onClick={() => setShowApproveModal(true)}
                className="flex-1 gap-2"
                size="sm"
              >
                <CheckCircle className="w-4 h-4" />
                Approuver
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(true)}
                className="flex-1 gap-2 text-red-600 hover:bg-red-50 border-red-200"
                size="sm"
              >
                <XCircle className="w-4 h-4" />
                Rejeter
              </Button>
            </div>
          )}

          {approval.status === 'approved' && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
              <CheckCircle className="w-4 h-4" />
              <span>
                Approuvée le {approval.approved_at ? new Date(approval.approved_at).toLocaleDateString('fr-FR') : '—'}
              </span>
            </div>
          )}

          {approval.status === 'rejected' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
              <XCircle className="w-4 h-4" />
              <span>Rejetée</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)}>
        <ModalHeader onClose={() => setShowApproveModal(false)}>
          Confirmer l’approbation
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-gray-700">
              Confirmez-vous l’approbation de cette demande « {getTypeLabel(approval.request_type)} » ?
            </p>
            {approval.comments && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900 mb-1">Détails de la demande :</p>
                <p className="text-sm text-gray-700">{approval.comments}</p>
              </div>
            )}
            <p className="text-sm text-gray-600">
              La décision et l’objet métier associé seront mis à jour dans une même transaction.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowApproveModal(false)}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleApprove} loading={processing}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Approuver
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)}>
        <ModalHeader onClose={() => setShowRejectModal(false)}>
          Rejeter la demande
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-gray-700">
              Indiquez le motif précis du rejet :
            </p>
            <TextArea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Motif du rejet…"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
            Annuler
          </Button>
          <Button
            variant="outline"
            onClick={handleReject}
            loading={processing}
            className="text-red-600 hover:bg-red-50 border-red-200"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Rejeter
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
