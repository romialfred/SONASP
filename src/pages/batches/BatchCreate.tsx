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
import { createBatch, getSites, getTransportCompanies, getRefineries } from '@/services/batchCreationService';
import type { CreateBatchData } from '@/services/batchCreationService';

interface FormData {
  shipping_date: string;
  weight_grams: string;
  purity_percentage: string;
  site_id: string;
  mine_to_airport_transport_id: string;
  airport_to_refinery_transport_id: string;
  destination_refinery_id: string;
  comments: string;
}

interface FormErrors {
  shipping_date?: string;
  weight_grams?: string;
  purity_percentage?: string;
  site_id?: string;
  mine_to_airport_transport_id?: string;
  airport_to_refinery_transport_id?: string;
  destination_refinery_id?: string;
}

export function BatchCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    shipping_date: new Date().toISOString().split('T')[0],
    weight_grams: '',
    purity_percentage: '',
    site_id: '',
    mine_to_airport_transport_id: '',
    airport_to_refinery_transport_id: '',
    destination_refinery_id: '',
    comments: '',
  });
  const [sites, setSites] = useState<any[]>([]);
  const [mineToAirportTransports, setMineToAirportTransports] = useState<any[]>([]);
  const [airportToRefineryTransports, setAirportToRefineryTransports] = useState<any[]>([]);
  const [refineries, setRefineries] = useState<any[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [batchNumber, setBatchNumber] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const number = generateBatchNumber('GN', new Date(formData.shipping_date));
    setBatchNumber(number);
  }, [formData.shipping_date]);

  useEffect(() => {
    loadSites();
    loadTransportCompanies();
    loadRefineries();
  }, []);

  const loadSites = async () => {
    const sitesData = await getSites();
    setSites(sitesData);
  };

  const loadTransportCompanies = async () => {
    const mineToAirport = await getTransportCompanies('mine_to_airport');
    const airportToRefinery = await getTransportCompanies('airport_to_refinery');
    setMineToAirportTransports(mineToAirport);
    setAirportToRefineryTransports(airportToRefinery);
  };

  const loadRefineries = async () => {
    const refineriesData = await getRefineries();
    setRefineries(refineriesData);
  };

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

    if (!formData.purity_percentage) {
      newErrors.purity_percentage = 'Purity is required';
    } else {
      const purity = parseFloat(formData.purity_percentage);
      if (purity <= 0 || purity > 100) {
        newErrors.purity_percentage = 'Purity must be between 0 and 100';
      }
    }

    if (!formData.site_id) {
      newErrors.site_id = 'Site selection is required';
    }

    if (!formData.mine_to_airport_transport_id) {
      newErrors.mine_to_airport_transport_id = 'Mine to airport transport company is required';
    }

    if (!formData.airport_to_refinery_transport_id) {
      newErrors.airport_to_refinery_transport_id = 'Airport to refinery transport company is required';
    }

    if (!formData.destination_refinery_id) {
      newErrors.destination_refinery_id = 'Destination refinery is required';
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
      const batchData: CreateBatchData = {
        origin_site_id: formData.site_id,
        weight_grams: parseFloat(formData.weight_grams),
        purity_percentage: parseFloat(formData.purity_percentage),
        shipping_date: formData.shipping_date,
        mine_to_airport_transport_id: formData.mine_to_airport_transport_id,
        airport_to_refinery_transport_id: formData.airport_to_refinery_transport_id,
        destination_refinery_id: formData.destination_refinery_id,
        comments: formData.comments || undefined,
      };

      const result = await createBatch(batchData);

      if (result.success) {
        localStorage.removeItem('batch_draft');
        navigate('/batches', {
          state: { message: 'Batch created successfully!' }
        });
      } else {
        alert('Error creating batch: ' + result.error);
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('Error creating batch:', error);
      alert('Error: ' + error.message);
      setIsSubmitting(false);
    } finally {
      setShowConfirmModal(false);
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

                <FormField
                  label="Purity (%)"
                  required
                  error={errors.purity_percentage}
                  hint="Percentage purity of the gold (0-100%)"
                >
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={formData.purity_percentage}
                    onChange={(e) => handleInputChange('purity_percentage', e.target.value)}
                    error={!!errors.purity_percentage}
                  />
                </FormField>

                <FormField label="Origin Site" required error={errors.site_id}>
                  <Select
                    value={formData.site_id}
                    onChange={(e) => handleInputChange('site_id', e.target.value)}
                    error={!!errors.site_id}
                  >
                    <option value="">Select site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} - {site.country}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Transportation & Destination</h3>

                  <FormField
                    label="Mine to Airport Transport Company"
                    required
                    error={errors.mine_to_airport_transport_id}
                    hint="Company responsible for transporting gold from mine to airport"
                  >
                    <Select
                      value={formData.mine_to_airport_transport_id}
                      onChange={(e) => handleInputChange('mine_to_airport_transport_id', e.target.value)}
                      error={!!errors.mine_to_airport_transport_id}
                    >
                      <option value="">Select transport company</option>
                      {mineToAirportTransports.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name} - {company.contact_person || 'N/A'}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField
                    label="Airport to Refinery Transport Company"
                    required
                    error={errors.airport_to_refinery_transport_id}
                    hint="Company responsible for transporting gold from airport to refinery"
                  >
                    <Select
                      value={formData.airport_to_refinery_transport_id}
                      onChange={(e) => handleInputChange('airport_to_refinery_transport_id', e.target.value)}
                      error={!!errors.airport_to_refinery_transport_id}
                    >
                      <option value="">Select transport company</option>
                      {airportToRefineryTransports.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name} - {company.contact_person || 'N/A'}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField
                    label="Destination Refinery"
                    required
                    error={errors.destination_refinery_id}
                    hint="Refinery responsible for processing and sale"
                  >
                    <Select
                      value={formData.destination_refinery_id}
                      onChange={(e) => handleInputChange('destination_refinery_id', e.target.value)}
                      error={!!errors.destination_refinery_id}
                    >
                      <option value="">Select refinery</option>
                      {refineries.map((refinery) => (
                        <option key={refinery.id} value={refinery.id}>
                          {refinery.name} - {refinery.location}, {refinery.country}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

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
                        formData.purity_percentage,
                        formData.site_id,
                        formData.mine_to_airport_transport_id,
                        formData.airport_to_refinery_transport_id,
                        formData.destination_refinery_id,
                      ].filter(Boolean).length}{' '}
                      / 7
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
                            formData.purity_percentage,
                            formData.site_id,
                            formData.mine_to_airport_transport_id,
                            formData.airport_to_refinery_transport_id,
                            formData.destination_refinery_id,
                          ].filter(Boolean).length /
                            7) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Field Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Weight</p>
                    <p className="text-gray-600">Enter weight in grams. System automatically converts to ounces</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Purity</p>
                    <p className="text-gray-600">Percentage purity of the gold (0-100%)</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Mine to Airport Transport</p>
                    <p className="text-gray-600">Company handling the first leg from mine to airport. They will receive notifications when batch is shipped.</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Airport to Refinery Transport</p>
                    <p className="text-gray-600">Company handling the second leg from airport to refinery. They will be notified when batch reaches airport.</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Destination Refinery</p>
                    <p className="text-gray-600">Final refinery for processing and sale. Will receive notifications when batch arrives.</p>
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
