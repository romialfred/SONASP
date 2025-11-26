import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Calculator, Send } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import { FormField } from '@/components/ui/FormField';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { formatWeight } from '@/utils/salesUtils';

function calculateFinalFine(
  postMeltingWeight: number,
  fineness: number,
  metalRetained: number
): { finalFineGrams: number; finalFineOunces: number } {
  const finalFineGrams = postMeltingWeight * (fineness / 100) * (metalRetained / 100);
  const finalFineOunces = finalFineGrams / 31.1035;
  return { finalFineGrams, finalFineOunces };
}

interface FormData {
  pre_melting_weight: string;
  post_melting_weight: string;
  fineness: string;
  metal_retained: string;
  processing_notes: string;
}

export function RefiningProcess() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    pre_melting_weight: '',
    post_melting_weight: '',
    fineness: '',
    metal_retained: '',
    processing_notes: '',
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const batch = {
    id: id,
    batch_number: 'BT-202410-GN-0001',
    received_weight_grams: 1250.5,
    origin_site: 'Conakry Factory',
  };

  const finalFine =
    formData.post_melting_weight && formData.fineness && formData.metal_retained
      ? calculateFinalFine(
          parseFloat(formData.post_melting_weight),
          parseFloat(formData.fineness),
          parseFloat(formData.metal_retained)
        )
      : null;

  const weightLoss =
    formData.pre_melting_weight && formData.post_melting_weight
      ? parseFloat(formData.pre_melting_weight) - parseFloat(formData.post_melting_weight)
      : 0;

  const weightLossPercentage =
    formData.pre_melting_weight && weightLoss
      ? (weightLoss / parseFloat(formData.pre_melting_weight)) * 100
      : 0;

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    return (
      formData.pre_melting_weight &&
      formData.post_melting_weight &&
      formData.fineness &&
      formData.metal_retained &&
      parseFloat(formData.fineness) >= 0 &&
      parseFloat(formData.fineness) <= 100 &&
      parseFloat(formData.metal_retained) >= 0 &&
      parseFloat(formData.metal_retained) <= 100
    );
  };

  const handleSubmit = () => {
    if (isFormValid()) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);

    try {
      console.log('Submitting refining data:', {
        batch_id: batch.id,
        ...formData,
        final_fine: finalFine,
      });

      setTimeout(() => {
        setIsSubmitting(false);
        setShowConfirmModal(false);
        navigate('/refining');
      }, 1500);
    } catch (error) {
      console.error('Error submitting refining data:', error);
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
              Process Refining
            </h1>
            <p className="text-gray-600 mt-1">Enter refining process details</p>
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
                    <p className="text-sm text-gray-600">Received Weight</p>
                    <p className="text-base font-semibold text-gray-900">
                      {formatWeight(batch.received_weight_grams)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weight Measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  label="Pre-Melting Weight (grams)"
                  required
                  hint="Weight before melting process"
                >
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.pre_melting_weight}
                    onChange={(e) =>
                      handleInputChange('pre_melting_weight', e.target.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Post-Melting Weight (grams)"
                  required
                  hint="Weight after melting process"
                >
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.post_melting_weight}
                    onChange={(e) =>
                      handleInputChange('post_melting_weight', e.target.value)
                    }
                  />
                </FormField>

                {weightLoss > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Weight Loss</p>
                        <p className="text-lg font-bold text-blue-700">
                          {weightLoss.toFixed(2)}g
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Loss Percentage</p>
                        <p className="text-lg font-bold text-blue-700">
                          {weightLossPercentage.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Refining Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  label="Fineness (%)"
                  required
                  hint="Purity percentage (0-100)"
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    value={formData.fineness}
                    onChange={(e) => handleInputChange('fineness', e.target.value)}
                  />
                </FormField>

                <FormField
                  label="Metal Retained (%)"
                  required
                  hint="Retention percentage (0-100)"
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    value={formData.metal_retained}
                    onChange={(e) =>
                      handleInputChange('metal_retained', e.target.value)
                    }
                  />
                </FormField>

                {finalFine && (
                  <div className="p-4 bg-accent-50 border-2 border-accent-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Calculator className="h-6 w-6 text-accent-600" />
                      <h4 className="font-semibold text-accent-900">
                        Calculated Final Fine
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Grams</p>
                        <p className="text-2xl font-bold text-accent-700">
                          {finalFine.finalFineGrams.toFixed(2)}g
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Ounces</p>
                        <p className="text-2xl font-bold text-accent-700">
                          {finalFine.finalFineOunces.toFixed(2)} oz
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  label="Operator Notes"
                  hint="Any observations or special conditions during processing"
                >
                  <TextArea
                    placeholder="Enter processing notes..."
                    value={formData.processing_notes}
                    onChange={(e) =>
                      handleInputChange('processing_notes', e.target.value)
                    }
                    rows={4}
                  />
                </FormField>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Processing Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pre-Melting:</span>
                    <span className="font-semibold">
                      {formData.pre_melting_weight
                        ? `${formData.pre_melting_weight}g`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Post-Melting:</span>
                    <span className="font-semibold">
                      {formData.post_melting_weight
                        ? `${formData.post_melting_weight}g`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fineness:</span>
                    <span className="font-semibold">
                      {formData.fineness ? `${formData.fineness}%` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Metal Retained:</span>
                    <span className="font-semibold">
                      {formData.metal_retained ? `${formData.metal_retained}%` : '-'}
                    </span>
                  </div>
                  {finalFine && (
                    <div className="flex justify-between text-sm pt-3 border-t">
                      <span className="text-gray-600">Final Fine:</span>
                      <span className="font-bold text-accent-600">
                        {finalFine.finalFineGrams.toFixed(2)}g
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 space-y-3">
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!isFormValid()}
                    className="w-full gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Submit for Approval
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => navigate('/refining')}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Approval Process</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold">1.</span>
                    <span>Complete all measurements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold">2.</span>
                    <span>Review calculated final fine</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold">3.</span>
                    <span>Submit for supervisor approval</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500 font-bold">4.</span>
                    <span>Batch ready for sale after approval</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
        <ModalHeader onClose={() => setShowConfirmModal(false)}>
          Confirm Processing Details
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-gray-700">
              Please confirm the refining details before submission:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Batch Number:</span>
                <span className="text-sm font-semibold">{batch.batch_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pre-Melting Weight:</span>
                <span className="text-sm font-semibold">
                  {formData.pre_melting_weight}g
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Post-Melting Weight:</span>
                <span className="text-sm font-semibold">
                  {formData.post_melting_weight}g
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Fineness:</span>
                <span className="text-sm font-semibold">{formData.fineness}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Metal Retained:</span>
                <span className="text-sm font-semibold">
                  {formData.metal_retained}%
                </span>
              </div>
              {finalFine && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm text-gray-600">Final Fine:</span>
                  <span className="text-sm font-bold text-accent-600">
                    {finalFine.finalFineGrams.toFixed(2)}g (
                    {finalFine.finalFineOunces.toFixed(2)} oz)
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600">
              After submission, this batch will be sent to your supervisor for approval.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmSubmit}
            loading={isSubmitting}
          >
            Confirm & Submit
          </Button>
        </ModalFooter>
      </Modal>
    </MainLayout>
  );
}
