import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Calculator, Info, Package, Calendar, MapPin, Weight } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TextArea from '@/components/ui/TextArea';
import DatePicker from '@/components/ui/DatePicker';
import { FormField } from '@/components/ui/FormField';
import { FileUpload } from '@/components/ui/FileUpload';
import { supabase } from '@/lib/supabase';
import { addInventoryEntry, type GoldInventoryEntry } from '@/services/inventoryService';

interface Batch {
  id: string;
  batch_number: string;
  weight_grams: number;
  metal_type: string;
  status: string;
  shipping_date: string;
  origin_site?: {
    name: string;
    country: string;
  };
  current_site?: {
    name: string;
    country: string;
  };
}

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
}

interface BatchDetails {
  batch_number: string;
  shipping_date: string;
  shipper: string;
  quantity_shipped: number;
  weight_before_melting: number;
}

interface FormData {
  entry_date: string;
  batch_id: string;
  weight_before_melting_grams: string;
  weight_after_melting_grams: string;
  fineness_percentage: string;
  metal_retained_percentage: string;
  variance_with_export_invoice_oz: string;
  notes: string;
  processing_location: string;
  certificate_number: string;
}

interface CalculatedValues {
  final_fine_grams: number;
  final_fine_oz: number;
  monthly_total_oz: number;
  yield_percentage: number;
}

export function AddInventoryEntry() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<BatchDetails | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState<FormData>({
    entry_date: new Date().toISOString().split('T')[0],
    batch_id: '',
    weight_before_melting_grams: '',
    weight_after_melting_grams: '',
    fineness_percentage: '',
    metal_retained_percentage: '',
    variance_with_export_invoice_oz: '',
    notes: '',
    processing_location: '',
    certificate_number: ''
  });

  const [calculated, setCalculated] = useState<CalculatedValues>({
    final_fine_grams: 0,
    final_fine_oz: 0,
    monthly_total_oz: 0,
    yield_percentage: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAvailableBatches();
    loadRefineries();
    loadMonthlyTotal();
  }, [formData.entry_date]);

  useEffect(() => {
    calculateValues();
  }, [
    formData.weight_after_melting_grams,
    formData.fineness_percentage,
    formData.metal_retained_percentage,
    formData.weight_before_melting_grams
  ]);

  useEffect(() => {
    if (formData.batch_id) {
      loadBatchDetails();
    } else {
      setSelectedBatchDetails(null);
    }
  }, [formData.batch_id]);

  async function loadAvailableBatches() {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          id,
          batch_number,
          weight_grams,
          metal_type,
          status,
          shipping_date,
          origin_site:origin_site_id (
            name,
            country
          ),
          current_site:current_site_id (
            name,
            country
          )
        `)
        .eq('status', 'processed')
        .order('shipping_date', { ascending: false });

      if (error) throw error;

      setBatches(data || []);
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  }

  async function loadRefineries() {
    try {
      const { data, error } = await supabase
        .from('refineries')
        .select('id, name, location, country')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setRefineries(data || []);
    } catch (error) {
      console.error('Error loading refineries:', error);
    }
  }

  async function loadBatchDetails() {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          batch_number,
          shipping_date,
          weight_grams,
          origin_site:origin_site_id (
            name
          )
        `)
        .eq('id', formData.batch_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSelectedBatchDetails({
          batch_number: data.batch_number,
          shipping_date: data.shipping_date,
          shipper: data.origin_site?.name || 'Unknown',
          quantity_shipped: data.weight_grams,
          weight_before_melting: data.weight_grams
        });

        // Auto-fill weight before melting
        if (!formData.weight_before_melting_grams) {
          setFormData((prev) => ({
            ...prev,
            weight_before_melting_grams: data.weight_grams.toString()
          }));
        }
      }
    } catch (error) {
      console.error('Error loading batch details:', error);
    }
  }

  async function loadMonthlyTotal() {
    try {
      const startOfMonth = new Date(formData.entry_date);
      startOfMonth.setDate(1);
      const startDate = startOfMonth.toISOString().split('T')[0];

      const endOfMonth = new Date(formData.entry_date);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      const endDate = endOfMonth.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('gold_inventory')
        .select('final_fine_oz')
        .eq('transaction_type', 'entry')
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (item.final_fine_oz || 0), 0);
      setCalculated((prev) => ({ ...prev, monthly_total_oz: total }));
    } catch (error) {
      console.error('Error loading monthly total:', error);
    }
  }

  function calculateValues() {
    const weightAfter = parseFloat(formData.weight_after_melting_grams);
    const fineness = parseFloat(formData.fineness_percentage);
    const metalRetained = parseFloat(formData.metal_retained_percentage);
    const weightBefore = parseFloat(formData.weight_before_melting_grams);

    if (!weightAfter || !fineness || !metalRetained) {
      setCalculated((prev) => ({
        ...prev,
        final_fine_grams: 0,
        final_fine_oz: 0,
        yield_percentage: 0
      }));
      return;
    }

    const finalFineGrams = weightAfter * (fineness / 100) * (metalRetained / 100);
    const finalFineOz = finalFineGrams / 28.3495;
    const yieldPercentage = weightBefore > 0 ? (weightAfter / weightBefore) * 100 : 0;

    setCalculated((prev) => ({
      ...prev,
      final_fine_grams: finalFineGrams,
      final_fine_oz: finalFineOz,
      yield_percentage: yieldPercentage
    }));
  }

  function handleInputChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }

  function handleFileSelect(files: File[]) {
    setUploadedFiles(files);
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.batch_id) newErrors.batch_id = 'Please select a batch';
    if (!formData.weight_before_melting_grams)
      newErrors.weight_before_melting_grams = 'Weight before melting is required';
    if (!formData.weight_after_melting_grams)
      newErrors.weight_after_melting_grams = 'Weight after melting is required';
    if (!formData.fineness_percentage) newErrors.fineness_percentage = 'Fineness is required';
    if (!formData.metal_retained_percentage)
      newErrors.metal_retained_percentage = 'Metal retained is required';
    if (!formData.processing_location) newErrors.processing_location = 'Processing location is required';

    const fineness = parseFloat(formData.fineness_percentage);
    if (fineness < 0 || fineness > 100) {
      newErrors.fineness_percentage = 'Fineness must be between 0 and 100';
    }

    const metalRetained = parseFloat(formData.metal_retained_percentage);
    if (metalRetained < 0 || metalRetained > 100) {
      newErrors.metal_retained_percentage = 'Metal retained must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // TODO: Upload files to Supabase Storage if any
      // const documentUrls = await uploadDocuments(uploadedFiles);

      const entry: GoldInventoryEntry = {
        entry_date: formData.entry_date,
        batch_id: formData.batch_id,
        weight_before_melting_grams: parseFloat(formData.weight_before_melting_grams),
        weight_after_melting_grams: parseFloat(formData.weight_after_melting_grams),
        fineness_percentage: parseFloat(formData.fineness_percentage),
        metal_retained_percentage: parseFloat(formData.metal_retained_percentage),
        variance_with_export_invoice_oz: formData.variance_with_export_invoice_oz
          ? parseFloat(formData.variance_with_export_invoice_oz)
          : undefined,
        notes: formData.notes || undefined,
        processing_location: formData.processing_location || undefined,
        certificate_number: formData.certificate_number || undefined,
        transaction_type: 'entry'
      };

      const result = await addInventoryEntry(entry);

      if (result.success) {
        alert('Inventory entry added successfully!');
        navigate('/inventory');
      } else {
        alert('Error adding inventory entry: ' + (result.error as any)?.message);
      }
    } catch (error: any) {
      console.error('Error submitting form:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/inventory')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Add Gold Inventory Entry
            </h1>
            <p className="text-gray-600 mt-1">Add refined gold to inventory after processing</p>
          </div>
        </div>

        {/* Main Form - Single Column Layout */}
        <div className="max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Refining Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Entry Date and Batch Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Entry Date" required error={errors.entry_date}>
                  <DatePicker
                    value={formData.entry_date}
                    onChange={(e) => handleInputChange('entry_date', e.target.value)}
                    error={!!errors.entry_date}
                  />
                </FormField>

                <FormField label="Batch (Processed Only)" required error={errors.batch_id}>
                  <Select
                    value={formData.batch_id}
                    onChange={(e) => handleInputChange('batch_id', e.target.value)}
                    error={!!errors.batch_id}
                  >
                    <option value="">Select batch</option>
                    {batches.map((batch) => {
                      const shippingDate = batch.shipping_date
                        ? new Date(batch.shipping_date).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })
                        : 'N/A';
                      const origin = batch.origin_site?.name || 'Unknown';
                      return (
                        <option key={batch.id} value={batch.id}>
                          {batch.batch_number} - {shippingDate} - {origin}
                        </option>
                      );
                    })}
                  </Select>
                </FormField>
              </div>

              {/* Batch Information Display */}
              {selectedBatchDetails && (
                <div className="bg-gray-100 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-5 w-5 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Batch Information</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Shipping Date</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(selectedBatchDetails.shipping_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>Shipper</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedBatchDetails.shipper}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Package className="h-3.5 w-3.5" />
                        <span>Quantity Shipped</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedBatchDetails.quantity_shipped.toFixed(2)} g
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Weight className="h-3.5 w-3.5" />
                        <span>Weight Before Melting</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedBatchDetails.weight_before_melting.toFixed(2)} g
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Weight Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Weight Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Weight Before Melting (g)"
                    required
                    error={errors.weight_before_melting_grams}
                    hint="Auto-filled from batch data"
                  >
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={formData.weight_before_melting_grams}
                      onChange={(e) =>
                        handleInputChange('weight_before_melting_grams', e.target.value)
                      }
                      error={!!errors.weight_before_melting_grams}
                      disabled={!!selectedBatchDetails}
                    />
                  </FormField>

                  <FormField
                    label="Weight After Melting (g)"
                    required
                    error={errors.weight_after_melting_grams}
                  >
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={formData.weight_after_melting_grams}
                      onChange={(e) =>
                        handleInputChange('weight_after_melting_grams', e.target.value)
                      }
                      error={!!errors.weight_after_melting_grams}
                    />
                  </FormField>
                </div>
              </div>

              {/* Purity & Retention */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Purity & Retention</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Fineness (%)"
                    required
                    error={errors.fineness_percentage}
                    hint="Gold purity percentage (0-100)"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="99.99"
                      min="0"
                      max="100"
                      value={formData.fineness_percentage}
                      onChange={(e) => handleInputChange('fineness_percentage', e.target.value)}
                      error={!!errors.fineness_percentage}
                    />
                  </FormField>

                  <FormField
                    label="Metal Retained (%)"
                    required
                    error={errors.metal_retained_percentage}
                    hint="Percentage of metal retained after refining"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="98.50"
                      min="0"
                      max="100"
                      value={formData.metal_retained_percentage}
                      onChange={(e) =>
                        handleInputChange('metal_retained_percentage', e.target.value)
                      }
                      error={!!errors.metal_retained_percentage}
                    />
                  </FormField>
                </div>
              </div>

              {/* Calculations Display */}
              <div className="border-t pt-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-5 w-5 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Automatic Calculations</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Final Fine (g)</p>
                      <p className="text-xl font-bold text-gray-900">
                        {calculated.final_fine_grams.toFixed(4)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 mb-1">Final Fine (oz)</p>
                      <p className="text-xl font-bold text-primary-600">
                        {calculated.final_fine_oz.toFixed(4)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 mb-1">Yield %</p>
                      <p className="text-xl font-semibold text-gray-700">
                        {calculated.yield_percentage.toFixed(2)}%
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 mb-1">Monthly Total (oz)</p>
                      <p className="text-xl font-semibold text-green-600">
                        {(calculated.monthly_total_oz + calculated.final_fine_oz).toFixed(4)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Processing Location (Refinery)" required error={errors.processing_location}>
                      <Select
                        value={formData.processing_location}
                        onChange={(e) => handleInputChange('processing_location', e.target.value)}
                        error={!!errors.processing_location}
                      >
                        <option value="">Select refinery</option>
                        {refineries.map((refinery) => (
                          <option key={refinery.id} value={refinery.name}>
                            {refinery.name} - {refinery.location}, {refinery.country}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Certificate Number" hint="Optional">
                      <Input
                        type="text"
                        placeholder="e.g., CERT-2025-001"
                        value={formData.certificate_number}
                        onChange={(e) => handleInputChange('certificate_number', e.target.value)}
                      />
                    </FormField>
                  </div>

                  <FormField label="Variance with Export Invoice (oz)" hint="Optional">
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={formData.variance_with_export_invoice_oz}
                      onChange={(e) =>
                        handleInputChange('variance_with_export_invoice_oz', e.target.value)
                      }
                    />
                  </FormField>

                  <FormField label="Notes" hint="Optional">
                    <TextArea
                      placeholder="Add any additional notes about this entry..."
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      rows={3}
                    />
                  </FormField>

                  {/* Document Upload */}
                  <FormField label="Attach Documents" hint="Optional - Upload certificates, reports, etc.">
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      multiple={true}
                      maxSize={10 * 1024 * 1024}
                    />
                  </FormField>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t">
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  className="gap-2 flex-1"
                >
                  <Save className="h-4 w-4" />
                  Save to Inventory
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => navigate('/inventory')}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
