import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Calculator } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TextArea from '@/components/ui/TextArea';
import DatePicker from '@/components/ui/DatePicker';
import { FormField } from '@/components/ui/FormField';
import { supabase } from '@/lib/supabase';
import { addInventoryEntry, type GoldInventoryEntry } from '@/services/inventoryService';

interface Batch {
  id: string;
  batch_number: string;
  weight_grams: number;
  metal_type: string;
  status: string;
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
      loadBatchWeight();
    }
  }, [formData.batch_id]);

  async function loadAvailableBatches() {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_number, weight_grams, metal_type, status')
        .eq('status', 'validated_for_processing')
        .order('batch_number', { ascending: false });

      if (error) throw error;

      setBatches(data || []);
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  }

  async function loadBatchWeight() {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('weight_grams')
        .eq('id', formData.batch_id)
        .maybeSingle();

      if (error) throw error;

      if (data && !formData.weight_before_melting_grams) {
        setFormData((prev) => ({
          ...prev,
          weight_before_melting_grams: data.weight_grams.toString()
        }));
      }
    } catch (error) {
      console.error('Error loading batch weight:', error);
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/inventory')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Add Inventory Entry
            </h1>
            <p className="text-gray-600 mt-1">Add refined gold to inventory after processing</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Refining Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Entry Date" required error={errors.entry_date}>
                    <DatePicker
                      value={formData.entry_date}
                      onChange={(e) => handleInputChange('entry_date', e.target.value)}
                      error={!!errors.entry_date}
                    />
                  </FormField>

                  <FormField label="Batch" required error={errors.batch_id}>
                    <Select
                      value={formData.batch_id}
                      onChange={(e) => handleInputChange('batch_id', e.target.value)}
                      error={!!errors.batch_id}
                    >
                      <option value="">Select batch</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.batch_number} - {batch.weight_grams}g ({batch.metal_type})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Weight Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label="Weight Before Melting (g)"
                      required
                      error={errors.weight_before_melting_grams}
                      hint="Quantity received from airport"
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

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>

                  <div className="space-y-4">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Processing Location" hint="Optional">
                        <Input
                          type="text"
                          placeholder="e.g., Dubai Refinery"
                          value={formData.processing_location}
                          onChange={(e) =>
                            handleInputChange('processing_location', e.target.value)
                          }
                        />
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

                    <FormField label="Notes" hint="Optional">
                      <TextArea
                        placeholder="Add any additional notes about this entry..."
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        rows={3}
                      />
                    </FormField>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  Automatic Calculations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Final Fine (g)</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {calculated.final_fine_grams.toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      = Weight After × (Fineness% ÷ 100) × (Retained% ÷ 100)
                    </p>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-600 mb-1">Final Fine (oz)</p>
                    <p className="text-2xl font-bold text-primary-600">
                      {calculated.final_fine_oz.toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      = Final Fine (g) ÷ 28.3495
                    </p>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-600 mb-1">Yield Percentage</p>
                    <p className="text-xl font-semibold text-gray-700">
                      {calculated.yield_percentage.toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Weight loss during melting
                    </p>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-600 mb-1">Monthly Total (oz)</p>
                    <p className="text-xl font-semibold text-green-600">
                      {(calculated.monthly_total_oz + calculated.final_fine_oz).toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Including this entry
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  className="w-full gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save to Inventory
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => navigate('/inventory')}
                  className="w-full"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
