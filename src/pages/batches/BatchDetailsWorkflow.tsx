import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Edit,
  Package,
  Weight,
  Calendar,
  MapPin,
  Building2,
  User,
  FileText,
  Upload,
  CheckCircle,
  XCircle,
  Truck,
  Factory,
  DollarSign,
  CreditCard,
  Info,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { supabase } from '@/lib/supabase';

interface BatchData {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  shipping_date: string;
  comments?: string;
  metal_type: string;
  origin_site_name: string;
  origin_site_country: string;
  current_site_name: string;
  created_by_name: string;
  created_by: string;
  created_at: string;
  transportation_company?: string;
}

interface TimelineEvent {
  id: string;
  status: string;
  changed_at: string;
  changed_by_name?: string;
  comments?: string;
}

export function BatchDetailsWorkflow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (id) {
      loadBatchData();
    }
  }, [id]);

  const loadBatchData = async () => {
    try {
      setLoading(true);

      // Load batch with all related data
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select(`
          *,
          origin_site:sites!batches_origin_site_id_fkey(name, country),
          current_site:sites!batches_current_site_id_fkey(name, site_type),
          created_by_user:user_profiles!batches_created_by_fkey(full_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (batchError) throw batchError;
      if (!batchData) {
        console.warn('Batch not found');
        return;
      }

      setBatch({
        ...batchData,
        origin_site_name: batchData.origin_site?.name || 'Unknown',
        origin_site_country: batchData.origin_site?.country || 'Unknown',
        current_site_name: batchData.current_site?.name || 'Unknown',
        created_by_name: batchData.created_by_user?.full_name || 'Unknown',
        created_by: batchData.created_by,
      });

      // Load timeline
      const { data: timelineData, error: timelineError } = await supabase
        .from('batch_status_history')
        .select(`
          *,
          user:user_profiles!batch_status_history_changed_by_fkey(full_name)
        `)
        .eq('batch_id', id)
        .order('changed_at', { ascending: true });

      if (timelineError) throw timelineError;

      setTimeline(
        (timelineData || []).map((item) => ({
          id: item.id,
          status: item.status,
          changed_at: item.changed_at,
          changed_by_name: item.user?.full_name || 'System',
          comments: item.comments,
        }))
      );
    } catch (error) {
      console.error('Error loading batch:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateForTransport = async () => {
    if (!batch || !user) return;

    try {
      setActionLoading(true);

      const { error: updateError } = await supabase
        .from('batches')
        .update({ status: 'received_airport' })
        .eq('id', batch.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('batch_status_history')
        .insert({
          batch_id: batch.id,
          status: 'received_airport',
          changed_by: user.id,
          comments: 'Batch validated for transportation by creator',
        });

      if (historyError) throw historyError;

      await loadBatchData();
      setSuccessMessage('Batch validated for transportation successfully!');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error validating batch:', error);
      setSuccessMessage('Failed to validate batch. Please try again.');
      setShowSuccessModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectBatch = async () => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason || !batch || !user) return;

    try {
      setActionLoading(true);

      const { error } = await supabase.from('batch_status_history').insert({
        batch_id: batch.id,
        status: 'rejected',
        changed_by: user.id,
        comments: `Batch rejected: ${reason}`,
      });

      if (error) throw error;

      await loadBatchData();
      setSuccessMessage('Batch rejected successfully');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error rejecting batch:', error);
      setSuccessMessage('Failed to reject batch. Please try again.');
      setShowSuccessModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { key: 'created', label: 'Created', sublabel: 'Batch registered' },
      { key: 'received_airport', label: 'Airport', sublabel: 'Received at airport' },
      { key: 'received_refinery', label: 'Refinery', sublabel: 'Received at refinery' },
      { key: 'processed', label: 'Processed', sublabel: 'Refining completed' },
      { key: 'approved', label: 'Approved', sublabel: 'Ready for sale' },
      { key: 'sold', label: 'Sell', sublabel: 'Sale completed' },
      { key: 'paid', label: 'Paid', sublabel: 'Payment received' },
    ];

    const currentIndex = steps.findIndex((s) => s.key === batch?.status);
    return steps.map((step, index) => ({
      ...step,
      completed: index < currentIndex,
      current: index === currentIndex,
      upcoming: index > currentIndex,
    }));
  };

  const getTimelineIcon = (status: string) => {
    const iconMap: Record<string, any> = {
      created: Package,
      received_airport: MapPin,
      received_refinery: Building2,
      processed: CheckCircle,
      approved: CheckCircle,
      sold: DollarSign,
      paid: CreditCard,
      rejected: XCircle,
    };
    return iconMap[status] || Package;
  };

  const getTimelineColor = (status: string) => {
    const colorMap: Record<string, string> = {
      created: 'bg-gray-500',
      received_airport: 'bg-blue-500',
      received_refinery: 'bg-purple-500',
      processed: 'bg-accent-500',
      approved: 'bg-green-500',
      sold: 'bg-primary-500',
      paid: 'bg-green-600',
      rejected: 'bg-red-500',
    };
    return colorMap[status] || 'bg-gray-500';
  };

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
        <div className="flex flex-col items-center justify-center h-64">
          <Package className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Batch not found</h2>
          <Button onClick={() => navigate('/batches')} variant="primary">
            Back to Batches
          </Button>
        </div>
      </MainLayout>
    );
  }

  const statusSteps = getStatusSteps();
  const isCreator = batch.created_by === user?.id;
  const canValidate = batch.status === 'created' && isCreator;

  return (
    <MainLayout userRole="factory">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/batches')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{batch.batch_number}</h1>
              <p className="text-sm text-gray-500">Batch Details and Tracking</p>
            </div>
          </div>
          <Button variant="secondary" className="flex items-center space-x-2">
            <Edit className="h-4 w-4" />
            <span>Edit Batch</span>
          </Button>
        </div>

        {/* Status Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Batch Status Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" style={{ left: '2.5rem', right: '2.5rem' }}></div>

              {/* Steps */}
              <div className="relative flex justify-between">
                {statusSteps.map((step, index) => (
                  <div key={step.key} className="flex flex-col items-center" style={{ width: '12.5%' }}>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center z-10 mb-2 ${
                        step.completed
                          ? 'bg-primary-500 text-white'
                          : step.current
                          ? 'bg-primary-500 text-white ring-4 ring-primary-100'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-current"></div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-medium ${step.completed || step.current ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-500">{step.sublabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Batch Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Batch Information */}
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Batch Number</p>
                      <p className="text-sm font-semibold text-gray-900">{batch.batch_number}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Weight className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Weight</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {batch.weight_grams.toFixed(2)}g ({batch.weight_ounces.toFixed(2)} oz)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Shipping Date</p>
                      <p className="text-sm font-semibold text-gray-900">{batch.shipping_date}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <StatusBadge status={batch.status as any} label={batch.status} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Current Status</p>
                      <p className="text-sm font-semibold text-gray-900 capitalize">{batch.status.replace('_', ' ')}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Origin Site</p>
                      <p className="text-sm font-semibold text-gray-900">{batch.origin_site_name}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Current Location</p>
                      <p className="text-sm font-semibold text-gray-900">{batch.current_site_name}</p>
                    </div>
                  </div>

                  {batch.transportation_company && (
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Transportation</p>
                        <p className="text-sm font-semibold text-gray-900">{batch.transportation_company}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created By</p>
                      <p className="text-sm font-semibold text-gray-900">{batch.created_by_name}</p>
                    </div>
                  </div>
                </div>

                {batch.comments && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-2">Comments</p>
                    <p className="text-gray-700">{batch.comments}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-gray-500">No timeline events yet</p>
                  ) : (
                    timeline.map((event, index) => {
                      const Icon = getTimelineIcon(event.status);
                      const colorClass = getTimelineColor(event.status);

                      return (
                        <div key={event.id} className="flex items-start space-x-4">
                          <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-1">
                              <p className="font-semibold text-gray-900 capitalize">
                                {event.status === 'received_airport'
                                  ? 'Quality Check Passed'
                                  : event.status === 'received_refinery'
                                  ? 'Shipment Initiated'
                                  : event.status.replace('_', ' ')}
                              </p>
                              <p className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                {new Date(event.changed_at).toLocaleDateString()} {new Date(event.changed_at).toLocaleTimeString()}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              {event.comments ||
                                (event.status === 'created' ? 'Initial batch registration at factory' :
                                 event.status === 'received_airport' ? 'Batch passed initial quality inspection' :
                                 event.status === 'received_refinery' ? 'Batch handed over to TransGold Logistics' :
                                 `Batch status changed to ${event.status.replace('_', ' ')}`)}
                            </p>
                            <p className="text-xs text-gray-500">By {event.changed_by_name}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Validation Actions */}
            {canValidate && (
              <Card className="border-primary-200 bg-primary-50">
                <CardHeader>
                  <CardTitle className="text-primary-900">Validation Required</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-primary-800">
                    As the creator, you need to validate this batch for transportation before it can proceed.
                  </p>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleValidateForTransport}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Validate for Transportation
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full border-red-300 text-red-700 hover:bg-red-50"
                    onClick={handleRejectBatch}
                    disabled={actionLoading}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Batch
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Field Guide */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  Batch Tracking Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Batch Number</p>
                  <p className="text-xs text-blue-700">Unique identifier generated automatically for tracking purposes</p>
                </div>

                <div className="bg-green-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-900 mb-1">Weight Information</p>
                  <p className="text-xs text-green-700">Total weight in grams with automatic conversion to ounces</p>
                </div>

                <div className="bg-orange-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-orange-900 mb-1">Shipping Date</p>
                  <p className="text-xs text-orange-700">Date when batch is scheduled for transportation</p>
                </div>

                <div className="bg-purple-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-purple-900 mb-1">Current Status</p>
                  <p className="text-xs text-purple-700">Current stage in the batch processing workflow</p>
                </div>

                <div className="bg-pink-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-pink-900 mb-1">Origin & Location</p>
                  <p className="text-xs text-pink-700">Where the batch started and its current physical location</p>
                </div>

                <div className="bg-yellow-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-900 mb-1">Transportation</p>
                  <p className="text-xs text-yellow-700">Logistics company handling the shipment</p>
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Initial Quality Report.pdf</p>
                        <p className="text-xs text-gray-500">245 KB • 2024-10-20 09:15 AM</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Shipping Manifest.pdf</p>
                        <p className="text-xs text-gray-500">180 KB • 2024-10-20 10:00 AM</p>
                      </div>
                    </div>
                  </div>
                </div>
                <Button variant="secondary" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        size="sm"
      >
        <div className="p-6 text-center">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
            successMessage.includes('Failed') ? 'bg-red-100' : 'bg-green-100'
          }`}>
            {successMessage.includes('Failed') ? (
              <XCircle className="h-6 w-6 text-red-600" />
            ) : (
              <CheckCircle className="h-6 w-6 text-green-600" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {successMessage.includes('Failed') ? 'Error' : 'Success'}
          </h3>
          <p className="text-sm text-gray-600 mb-6">{successMessage}</p>
          <Button
            variant="primary"
            onClick={() => setShowSuccessModal(false)}
            className="w-full"
          >
            OK
          </Button>
        </div>
      </Modal>
    </MainLayout>
  );
}
