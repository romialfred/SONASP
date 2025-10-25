import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { calculateSaleProceeds, formatCurrency, formatWeight } from '@/utils/salesUtils';

interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
}

export function SaleCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    customerId: '',
    quantityOz: '',
    londonAMRate: '2450.00',
    freightCost: '',
    otherCosts: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCalculations, setShowCalculations] = useState(false);

  const availableInventory = 1250.5;

  const customers: Customer[] = [
    { id: '1', name: 'Premium Gold Ltd.', email: 'contact@premiumgold.com', country: 'Switzerland' },
    { id: '2', name: 'Global Metals Inc.', email: 'sales@globalmetals.com', country: 'UAE' },
    { id: '3', name: 'Swiss Refineries SA', email: 'info@swissref.ch', country: 'Switzerland' },
    { id: '4', name: 'Asian Gold Trading', email: 'trading@asiangold.com', country: 'Singapore' },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerId) {
      newErrors.customerId = 'Please select a customer';
    }

    const quantity = parseFloat(formData.quantityOz);
    if (!formData.quantityOz || isNaN(quantity) || quantity <= 0) {
      newErrors.quantityOz = 'Please enter a valid quantity';
    } else if (quantity > availableInventory / 31.1035) {
      newErrors.quantityOz = 'Quantity exceeds available inventory';
    }

    const londonRate = parseFloat(formData.londonAMRate);
    if (!formData.londonAMRate || isNaN(londonRate) || londonRate <= 0) {
      newErrors.londonAMRate = 'Please enter a valid London AM rate';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = () => {
    if (validateForm()) {
      setShowCalculations(true);
    }
  };

  const handleSubmit = () => {
    if (validateForm()) {
      navigate('/sales');
    }
  };

  const calculations = formData.quantityOz && formData.londonAMRate
    ? calculateSaleProceeds(
        parseFloat(formData.quantityOz) || 0,
        parseFloat(formData.londonAMRate) || 0,
        parseFloat(formData.freightCost) || 0,
        parseFloat(formData.otherCosts) || 0
      )
    : null;

  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/sales')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Create New Sale
            </h1>
            <p className="text-gray-600 mt-1">Configure sale details and calculate proceeds</p>
          </div>
        </div>

        <Alert type="info" title="Available Inventory">
          {formatWeight(availableInventory, 'g')} ({formatWeight(availableInventory / 31.1035, 'oz')}) of fine gold available for sale
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Sale Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <FormField
                label="Customer"
                required
                error={errors.customerId}
              >
                <Select
                  value={formData.customerId}
                  onChange={(e) => handleInputChange('customerId', e.target.value)}
                  error={!!errors.customerId}
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.country}
                    </option>
                  ))}
                </Select>
              </FormField>

              {selectedCustomer && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {selectedCustomer.email}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Country:</span> {selectedCustomer.country}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Quantity (Troy Ounces)"
                  required
                  error={errors.quantityOz}
                  hint={`Max: ${(availableInventory / 31.1035).toFixed(3)} oz`}
                >
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.quantityOz}
                    onChange={(e) => handleInputChange('quantityOz', e.target.value)}
                    error={!!errors.quantityOz}
                    placeholder="0.000"
                  />
                </FormField>

                <FormField
                  label="London AM Rate (USD/oz)"
                  required
                  error={errors.londonAMRate}
                  hint="Current market rate"
                >
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.londonAMRate}
                    onChange={(e) => handleInputChange('londonAMRate', e.target.value)}
                    error={!!errors.londonAMRate}
                    placeholder="0.00"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Freight Cost (USD)"
                  hint="Optional"
                >
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.freightCost}
                    onChange={(e) => handleInputChange('freightCost', e.target.value)}
                    placeholder="0.00"
                  />
                </FormField>

                <FormField
                  label="Other Costs (USD)"
                  hint="Optional"
                >
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.otherCosts}
                    onChange={(e) => handleInputChange('otherCosts', e.target.value)}
                    placeholder="0.00"
                  />
                </FormField>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleCalculate}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Calculator className="h-4 w-4" />
                  Calculate Proceeds
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showCalculations && calculations && (
          <Card>
            <CardHeader>
              <CardTitle>Sale Calculations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Quantity</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {calculations.quantity.toFixed(3)} oz
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">London AM Rate</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(calculations.londonAMRate)} per oz
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Gross Proceeds</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(calculations.grossProceeds)}
                  </span>
                </div>
                {calculations.totalCosts > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Total Costs</span>
                    <span className="text-sm font-semibold text-red-600">
                      -{formatCurrency(calculations.totalCosts)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Net Proceeds</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(calculations.netProceeds)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Net Smelted Royalties (3%)</span>
                  <span className="text-sm font-semibold text-red-600">
                    -{formatCurrency(calculations.netSmeltedRoyalties)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 bg-primary-50 rounded-lg px-3 mt-2">
                  <span className="text-base font-bold text-gray-900">Final Proceeds</span>
                  <span className="text-base font-bold text-primary-700">
                    {formatCurrency(calculations.finalProceeds)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/sales')}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!showCalculations}
          >
            Submit to Management
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
