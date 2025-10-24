import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TextArea from '@/components/ui/TextArea';
import DatePicker from '@/components/ui/DatePicker';
import { FormField } from '@/components/ui/FormField';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { generateBatchNumber, gramsToOunces } from '@/utils/batchUtils';

interface FormData {
  shipping_date: string;
  weight_grams: string;
  site_id: string;
  transportation_company: string;
  comments: string;
}

interface FormErrors {
  shipping_date?: string;
  weight_grams?: string;
  site_id?: string;
}

export function BatchCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    shipping_date: new Date().toISOString().split('T')[0],
    weight_grams: '',
    site_id: '',
    transportation_company: '',
    comments: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [batchNumber, setBatchNumber] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const number = generateBatchNumber('GN', new Date(formData.shipping_date));
    setBatchNumber(number);
  }, [formData.shipping_date]);

  const weightInOunces = formData.weight_grams
    ? gramsToOunces(parseFloat(formData.weight_grams))
    : 0;

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.shipping_date) {
      newErrors.shipping_date = 'Shipping date is required';
    }

    if (!formData.weight_grams) {
      newErrors.weight_grams = 'Weight is required';
    } else if (parseFloat(formData.weight_grams) <= 0) {
      newErrors.weight_grams = 'Weight must be greater than 0';
    }

    if (!formData.site_id) {
      newErrors.site_id = 'Site selection is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem('batch_draft', JSON.stringify(formData));
    console.log('Draft saved');
  };

  const handleSubmit = () => {
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);

    try {
      console.log('Submitting batch:', {
        ...formData,
        batch_number: batchNumber,
        weight_ounces: weightInOunces,
      });

      setTimeout(() => {
        setIsSubmitting(false);
        setShowConfirmModal(false);
        localStorage.removeItem('batch_draft');
        navigate('/batches');
      }, 1500);
    } catch (error) {
      console.error('Error creating batch:', error);
      setIsSubmitting(false);
    }
  };

  const characterLimit = 500;
  const remainingChars = characterLimit - formData.comments.length;

  return (
    <MainLayout userRole="factory">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/batches')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Create New Batch
            </h1>
            <p className="text-gray-600 mt-1">Register a new gold shipment batch</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Auto-generated Batch Number</p>
                  <p className="text-2xl font-bold text-primary-700">{batchNumber}</p>
                </div>

                <FormField
                  label="Shipping Date"
                  required
                  error={errors.shipping_date}
                >
                  <DatePicker
                    value={formData.shipping_date}
                    onChange={(e) => handleInputChange('shipping_date', e.target.value)}
                    error={!!errors.shipping_date}
                  />
                </FormField>

                <FormField
                  label="Weight (grams)"
                  required
                  error={errors.weight_grams}
                  hint="Enter weight in grams. Conversion to ounces will be automatic."
                >
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.weight_grams}
                    onChange={(e) => handleInputChange('weight_grams', e.target.value)}
                    error={!!errors.weight_grams}
                  />
                  {formData.weight_grams && (
                    <p className="text-sm text-gray-600 mt-2">
                      ≈ <span className="font-semibold">{weightInOunces.toFixed(2)} oz</span>
                    </p>
                  )}
                </FormField>

                <FormField label="Origin Site" required error={errors.site_id}>
                  <Select
                    value={formData.site_id}
                    onChange={(e) => handleInputChange('site_id', e.target.value)}
                    error={!!errors.site_id}
                  >
                    <option value="">Select site</option>
                    <option value="1">Conakry Factory - Guinea</option>
                    <option value="2">Abidjan Factory - Côte d'Ivoire</option>
                    <option value="3">Bamako Factory - Mali</option>
                  </Select>
                </FormField>

                <FormField label="Transportation Company">
                  <Input
                    placeholder="Enter transporter name"
                    value={formData.transportation_company}
                    onChange={(e) =>
                      handleInputChange('transportation_company', e.target.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Comments"
                  hint={`${remainingChars} characters remaining`}
                >
                  <TextArea
                    placeholder="Add any relevant comments about this batch..."
                    value={formData.comments}
                    onChange={(e) => {
                      if (e.target.value.length <= characterLimit) {
                        handleInputChange('comments', e.target.value);
                      }
                    }}
                    rows={4}
                  />
                </FormField>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  className="w-full gap-2"
                >
                  <Send className="h-4 w-4" />
                  Submit Batch
                </Button>

                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  className="w-full gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save as Draft
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => navigate('/batches')}
                  className="w-full"
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Form Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Required Fields</span>
                    <span className="font-medium">
                      {[
                        formData.shipping_date,
                        formData.weight_grams,
                        formData.site_id,
                      ].filter(Boolean).length}{' '}
                      / 3
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          ([
                            formData.shipping_date,
                            formData.weight_grams,
                            formData.site_id,
                          ].filter(Boolean).length /
                            3) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
        <ModalHeader onClose={() => setShowConfirmModal(false)}>
          Confirm Batch Submission
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-gray-700">
              Please confirm the batch details before submission:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Batch Number:</span>
                <span className="text-sm font-semibold">{batchNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Weight:</span>
                <span className="text-sm font-semibold">
                  {formData.weight_grams}g ({weightInOunces.toFixed(2)} oz)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Shipping Date:</span>
                <span className="text-sm font-semibold">
                  {new Date(formData.shipping_date).toLocaleDateString()}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              After submission, the batch status will be set to "Shipped" and notifications
              will be sent to the receiving team.
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
