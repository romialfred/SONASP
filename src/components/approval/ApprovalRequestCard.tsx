import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import TextArea from '@/components/ui/TextArea';
import { approveVariance } from '@/services/receivingValidationService';
import { approveRefining } from '@/services/refiningValidationService';
import { useAlert } from '@/hooks/useAlert';

interface ApprovalRequestCardProps {
  approval: any;
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
      batch_receipt: 'Batch Receipt Variance',
      refining_process: 'Refining Process',
      sale_approval: 'Sale Approval',
      payment_approval: 'Payment Approval',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      batch_receipt: 'bg-amber-100 text-amber-800 border-amber-200',
      refining_process: 'bg-blue-100 text-blue-800 border-blue-200',
      sale_approval: 'bg-green-100 text-green-800 border-green-200',
      payment_approval: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const handleApprove = async () => {
    setProcessing(true);

    try {
      let result;

      if (approval.request_type === 'batch_receipt') {
        result = await approveVariance(approval.entity_id, approval.entity_id);
      } else if (approval.request_type === 'refining_process') {
        result = await approveRefining(approval.entity_id, approval.entity_id);
      } else {
        result = { success: false, error: 'Unknown approval type' };
      }

      if (result.success) {
        onApproved?.();
      } else {
        alert.error('Error approving: ' + result.error);
      }
    } catch (error: any) {
      alert.error('Error: ' + error.message);
    } finally {
      setProcessing(false);
      setShowApproveModal(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert.warning('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);

    try {
      alert.info('Rejection functionality will be implemented');
      onRejected?.();
    } catch (error: any) {
      alert.error('Error: ' + error.message);
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
                  {new Date(approval.requested_at).toLocaleDateString()}
                </span>
              </div>
              <CardTitle className="text-lg">
                {approval.entity_type === 'batch' ? `Batch Approval Required` : 'Approval Required'}
              </CardTitle>
            </div>
            {approval.status === 'pending' && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                Pending
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
              <p className="text-gray-600">Requested by</p>
              <p className="font-medium text-gray-900">{approval.requested_by || 'System'}</p>
            </div>
            <div>
              <p className="text-gray-600">Entity ID</p>
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
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(true)}
                className="flex-1 gap-2 text-red-600 hover:bg-red-50 border-red-200"
                size="sm"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
            </div>
          )}

          {approval.status === 'approved' && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
              <CheckCircle className="w-4 h-4" />
              <span>Approved on {new Date(approval.approved_at).toLocaleDateString()}</span>
            </div>
          )}

          {approval.status === 'rejected' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
              <XCircle className="w-4 h-4" />
              <span>Rejected</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)}>
        <ModalHeader onClose={() => setShowApproveModal(false)}>
          Confirm Approval
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to approve this {getTypeLabel(approval.request_type).toLowerCase()}?
            </p>
            {approval.comments && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900 mb-1">Request Details:</p>
                <p className="text-sm text-gray-700">{approval.comments}</p>
              </div>
            )}
            <p className="text-sm text-gray-600">
              This action will update the batch status and allow it to proceed to the next stage.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowApproveModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApprove} loading={processing}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)}>
        <ModalHeader onClose={() => setShowRejectModal(false)}>
          Reject Request
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-gray-700">
              Please provide a reason for rejecting this request:
            </p>
            <TextArea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Enter rejection reason..."
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleReject}
            loading={processing}
            className="text-red-600 hover:bg-red-50 border-red-200"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
