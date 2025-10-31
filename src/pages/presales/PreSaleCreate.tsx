import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Package, DollarSign, Users, Calendar, Info } from 'lucide-react';
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
  const [showCalculations, setShowCalculations] = useState(false);

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

  if (loading) {
    return <Loading />;
  }

  return (
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
      <Alert variant="info" icon={Info}>
        <p className="font-medium">What is a Pre-Sale?</p>
        <p className="text-sm mt-1">
          Pre-sales allow you to sell validated batches before they arrive at the factory. The system will automatically
          convert the pre-sale to a regular sale when the inventory arrives, with intelligent variance handling.
        </p>
      </Alert>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
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
                    {customer.name} - {customer.country}
                  </option>
                ))}
              </Select>
            </FormField>
          </Card>

          {/* Pricing Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">Pricing Information</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Quantity (oz)" required>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.quantity_oz}
                  onChange={(e) => setFormData({ ...formData, quantity_oz: parseFloat(e.target.value) || 0 })}
                  required
                  min="0.0001"
                />
              </FormField>

              <FormField label="London AM Rate ($/oz)" required>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.london_am_rate}
                  onChange={(e) => setFormData({ ...formData, london_am_rate: parseFloat(e.target.value) || 0 })}
                  required
                  min="0.01"
                />
              </FormField>

              <FormField label="Freight Cost ($)">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.freight_cost || ''}
                  onChange={(e) => setFormData({ ...formData, freight_cost: parseFloat(e.target.value) || 0 })}
                  min="0"
                />
              </FormField>

              <FormField label="Other Costs ($)">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.other_costs || ''}
                  onChange={(e) => setFormData({ ...formData, other_costs: parseFloat(e.target.value) || 0 })}
                  min="0"
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Notes">
                <TextArea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes about this pre-sale..."
                />
              </FormField>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? 'Creating Pre-Sale...' : 'Create Pre-Sale'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCalculations(!showCalculations)}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {showCalculations ? 'Hide' : 'Show'} Calculations
            </Button>
          </div>
        </div>

        {/* Calculations Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* Calculation Summary */}
            {showCalculations && calculations && (
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Calculation Summary
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium">{formData.quantity_oz.toFixed(4)} oz</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">London AM Rate:</span>
                    <span className="font-medium">{formatCurrency(formData.london_am_rate)}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-medium text-gray-700">Gross Proceeds:</span>
                    <span className="font-semibold">{formatCurrency(calculations.gross_proceeds)}</span>
                  </div>

                  <div className="flex justify-between text-sm text-red-600">
                    <span>Freight Cost:</span>
                    <span>-{formatCurrency(formData.freight_cost || 0)}</span>
                  </div>

                  <div className="flex justify-between text-sm text-red-600">
                    <span>Other Costs:</span>
                    <span>-{formatCurrency(formData.other_costs || 0)}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-medium text-gray-700">Net Proceeds:</span>
                    <span className="font-semibold">{formatCurrency(calculations.net_proceeds)}</span>
                  </div>

                  <div className="flex justify-between text-sm text-red-600">
                    <span>Royalty (3%):</span>
                    <span>-{formatCurrency(calculations.royalty_amount)}</span>
                  </div>

                  <div className="border-t-2 border-gray-300 pt-3 flex justify-between">
                    <span className="font-bold text-gray-900">Final Proceeds:</span>
                    <span className="font-bold text-lg text-green-600">
                      {formatCurrency(calculations.final_proceeds)}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Info Card */}
            <Card className="p-6 bg-teal-50 border-teal-200">
              <h3 className="font-semibold text-teal-900 mb-3">Pre-Sale Benefits</h3>
              <ul className="space-y-2 text-sm text-teal-800">
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">•</span>
                  <span>Lock in prices before inventory arrives</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">•</span>
                  <span>Automatic conversion when batch arrives</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">•</span>
                  <span>Customer account tracking (we owe them)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">•</span>
                  <span>Intelligent variance detection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">•</span>
                  <span>Same approval workflow as sales</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
