import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { FieldGuidePanel } from '@/components/ui/FieldGuidePanel';
import { Select } from '@/components/ui/Select';
import { FileUpload } from '@/components/ui/FileUpload';
import { Alert } from '@/components/ui/Alert';
import { WeightInputWithUnit } from '@/components/ui/WeightInputWithUnit';
import { licenseRequestService } from '@/services/licenseRequestService';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/contexts/NotificationContext';
import { AlertCircle, FileText, Save, Send, Plus, X, Calendar, TrendingUp, Package } from 'lucide-react';
import type { DocumentType } from '@/types/license';
import { convertWeight, type WeightUnit } from '@/utils/weightConversion';

interface MiningCompany {
  id: string;
  name: string;
}

interface Document {
  title: string;
  type: DocumentType;
  description: string;
  file: File | null;
}

export function LicenseRequestForm() {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useNotification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [companiesError, setCompaniesError] = useState('');
  const [formData, setFormData] = useState({
    mine_id: '',
    mine_name: '',
    title: '',
    planned_quantity_oz: '',
    planned_start_date: '',
    planned_end_date: '',
    comments: '',
    priority: 'NORMAL',
  });

  const [quantityUnit, setQuantityUnit] = useState<'g' | 'oz' | 'ozt'>('ozt');

  const [durationInfo, setDurationInfo] = useState<{
    days: number;
    estimatedShipments: number;
    avgQuantityPerShipment: number;
  } | null>(null);

  const [documents, setDocuments] = useState<Document[]>([
    { title: '', type: 'APPLICATION_FORM', description: '', file: null },
  ]);

  const [signatureData, setSignatureData] = useState({
    applicant_signatory_name: '',
    applicant_signatory_title: '',
    certification_accepted: false,
  });

  useEffect(() => {
    loadMiningCompanies();
  }, []);

  const loadMiningCompanies = async () => {
    try {
      setLoadingCompanies(true);
      setCompaniesError('');

      const { data, error: queryError } = await supabase
        .from('mining_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (queryError) {
        console.error('Error loading mining companies:', queryError);
        setCompaniesError(`Database error: ${queryError.message}`);
        setMiningCompanies([]);
      } else if (!data || data.length === 0) {
        console.warn('No active mining companies found');
        setCompaniesError('No active mining companies found. Please contact administrator.');
        setMiningCompanies([]);
      } else {
        console.log(`Loaded ${data.length} mining companies:`, data);
        setMiningCompanies(data);
      }
    } catch (err: any) {
      console.error('Error loading mining companies:', err);
      setCompaniesError(err.message || 'Failed to load mining companies');
      setMiningCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleMineChange = (mineId: string) => {
    const company = miningCompanies.find(c => c.id === mineId);
    setFormData({
      ...formData,
      mine_id: mineId,
      mine_name: company?.name || '',
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });

    if (field === 'planned_start_date' || field === 'planned_end_date') {
      calculateDuration({ ...formData, [field]: value });
    }
    if (field === 'planned_quantity_oz') {
      calculateDuration({ ...formData, [field]: value });
    }
  };

  const handleQuantityChange = (value: string, unit: WeightUnit) => {
    setQuantityUnit(unit);

    // Convert to troy ounces for storage (database stores in oz t)
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      const ozValue = convertWeight(numValue, unit, 'ozt');
      setFormData({ ...formData, planned_quantity_oz: ozValue.toString() });
      calculateDuration({ ...formData, planned_quantity_oz: ozValue.toString() });
    } else {
      setFormData({ ...formData, planned_quantity_oz: value });
    }
  };

  const calculateDuration = (data: typeof formData) => {
    if (!data.planned_start_date || !data.planned_end_date || !data.planned_quantity_oz) {
      setDurationInfo(null);
      return;
    }

    const startDate = new Date(data.planned_start_date);
    const endDate = new Date(data.planned_end_date);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const weeks = diffDays / 7;
    const shipmentsPerWeek = 3;
    const estimatedShipments = Math.ceil(weeks * shipmentsPerWeek);

    const totalQuantity = parseFloat(data.planned_quantity_oz);
    const avgQuantityPerShipment = estimatedShipments > 0
      ? totalQuantity / estimatedShipments
      : 0;

    setDurationInfo({
      days: diffDays,
      estimatedShipments,
      avgQuantityPerShipment,
    });
  };

  const handleDocumentChange = (index: number, field: keyof Document, value: any) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], [field]: value };
    setDocuments(updated);
  };

  const addDocument = () => {
    setDocuments([
      ...documents,
      { title: '', type: 'OTHER', description: '', file: null },
    ]);
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const validateStep1 = (): boolean => {
    if (!formData.title) {
      setError('Please enter a license title');
      return false;
    }
    if (!formData.mine_id) {
      setError('Please select a mining company');
      return false;
    }
    if (!formData.planned_quantity_oz || parseFloat(formData.planned_quantity_oz) <= 0) {
      setError('Please enter a valid planned quantity');
      return false;
    }
    if (!formData.planned_start_date) {
      setError('Please select a start date');
      return false;
    }
    if (!formData.planned_end_date) {
      setError('Please select an end date');
      return false;
    }
    if (formData.planned_start_date > formData.planned_end_date) {
      setError('Start date must be before end date');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    const validDocs = documents.filter(doc => doc.title && doc.file);
    if (validDocs.length === 0) {
      setError('Please upload at least one document');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (!signatureData.applicant_signatory_name) {
      setError('Please enter signatory name');
      return false;
    }
    if (!signatureData.certification_accepted) {
      setError('Please accept the certification');
      return false;
    }
    return true;
  };

  const saveAsDraft = async (): Promise<string | null> => {
    if (!validateStep1()) return null;

    setLoading(true);
    setError('');

    try {
      const data = {
        ...formData,
        planned_quantity_oz: parseFloat(formData.planned_quantity_oz),
      };

      let savedRequestId = requestId;

      if (requestId) {
        await licenseRequestService.updateRequest(requestId, data);
      } else {
        const request = await licenseRequestService.createRequest(data);
        savedRequestId = request.id;
        setRequestId(request.id);
      }

      setError('');
      showSuccess(
        'Draft Saved',
        'Your license request has been saved as a draft. You can continue editing or come back later to complete it.'
      );
      return savedRequestId;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save draft';
      setError(errorMsg);
      showError(
        'Save Failed',
        errorMsg + '. Please check your internet connection and try again.'
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    setError('');

    if (step === 1) {
      if (!validateStep1()) return;
      const savedId = await saveAsDraft();
      if (!savedId) {
        setError('Failed to save draft. Please try again.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      await uploadDocuments();
      setStep(3);
    }
  };

  const previousStep = () => {
    setError('');
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const uploadDocuments = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      for (const doc of documents) {
        if (doc.file && doc.title) {
          await licenseRequestService.uploadDocument(
            requestId,
            doc.file,
            doc.title,
            doc.type,
            doc.description
          );
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to upload documents';
      setError(errorMsg);
      showError(
        'Document Upload Failed',
        errorMsg + '. Please check your files and try again.'
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async () => {
    if (!validateStep3() || !requestId) return;

    setLoading(true);
    setError('');

    try {
      await licenseRequestService.submitRequest(requestId, {
        applicant_signatory_name: signatureData.applicant_signatory_name,
        applicant_signatory_title: signatureData.applicant_signatory_title,
        applicant_certification_text: 'I certify that all information provided is accurate and complete.',
      });

      showSuccess(
        'Request Submitted Successfully',
        'Your export license request has been submitted to the Ministry of Mines for review. You will be notified once it has been processed.',
        {
          confirmText: 'View My Requests',
          onConfirm: () => navigate('/licenses/requests')
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
      showError(
        'Submission Failed',
        err.message || 'An error occurred while submitting your request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldGuides = [
    {
      field: 'title',
      title: 'License Title',
      description: 'A descriptive title for this export license request that helps identify its purpose.',
      examples: ['Q1 2025 Export License', 'Monthly Export - January 2025', 'Special Export Authorization']
    },
    {
      field: 'mine_id',
      title: 'Mining Company',
      description: 'Select the mining company that will be exporting gold under this license. Only active mining companies are shown.',
      examples: ['Mansa Resources', 'SAG Mining Co.', 'Gold Fields Ltd.']
    },
    {
      field: 'planned_quantity_oz',
      title: 'Planned Export Quantity',
      description: 'The total quantity of gold (in troy ounces) you plan to export during the license period. This should match your available inventory.',
      examples: ['1000', '2500.5', '500']
    },
    {
      field: 'planned_dates',
      title: 'License Period',
      description: 'The start and end dates for this export license. The system will calculate the duration and estimate shipment requirements based on 3 shipments per week.',
      examples: ['Start: 01/01/2025, End: 31/01/2025 (31 days)']
    },
    {
      field: 'priority',
      title: 'Request Priority',
      description: 'Set the urgency level for this license request. Normal: Standard processing time. High: Expedited review. Urgent: Immediate attention required.',
      examples: ['Normal', 'High', 'Urgent']
    },
    {
      field: 'comments',
      title: 'Additional Information',
      description: 'Use the rich text editor to provide detailed information about this license request. You can format text, add lists, and structure your content with headings.',
      examples: ['Customer commitments, special requirements, supporting details']
    }
  ];

  return (
    <MainLayout>
      <div className="h-full flex">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">New Export License Request</h1>
              <p className="text-sm text-gray-600 mt-1">
                Submit a request to the Ministry of Mines for gold export authorization
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    s < step
                      ? 'bg-green-500 text-white'
                      : s === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                <div className="ml-3 text-sm">
                  {s === 1 && 'Request Details'}
                  {s === 2 && 'Documents'}
                  {s === 3 && 'Signature'}
                </div>
                {s < 3 && <div className="flex-1 h-1 mx-4 bg-gray-300" />}
              </div>
            ))}
              </div>
            </div>

            {error && (
              <Alert variant="error" className="mb-4">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </Alert>
            )}

            <Card className="p-6">
          {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Request Information</h2>

              <Input
                label="License Title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Q1 2025 Export License"
                required
              />

              <div className="space-y-2">
                <Select
                  label="Mining Company"
                  value={formData.mine_id}
                  onChange={(e) => handleMineChange(e.target.value)}
                  required
                  disabled={loadingCompanies}
                >
                  <option value="">
                    {loadingCompanies
                      ? 'Loading mining companies...'
                      : miningCompanies.length === 0
                      ? 'No active mining companies found'
                      : 'Select a mining company'}
                  </option>
                  {miningCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </Select>
                {companiesError && (
                  <Alert variant="warning" className="text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Mining Companies Issue</p>
                      <p className="text-xs mt-1">{companiesError}</p>
                      <p className="text-xs mt-1">
                        Please run the diagnostic script: <code className="bg-yellow-100 px-1 rounded">CHECK_MINING_COMPANIES.sql</code>
                      </p>
                    </div>
                  </Alert>
                )}
                {!loadingCompanies && miningCompanies.length > 0 && (
                  <p className="text-sm text-green-600">
                    ✓ Loaded {miningCompanies.length} active mining {miningCompanies.length === 1 ? 'company' : 'companies'}
                  </p>
                )}
              </div>

              <WeightInputWithUnit
                label="Planned Export Quantity"
                value={formData.planned_quantity_oz}
                onChange={handleQuantityChange}
                placeholder="Enter quantity"
                defaultUnit="ozt"
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Planned Start Date"
                  type="date"
                  value={formData.planned_start_date}
                  onChange={(e) => handleInputChange('planned_start_date', e.target.value)}
                  required
                />

                <Input
                  label="Planned End Date"
                  type="date"
                  value={formData.planned_end_date}
                  onChange={(e) => handleInputChange('planned_end_date', e.target.value)}
                  required
                />
              </div>

              {durationInfo && (
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-blue-900">
                      <Calendar className="w-5 h-5" />
                      <h3 className="font-semibold">License Duration Information</h3>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <div className="text-sm text-gray-600 mb-1">Duration</div>
                        <div className="text-2xl font-bold text-blue-700">
                          {durationInfo.days}
                        </div>
                        <div className="text-xs text-gray-500">days</div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Est. Shipments
                        </div>
                        <div className="text-2xl font-bold text-green-700">
                          {durationInfo.estimatedShipments}
                        </div>
                        <div className="text-xs text-gray-500">@ 3 per week</div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Avg per Shipment
                        </div>
                        <div className="text-2xl font-bold text-amber-700">
                          {durationInfo.avgQuantityPerShipment.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">oz</div>
                      </div>
                    </div>

                    <div className="text-xs text-blue-700 bg-blue-100 rounded p-2">
                      <strong>Note:</strong> Estimates based on {durationInfo.estimatedShipments} shipments over {durationInfo.days} days.
                      Actual shipments may vary based on operational requirements.
                    </div>
                  </div>
                </Card>
              )}

              <Select
                label="Priority"
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>

              <RichTextEditor
                label="Additional Information"
                value={formData.comments}
                onChange={(value) => handleInputChange('comments', value)}
                placeholder="Provide detailed information about this license request. Use formatting tools to structure your content..."
                minHeight="200px"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Supporting Documents</h2>
                <Button onClick={addDocument} size="sm" variant="secondary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Document
                </Button>
              </div>

              {documents.map((doc, index) => (
                <Card key={index} className="p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <FileText className="w-5 h-5 text-gray-400 mt-1" />
                    {documents.length > 1 && (
                      <button
                        onClick={() => removeDocument(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Document Title"
                      value={doc.title}
                      onChange={(e) => handleDocumentChange(index, 'title', e.target.value)}
                      placeholder="e.g., Company Registration Certificate"
                      required
                    />

                    <Select
                      label="Document Type"
                      value={doc.type}
                      onChange={(e) => handleDocumentChange(index, 'type', e.target.value as DocumentType)}
                    >
                      <option value="APPLICATION_FORM">Application Form</option>
                      <option value="COMPANY_REGISTRATION">Company Registration</option>
                      <option value="TAX_CERTIFICATE">Tax Certificate</option>
                      <option value="EXPORT_AUTHORIZATION">Export Authorization</option>
                      <option value="MINING_PERMIT">Mining Permit</option>
                      <option value="ASSAY_CERTIFICATE">Assay Certificate</option>
                      <option value="OTHER">Other</option>
                    </Select>

                    <TextArea
                      label="Description"
                      value={doc.description}
                      onChange={(e) => handleDocumentChange(index, 'description', e.target.value)}
                      placeholder="Brief description of this document"
                      rows={2}
                    />

                    <FileUpload
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(files) => {
                        if (files && files.length > 0) {
                          handleDocumentChange(index, 'file', files[0]);
                        }
                      }}
                      maxSize={10 * 1024 * 1024}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Applicant Signature</h2>

              <Input
                label="Signatory Name"
                value={signatureData.applicant_signatory_name}
                onChange={(e) =>
                  setSignatureData({
                    ...signatureData,
                    applicant_signatory_name: e.target.value,
                  })
                }
                placeholder="Full name of authorized signatory"
                required
              />

              <Input
                label="Signatory Title"
                value={signatureData.applicant_signatory_title}
                onChange={(e) =>
                  setSignatureData({
                    ...signatureData,
                    applicant_signatory_title: e.target.value,
                  })
                }
                placeholder="e.g., General Manager, CEO"
              />

              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={signatureData.certification_accepted}
                    onChange={(e) =>
                      setSignatureData({
                        ...signatureData,
                        certification_accepted: e.target.checked,
                      })
                    }
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">
                    I certify that all information provided in this application is accurate and
                    complete to the best of my knowledge. I understand that providing false
                    information may result in the rejection of this application and potential legal
                    consequences.
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <div>
              {step > 1 && (
                <Button onClick={previousStep} variant="secondary" disabled={loading}>
                  Previous
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {step < 3 && (
                <>
                  <Button onClick={saveAsDraft} variant="secondary" disabled={loading}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button onClick={nextStep} disabled={loading}>
                    Next
                  </Button>
                </>
              )}

              {step === 3 && (
                <Button onClick={submitRequest} disabled={loading}>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </Button>
              )}
              </div>
            </div>
          </Card>
          </div>
        </div>

        <div className="w-[420px] shrink-0 border-l border-gray-200 bg-gray-50 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            <FieldGuidePanel
              title="Export License Guide"
              guides={fieldGuides}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
