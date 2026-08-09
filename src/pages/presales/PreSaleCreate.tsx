import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Package, DollarSign, Users, Info, ChevronDown, ChevronUp, TrendingUp, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { TextArea } from '@/components/ui/TextArea';
import { useAlert } from '@/hooks/useAlert';
import { supabase } from '@/lib/supabase';
import {
  createPreSale,
  calculatePreSaleAmounts,
  getBatchesForPreSale,
  type CreatePreSaleData,
} from '@/services/preSalesService';

interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
}

interface Batch {
  id: string;
  batch_number: string;
  final_weight_oz: number;
  mining_companies: { name: string } | null;
}

export default function PreSaleCreate() {
  const navigate = useNavigate();
  const alert = useAlert();

  const [formData, setFormData] = useState<CreatePreSaleData>({
    customer_id: '',
    batch_id: '',
    quantity_oz: 0,
    london_am_rate: 2450,
    freight_cost: 0,
    other_costs: 0,
    expected_arrival_date: '',
    notes: '',
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Accordion state for right panel
  const [accordionState, setAccordionState] = useState({
    calculations: true,
    guidance: true,
    workflow: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.batch_id) {
      const batch = batches.find((b) => b.id === formData.batch_id);
      setSelectedBatch(batch || null);
      if (batch) {
        setFormData((prev) => ({ ...prev, quantity_oz: batch.final_weight_oz }));
      }
    } else {
      setSelectedBatch(null);
    }
  }, [formData.batch_id, batches]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customersResult, batchesResult] = await Promise.all([
        supabase.from('customers').select('id, name, email, country').eq('status', 'active').order('name'),
        getBatchesForPreSale(),
      ]);

      if (customersResult.error) throw customersResult.error;
      if (batchesResult.error) throw new Error(batchesResult.error);

      setCustomers(customersResult.data || []);
      setBatches(batchesResult.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert.showAlert('Error loading data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculations = formData.quantity_oz > 0 && formData.london_am_rate > 0
    ? calculatePreSaleAmounts(
        formData.quantity_oz,
        formData.london_am_rate,
        formData.freight_cost || 0,
        formData.other_costs || 0
      )
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id) {
      alert.showAlert('Please select a customer', 'error');
      return;
    }

    if (!formData.batch_id) {
      alert.showAlert('Please select a batch', 'error');
      return;
    }

    if (formData.quantity_oz <= 0) {
      alert.showAlert('Quantity must be greater than 0', 'error');
      return;
    }

    if (formData.london_am_rate <= 0) {
      alert.showAlert('London AM rate must be greater than 0', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPreSale(formData);

      if (result.success) {
        alert.showAlert('Pre-sale created successfully!', 'success');
        navigate(`/presales/${result.data.id}`);
      } else {
        alert.showAlert(result.error || 'Failed to create pre-sale', 'error');
      }
    } catch (error: any) {
      console.error('Error creating pre-sale:', error);
      alert.showAlert('Error creating pre-sale: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const toggleAccordion = (key: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/presales')} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Pre-Sale</h1>
              <p className="mt-1 text-sm text-gray-500">
                Pre-sell a validated batch before inventory arrives
              </p>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <Alert variant="info">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">What is a Pre-Sale?</p>
              <p className="text-sm mt-1">
                Pre-sales allow you to sell validated batches before they arrive at the factory. The system will automatically
                convert the pre-sale to a regular sale when the inventory arrives, with intelligent variance handling.
              </p>
            </div>
          </div>
        </Alert>

        {/* Form Grid with Right Panel */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form - Left Side */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            {/* Batch Selection */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Batch Information</h2>
              </div>

              <div className="space-y-4">
                <FormField label="Select Batch" required>
                  <Select
                    value={formData.batch_id}
                    onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                    required
                  >
                    <option value="">-- Select Batch --</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.batch_number} - {batch.final_weight_oz.toFixed(2)} oz
                        {batch.mining_companies ? ` (${batch.mining_companies.name})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {selectedBatch && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">Batch Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-blue-600">Batch Number</p>
                        <p className="font-medium text-blue-900">{selectedBatch.batch_number}</p>
                      </div>
                      <div>
                        <p className="text-blue-600">Weight</p>
                        <p className="font-medium text-blue-900">
                          {selectedBatch.final_weight_oz.toFixed(2)} oz
                        </p>
                      </div>
                      {selectedBatch.mining_companies && (
                        <div className="col-span-2">
                          <p className="text-blue-600">Mining Company</p>
                          <p className="font-medium text-blue-900">{selectedBatch.mining_companies.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <FormField label="Expected Arrival Date">
                  <Input
                    type="date"
                    value={formData.expected_arrival_date}
                    onChange={(e) => setFormData({ ...formData, expected_arrival_date: e.target.value })}
                  />
                </FormField>
              </div>
            </Card>

            {/* Customer Selection */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Customer Information</h2>
              </div>

              <FormField label="Select Customer" required>
                <Select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.country})
                    </option>
                  ))}
                </Select>
              </FormField>
            </Card>

            {/* Pricing Details */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Pricing Details</h2>
              </div>

              <div className="space-y-4">
                <FormField label="Quantity (oz)" required>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.quantity_oz}
                    onChange={(e) => setFormData({ ...formData, quantity_oz: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </FormField>

                <FormField label="London AM Rate (USD/oz)" required>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.london_am_rate}
                    onChange={(e) => setFormData({ ...formData, london_am_rate: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </FormField>

                <FormField label="Freight Cost (USD)">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.freight_cost}
                    onChange={(e) => setFormData({ ...formData, freight_cost: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>

                <FormField label="Other Costs (USD)">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.other_costs}
                    onChange={(e) => setFormData({ ...formData, other_costs: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>

                <FormField label="Notes">
                  <TextArea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Add any additional notes about this pre-sale..."
                  />
                </FormField>
              </div>
            </Card>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/presales')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Create Pre-Sale
              </Button>
            </div>
          </form>

          {/* Right Accordion Panel */}
          <div className="space-y-4">
            {/* Calculations Accordion */}
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion('calculations')}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-primary-100 hover:from-primary-100 hover:to-primary-150 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary-600" />
                  <span className="font-semibold text-primary-900">Live Calculations</span>
                </div>
                {accordionState.calculations ? (
                  <ChevronUp className="h-5 w-5 text-primary-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-primary-600" />
                )}
              </button>

              {accordionState.calculations && (
                <div className="p-4 space-y-3 border-t border-primary-200">
                  {calculations ? (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Gross Proceeds</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(calculations.gross_proceeds)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Freight Cost</span>
                        <span className="font-medium text-red-600">
                          -{formatCurrency(formData.freight_cost || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Other Costs</span>
                        <span className="font-medium text-red-600">
                          -{formatCurrency(formData.other_costs || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">Net Proceeds</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(calculations.net_proceeds)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Royalty (3%)</span>
                        <span className="font-medium text-red-600">
                          -{formatCurrency(calculations.royalty_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 bg-accent-50 rounded-lg px-3 mt-2">
                        <span className="text-sm font-bold text-accent-900">Final Proceeds</span>
                        <span className="text-lg font-bold text-accent-700">
                          {formatCurrency(calculations.final_proceeds)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Enter quantity and rate to see calculations
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Guidance Accordion */}
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion('guidance')}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Field Guidance</span>
                </div>
                {accordionState.guidance ? (
                  <ChevronUp className="h-5 w-5 text-blue-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-blue-600" />
                )}
              </button>

              {accordionState.guidance && (
                <div className="p-4 space-y-3 border-t border-blue-200 text-sm">
                  <div>
                    <p className="font-medium text-blue-900 mb-1">Batch Selection</p>
                    <p className="text-blue-700">
                      Only validated batches are available for pre-sales. These are batches that have been approved for transport but haven't arrived at the factory yet.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900 mb-1">Quantity</p>
                    <p className="text-blue-700">
                      The system will auto-fill with the batch's total weight, but you can adjust if selling partial quantities.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900 mb-1">Expected Arrival</p>
                    <p className="text-blue-700">
                      Set the expected date when inventory will arrive. The system will track this for automatic conversion.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900 mb-1">London AM Rate</p>
                    <p className="text-blue-700">
                      Current market rate for gold. This will be used to calculate the sale amount.
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Workflow Accordion */}
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion('workflow')}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-150 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold text-amber-900">Workflow Steps</span>
                </div>
                {accordionState.workflow ? (
                  <ChevronUp className="h-5 w-5 text-amber-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-amber-600" />
                )}
              </button>

              {accordionState.workflow && (
                <div className="p-4 space-y-2 border-t border-amber-200 text-sm">
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <p className="text-amber-800">Management reviews and approves pre-sale</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold">
                      2
                    </span>
                    <p className="text-amber-800">Customer receives approval email</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold">
                      3
                    </span>
                    <p className="text-amber-800">Customer account receivable is created (we owe them)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold">
                      4
                    </span>
                    <p className="text-amber-800">System tracks batch arrival automatically</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold">
                      5
                    </span>
                    <p className="text-amber-800">Auto-converts to sale when inventory arrives (±2% variance)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold">
                      6
                    </span>
                    <p className="text-amber-800">Payment processed and transaction completed</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
