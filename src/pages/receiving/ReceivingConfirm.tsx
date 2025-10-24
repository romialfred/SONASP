import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import { FormField } from '@/components/ui/FormField';
import { AlertBox } from '@/components/dashboard/AlertBox';
import { FileUpload } from '@/components/ui/FileUpload';
import { calculateVariance, formatWeight } from '@/utils/batchUtils';

export function ReceivingConfirm() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [actualWeight, setActualWeight] = useState('');
  const [reconciliationComments, setReconciliationComments] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const batch = {
    id: id,
    batch_number: 'BT-202410-GN-0001',
    origin_site: 'Conakry Factory',
    expected_weight_grams: 1250.5,
    shipping_date: '2024-10-20',
    transportation_company: 'TransGold Logistics',
  };

  const variance = actualWeight
    ? calculateVariance(batch.expected_weight_grams, parseFloat(actualWeight))
    : null;

  const canConfirmWithoutReconciliation = variance
    ? !variance.isSignificant
    : false;

  const handleFileSelect = (files: File[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleConfirm = async () => {
    if (!actualWeight) {
      return;
    }

    if (variance?.isSignificant && !reconciliationComments) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Confirming receipt:', {
        batch_id: batch.id,
        actual_weight: parseFloat(actualWeight),
        variance,
        reconciliation_comments: reconciliationComments,
        uploaded_files: uploadedFiles.length,
      });

      setTimeout(() => {
        setIsSubmitting(false);
        navigate('/receiving');
      }, 1500);
    } catch (error) {
      console.error('Error confirming receipt:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout userRole="airport">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/receiving')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Confirm Receipt
            </h1>
            <p className="text-gray-600 mt-1">
              Verify and confirm batch receipt at airport
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
                    <p className="text-sm text-gray-600">Origin Site</p>
                    <p className="text-base font-semibold text-gray-900">
                      {batch.origin_site}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Expected Weight</p>
                    <p className="text-base font-semibold text-gray-900">
                      {formatWeight(batch.expected_weight_grams)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Transportation</p>
                    <p className="text-base font-semibold text-gray-900">
                      {batch.transportation_company}
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
                  label="Actual Received Weight (grams)"
                  required
                  hint="Enter the actual weight received after verification"
                >
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={actualWeight}
                    onChange={(e) => setActualWeight(e.target.value)}
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
                              {variance.difference}g
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
                            <p className="text-base font-bold text-gray-700">±2%</p>
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
                    variant="warning"
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
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Expected:</span>
                    <span className="font-semibold">
                      {formatWeight(batch.expected_weight_grams)}
                    </span>
                  </div>
                  {actualWeight && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Actual:</span>
                        <span className="font-semibold">
                          {formatWeight(parseFloat(actualWeight))}
                        </span>
                      </div>
                      {variance && (
                        <div className="flex justify-between text-sm pt-3 border-t">
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
                      )}
                    </>
                  )}
                </div>

                <div className="pt-4 space-y-3">
                  <Button
                    variant="primary"
                    onClick={handleConfirm}
                    disabled={
                      !actualWeight ||
                      (variance?.isSignificant && !reconciliationComments)
                    }
                    loading={isSubmitting}
                    className="w-full"
                  >
                    Confirm Receipt
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => navigate('/receiving')}
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

            {variance?.isSignificant && (
              <Card>
                <CardHeader>
                  <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-500 font-bold">1.</span>
                      <span>Provide detailed justification</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-500 font-bold">2.</span>
                      <span>Upload supporting documents</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-500 font-bold">3.</span>
                      <span>Supervisor approval will be required</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-500 font-bold">4.</span>
                      <span>Batch will be held pending review</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
