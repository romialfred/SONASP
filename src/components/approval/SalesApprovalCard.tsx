import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Package, User, Calendar, TrendingUp } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import TextArea from '@/components/ui/TextArea';
import { approveRequest, rejectRequest } from '@/services/approvalService';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { supabase } from '@/lib/supabase';
import { SalesApprovalWorkflowPanel } from '@/components/sales/SalesApprovalWorkflowPanel';

interface SalesApprovalCardProps {
  approval: any;
  onApproved?: () => void;
  onRejected?: () => void;
}

export function SalesApprovalCard({ approval, onApproved, onRejected }: SalesApprovalCardProps) {
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saleDetails, setSaleDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const alert = useAlert();

  useEffect(() => {
    loadSaleDetails();
  }, [approval.entity_id]);

  const loadSaleDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(id, name, email, country),
          seller:mining_companies(id, name)
        `)
        .eq('id', approval.entity_id)
        .maybeSingle();

      if (error) throw error;
      setSaleDetails(data);
    } catch (error) {
      console.error('Error loading sale details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMechanismLabel = (mechanism: string) => {
    const labels: Record<string, string> = {
      spot: 'Spot (2 days)',
      forward_7: 'Forward 7 days',
      forward_7_days: 'Forward 7 days',
      forward_14: 'Forward 14 days',
      forward_14_days: 'Forward 14 days',
    };
    return labels[mechanism?.toLowerCase()] || mechanism || 'Spot';
  };

  const getMechanismDays = (mechanism: string) => {
    const days: Record<string, number> = {
      spot: 2,
      forward_7: 7,
      forward_7_days: 7,
      forward_14: 14,
      forward_14_days: 14,
    };
    return days[mechanism?.toLowerCase()] || 2;
  };

  const handleApprove = async () => {
    setProcessing(true);

    try {
      if (!user?.email) {
        alert.error('User email not found');
        return;
      }

      const result = await approveRequest(approval.id, user.email);

      if (result.success) {
        alert.success('Sale approved successfully! Customer has been notified.');
        onApproved?.();
      } else {
        alert.error('Error approving sale: ' + result.error);
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
      if (!user?.email) {
        alert.error('User email not found');
        return;
      }

      const result = await rejectRequest(approval.id, user.email, rejectionReason);

      if (result.success) {
        alert.success('Sale rejected successfully');
        onRejected?.();
      } else {
        alert.error('Error rejecting sale: ' + result.error);
      }
    } catch (error: any) {
      alert.error('Error: ' + error.message);
    } finally {
      setProcessing(false);
      setShowRejectModal(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 mt-2">Loading sale details...</p>
        </CardContent>
      </Card>
    );
  }

  if (!saleDetails) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-600">Sale not found</p>
        </CardContent>
      </Card>
    );
  }

  const mechanismDays = getMechanismDays(saleDetails.mechanism_type);
  const dueDate = new Date(saleDetails.created_at);
  dueDate.setDate(dueDate.getDate() + mechanismDays);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 text-xs font-semibold rounded-md bg-green-100 text-green-800 border border-green-200">
                  Sale Approval
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  {new Date(approval.requested_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <CardTitle className="text-lg">
                Sale #{saleDetails.sale_number}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Awaiting management approval
              </p>
            </div>
            {approval.status === 'pending' && (
              <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                <Clock className="w-3.5 h-3.5" />
                Pending Review
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Customer & Seller Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</p>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{saleDetails.customer?.name}</p>
                  <p className="text-xs text-gray-600 truncate">{saleDetails.customer?.country}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Seller</p>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Package className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{saleDetails.seller?.name || 'N/A'}</p>
                  <p className="text-xs text-gray-600">Mining Company</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sale Details */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Quantity</p>
                <p className="text-lg font-bold text-gray-900">
                  {saleDetails.quantity_oz?.toFixed(3)} oz
                </p>
                <p className="text-xs text-gray-500">
                  ({(saleDetails.quantity_oz * 31.1034768).toFixed(2)} g)
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Gold Price</p>
                <p className="text-lg font-bold text-gray-900">
                  ${saleDetails.gold_price?.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">per ounce</p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Gross Proceeds</p>
                <p className="text-lg font-semibold text-blue-600">
                  ${saleDetails.gross_proceeds?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Net Proceeds</p>
                <p className="text-lg font-semibold text-emerald-600">
                  ${saleDetails.net_proceeds?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900 text-sm">Payment Terms</p>
                <p className="text-sm text-blue-800 mt-1">
                  <span className="font-medium">{getMechanismLabel(saleDetails.mechanism_type)}</span>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Payment due: {dueDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })} ({mechanismDays} days from creation)
                </p>
              </div>
            </div>
          </div>

          {/* Additional Costs */}
          {(saleDetails.freight_cost > 0 || saleDetails.insurance_cost > 0) && (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-700">Additional Costs:</p>
              <div className="grid grid-cols-2 gap-2">
                {saleDetails.freight_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Freight:</span>
                    <span className="font-medium">${saleDetails.freight_cost.toFixed(2)}</span>
                  </div>
                )}
                {saleDetails.insurance_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Insurance:</span>
                    <span className="font-medium">${saleDetails.insurance_cost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {approval.status === 'pending' && (
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={() => setShowApproveModal(true)}
                  className="flex-1 gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve Sale
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectModal(true)}
                  className="flex-1 gap-2 text-red-600 hover:bg-red-50 border-red-200"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowWorkflowPanel(true)}
                size="sm"
                className="w-full"
              >
                View Workflow Progress
              </Button>
            </div>
          )}

          {approval.status === 'approved' && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-lg border border-green-200">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">
                Approved on {new Date(approval.approved_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Modal */}
      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} size="lg">
        <ModalHeader onClose={() => setShowApproveModal(false)}>
          Confirm Sale Approval
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">
                You are about to approve:
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Sale #{saleDetails.sale_number}</li>
                <li>• Customer: {saleDetails.customer?.name}</li>
                <li>• Quantity: {saleDetails.quantity_oz?.toFixed(3)} oz</li>
                <li>• Net Proceeds: ${saleDetails.net_proceeds?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</li>
                <li>• Payment Terms: {getMechanismLabel(saleDetails.mechanism_type)}</li>
              </ul>
            </div>

            <p className="text-sm text-gray-700">
              After approval:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 pl-4">
              <li>✓ Sale status will change to "Customer Approved"</li>
              <li>✓ Customer will receive an email notification</li>
              <li>✓ Customer must confirm payment commitment to proceed</li>
            </ul>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowApproveModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApprove} loading={processing}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve Sale
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)}>
        <ModalHeader onClose={() => setShowRejectModal(false)}>
          Reject Sale
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Please provide a reason for rejecting this sale:
            </p>
            <TextArea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Enter rejection reason..."
            />
            <p className="text-xs text-gray-600">
              The customer and sales team will be notified of this rejection.
            </p>
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
            Reject Sale
          </Button>
        </ModalFooter>
      </Modal>

      {/* Workflow Panel Modal */}
      <Modal isOpen={showWorkflowPanel} onClose={() => setShowWorkflowPanel(false)} size="lg">
        <ModalHeader onClose={() => setShowWorkflowPanel(false)}>
          Sales Workflow Progress
        </ModalHeader>
        <ModalBody>
          <SalesApprovalWorkflowPanel currentStatus={saleDetails.status} />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowWorkflowPanel(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
