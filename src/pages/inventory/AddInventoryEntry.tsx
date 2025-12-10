import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Calculator, Info, Package, Calendar, MapPin, Weight, Beaker, Award, TrendingUp, FileText, Upload, AlertTriangle, CheckCircle, DollarSign, TrendingDown } from 'lucide-react';
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
import { useAlert } from '@/hooks/useAlert';

interface ShipmentDetails {
  id: string;
  reference_number: string;
  shipment_date: string;
  total_bullion_grams: number;
  total_pure_gold_grams: number;
  total_pure_gold_oz: number;
  production_count: number;
  destination_refinery?: {
    name: string;
    location: string;
    country: string;
  };
}

interface Shipment {
  id: string;
  reference_number: string;
  shipment_date: string;
  status: string;
  total_bullion_grams: number;
  total_pure_gold_grams: number;
  total_pure_gold_oz: number;
  production_count: number;
  destination_refinery_name?: string;
}

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
}

interface FormData {
  entry_date: string;
  shipment_id: string;
  weight_before_melting_grams: string;
  weight_after_melting_grams: string;
  fineness_percentage: string;
  silver_percentage: string;
  metal_retained_percentage: string;
  notes: string;
  processing_location: string;
  certificate_number: string;
}

interface CalculatedValues {
  final_fine_grams: number;
  final_fine_oz: number;
  monthly_total_oz: number;
  yield_percentage: number;
  variance_grams: number;
  variance_oz: number;
  variance_percentage: number;
  impurity_percentage: number;
  factory_fineness: number;
  factory_silver: number;
  fineness_difference: number;
  financial_loss_usd: number;
}

interface FieldGuidance {
  [key: string]: {
    title: string;
    description: string;
    icon: any;
    color: string;
  };
}

const fieldGuidance: FieldGuidance = {
  shipment_id: {
    title: 'Shipment Selection',
    description: 'Select a refined shipment that is ready for stock entry. Only shipments with "in_stock" status from the refinery are available.',
    icon: Package,
    color: 'blue',
  },
  weight_before_melting_grams: {
    title: 'Weight Before Melting',
    description: 'The total bullion weight of the shipment received at the refinery before the melting process. This value is auto-filled from shipment data.',
    icon: Weight,
    color: 'purple',
  },
  weight_after_melting_grams: {
    title: 'Weight After Melting',
    description: 'The weight of the gold after the melting and refining process. This value should be measured and entered by the refinery operator.',
    icon: Beaker,
    color: 'orange',
  },
  fineness_percentage: {
    title: 'Fineness Percentage',
    description: 'The purity of the gold expressed as a percentage. For example, 24K gold is 99.99% fine. This is determined by laboratory assay.',
    icon: Award,
    color: 'yellow',
  },
  metal_retained_percentage: {
    title: 'Metal Retained',
    description: 'The percentage of metal recovered during the refining process. Accounts for losses during melting, slag removal, and other processing steps.',
    icon: TrendingUp,
    color: 'green',
  },
  processing_location: {
    title: 'Processing Location',
    description: 'The refinery where the batch was processed. Select from the list of active refineries.',
    icon: MapPin,
    color: 'red',
  },
};

export function AddInventoryEntry() {
  const navigate = useNavigate();
  const alert = useAlert();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [selectedShipmentDetails, setSelectedShipmentDetails] = useState<ShipmentDetails | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [activeField, setActiveField] = useState<string>('shipment_id');

  const [formData, setFormData] = useState<FormData>({
    entry_date: new Date().toISOString().split('T')[0],
    shipment_id: '',
    weight_before_melting_grams: '',
    weight_after_melting_grams: '',
    fineness_percentage: '',
    silver_percentage: '',
    metal_retained_percentage: '',
    notes: '',
    processing_location: '',
    certificate_number: ''
  });

  const [calculated, setCalculated] = useState<CalculatedValues>({
    final_fine_grams: 0,
    final_fine_oz: 0,
    monthly_total_oz: 0,
    yield_percentage: 0,
    variance_grams: 0,
    variance_oz: 0,
    variance_percentage: 0,
    impurity_percentage: 0,
    factory_fineness: 0,
    factory_silver: 0,
    fineness_difference: 0,
    financial_loss_usd: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAvailableShipments();
    loadRefineries();
    loadMonthlyTotal();
  }, [formData.entry_date]);

  useEffect(() => {
    calculateValues();
  }, [
    formData.weight_after_melting_grams,
    formData.fineness_percentage,
    formData.silver_percentage,
    formData.metal_retained_percentage,
    formData.weight_before_melting_grams,
    selectedShipmentDetails
  ]);

  useEffect(() => {
    if (formData.shipment_id) {
      loadShipmentDetails();
    } else {
      setSelectedShipmentDetails(null);
    }
  }, [formData.shipment_id]);

  async function loadAvailableShipments() {
    try {
      const { data, error } = await supabase
        .from('freight_shipments')
        .select(`
          id,
          reference_number,
          shipment_date,
          status,
          total_bullion_grams,
          total_pure_gold_grams,
          total_pure_gold_oz,
          production_count,
          destination_refinery:destination_refinery_id(name, location, country)
        `)
        .eq('status', 'in_stock')
        .order('shipment_date', { ascending: false });

      if (error) throw error;

      const mappedShipments = (data || []).map((shipment: any) => ({
        id: shipment.id,
        reference_number: shipment.reference_number,
        shipment_date: shipment.shipment_date,
        status: shipment.status,
        total_bullion_grams: shipment.total_bullion_grams,
        total_pure_gold_grams: shipment.total_pure_gold_grams,
        total_pure_gold_oz: shipment.total_pure_gold_oz,
        production_count: shipment.production_count,
        destination_refinery_name: shipment.destination_refinery?.name || 'Unknown Refinery',
      }));

      setShipments(mappedShipments);
    } catch (error) {
      console.error('Error loading shipments:', error);
      alert.error('Failed to load available shipments');
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

      // Set default to "Rand Refinery" if not already set
      if (data && data.length > 0 && !formData.processing_location) {
        const defaultRefinery = data.find(r => r.name.toLowerCase().includes('rand'));
        if (defaultRefinery) {
          setFormData(prev => ({ ...prev, processing_location: defaultRefinery.id }));
        }
      }
    } catch (error) {
      console.error('Error loading refineries:', error);
    }
  }

  async function loadShipmentDetails() {
    try {
      const { data, error } = await supabase
        .from('freight_shipments')
        .select(`
          id,
          reference_number,
          shipment_date,
          total_bullion_grams,
          total_pure_gold_grams,
          total_pure_gold_oz,
          production_count,
          destination_refinery:destination_refinery_id(name, location, country)
        `)
        .eq('id', formData.shipment_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const details: ShipmentDetails = {
          id: data.id,
          reference_number: data.reference_number,
          shipment_date: data.shipment_date,
          total_bullion_grams: data.total_bullion_grams,
          total_pure_gold_grams: data.total_pure_gold_grams,
          total_pure_gold_oz: data.total_pure_gold_oz,
          production_count: data.production_count,
          destination_refinery: data.destination_refinery,
        };

        setSelectedShipmentDetails(details);

        // Auto-fill weight before melting from shipment total bullion
        setFormData((prev) => ({
          ...prev,
          weight_before_melting_grams: details.total_bullion_grams.toString()
        }));
      }
    } catch (error) {
      console.error('Error loading shipment details:', error);
      alert.error('Failed to load shipment details');
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
    const silver = parseFloat(formData.silver_percentage) || 0;
    const metalRetained = parseFloat(formData.metal_retained_percentage);
    const weightBefore = parseFloat(formData.weight_before_melting_grams);
    const shipmentQuantity = selectedShipmentDetails?.total_bullion_grams || 0;

    // Calculate impurity percentage
    const impurityPct = Math.max(0, 100 - fineness - silver);

    // Get factory/mine values from shipment
    const factoryFineness = selectedShipmentDetails ?
      (selectedShipmentDetails.total_pure_gold_grams / selectedShipmentDetails.total_bullion_grams * 100) : 0;
    const factorySilver = 0; // Will be calculated if available in shipment data

    // Calculate fineness difference (factory - refinery)
    const finenessDiff = fineness ? (factoryFineness - fineness) : 0;

    // Calculate financial loss based on gold price (assuming $2000/oz)
    const goldPriceUSD = 2000;
    const finalFineOz = weightAfter && fineness && metalRetained ?
      (weightAfter * (fineness / 100) * (metalRetained / 100)) / 28.3495 : 0;
    const potentialOz = weightAfter && factoryFineness && metalRetained ?
      (weightAfter * (factoryFineness / 100) * (metalRetained / 100)) / 28.3495 : 0;
    const financialLoss = (potentialOz - finalFineOz) * goldPriceUSD;

    if (!weightAfter || !fineness || !metalRetained) {
      setCalculated((prev) => ({
        ...prev,
        final_fine_grams: 0,
        final_fine_oz: 0,
        yield_percentage: 0,
        variance_grams: 0,
        variance_oz: 0,
        variance_percentage: 0,
        impurity_percentage: impurityPct,
        factory_fineness: factoryFineness,
        factory_silver: factorySilver,
        fineness_difference: finenessDiff,
        financial_loss_usd: financialLoss
      }));
      return;
    }

    const finalFineGrams = weightAfter * (fineness / 100) * (metalRetained / 100);
    const finalFineOzCalc = finalFineGrams / 28.3495;
    const yieldPercentage = weightBefore > 0 ? (weightAfter / weightBefore) * 100 : 0;

    const varianceGrams = shipmentQuantity - finalFineGrams;
    const varianceOz = varianceGrams / 28.3495;
    const variancePercentage = shipmentQuantity > 0 ? (varianceGrams / shipmentQuantity) * 100 : 0;

    setCalculated({
      final_fine_grams: finalFineGrams,
      final_fine_oz: finalFineOzCalc,
      yield_percentage: yieldPercentage,
      variance_grams: varianceGrams,
      variance_oz: varianceOz,
      variance_percentage: variancePercentage,
      monthly_total_oz: calculated.monthly_total_oz,
      impurity_percentage: impurityPct,
      factory_fineness: factoryFineness,
      factory_silver: factorySilver,
      fineness_difference: finenessDiff,
      financial_loss_usd: financialLoss
    });
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

    if (!formData.shipment_id) newErrors.shipment_id = 'Please select a shipment';
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
      const entry: GoldInventoryEntry = {
        entry_date: formData.entry_date,
        freight_shipment_id: formData.shipment_id,
        weight_before_melting_grams: parseFloat(formData.weight_before_melting_grams),
        weight_after_melting_grams: parseFloat(formData.weight_after_melting_grams),
        fineness_percentage: parseFloat(formData.fineness_percentage),
        metal_retained_percentage: parseFloat(formData.metal_retained_percentage),
        variance_with_export_invoice_oz: calculated.variance_oz,
        notes: formData.notes || undefined,
        processing_location: formData.processing_location || undefined,
        certificate_number: formData.certificate_number || undefined,
        transaction_type: 'entry'
      };

      const result = await addInventoryEntry(entry);

      if (result.success) {
        alert.success('Inventory entry added successfully!');
        navigate('/inventory');
      } else {
        alert.error('Error adding inventory entry: ' + (result.error as any)?.message);
      }
    } catch (error: any) {
      console.error('Error submitting form:', error);
      alert.error('Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currentGuidance = fieldGuidance[activeField];
  const IconComponent = currentGuidance?.icon || Info;

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
            <p className="text-gray-600 mt-1">Add refined gold shipments to inventory after processing</p>
          </div>
        </div>

        {/* Two Column Layout: Form + Guidance */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Form - Left Side (2/3) */}
          <div className="xl:col-span-2">
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
                      onFocus={() => setActiveField('entry_date')}
                    />
                  </FormField>

                  <FormField label="Shipment (In Stock)" required error={errors.shipment_id}>
                    <Select
                      value={formData.shipment_id}
                      onChange={(e) => handleInputChange('shipment_id', e.target.value)}
                      error={!!errors.shipment_id}
                      onFocus={() => setActiveField('shipment_id')}
                    >
                      <option value="">Select shipment</option>
                      {shipments.map((shipment) => {
                        const shippingDate = shipment.shipment_date
                          ? new Date(shipment.shipment_date).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })
                          : 'N/A';
                        const refinery = shipment.destination_refinery_name || 'Unknown Refinery';
                        return (
                          <option key={shipment.id} value={shipment.id}>
                            {shipment.reference_number} - {shippingDate} - {shipment.production_count} bars - {refinery}
                          </option>
                        );
                      })}
                    </Select>
                  </FormField>
                </div>

                {/* Shipment Information Display - Enhanced with Colored Background */}
                {selectedShipmentDetails && (
                  <div className="relative overflow-hidden rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 shadow-sm">
                    {/* Decorative background pattern */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-200 rounded-full opacity-10 -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-200 rounded-full opacity-10 -ml-24 -mb-24" />

                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-blue-600 rounded-lg shadow-md">
                          <Info className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Shipment Information Summary</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Total Bullion Weight */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-blue-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Total Bullion</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {selectedShipmentDetails.total_bullion_grams.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">grams</p>
                        </div>

                        {/* Pure Gold Content */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-yellow-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Award className="h-4 w-4 text-yellow-600" />
                            <span className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">Pure Gold</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {selectedShipmentDetails.total_pure_gold_oz.toFixed(4)}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">oz ({selectedShipmentDetails.total_pure_gold_grams.toFixed(2)}g)</p>
                        </div>

                        {/* Shipment Date */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-indigo-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">Shipment Date</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900">
                            {new Date(selectedShipmentDetails.shipment_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>

                        {/* Production Count */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-purple-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">Production Bars</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {selectedShipmentDetails.production_count}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">bars included</p>
                        </div>

                        {/* Destination Refinery */}
                        {selectedShipmentDetails.destination_refinery && (
                          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-pink-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="h-4 w-4 text-pink-600" />
                              <span className="text-xs font-semibold text-pink-800 uppercase tracking-wide">Refinery</span>
                            </div>
                            <p className="text-lg font-bold text-gray-900">
                              {selectedShipmentDetails.destination_refinery.name}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {selectedShipmentDetails.destination_refinery.location}, {selectedShipmentDetails.destination_refinery.country}
                            </p>
                          </div>
                        )}

                        {/* Weight Before Melting */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-green-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Beaker className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-semibold text-green-800 uppercase tracking-wide">Before Melting</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {selectedShipmentDetails.total_bullion_grams.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">grams (auto-filled)</p>
                        </div>
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
                      hint="Auto-filled from shipment data"
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
                        disabled={!!selectedShipmentDetails}
                        onFocus={() => setActiveField('weight_before_melting_grams')}
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
                        onFocus={() => setActiveField('weight_after_melting_grams')}
                      />
                    </FormField>
                  </div>
                </div>

                {/* Purity & Retention */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Purity & Retention</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      label="Gold Fineness (%)"
                      required
                      error={errors.fineness_percentage}
                      hint="Gold purity percentage"
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
                        onFocus={() => setActiveField('fineness_percentage')}
                      />
                    </FormField>

                    <FormField
                      label="Silver Content (%)"
                      error={errors.silver_percentage}
                      hint="Silver percentage in bullion"
                    >
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        min="0"
                        max="100"
                        value={formData.silver_percentage}
                        onChange={(e) => handleInputChange('silver_percentage', e.target.value)}
                        error={!!errors.silver_percentage}
                        onFocus={() => setActiveField('silver_percentage')}
                      />
                    </FormField>

                    <FormField
                      label="Impurities (%)"
                      hint="Auto-calculated"
                    >
                      <Input
                        type="number"
                        value={calculated.impurity_percentage.toFixed(2)}
                        disabled
                        className="bg-gray-100"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mt-4">
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
                        onFocus={() => setActiveField('metal_retained_percentage')}
                      />
                    </FormField>
                  </div>
                </div>

                {/* Calculations Display */}
                <div className="border-t pt-6">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-5 border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-4">
                      <Calculator className="h-5 w-5 text-blue-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Automatic Calculations</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs text-gray-600 mb-1">Final Fine (g)</p>
                        <p className="text-xl font-bold text-gray-900">
                          {calculated.final_fine_grams.toFixed(4)}
                        </p>
                      </div>

                      <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs text-gray-600 mb-1">Final Fine (oz)</p>
                        <p className="text-xl font-bold text-primary-600">
                          {calculated.final_fine_oz.toFixed(4)}
                        </p>
                      </div>

                      <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs text-gray-600 mb-1">Yield %</p>
                        <p className="text-xl font-semibold text-gray-700">
                          {calculated.yield_percentage.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {/* Variance Section */}
                    <div className="border-t border-blue-200 pt-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-3">
                        Variance with Export Invoice
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                          <p className="text-xs text-gray-600 mb-1">Variance (g)</p>
                          <p className={`text-lg font-bold ${calculated.variance_grams >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {calculated.variance_grams >= 0 ? '+' : ''}{calculated.variance_grams.toFixed(4)}
                          </p>
                        </div>

                        <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                          <p className="text-xs text-gray-600 mb-1">Variance (oz)</p>
                          <p className={`text-lg font-bold ${calculated.variance_oz >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {calculated.variance_oz >= 0 ? '+' : ''}{calculated.variance_oz.toFixed(4)}
                          </p>
                        </div>

                        <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                          <p className="text-xs text-gray-600 mb-1">Variance %</p>
                          <p className={`text-lg font-bold ${calculated.variance_percentage >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {calculated.variance_percentage >= 0 ? '+' : ''}{calculated.variance_percentage.toFixed(2)}%
                          </p>
                        </div>
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
                          onFocus={() => setActiveField('processing_location')}
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

                    <FormField label="Notes" hint="Optional">
                      <TextArea
                        placeholder="Add any additional notes about this entry..."
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        rows={3}
                      />
                    </FormField>

                    <FormField label="Attach Documents" hint="Upload PDFs, reports, or add Assay Certificates">
                      <div className="space-y-3">
                        <FileUpload
                          onFileSelect={handleFileSelect}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          multiple={true}
                          maxSize={10 * 1024 * 1024}
                        />
                        <div className="flex items-center gap-3 pt-2">
                          <div className="flex-1 border-t border-gray-200"></div>
                          <span className="text-xs text-gray-500 uppercase">Or</span>
                          <div className="flex-1 border-t border-gray-200"></div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => navigate('/documents/assay-certificates')}
                          className="w-full gap-2"
                          type="button"
                        >
                          <FileText className="h-4 w-4" />
                          Add Assay Certificate
                        </Button>
                        <p className="text-xs text-gray-500 mt-2">
                          Click above to navigate to the Assay Certificate module for detailed certificate management
                        </p>
                      </div>
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

          {/* Shipment Analysis Panel - Right Side (1/3) */}
          <div className="xl:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Shipment Information */}
              {selectedShipmentDetails && (
                <Card className="overflow-hidden border-2 border-blue-200 shadow-lg">
                  <CardHeader className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Package className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-white">Shipment Analysis</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Reference Info */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Shipment Reference</p>
                      <p className="text-lg font-bold text-gray-900">{selectedShipmentDetails.reference_number}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {selectedShipmentDetails.production_count} bars • {selectedShipmentDetails.total_bullion_grams.toFixed(2)}g
                      </p>
                    </div>

                    {/* Factory vs Refinery Comparison */}
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quality Comparison</p>

                      {/* Factory Values */}
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                          <p className="text-xs font-bold text-blue-900 uppercase">Factory/Mine</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Gold Fineness:</span>
                            <span className="font-bold text-gray-900">{calculated.factory_fineness.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Silver Content:</span>
                            <span className="font-bold text-gray-900">{calculated.factory_silver.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Refinery Values */}
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Beaker className="h-4 w-4 text-amber-600" />
                          <p className="text-xs font-bold text-amber-900 uppercase">Refinery Results</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Gold Fineness:</span>
                            <span className="font-bold text-gray-900">
                              {formData.fineness_percentage || '0.00'}%
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Silver Content:</span>
                            <span className="font-bold text-gray-900">
                              {formData.silver_percentage || '0.00'}%
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Impurities:</span>
                            <span className="font-bold text-red-700">
                              {calculated.impurity_percentage.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Difference Analysis */}
                    {formData.fineness_percentage && (
                      <div className="border-t pt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Variance Analysis
                        </p>

                        <div className={`p-4 rounded-lg border-2 ${
                          calculated.fineness_difference < 0
                            ? 'bg-red-50 border-red-300'
                            : 'bg-green-50 border-green-300'
                        }`}>
                          <div className="flex items-start gap-3">
                            {calculated.fineness_difference < 0 ? (
                              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className={`text-sm font-bold ${
                                calculated.fineness_difference < 0 ? 'text-red-900' : 'text-green-900'
                              } mb-1`}>
                                {calculated.fineness_difference < 0 ? 'Quality Loss Detected' : 'Quality Maintained'}
                              </p>
                              <p className="text-xs text-gray-700 mb-2">
                                Fineness difference: <span className="font-bold">
                                  {calculated.fineness_difference.toFixed(2)}%
                                </span>
                              </p>
                              {calculated.fineness_difference < 0 && (
                                <p className="text-xs text-gray-600">
                                  The refinery fineness is lower than factory estimate, indicating potential quality issues or measurement differences.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Financial Impact */}
                    {calculated.financial_loss_usd !== 0 && formData.fineness_percentage && (
                      <div className="border-t pt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Financial Impact
                        </p>

                        <div className={`p-4 rounded-lg border-2 ${
                          calculated.financial_loss_usd > 0
                            ? 'bg-red-50 border-red-300'
                            : 'bg-green-50 border-green-300'
                        }`}>
                          <div className="flex items-start gap-3">
                            <DollarSign className={`h-6 w-6 flex-shrink-0 ${
                              calculated.financial_loss_usd > 0 ? 'text-red-600' : 'text-green-600'
                            }`} />
                            <div className="flex-1">
                              <p className="text-xs text-gray-600 mb-1">
                                {calculated.financial_loss_usd > 0 ? 'Estimated Loss' : 'Value Preserved'}
                              </p>
                              <p className={`text-2xl font-bold ${
                                calculated.financial_loss_usd > 0 ? 'text-red-900' : 'text-green-900'
                              }`}>
                                ${Math.abs(calculated.financial_loss_usd).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </p>
                              <p className="text-xs text-gray-600 mt-2">
                                Based on gold price @ $2,000/oz
                              </p>
                              {calculated.financial_loss_usd > 0 && (
                                <>
                                  <div className="mt-3 pt-3 border-t border-red-200">
                                    <p className="text-xs font-semibold text-red-800 mb-2">Potential Causes:</p>
                                    <ul className="text-xs text-gray-700 space-y-1">
                                      <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        <span>Measurement accuracy differences</span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        <span>Processing losses during refining</span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        <span>Sample variation between sites</span>
                                      </li>
                                    </ul>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Quick Tips */}
              <Card className="border-2 border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Quick Tips
                  </p>
                  <ul className="space-y-2 text-xs text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">●</span>
                      <span>Impurities are automatically calculated: 100 - (Gold % + Silver %)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">●</span>
                      <span>Compare refinery results with factory values</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5">●</span>
                      <span>Monitor financial impact of quality differences</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
