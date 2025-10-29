import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, Package, FileText } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import TextArea from '@/components/ui/TextArea';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { supabase } from '@/lib/supabase';
import { approveBatchForTransport } from '@/services/batchApprovalService';
import { useAlert } from '@/hooks/useAlert';

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  metal_type: string;
  shipping_date: string;
  comments?: string;
  created_at: string;
  origin_site: { name: string };
  created_by_user: { full_name: string };
}

export function BatchApprovalFactory() {
  const navigate = useNavigate();
  const alert = useAlert();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    fetchPendingBatches();
  }, []);

  async function fetchPendingBatches() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          origin_site:sites!batches_origin_site_id_fkey(name),
          created_by_user:user_profiles!batches_created_by_fkey(full_name)
        `)
        .eq('status', 'pending_factory_approval')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching batches:', error);
      } else {
        setBatches(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleApproveClick(batch: Batch) {
    setSelectedBatch(batch);
    setApprovalComments('');
    setShowApprovalModal(true);
  }

  async function handleConfirmApproval() {
    if (!selectedBatch) return;

    setIsApproving(true);
    try {
      const result = await approveBatchForTransport(
        selectedBatch.id,
        approvalComments || undefined
      );

      if (result.success) {
        setShowApprovalModal(false);
        setSelectedBatch(null);
        setApprovalComments('');
        await fetchPendingBatches();

        alert.success(`Batch ${selectedBatch.batch_number} approved successfully!`);
      } else {
        alert.error('Error approving batch: ' + (result.error as any)?.message);
      }
    } catch (error: any) {
      console.error('Error approving batch:', error);
      alert.error('Error: ' + error.message);
    } finally {
      setIsApproving(false);
    }
  }

  function handleViewBatch(batchId: string) {
    navigate(`/batches/${batchId}`);
  }

  const pendingCount = batches.length;
  const totalWeight = batches.reduce((sum, b) => sum + b.weight_ounces, 0);

  const metrics = [
    {
      title: 'Pending Approval',
      value: pendingCount.toString(),
      change: 'Awaiting factory approval',
      changeType: 'neutral' as const,
      icon: Clock,
      iconColor: 'text-orange-500'
    },
    {
      title: 'Total Weight',
      value: `${totalWeight.toFixed(2)} oz`,
      change: 'Pending batches',
      changeType: 'neutral' as const,
      icon: Package,
      iconColor: 'text-primary-500'
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Factory Batch Approvals
            </h1>
            <p className="text-gray-600 mt-1">
              Approve batches for transport to airport
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} {...metric} />
              ))}
            </div>

            {batches.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No pending approvals</p>
                    <p className="text-sm text-gray-400 mt-2">
                      All batches have been approved or are in transit
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    Pending Approvals ({pendingCount})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {batches.map((batch) => (
                      <div
                        key={batch.id}
                        className="flex items-start justify-between p-4 border-2 border-orange-200 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 text-lg">
                              {batch.batch_number}
                            </h3>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-200 text-orange-800">
                              Pending Approval
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                            <div>
                              <p className="font-medium">Weight:</p>
                              <p>{batch.weight_grams.toLocaleString()}g ({batch.weight_ounces.toFixed(2)} oz)</p>
                            </div>
                            <div>
                              <p className="font-medium">Metal Type:</p>
                              <p className="capitalize">{batch.metal_type}</p>
                            </div>
                            <div>
                              <p className="font-medium">Origin Site:</p>
                              <p>{batch.origin_site.name}</p>
                            </div>
                            <div>
                              <p className="font-medium">Shipping Date:</p>
                              <p>{new Date(batch.shipping_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="font-medium">Created By:</p>
                              <p>{batch.created_by_user.full_name}</p>
                            </div>
                            <div>
                              <p className="font-medium">Created At:</p>
                              <p>{new Date(batch.created_at).toLocaleString()}</p>
                            </div>
                          </div>

                          {batch.comments && (
                            <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                              <p className="text-xs font-medium text-gray-600 mb-1">Comments:</p>
                              <p className="text-sm text-gray-700">{batch.comments}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            variant="primary"
                            onClick={() => handleApproveClick(batch)}
                            className="gap-2 whitespace-nowrap"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve for Transport
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleViewBatch(batch.id)}
                            className="gap-2 whitespace-nowrap"
                          >
                            <FileText className="w-4 h-4" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={showApprovalModal}
        onClose={() => !isApproving && setShowApprovalModal(false)}
      >
        <ModalHeader onClose={() => !isApproving && setShowApprovalModal(false)}>
          Approve Batch for Transport
        </ModalHeader>
        <ModalBody>
          {selectedBatch && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Batch Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Batch Number:</span>
                    <span className="font-semibold">{selectedBatch.batch_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weight:</span>
                    <span className="font-semibold">
                      {selectedBatch.weight_grams.toLocaleString()}g ({selectedBatch.weight_ounces.toFixed(2)} oz)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Metal Type:</span>
                    <span className="font-semibold capitalize">{selectedBatch.metal_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping Date:</span>
                    <span className="font-semibold">
                      {new Date(selectedBatch.shipping_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approval Comments (Optional)
                </label>
                <TextArea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder="Add any comments about this approval..."
                  rows={4}
                  disabled={isApproving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  These comments will be recorded in the batch approval history
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Once approved, the batch cannot be modified</li>
                      <li>The batch will be ready for transport to the airport</li>
                      <li>Status will change to "Approved for Transport"</li>
                      <li>This action will be logged in the audit trail</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setShowApprovalModal(false)}
            disabled={isApproving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmApproval}
            loading={isApproving}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm Approval
          </Button>
        </ModalFooter>
      </Modal>
    </MainLayout>
  );
}
