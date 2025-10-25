import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, TrendingUp, Award, Info } from 'lucide-react';
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
  ytdGoldSold?: number;
  ytdAvgPrice?: number;
  ytdAmount?: number;
  isBestCustomer?: boolean;
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

  const availableInventoryGrams = 1250.5;
  const availableInventoryOz = availableInventoryGrams / 31.1035;

  const customers: Customer[] = [
    {
      id: '1',
      name: 'Premium Gold Ltd.',
      email: 'contact@premiumgold.com',
      country: 'Switzerland',
      ytdGoldSold: 458.5,
      ytdAvgPrice: 2435,
      ytdAmount: 1116458,
      isBestCustomer: true
    },
    {
      id: '2',
      name: 'Global Metals Inc.',
      email: 'sales@globalmetals.com',
      country: 'UAE',
      ytdGoldSold: 325.2,
      ytdAvgPrice: 2410,
      ytdAmount: 783732,
      isBestCustomer: false
    },
    {
      id: '3',
      name: 'Swiss Refineries SA',
      email: 'info@swissref.ch',
      country: 'Switzerland',
      ytdGoldSold: 412.8,
      ytdAvgPrice: 2442,
      ytdAmount: 1008058,
      isBestCustomer: false
    },
    {
      id: '4',
      name: 'Asian Gold Trading',
      email: 'trading@asiangold.com',
      country: 'Singapore',
      ytdGoldSold: 289.6,
      ytdAvgPrice: 2398,
      ytdAmount: 694501,
      isBestCustomer: false
    },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    setShowCalculations(false);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerId) {
      newErrors.customerId = 'Please select a customer';
    }

    const quantity = parseFloat(formData.quantityOz);
    if (!formData.quantityOz || isNaN(quantity) || quantity <= 0) {
      newErrors.quantityOz = 'Please enter a valid quantity';
    } else if (quantity > availableInventoryOz) {
      newErrors.quantityOz = `Quantity exceeds available inventory (${availableInventoryOz.toFixed(3)} oz)`;
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
    if (validateForm() && showCalculations) {
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
      <div className="flex gap-6">
        <div className="flex-1 space-y-6 max-w-4xl">
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
            {availableInventoryGrams.toFixed(2)} g ({availableInventoryOz.toFixed(2)} oz) of fine gold available for sale
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
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Email:</span> {selectedCustomer.email}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Country:</span> {selectedCustomer.country}
                      </p>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          YTD Customer Statistics
                        </h3>
                        {selectedCustomer.isBestCustomer && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
                            <Award className="h-3 w-3 text-yellow-600" />
                            <span className="text-xs font-semibold text-yellow-700">Best Customer</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-gray-600 mb-1">Gold Sold</p>
                          <p className="text-lg font-bold text-gray-900">{selectedCustomer.ytdGoldSold?.toFixed(2)} oz</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-gray-600 mb-1">Avg Price</p>
                          <p className="text-lg font-bold text-gray-900">${selectedCustomer.ytdAvgPrice?.toLocaleString()}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedCustomer.ytdAmount || 0)}</p>
                        </div>
                      </div>
                      {selectedCustomer.isBestCustomer && (
                        <p className="text-xs text-blue-700 mt-3 font-medium">
                          This customer has the highest total purchase volume this year
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Quantity (Troy Ounces)"
                    required
                    error={errors.quantityOz}
                    hint={`Max: ${availableInventoryOz.toFixed(3)} oz`}
                  >
                    <Input
                      type="number"
                      step="0.001"
                      max={availableInventoryOz}
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
                      {parseFloat(formData.quantityOz).toFixed(3)} oz
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">London AM Rate</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(parseFloat(formData.londonAMRate))} per oz
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Gross Proceeds</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(calculations.grossProceeds)}
                    </span>
                  </div>
                  {(calculations.freight > 0 || calculations.otherCosts > 0) && (
                    <>
                      {calculations.freight > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Freight Cost</span>
                          <span className="text-sm font-semibold text-red-600">
                            -{formatCurrency(calculations.freight)}
                          </span>
                        </div>
                      )}
                      {calculations.otherCosts > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">Other Costs</span>
                          <span className="text-sm font-semibold text-red-600">
                            -{formatCurrency(calculations.otherCosts)}
                          </span>
                        </div>
                      )}
                    </>
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
                      -{formatCurrency(calculations.royalties)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-primary-50 rounded-lg px-3 mt-2">
                    <span className="text-base font-bold text-gray-900">Final Proceeds</span>
                    <span className="text-base font-bold text-primary-700">
                      {formatCurrency(calculations.finalAmount)}
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
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!showCalculations}
            >
              Submit to Management
            </Button>
          </div>
        </div>

        {/* Right Pane - Sales Information Guide */}
        <div className="hidden xl:block w-80 space-y-4">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-5 w-5 text-blue-600" />
                Sales Information Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-900 mb-2">Creating a Sale</h4>
                <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
                  <li>Select a customer from the dropdown</li>
                  <li>Review customer YTD statistics</li>
                  <li>Enter quantity in troy ounces (max: available inventory)</li>
                  <li>Confirm or adjust London AM rate</li>
                  <li>Add freight and other costs if applicable</li>
                  <li>Click "Calculate Proceeds" to preview</li>
                  <li>Submit to management for approval</li>
                </ol>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <h4 className="font-semibold text-sm text-gray-900 mb-2">Key Information</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                    <p><strong>YTD Statistics:</strong> Shows customer's year-to-date gold purchases, average price, and total amount</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                    <p><strong>Best Customer:</strong> Badge indicates the customer with highest purchase volume</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                    <p><strong>Max Quantity:</strong> Cannot exceed available inventory ({availableInventoryOz.toFixed(2)} oz)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                    <p><strong>Royalties:</strong> 3% net smelted royalties automatically deducted from net proceeds</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <h4 className="font-semibold text-sm text-gray-900 mb-2">Calculation Formula</h4>
                <div className="bg-gray-50 p-3 rounded text-xs space-y-1 text-gray-700">
                  <p>Gross Proceeds = Quantity × Price</p>
                  <p>Net Proceeds = Gross - Costs</p>
                  <p>Royalties = Net × 3%</p>
                  <p className="font-semibold pt-1 border-t border-gray-300">Final = Net - Royalties</p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <h4 className="font-semibold text-sm text-gray-900 mb-2">Approval Process</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold flex-shrink-0">1</div>
                    <p>Management review and approval</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold flex-shrink-0">2</div>
                    <p>Email sent to customer for confirmation</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold flex-shrink-0">3</div>
                    <p>Customer approves via email link</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold flex-shrink-0">4</div>
                    <p>Payment processing and tracking</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
