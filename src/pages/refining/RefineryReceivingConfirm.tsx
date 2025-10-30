import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertTriangle, CheckCircle, HelpCircle, Scale, FileText, Camera } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import { FormField } from '@/components/ui/FormField';
import { AlertBox } from '@/components/dashboard/AlertBox';
import { FileUpload } from '@/components/ui/FileUpload';
import { Loading } from '@/components/ui/Loading';
import { WeightInput } from '@/components/ui/WeightInput';
import { calculateVariance, formatWeight, convertGramsToOunces } from '@/utils/batchUtils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BATCH_STATUSES } from '@/constants/batchStatuses';
import { useAlert } from '@/hooks/useAlert';

export function RefineryReceivingConfirm() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const alert = useAlert();

  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actualWeight, setActualWeight] = useState<number>(0);
  const [reconciliationComments, setReconciliationComments] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadBatch();
  }, [id]);

  const loadBatch = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          mining_company:mining_companies(name, country)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setBatch(data);
    } catch (error) {
      console.error('Error loading batch:', error);
      alert.error('Error loading batch data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!batch) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Batch not found</p>
        </div>
      </MainLayout>
    );
  }

  // Use airport validated weight as expected weight for refinery
  const expectedWeight = batch.airport_received_weight_grams || batch.weight_grams;

  const variance = actualWeight > 0
    ? calculateVariance(expectedWeight, actualWeight)
    : null;

  const handleFileSelect = (files: File[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleConfirm = async () => {
    if (!actualWeight || actualWeight === 0) {
      alert.error('Please enter the actual weight');
      return;
    }

    if (variance?.isSignificant && !reconciliationComments) {
      alert.error('Reconciliation comments are required for significant variances');
      return;
    }

    setIsSubmitting(true);

    try {
      const actualWeightGrams = actualWeight;

      // Use the transition service to handle the status changes
      // The correct workflow can have three entry points:
      // A. validated_for_refinery → waiting_refinery_receipt (system) → received_at_refinery → validated_for_processing
      // B. waiting_refinery_receipt → received_at_refinery → validated_for_processing
      // C. received_at_refinery → validated_for_processing
      const { transitionBatchStatus } = await import('@/services/batchTransitionService');

      // Pre-Step: If coming from validated_for_refinery, transition to waiting_refinery_receipt first
      if (batch.status === BATCH_STATUSES.VALIDATED_FOR_REFINERY) {
        const waitingResult = await transitionBatchStatus(
          batch.id,
          BATCH_STATUSES.WAITING_REFINERY_RECEIPT,
          {
            comments: `Batch ready for refinery receipt`,
          }
        );

        if (!waitingResult.success) {
          throw new Error(waitingResult.error || 'Failed to transition to waiting refinery receipt');
        }
      }

      // Step 1: Confirm physical receipt at refinery (if coming from validated_for_refinery or waiting_refinery_receipt)
      if (batch.status === BATCH_STATUSES.VALIDATED_FOR_REFINERY || batch.status === BATCH_STATUSES.WAITING_REFINERY_RECEIPT) {
        const receiptResult = await transitionBatchStatus(
          batch.id,
          BATCH_STATUSES.RECEIVED_AT_REFINERY,
          {
            weightGrams: actualWeightGrams,
            variancePercentage: variance?.percentage,
            reconciliationComments: reconciliationComments || undefined,
            comments: `Refinery reception confirmed. Weight: ${formatWeight(actualWeightGrams)}. Variance: ${variance?.percentage || 0}%${reconciliationComments ? '. ' + reconciliationComments : ''}`,
          }
        );

        if (!receiptResult.success) {
          throw new Error(receiptResult.error || 'Failed to confirm receipt at refinery');
        }
      }

      // Step 2: Validate for processing (from received_at_refinery to validated_for_processing)
      const validationResult = await transitionBatchStatus(
        batch.id,
        BATCH_STATUSES.VALIDATED_FOR_PROCESSING,
        {
          weightGrams: actualWeightGrams,
          variancePercentage: variance?.percentage,
          reconciliationComments: reconciliationComments || undefined,
          comments: `Batch validated for processing. Weight: ${formatWeight(actualWeightGrams)}. Variance: ${variance?.percentage || 0}%${reconciliationComments ? '. ' + reconciliationComments : ''}`,
        }
      );

      if (!validationResult.success) {
        throw new Error(validationResult.error || 'Failed to validate for processing');
      }

      alert.success('Batch confirmed and validated for processing');

      // Navigate after a short delay to show the success message
      setTimeout(() => {
        navigate('/refining');
      }, 1000);
    } catch (error: any) {
      console.error('Error confirming receipt:', error);
      alert.error(error.message || 'Error confirming receipt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/refining')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Confirm Refinery Receipt
            </h1>
            <p className="text-gray-600 mt-1">
              Verify and confirm batch receipt at refinery
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Batch Number</p>
                    <p className="text-base font-semibold text-gray-900">
                      {batch.batch_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Mining Company</p>
                    <p className="text-base font-semibold text-gray-900">
                      {batch.mining_company?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Expected Weight (from Airport)</p>
                    <p className="text-base font-semibold text-gray-900">
                      {formatWeight(expectedWeight)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Shipping Date</p>
                    <p className="text-base font-semibold text-gray-900">
                      {new Date(batch.shipping_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weight Confirmation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  label="Actual Received Weight"
                  required
                >
                  <WeightInput
                    value={actualWeight}
                    onChange={(grams) => setActualWeight(grams)}
                    placeholder="Enter actual weight"
                    defaultUnit="g"
                    showConversion={true}
                  />
                </FormField>

                {variance && (
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      variance.isSignificant
                        ? 'bg-red-50 border-red-200'
                        : 'bg-accent-50 border-accent-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {variance.isSignificant ? (
                        <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-accent-600 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h4
                          className={`font-semibold mb-2 ${
                            variance.isSignificant ? 'text-red-900' : 'text-accent-900'
                          }`}
                        >
                          {variance.isSignificant
                            ? 'Significant Variance Detected'
                            : 'Variance Within Acceptable Range'}
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-600">Difference</p>
                            <p
                              className={`text-base font-bold ${
                                variance.isSignificant
                                  ? 'text-red-700'
                                  : 'text-accent-700'
                              }`}
                            >
                              {variance.difference > 0 ? '+' : ''}
                              {variance.difference.toFixed(2)}g
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              ({variance.difference > 0 ? '+' : ''}
                              {convertGramsToOunces(variance.difference).toFixed(3)} oz)
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Percentage</p>
                            <p
                              className={`text-base font-bold ${
                                variance.isSignificant
                                  ? 'text-red-700'
                                  : 'text-accent-700'
                              }`}
                            >
                              {variance.percentage > 0 ? '+' : ''}
                              {variance.percentage}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Threshold</p>
                            <p className="text-base font-bold text-gray-700">±{variance.threshold}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {variance?.isSignificant && (
              <Card>
                <CardHeader>
                  <CardTitle>Reconciliation Required</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <AlertBox
                    type="warning"
                    title="High Variance Detected"
                    message="This variance exceeds the acceptable threshold. Please provide detailed justification and supporting documentation before proceeding."
                  />

                  <FormField
                    label="Justification Comments"
                    required
                    hint="Explain the reason for the variance and any actions taken"
                  >
                    <TextArea
                      placeholder="Provide detailed explanation for the variance..."
                      value={reconciliationComments}
                      onChange={(e) => setReconciliationComments(e.target.value)}
                      rows={4}
                    />
                  </FormField>

                  <FormField
                    label="Supporting Documents"
                    hint="Upload photos, receipts, or other evidence"
                  >
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      accept="image/*,.pdf"
                      multiple
                      maxSize={5 * 1024 * 1024}
                    />
                  </FormField>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Confirmation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Expected:</span>
                      <span className="font-semibold">
                        {formatWeight(expectedWeight)}
                      </span>
                    </div>
                    <div className="flex justify-end text-xs text-gray-500">
                      ({convertGramsToOunces(expectedWeight).toFixed(3)} oz)
                    </div>
                  </div>
                  {actualWeight > 0 && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Actual:</span>
                          <span className="font-semibold">
                            {formatWeight(actualWeight)}
                          </span>
                        </div>
                        <div className="flex justify-end text-xs text-gray-500">
                          ({convertGramsToOunces(actualWeight).toFixed(3)} oz)
                        </div>
                      </div>
                      {variance && (
                        <>
                          <div className="flex justify-between text-sm pt-3 border-t">
                            <span className="text-gray-600">Difference:</span>
                            <span
                              className={`font-bold ${
                                variance.isSignificant
                                  ? 'text-red-600'
                                  : 'text-accent-600'
                              }`}
                            >
                              {variance.difference > 0 ? '+' : ''}
                              {variance.difference.toFixed(2)} g
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Variance:</span>
                            <span
                              className={`font-bold ${
                                variance.isSignificant
                                  ? 'text-red-600'
                                  : 'text-accent-600'
                              }`}
                            >
                              {variance.percentage > 0 ? '+' : ''}
                              {variance.percentage}%
                            </span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-4 space-y-3">
                  <Button
                    variant="primary"
                    onClick={handleConfirm}
                    disabled={
                      !actualWeight || actualWeight === 0 ||
                      (variance?.isSignificant && !reconciliationComments)
                    }
                    loading={isSubmitting}
                    className="w-full"
                  >
                    Confirm Receipt
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => navigate('/refining')}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>

                {variance?.isSignificant && !reconciliationComments && (
                  <p className="text-xs text-red-600">
                    Reconciliation comments are required for significant variances
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary-500" />
                  Field Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Scale className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Weight Verification</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          Use calibrated scales to measure the actual weight received. Record weight in grams with decimal precision.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Variance Threshold</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          Acceptable variance is ±{variance?.threshold || 2}%. Variances exceeding this require reconciliation and supervisor approval.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Documentation</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          For significant variances, provide detailed justification explaining the cause and any corrective actions taken.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
