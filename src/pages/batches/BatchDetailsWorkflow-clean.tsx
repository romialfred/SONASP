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
  CheckCircle,
  XCircle,
  Truck,
  Factory,
  DollarSign,
  CreditCard,
  Info,
  ChevronRight,
  ChevronLeft,
  Clock,
} from 'lucide-react';
import { AssayCertificateUpload } from '@/components/batch/AssayCertificateUpload';
import { AssayCertificatesList } from '@/components/batch/AssayCertificatesList';
import { AssayCertificateViewer } from '@/components/batch/AssayCertificateViewer';
import type { AssayCertificate } from '@/services/assayCertificateService';
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
  const [selectedCertificate, setSelectedCertificate] = useState<AssayCertificate | null>(null);
  const [certificateRefresh, setCertificateRefresh] = useState(0);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Airport receiving form state
  const [receivedWeight, setReceivedWeight] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>('');
  const [freightCompany, setFreightCompany] = useState<string>('');
  const [freightDocument, setFreightDocument] = useState<File | null>(null);
  const [freightCompanies, setFreightCompanies] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    if (id) {
      loadBatchData();
      loadFreightCompanies();
    }
  }, [id]);

  // Realtime subscription for batch updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`batch-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'batches',
          filter: `id=eq.${id}`,
        },
        () => {
          loadBatchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const loadFreightCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('transport_companies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setFreightCompanies(data || []);
    } catch (error) {
      console.error('Error loading freight companies:', error);
    }
  };

  const loadBatchData = async () => {
    try {
      setLoading(true);
      console.log('Loading batch with ID:', id);

      // Load batch with all related data
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select(`
          *,
          mining_company:mining_companies(name, country),
          refinery:refineries(name, location),
          created_by_user:user_profiles!batches_created_by_fkey(full_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (batchError) {
        console.error('Error loading batch:', batchError);
        throw batchError;
      }

      if (!batchData) {
        console.warn('Batch not found with ID:', id);
        console.warn('Make sure you are navigating from the Batches list page, not from demo/mock data');
        return;
      }

      console.log('Batch loaded successfully:', batchData.batch_number);

      setBatch({
        ...batchData,
        mining_company_name: batchData.mining_company?.name || 'Unknown',
        mining_company_country: batchData.mining_company?.country || 'Unknown',
        refinery_name: batchData.refinery?.name || 'Not assigned',
        refinery_location: batchData.refinery?.location || 'Unknown',
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
        .update({ status: 'validated_for_transport' })
        .eq('id', batch.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('batch_status_history')
        .insert({
          batch_id: batch.id,
          status: 'validated_for_transport',
          changed_by: user.id,
          comments: 'Batch validated for transportation by Plant Manager',
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

  const calculateVariance = () => {
    if (!batch || !receivedWeight) return null;

    const expected = batch.weight_grams;
    const actual = parseFloat(receivedWeight);
    const difference = actual - expected;
    const percentage = expected !== 0 ? (difference / expected) * 100 : 0;

    return {
      difference: difference.toFixed(2),
      percentage: percentage.toFixed(2),
      isSignificant: Math.abs(percentage) > 2
    };
  };

  const handleAirportReceiving = async () => {
    if (!batch || !user || !receivedWeight || !receiptDate || !freightCompany) {
      setSuccessMessage('Please fill in all required fields');
      setShowSuccessModal(true);
      return;
    }

    try {
      setActionLoading(true);

      const actualWeight = parseFloat(receivedWeight);
      const actualOunces = actualWeight * 0.03527396195;

      // Upload document if provided
      let documentUrl = '';
      if (freightDocument) {
        const fileExt = freightDocument.name.split('.').pop();
        const fileName = `${batch.id}_freight_${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('batch-documents')
          .upload(fileName, freightDocument);

        if (uploadError) throw uploadError;
        documentUrl = uploadData.path;
      }

      // Update batch with received weight and freight info
      const { error: updateError } = await supabase
        .from('batches')
        .update({
          status: 'received_airport',
          received_weight_grams: actualWeight,
          received_weight_ounces: actualOunces,
          received_date: receiptDate,
          transport_company_id: freightCompany,
          freight_document_url: documentUrl
        })
        .eq('id', batch.id);

      if (updateError) throw updateError;

      // Add status history
      const variance = calculateVariance();
      const comments = variance
        ? `Received at airport. Weight variance: ${variance.percentage}% (${variance.difference}g). Freight company assigned.`
        : 'Received at airport. Freight company assigned.';

      const { error: historyError } = await supabase
        .from('batch_status_history')
        .insert({
          batch_id: batch.id,
          status: 'received_airport',
          changed_by: user.id,
          comments: comments,
        });

      if (historyError) throw historyError;

      await loadBatchData();
      setSuccessMessage('Batch received at airport successfully!');
      setShowSuccessModal(true);

      // Reset form
      setReceivedWeight('');
      setReceiptDate('');
      setFreightCompany('');
      setFreightDocument(null);
    } catch (error) {
      console.error('Error receiving batch at airport:', error);
      setSuccessMessage('Failed to receive batch. Please try again.');
      setShowSuccessModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { key: 'created', label: 'Created', sublabel: 'Batch registered' },
      { key: 'validated_for_transport', label: 'Validated', sublabel: 'Ready for transport' },
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
      validated_for_transport: CheckCircle,
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
      validated_for_transport: 'bg-green-500',
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
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading batch details...</div>
        </div>
      </MainLayout>
    );
  }

  if (!batch) {
    return (
      <MainLayout>
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
  const isPlantManager = user && (user.role === 'factory' || user.role === 'management');
  const canValidate = batch.status === 'created' && isCreator && isPlantManager;

  return (
    <MainLayout>
      <div className="px-6">
        <div className="space-y-6 mb-6">
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
              {/* Green Progress Line for completed steps */}
              <div
                className="absolute top-5 left-0 h-0.5 bg-green-500 transition-all duration-500"
                style={{
                  left: '2.5rem',
                  width: `calc(${(statusSteps.filter(s => s.completed).length / (statusSteps.length - 1)) * 100}% - 2.5rem)`
                }}
              ></div>

              {/* Steps */}
              <div className="relative flex justify-between">
                {statusSteps.map((step, index) => (
                  <div key={step.key} className="flex flex-col items-center" style={{ width: '12.5%' }}>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center z-10 mb-2 transition-all duration-300 ${
                        step.completed
                          ? 'bg-green-500 text-white shadow-lg'
                          : step.current
                          ? 'bg-primary-500 text-white ring-4 ring-primary-100 shadow-lg'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : step.current ? (
                        <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div>
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Batch Information - Compact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Batch Number</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{batch.batch_number}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Weight className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Weight</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {batch.weight_grams.toFixed(2)}g ({batch.weight_ounces.toFixed(2)} oz)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Shipping Date</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{batch.shipping_date}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Current Status</p>
                      <p className="text-sm font-semibold text-gray-900 capitalize truncate">{batch.status.replace(/_/g, ' ')}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Origin Site</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{batch.origin_site_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Current Location</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{batch.current_site_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-pink-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Created By</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{batch.created_by_name}</p>
                    </div>
                  </div>

                  {batch.transportation_company && (
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Transportation</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{batch.transportation_company}</p>
                      </div>
                    </div>
                  )}
                </div>

                {batch.comments && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-2">Comments</p>
                    <p className="text-gray-700">{batch.comments}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assay Certificates - Moved from right panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-amber-600">Assay Certificates</CardTitle>
              </CardHeader>
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
            </Card>
          </div>

            {/* Validation Actions - Now in main column */}
            {canValidate && (
              <Card className="border-primary-200 bg-primary-50">
                <CardHeader>
                  <CardTitle className="text-primary-900">Validation Required</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-primary-800">
                    As the Plant Manager who created this batch, you need to validate it for transportation.
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

            {/* Airport Receiving Form */}
            {batch?.status === 'validated_for_transport' &&
             user && (user.role === 'airport' || user.role === 'management') && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-blue-900">Airport Receiving</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-blue-800 mb-4">
                    <strong>Airport Team:</strong> Confirm batch receipt, enter actual weight received, and assign freight company for transport to refinery.
                  </p>

                  {/* Weight Confirmation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Received Weight (g) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={receivedWeight}
                      onChange={(e) => setReceivedWeight(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter received weight"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Original: {batch.weight_grams.toFixed(2)}g ({batch.weight_ounces.toFixed(2)} oz)
                    </p>
                  </div>

                  {/* Variance Display */}
                  {receivedWeight && calculateVariance() && (
                    <div className={`p-3 rounded-md ${
                      calculateVariance()!.isSignificant ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'
                    }`}>
                      <p className="text-sm font-medium mb-1">
                        {calculateVariance()!.isSignificant ? 'Significant Variance Detected' : 'Variance Within Tolerance'}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Difference:</span>
                          <span className="font-semibold ml-1">{calculateVariance()!.difference}g</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Variance:</span>
                          <span className="font-semibold ml-1">{calculateVariance()!.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Receipt Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Receipt <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Freight Company Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Freight Company (Airport to Refinery) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={freightCompany}
                      onChange={(e) => setFreightCompany(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select freight company...</option>
                      {freightCompanies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Document Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Freight Document (Optional)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setFreightDocument(e.target.files?.[0] || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Supported formats: PDF, JPG, PNG
                    </p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleAirportReceiving}
                    disabled={actionLoading || !receivedWeight || !receiptDate || !freightCompany}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Validate for Shipping to Refinery
                  </Button>
                </CardContent>
              </Card>
            )}

          </div>

          {/* Right Column (1/3) - Field Guide */}
          <div className="space-y-6">
            <div className="sticky top-6">
              {/* Field Guide */}
              <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  Batch Tracking Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
            </div>
          </div>
        </div>

      {/* Fixed Timeline Panel - Right Side (similar to Live Gold Price) */}
      <div
        className={`fixed top-20 right-0 transition-all duration-300 z-40 ${
          timelineExpanded ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ maxHeight: 'calc(100vh - 5rem)' }}
      >
        {/* Collapse/Expand Button */}
        <button
          onClick={() => setTimelineExpanded(!timelineExpanded)}
          className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 bg-white shadow-lg rounded-l-lg p-2 hover:bg-gray-50 transition-colors border-l border-t border-b border-gray-200"
          title={timelineExpanded ? 'Hide timeline' : 'Show timeline'}
        >
          {timelineExpanded ? (
            <ChevronRight className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          )}
        </button>

        {/* Timeline Panel */}
        <div className="bg-white shadow-2xl rounded-l-2xl border-l border-gray-200 w-96 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Batch Timeline</h2>
                  <p className="text-xs text-gray-500">{timeline.length} events</p>
                </div>
              </div>
            </div>

            {/* Timeline Events */}
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No timeline events yet</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((event, index) => {
                  const Icon = getTimelineIcon(event.status);
                  const colorClass = getTimelineColor(event.status);

                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0 shadow-md`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-bold text-gray-900 capitalize">
                            {event.status === 'received_airport'
                              ? 'Received at Airport'
                              : event.status === 'received_refinery'
                              ? 'Received at Refinery'
                              : event.status.replace('_', ' ')}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">
                          {new Date(event.changed_at).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                          {' '}
                          {new Date(event.changed_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {event.comments && (
                          <p className="text-xs text-gray-600 mb-1">{event.comments}</p>
                        )}
                        <p className="text-xs text-gray-500">By {event.changed_by_name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* Certificate Viewer Modal */}
      {selectedCertificate && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCertificate(null)}
          title={`Assay Certificate: ${selectedCertificate.file_name}`}
          size="5xl"
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
