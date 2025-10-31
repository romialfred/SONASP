import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotification } from '@/contexts/NotificationContext';
import { ArrowLeft, Save, Send, Upload, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TextArea from '@/components/ui/TextArea';
import DatePicker from '@/components/ui/DatePicker';
import { FormField } from '@/components/ui/FormField';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { FieldGuidePanel, FieldGuideItem } from '@/components/ui/FieldGuidePanel';
import { WeightInput } from '@/components/ui/WeightInput';
import { generateBatchNumber, gramsToOunces } from '@/utils/batchUtils';
import { createBatch, getSites, getTransportCompanies, getRefineries } from '@/services/batchCreationService';
import type { CreateBatchData } from '@/services/batchCreationService';
import { supabase } from '@/lib/supabase';
import { extractArrayData } from '@/utils/arrayUtils';
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';

interface FormData {
  shipping_date: string;
  weight_grams: string;
  metal_type: 'gold' | 'silver' | 'zinc' | 'diamond' | 'other';
  mining_company_id: string;
  mine_to_airport_transport_id: string;
  airport_to_refinery_transport_id: string;
  destination_refinery_id: string;
  comments: string;
}

interface FormErrors {
  shipping_date?: string;
  weight_grams?: string;
  metal_type?: string;
  mining_company_id?: string;
  mine_to_airport_transport_id?: string;
  airport_to_refinery_transport_id?: string;
  destination_refinery_id?: string;
}

interface UploadedDocument {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export function BatchCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();
  const [formData, setFormData] = useState<FormData>({
    shipping_date: new Date().toISOString().split('T')[0],
    weight_grams: '',
    metal_type: 'gold',
    mining_company_id: '',
    mine_to_airport_transport_id: '',
    airport_to_refinery_transport_id: '',
    destination_refinery_id: '',
    comments: '',
  });
  const [miningCompanies, setMiningCompanies] = useState<any[]>([]);
  const [mineToAirportTransports, setMineToAirportTransports] = useState<any[]>([]);
  const [airportToRefineryTransports, setAirportToRefineryTransports] = useState<any[]>([]);
  const [refineries, setRefineries] = useState<any[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [batchNumber, setBatchNumber] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string>('');

  const fieldGuides: FieldGuideItem[] = [
    {
      field: 'shipping_date',
      label: 'Shipping Date',
      description: 'Date when batch ships from mine to airport.',
      example: 'Ex: 27/10/2025',
      required: true,
      rules: [
        'Today or future date only',
        'Used in batch number: GN-YYYYMMDD-XXX'
      ]
    },
    {
      field: 'metal_type',
      label: 'Metal Type',
      description: 'Type of precious metal being shipped.',
      example: 'Ex: Gold',
      required: true,
      rules: [
        'Gold, Silver, Zinc, Diamond, Other',
        'Affects refining process'
      ]
    },
    {
      field: 'weight_grams',
      label: 'Weight (grams)',
      description: 'Gross weight in grams. Auto-converts to ounces.',
      example: 'Ex: 34000g = 1093.12 oz',
      required: true,
      rules: [
        'Positive number, decimals allowed',
        'Minimum: 0.01g'
      ]
    },
    {
      field: 'mining_company_id',
      label: 'Mining Company',
      description: 'Company providing this batch.',
      example: 'Ex: Société Minière XYZ',
      required: true,
      rules: [
        'Only active companies shown'
      ]
    },
    {
      field: 'mine_to_airport_transport_id',
      label: 'Mine to Airport Transport',
      description: 'Transport company for first leg (mine → airport).',
      example: 'Ex: Guinea Express',
      required: true,
      rules: [
        'Active companies only'
      ]
    },
    {
      field: 'airport_to_refinery_transport_id',
      label: 'Airport to Refinery Transport',
      description: 'International transport (airport → refinery).',
      example: 'Ex: DHL Cargo',
      required: true,
      rules: [
        'Handles customs & international shipping'
      ]
    },
    {
      field: 'destination_refinery_id',
      label: 'Destination Refinery',
      description: 'Refinery for processing and purification.',
      example: 'Ex: Kaloti - Dubai, UAE',
      required: true,
      rules: [
        'Active refineries only',
        'Affects timelines & rates'
      ]
    },
    {
      field: 'documents',
      label: 'Documents',
      description: 'Upload permits, certificates, manifests, or photos.',
      example: 'Ex: export_permit.pdf',
      required: false,
      rules: [
        'Multiple files allowed',
        'PDF, JPG, PNG, DOC, XLS',
        'Max: 10MB per file'
      ]
    },
    {
      field: 'comments',
      label: 'Comments',
      description: 'Add notes or special instructions (optional).',
      example: 'Ex: High-grade ore, special handling',
      required: false,
      rules: [
        'Max 500 characters',
        'Visible to all stakeholders'
      ]
    }
  ];

  useEffect(() => {
    const number = generateBatchNumber('GN', new Date(formData.shipping_date));
    setBatchNumber(number);
  }, [formData.shipping_date]);

  useEffect(() => {
    loadMiningCompanies();
    loadTransportCompanies();
    loadRefineries();
  }, []);

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name, code, country')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMiningCompanies(data || []);
    } catch (error) {
      console.error('Error loading mining companies:', error);
    }
  };


  const loadTransportCompanies = async () => {
    try {
      const mineToAirport = await getTransportCompanies('mine_to_airport');
      const airportToRefinery = await getTransportCompanies('airport_to_refinery');
      setMineToAirportTransports(extractArrayData(mineToAirport));
      setAirportToRefineryTransports(extractArrayData(airportToRefinery));
    } catch (error) {
      console.error('Error loading transport companies:', error);
      setMineToAirportTransports([]);
      setAirportToRefineryTransports([]);
    }
  };

  const loadRefineries = async () => {
    try {
      const refineriesData = await getRefineries();
      setRefineries(extractArrayData(refineriesData));
    } catch (error) {
      console.error('Error loading refineries:', error);
      setRefineries([]);
    }
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

    if (!formData.metal_type) {
      newErrors.metal_type = 'Metal type is required';
    }

    if (!formData.mining_company_id) {
      newErrors.mining_company_id = 'Mining company is required';
    }

    if (!formData.mine_to_airport_transport_id) {
      newErrors.mine_to_airport_transport_id = 'Mine to airport transport is required';
    }

    if (!formData.airport_to_refinery_transport_id) {
      newErrors.airport_to_refinery_transport_id = 'Airport to refinery transport is required';
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

  const ensureStorageBucketExists = async (bucketName: string): Promise<boolean> => {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        console.error('Error listing buckets:', listError);
        return false;
      }

      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

      if (bucketExists) {
        return true;
      }

      // Try to create the bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
        return false;
      }

      console.log(`Bucket '${bucketName}' created successfully`);
      return true;
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      return false;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      // Note: We skip checking if buckets exist because it requires special permissions
      // Instead, we'll try to upload directly and handle errors appropriately
      console.log('Starting file upload to documents bucket...');

      for (const file of Array.from(files)) {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          showError('File Too Large', `${file.name} exceeds the 10MB limit`);
          continue;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
          showError('Invalid File Type', `${file.name} is not a supported file type (PDF, JPG, PNG, DOC, DOCX only)`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const fileName = `${timestamp}_${randomStr}.${fileExt}`;
        const filePath = `batch-documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error details:', uploadError);
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message || 'Storage bucket may not be configured correctly'}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        const newDoc: UploadedDocument = {
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        };

        setDocuments(prev => [...prev, newDoc]);
        showSuccess('File Uploaded', `${file.name} uploaded successfully`);
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      showError('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveDraft = () => {
    localStorage.setItem('batch_draft', JSON.stringify({ ...formData, documents }));
    showSuccess('Draft Saved', 'Your batch draft has been saved successfully.');
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
        mining_company_id: formData.mining_company_id,
        weight_grams: parseFloat(formData.weight_grams),
        metal_type: formData.metal_type,
        shipping_date: formData.shipping_date,
        mine_to_airport_transport_id: formData.mine_to_airport_transport_id,
        airport_to_refinery_transport_id: formData.airport_to_refinery_transport_id,
        destination_refinery_id: formData.destination_refinery_id,
        documents: documents,
        comments: formData.comments || undefined,
      };

      const result = await createBatch(batchData);

      if (result.success) {
        localStorage.removeItem('batch_draft');
        showSuccess('Batch Created', `Batch ${result.data.batch_number} has been created successfully!`);
        setTimeout(() => {
          navigateWithAutoRefresh(navigate, '/batches');
        }, 1500);
      } else {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'An unexpected error occurred';

        showError(
          'Creation Failed',
          <div className="space-y-2">
            <p className="font-semibold">Unable to create batch</p>
            <p className="text-sm text-gray-600">{errorMessage}</p>
            <p className="text-xs text-gray-500 mt-2">Please check all required fields and try again.</p>
          </div>
        );
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('Error creating batch:', error);
      const errorMessage = error?.message || error?.error_description || 'An unexpected error occurred';

      showError(
        'Unexpected Error',
        <div className="space-y-2">
          <p className="font-semibold">An error occurred</p>
          <p className="text-sm text-gray-600">{errorMessage}</p>
        </div>
      );
      setIsSubmitting(false);
    } finally {
      setShowConfirmModal(false);
    }
  };

  const characterLimit = 500;
  const remainingChars = characterLimit - formData.comments.length;

  return (
    <MainLayout>
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
            <p className="text-gray-600 mt-1">Register a new precious metals shipment batch</p>
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

                {/* Row 1: Shipping Date and Metal Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Shipping Date"
                    required
                    error={errors.shipping_date}
                  >
                    <DatePicker
                      value={formData.shipping_date}
                      onChange={(e) => handleInputChange('shipping_date', e.target.value)}
                      onFocus={() => setFocusedField('shipping_date')}
                      onBlur={() => setFocusedField('')}
                      error={!!errors.shipping_date}
                    />
                  </FormField>

                  <FormField
                    label="Metal Type"
                    required
                    error={errors.metal_type}
                    hint="Type of precious metal being shipped"
                  >
                    <Select
                      value={formData.metal_type}
                      onChange={(e) => handleInputChange('metal_type', e.target.value as any)}
                      onFocus={() => setFocusedField('metal_type')}
                      onBlur={() => setFocusedField('')}
                      error={!!errors.metal_type}
                    >
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                      <option value="zinc">Zinc</option>
                      <option value="diamond">Diamond</option>
                      <option value="other">Other</option>
                    </Select>
                  </FormField>
                </div>

                {/* Row 2: Mining Company */}
                <FormField
                  label="Mining Company"
                  required
                  hint="Select the mining company providing this batch"
                >
                  <Select
                    value={formData.mining_company_id}
                    onChange={(e) => handleInputChange('mining_company_id', e.target.value)}
                    onFocus={() => setFocusedField('mining_company_id')}
                    onBlur={() => setFocusedField('')}
                  >
                    <option value="">Select Mining Company</option>
                    {miningCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.code}) - {company.country}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {/* Row 3: Weight */}
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    label="Weight"
                    required
                    error={errors.weight_grams}
                  >
                    <WeightInput
                      value={parseFloat(formData.weight_grams) || 0}
                      onChange={(grams) => handleInputChange('weight_grams', grams.toString())}
                      placeholder="Enter weight"
                      error={!!errors.weight_grams}
                      onFocus={() => setFocusedField('weight_grams')}
                      onBlur={() => setFocusedField('')}
                      defaultUnit="oz"
                      showConversion={true}
                    />
                  </FormField>

                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Transportation & Destination</h3>

                  {/* Row 3: Mine to Airport and Airport to Refinery Transport */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <FormField
                      label="Mine to Airport Transport"
                      required
                      error={errors.mine_to_airport_transport_id}
                      hint="Company for first leg transport"
                    >
                      <Select
                        value={formData.mine_to_airport_transport_id}
                        onChange={(e) => handleInputChange('mine_to_airport_transport_id', e.target.value)}
                        onFocus={() => setFocusedField('mine_to_airport_transport_id')}
                        onBlur={() => setFocusedField('')}
                        error={!!errors.mine_to_airport_transport_id}
                      >
                        <option value="">Select transport company</option>
                        {Array.isArray(mineToAirportTransports) && mineToAirportTransports.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField
                      label="Airport to Refinery Transport"
                      required
                      error={errors.airport_to_refinery_transport_id}
                      hint="Company for second leg transport"
                    >
                      <Select
                        value={formData.airport_to_refinery_transport_id}
                        onChange={(e) => handleInputChange('airport_to_refinery_transport_id', e.target.value)}
                        onFocus={() => setFocusedField('airport_to_refinery_transport_id')}
                        onBlur={() => setFocusedField('')}
                        error={!!errors.airport_to_refinery_transport_id}
                      >
                        <option value="">Select transport company</option>
                        {Array.isArray(airportToRefineryTransports) && airportToRefineryTransports.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  {/* Row 4: Destination Refinery */}
                  <FormField
                    label="Destination Refinery"
                    required
                    error={errors.destination_refinery_id}
                    hint="Refinery for processing and sale"
                  >
                    <Select
                      value={formData.destination_refinery_id}
                      onChange={(e) => handleInputChange('destination_refinery_id', e.target.value)}
                      onFocus={() => setFocusedField('destination_refinery_id')}
                      onBlur={() => setFocusedField('')}
                      error={!!errors.destination_refinery_id}
                    >
                      <option value="">Select refinery</option>
                      {Array.isArray(refineries) && refineries.map((refinery) => (
                        <option key={refinery.id} value={refinery.id}>
                          {refinery.name} - {refinery.location}, {refinery.country}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>

                  <FormField
                    label="Attach Documents"
                    hint="Upload shipping manifests, certificates, photos, etc."
                  >
                    <div className="space-y-3">
                      <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                        <div className="text-center">
                          <Upload className="mx-auto h-8 w-8 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-600">
                            {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                          </p>
                          <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
                        </div>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>

                      {Array.isArray(documents) && documents.length > 0 && (
                        <div className="space-y-2">
                          {documents.map((doc, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                                <p className="text-xs text-gray-500">{(doc.size / 1024).toFixed(1)} KB</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDocument(index)}
                                className="ml-3 text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
                    onFocus={() => setFocusedField('comments')}
                    onBlur={() => setFocusedField('')}
                    rows={4}
                  />
                </FormField>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Actions Card - Sticky at top */}
            <div className="sticky top-4 z-10">
              <Card className="shadow-lg">
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
            </div>

            {/* Field Guide Panel */}
            <FieldGuidePanel
              title="Batch Creation Guide"
              guides={fieldGuides}
              currentField={focusedField}
            />

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
                        formData.metal_type,
                        formData.mining_company_id,
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
                            formData.metal_type,
                            formData.mining_company_id,
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
                <span className="text-sm text-gray-600">Metal Type:</span>
                <span className="text-sm font-semibold capitalize">{formData.metal_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Weight:</span>
                <span className="text-sm font-semibold">
                  {formData.weight_grams}g ({weightInOunces.toFixed(2)} oz)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Documents:</span>
                <span className="text-sm font-semibold">{documents.length} file(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Shipping Date:</span>
                <span className="text-sm font-semibold">
                  {new Date(formData.shipping_date).toLocaleDateString()}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              After submission, the batch status will be set to "Created" and notifications
              will be sent to transport companies and refinery.
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
