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
  Split,
  Merge,
  Tag,
  Shield,
  Lock,
  Unlock,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { StatusFlow } from '@/components/batch/StatusFlow';
import { Timeline, TimelineEvent } from '@/components/batch/Timeline';
import { QualityCheckCard } from '@/components/batch/QualityCheckCard';
import { AlertsPanel } from '@/components/batch/AlertsPanel';
import { ApprovalWorkflowCard } from '@/components/batch/ApprovalWorkflowCard';
import { formatWeight } from '@/utils/batchUtils';
import { supabase } from '@/lib/supabase';
import {
  batchEnhancedService,
  batchWorkflowService,
} from '@/services';

export function BatchDetailsEnhanced() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [qualityChecks, setQualityChecks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [transportDetails, setTransportDetails] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadAllData();
    }
  }, [id]);

  const loadAllData = async () => {
    await Promise.all([
      loadBatch(),
      loadTimeline(),
      loadQualityChecks(),
      loadAlerts(),
      loadApprovals(),
      loadTags(),
      loadTransportDetails(),
      loadReservations(),
    ]);
  };

  const loadBatch = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          origin_site:sites!batches_origin_site_id_fkey(name, country),
          current_site:sites!batches_current_site_id_fkey(name, site_type),
          created_by_user:user_profiles(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setBatch({
        ...data,
        origin_site: data.origin_site?.name || 'Unknown',
        current_site: data.current_site?.name || 'Unknown',
        created_by: data.created_by_user?.full_name || 'Unknown',
      });
    } catch (error) {
      console.error('Error loading batch:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async () => {
    try {
      const { data, error } = await supabase
        .from('batch_status_history')
        .select(`
          *,
          user:user_profiles(full_name)
        `)
        .eq('batch_id', id)
        .order('changed_at', { ascending: true });

      if (error) throw error;

      const events: TimelineEvent[] = (data || []).map((item: any, index: number) => ({
        id: item.id,
        title: getStatusTitle(item.status),
        description: item.comments || `Batch status changed to ${item.status}`,
        timestamp: new Date(item.changed_at).toLocaleString(),
        user: item.user?.full_name || 'System',
        icon: getStatusIcon(item.status),
        iconColor: getStatusColor(index),
      }));

      setTimelineEvents(events);
    } catch (error) {
      console.error('Error loading timeline:', error);
    }
  };

  const loadQualityChecks = async () => {
    try {
      const checks = await batchEnhancedService.getQualityChecks(id!);
      setQualityChecks(checks || []);
    } catch (error) {
      console.error('Error loading quality checks:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const alertsData = await batchEnhancedService.getAlerts(id);
      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const loadApprovals = async () => {
    try {
      const approvalsData = await batchWorkflowService.getApprovalHistory(id!);
      setApprovals(approvalsData || []);
    } catch (error) {
      console.error('Error loading approvals:', error);
    }
  };

  const loadTags = async () => {
    try {
      const tagsData = await batchEnhancedService.getBatchTags(id!);
      setTags(tagsData || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadTransportDetails = async () => {
    try {
      const details = await batchEnhancedService.getTransportationDetails(id!);
      setTransportDetails(details);
    } catch (error) {
      console.error('Error loading transport details:', error);
    }
  };

  const loadReservations = async () => {
    try {
      const reservationsData = await batchEnhancedService.getReservations(id!);
      setReservations(reservationsData || []);
    } catch (error) {
      console.error('Error loading reservations:', error);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await batchEnhancedService.acknowledgeAlert(alertId, 'user-id', 'user@example.com');
      loadAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    const notes = prompt('Enter resolution notes:');
    if (notes) {
      try {
        await batchEnhancedService.resolveAlert(alertId, 'user-id', 'user@example.com', notes);
        loadAlerts();
      } catch (error) {
        console.error('Error resolving alert:', error);
      }
    }
  };

  const handlePutOnHold = async () => {
    const reason = prompt('Enter reason for hold:');
    if (reason) {
      try {
        await batchEnhancedService.putBatchOnHold(id!, reason, 'user-id', 'user@example.com');
        loadBatch();
      } catch (error) {
        console.error('Error putting batch on hold:', error);
      }
    }
  };

  const handleReleaseHold = async () => {
    try {
      await batchEnhancedService.releaseBatchHold(id!, 'user-id', 'user@example.com');
      loadBatch();
    } catch (error) {
      console.error('Error releasing hold:', error);
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

  const documents = [
    {
      id: '1',
      name: 'Initial Quality Report.pdf',
      type: 'Quality Report',
      size: '245 KB',
      uploaded_at: '2024-10-20 09:15 AM',
    },
    {
      id: '2',
      name: 'Shipping Manifest.pdf',
      type: 'Shipping Document',
      size: '180 KB',
      uploaded_at: '2024-10-20 10:00 AM',
    },
  ];

  if (loading) {
    return (
      <MainLayout userRole="factory">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading batch details...</div>
        </div>
      </MainLayout>
    );
  }

  if (!batch) {
    return (
      <MainLayout userRole="factory">
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
    <MainLayout userRole="factory">
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
              <div className="flex items-center gap-3">
                <h1 className="font-heading text-3xl font-bold text-gray-900">
                  {batch.batch_number}
                </h1>
                {batch.is_on_hold && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Lock className="h-4 w-4" />
                    ON HOLD
                  </span>
                )}
                {batch.quality_grade && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    batch.quality_grade === 'A' ? 'bg-green-100 text-green-700' :
                    batch.quality_grade === 'B' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    Grade {batch.quality_grade}
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">Batch Details and Tracking</p>
            </div>
          </div>

          <div className="flex gap-2">
            {batch.is_on_hold ? (
              <Button variant="primary" onClick={handleReleaseHold} className="gap-2">
                <Unlock className="h-4 w-4" />
                Release Hold
              </Button>
            ) : (
              <Button variant="outline" onClick={handlePutOnHold} className="gap-2">
                <Lock className="h-4 w-4" />
                Put on Hold
              </Button>
            )}
            <Button variant="outline" className="gap-2">
              <Split className="h-4 w-4" />
              Split Batch
            </Button>
            <Button variant="outline" className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium flex items-center gap-1"
              >
                <Tag className="h-3 w-3" />
                {tag.tag_name}
              </span>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Batch Status Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusFlow currentStatus={batch.status} completedSteps={['created']} />
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
                        {batch.batch_number}
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
                        {formatWeight(batch.weight_grams)}
                      </p>
                    </div>
                  </div>

                  {batch.metal_type && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Shield className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Metal Type</p>
                        <p className="text-base font-semibold text-gray-900 capitalize">
                          {batch.metal_type}
                        </p>
                      </div>
                    </div>
                  )}

                  {batch.expected_purity && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Shield className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Expected Purity</p>
                        <p className="text-base font-semibold text-gray-900">
                          {batch.expected_purity}%
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-accent-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Shipping Date</p>
                      <p className="text-base font-semibold text-gray-900">
                        {new Date(batch.shipping_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Status</p>
                      <StatusBadge status={batch.status} />
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <MapPin className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Origin Site</p>
                      <p className="text-base font-semibold text-gray-900">
                        {batch.origin_site}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <MapPin className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Location</p>
                      <p className="text-base font-semibold text-gray-900">
                        {batch.current_site}
                      </p>
                    </div>
                  </div>

                  {transportDetails && (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                          <Truck className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Driver</p>
                          <p className="text-base font-semibold text-gray-900">
                            {transportDetails.driver_name || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {transportDetails.seal_number && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <Lock className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Seal Number</p>
                            <p className="text-base font-semibold text-gray-900">
                              {transportDetails.seal_number}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {batch.comments && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">Comments</p>
                    <p className="text-base text-gray-900">{batch.comments}</p>
                  </div>
                )}

                {batch.hold_reason && (
                  <div className="mt-6 pt-6 border-t border-red-200 bg-red-50 -mx-6 px-6 py-4">
                    <p className="text-sm text-red-600 font-semibold mb-2">Hold Reason</p>
                    <p className="text-base text-red-900">{batch.hold_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <QualityCheckCard checks={qualityChecks} />

            <ApprovalWorkflowCard approvals={approvals} />

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline events={timelineEvents} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <AlertsPanel
              alerts={alerts}
              onAcknowledge={handleAcknowledgeAlert}
              onResolve={handleResolveAlert}
            />

            {reservations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Reservations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-semibold text-gray-900">
                            Reserved
                          </span>
                          <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                            {reservation.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {formatWeight(reservation.reserved_weight_grams)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Expires: {new Date(reservation.reservation_expires_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <FileText className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.name}
                        </p>
                        <p className="text-xs text-gray-500">{doc.type}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {doc.size} • {doc.uploaded_at}
                        </p>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" className="w-full">
                    Upload Document
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full">
                  <Split className="h-4 w-4 mr-2" />
                  Split Batch
                </Button>
                <Button variant="outline" className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  Add Quality Check
                </Button>
                <Button variant="outline" className="w-full">
                  <Tag className="h-4 w-4 mr-2" />
                  Add Tag
                </Button>
                <Button variant="outline" className="w-full">
                  Print Details
                </Button>
                <Button variant="outline" className="w-full">
                  Export Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
