import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Edit,
  Package,
  MapPin,
  Calendar,
  Weight,
  Building2,
  FileText,
  Truck,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { StatusFlow, StatusHistoryItem } from '@/components/batch/StatusFlow';
import { Timeline, TimelineEvent } from '@/components/batch/Timeline';
import { AssayCertificateUpload } from '@/components/batch/AssayCertificateUpload';
import { AssayCertificatesList } from '@/components/batch/AssayCertificatesList';
import { AssayCertificateViewer } from '@/components/batch/AssayCertificateViewer';
import { Modal } from '@/components/ui/Modal';
import { formatWeight } from '@/utils/batchUtils';
import { supabase } from '@/lib/supabase';
import { getBatchStatusLabel, getBatchStatusVariant, BATCH_STATUSES } from '@/constants/batchStatuses';
import { approveBatchForTransport as legacyApproveBatchForTransport } from '@/services/batchApprovalService';
import { approveBatchForTransport, getBatchStatusHistory } from '@/services/batchTransitionService';
import { useSingleBatchRealtime } from '@/hooks/useBatchRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { canEditBatch, getEditRestrictionReason } from '@/utils/batchPermissions';
import type { AssayCertificate } from '@/services/assayCertificateService';

export function BatchDetails() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const alert = useAlert();
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [approving, setApproving] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<AssayCertificate | null>(null);
  const [certificateRefresh, setCertificateRefresh] = useState(0);
  const [certificatesExpanded, setCertificatesExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);

  // Use Realtime hook for automatic batch updates
  const { batch, loading, refetch } = useSingleBatchRealtime(id);

  useEffect(() => {
    if (id) {
      loadTimeline();
      checkManagerRole();
    }
  }, [id]);

  // Reload timeline when batch status changes
  useEffect(() => {
    if (batch?.status) {
      console.log('📡 Batch status changed to:', batch.status);
      loadTimeline();
    }
  }, [batch?.status]);

  const checkManagerRole = async () => {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const managerRoles = ['factory_manager', 'manager', 'admin', 'management'];
      setIsManager(managerRoles.some(role =>
        profile?.role?.toLowerCase().includes(role)
      ));
    } catch (error) {
      console.error('Error checking manager role:', error);
    }
  };

  const handleApproveBatch = async () => {
    if (!window.confirm('Are you sure you want to approve this batch for transportation?')) {
      return;
    }

    setApproving(true);
    try {
      const result = await approveBatchForTransport(id!, 'Approved by Factory Manager');

      if (result.success) {
        alert.success('Batch approved for transportation successfully!');
        // Wait a bit for DB sync, then refetch
        setTimeout(async () => {
          await Promise.all([
            refetch(),
            loadTimeline()
          ]);
        }, 500);
      } else {
        alert.error(`Failed to approve batch: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Error approving batch:', error);
      alert.error(`Error approving batch: ${error?.message || String(error)}`);
    } finally {
      setApproving(false);
    }
  };

  // Helper function to get formatted batch data
  const getFormattedBatch = () => {
    if (!batch) return null;
    return {
      ...batch,
      mining_company_name: batch.mining_company?.name || 'Unknown',
      mining_company_country: batch.mining_company?.country || 'Unknown',
      mine_transport_name: batch.mine_transport?.name || 'Not assigned',
      airport_transport_name: batch.airport_transport?.name || 'Not assigned',
      refinery_name: batch.refinery?.name || 'Not assigned',
      refinery_location: batch.refinery?.location || 'Unknown',
      created_by: batch.created_by_user?.full_name || 'Unknown',
    };
  };

  const loadTimeline = async () => {
    try {
      console.log('[BatchDetails] Loading timeline for batch:', id);

      const result = await getBatchStatusHistory(id!);

      if (!result.success) {
        console.error('[BatchDetails] Timeline error:', result.error);
        setTimelineEvents([]);
        return;
      }

      console.log('[BatchDetails] Timeline data loaded:', result.data?.length || 0, 'events');

      const events: TimelineEvent[] = (result.data || []).map((item: any, index: number) => ({
        id: item.id,
        title: getStatusTitle(item.status),
        description: item.comments || `Batch status changed to ${item.status}`,
        timestamp: new Date(item.changed_at).toLocaleString(),
        user: item.user?.full_name || 'System',
        icon: getStatusIcon(item.status),
        iconColor: getStatusColor(index),
      }));

      // Map to StatusHistoryItem for StatusFlow component
      const history: StatusHistoryItem[] = (result.data || []).map((item: any) => ({
        status: item.status,
        changed_at: item.changed_at,
        changed_by: item.changed_by,
        user_name: item.user?.full_name || 'System',
        user_role: item.user?.role || 'Unknown',
        comments: item.comments || '',
      }));

      setTimelineEvents(events);
      setStatusHistory(history);
    } catch (error) {
      console.error('[BatchDetails] Error loading timeline:', error);
      setTimelineEvents([]);
    }
  };

  const getStatusTitle = (status: string) => {
    const titles: Record<string, string> = {
      created: 'Batch Created',
      shipped: 'Shipment Initiated',
      received_airport: 'Received at Airport',
      shipped_refinery: 'Shipped to Refinery',
      received_refinery: 'Received at Refinery',
      processing: 'Processing Started',
      processed: 'Processing Completed',
      approved: 'Approved for Sale',
      ready_for_sale: 'Ready for Sale',
    };
    return titles[status] || status;
  };

  const getStatusIcon = (status: string) => {
    if (status.includes('received')) return FileText;
    if (status.includes('shipped')) return Truck;
    if (status.includes('processing') || status.includes('processed')) return Building2;
    return Package;
  };

  const getStatusColor = (index: number) => {
    const colors = ['bg-primary-500', 'bg-accent-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading batch details...</div>
        </div>
      </MainLayout>
    );
  }

  const formattedBatch = getFormattedBatch();

  if (!batch || !formattedBatch) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Batch not found</p>
          <Button onClick={() => navigate('/batches')} className="mt-4">
            Back to Batches
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/batches')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                {formattedBatch.batch_number}
              </h1>
              <p className="text-gray-600 mt-1">Batch Details and Tracking</p>
            </div>
          </div>

          <div className="flex gap-2">
            {formattedBatch.status === BATCH_STATUSES.PENDING_FACTORY_APPROVAL && isManager && (
              <Button
                variant="primary"
                onClick={handleApproveBatch}
                disabled={approving}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {approving ? 'Approving...' : 'Validate for Transportation'}
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              disabled={!canEditBatch(formattedBatch.status, user?.user_metadata?.role)}
              title={!canEditBatch(formattedBatch.status, user?.user_metadata?.role) ? getEditRestrictionReason(formattedBatch.status) : 'Edit batch details'}
            >
              <Edit className="h-4 w-4" />
              Edit Batch
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Batch Status Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusFlow
              currentStatus={formattedBatch.status}
              statusHistory={statusHistory}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Package className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Batch Number</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formattedBatch.batch_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Weight className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Weight</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formatWeight(formattedBatch.weight_grams)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-accent-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Shipping Date</p>
                      <p className="text-base font-semibold text-gray-900">
                        {new Date(formattedBatch.shipping_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Status</p>
                      <StatusBadge
                        label={getBatchStatusLabel(formattedBatch.status)}
                        variant={getBatchStatusVariant(formattedBatch.status)}
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <MapPin className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Mining Company</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formattedBatch.mining_company_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formattedBatch.mining_company_country}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Refinery</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formattedBatch.refinery_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formattedBatch.refinery_location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Truck className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Mine → Airport Transport</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formattedBatch.mine_transport_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Truck className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Airport → Refinery Transport</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formattedBatch.airport_transport_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Package className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Metal Type</p>
                      <p className="text-base font-semibold text-gray-900 capitalize">
                        {formattedBatch.metal_type || 'Gold'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileText className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created By</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formattedBatch.created_by}
                      </p>
                    </div>
                  </div>
                </div>

                {formattedBatch.comments && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">Comments</p>
                    <p className="text-base text-gray-900">{formattedBatch.comments}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL */}
          <div className="space-y-6">
            {/* Assay Certificates - Collapsible (TOP) */}
            <Card>
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setCertificatesExpanded(!certificatesExpanded)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-amber-600">
                    Assay Certificates
                  </CardTitle>
                  <button
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCertificatesExpanded(!certificatesExpanded);
                    }}
                  >
                    {certificatesExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
              </CardHeader>
              {certificatesExpanded && (
                <CardContent>
                  <div className="space-y-6">
                    <AssayCertificateUpload
                      batchId={id!}
                      onUploadComplete={() => setCertificateRefresh((prev) => prev + 1)}
                      onParseComplete={() => setCertificateRefresh((prev) => prev + 1)}
                    />

                    <AssayCertificatesList
                      batchId={id!}
                      onViewCertificate={(cert) => setSelectedCertificate(cert)}
                      refreshTrigger={certificateRefresh}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Timeline - Collapsible */}
            <Card>
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setTimelineExpanded(!timelineExpanded)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle>Timeline</CardTitle>
                  <button
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTimelineExpanded(!timelineExpanded);
                    }}
                  >
                    {timelineExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
              </CardHeader>
              {timelineExpanded && (
                <CardContent>
                  <Timeline events={timelineEvents} />
                </CardContent>
              )}
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full">
                  Print Details
                </Button>
                <Button variant="outline" className="w-full">
                  Export Report
                </Button>
                <Button variant="outline" className="w-full">
                  Share with Team
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {selectedCertificate && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCertificate(null)}
          title={`Certificate: ${selectedCertificate.file_name}`}
          size="large"
        >
          <AssayCertificateViewer
            certificate={selectedCertificate}
            onApprove={() => {
              setSelectedCertificate(null);
              setCertificateRefresh((prev) => prev + 1);
            }}
            onReject={() => {
              setSelectedCertificate(null);
              setCertificateRefresh((prev) => prev + 1);
            }}
            onDataUpdate={() => {
              setCertificateRefresh((prev) => prev + 1);
            }}
          />
        </Modal>
      )}
    </MainLayout>
  );
}
