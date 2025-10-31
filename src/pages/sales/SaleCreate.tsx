import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Calculator, TrendingUp, Award, Info, Package, DollarSign, Users, FileText, CheckCircle, Mail } from 'lucide-react';
import type { PricingMechanism } from '@/services/goldTradeSpaceService';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { WeightInput, gramsToOunces, ouncesToGrams } from '@/components/ui/WeightInput';
import { calculateSaleProceeds, formatCurrency, formatWeight } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { INITIAL_SALE_STATUS } from '@/constants/salesStatuses';
import {
  getAvailableSellers,
  isCustomerMansa,
  validateSellerCustomerPair,
  type Seller,
  type SellerType
} from '@/services/salesService';

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
  const location = useLocation();
  const { user } = useAuth();
  const alert = useAlert();

  // Extract data from navigation state (from simulation)
  const mechanismData = (location.state as any)?.mechanismData as PricingMechanism | undefined;
  const initialQuantity = (location.state as any)?.quantityOz || 0;
  const availableFromState = (location.state as any)?.availableStockOz;

  const [formData, setFormData] = useState({
    customerId: '',
    sellerId: '',
    sellerType: '' as SellerType | '',
    quantityOz: initialQuantity || 0,
    londonAMRate: mechanismData?.pricePerOz.toFixed(2) || '2450.00',
    freightCost: '',
    otherCosts: '',
    mechanismType: mechanismData?.mechanism || '',
    mechanismDisplayName: mechanismData?.displayName || ''
  });

  const [activeField, setActiveField] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCalculations, setShowCalculations] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customerIsMansa, setCustomerIsMansa] = useState(false);
  const [sellerValidationError, setSellerValidationError] = useState<string>('');

  useEffect(() => {
    fetchCustomers();
    fetchSellers();
  }, []);

  useEffect(() => {
    // When customer changes, check if it's Mansa and validate seller
    if (formData.customerId) {
      checkCustomerAndValidateSeller();
    } else {
      setCustomerIsMansa(false);
      setSellerValidationError('');
    }
  }, [formData.customerId, formData.sellerId, formData.sellerType]);

  const fetchCustomers = async () => {
    try {
      // Fetch all customers (or filter by status if available)
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, phone, country, address, contact_person, status')
        .order('name');

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        throw customersError;
      }

      console.log('Fetched customers:', customersData);

      // Filter active customers if status field exists
      const activeCustomers = (customersData || []).filter(c =>
        !c.status || c.status === 'active'
      );

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('customer_id, quantity_oz, london_am_rate, final_proceeds')
        .in('status', ['approved', 'customer_approved', 'payment_received', 'completed']);

      if (salesError) throw salesError;

      const customerStats = activeCustomers.map(customer => {
        const customerSales = (salesData || []).filter(s => s.customer_id === customer.id);
        const ytdGoldSold = customerSales.reduce((sum, s) => sum + parseFloat(s.quantity_oz || 0), 0);
        const ytdAmount = customerSales.reduce((sum, s) => sum + parseFloat(s.final_proceeds || 0), 0);
        const ytdAvgPrice = ytdGoldSold > 0
          ? customerSales.reduce((sum, s) => sum + parseFloat(s.london_am_rate || 0), 0) / customerSales.length
          : 0;

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          country: customer.country,
          ytdGoldSold: ytdGoldSold,
          ytdAvgPrice: ytdAvgPrice,
          ytdAmount: ytdAmount,
          isBestCustomer: false
        };
      });

      if (customerStats.length > 0) {
        const maxAmount = Math.max(...customerStats.map(c => c.ytdAmount || 0));
        customerStats.forEach(c => {
          c.isBestCustomer = c.ytdAmount === maxAmount && maxAmount > 0;
        });
      }

      setCustomers(customerStats);
      console.log('Customer stats processed:', customerStats);
    } catch (error) {
      console.error('Error fetching customers:', error);
      alert.error('Failed to load customers. Please refresh the page.');
    }
  };

  const fetchSellers = async () => {
    try {
      const result = await getAvailableSellers();
      if (result.success && result.data) {
        setSellers(result.data);
        console.log('Sellers loaded:', result.data);
      } else {
        console.error('Error fetching sellers:', result.error);
        alert.error('Failed to load sellers. Please refresh the page.');
      }
    } catch (error) {
      console.error('Error fetching sellers:', error);
      alert.error('Failed to load sellers. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const checkCustomerAndValidateSeller = async () => {
    if (!formData.customerId) return;

    try {
      // Check if customer is Mansa
      const result = await isCustomerMansa(formData.customerId);
      if (result.success) {
        setCustomerIsMansa(result.isMansa);

        // Validate seller if both customer and seller are selected
        if (formData.sellerId && formData.sellerType) {
          const validation = validateSellerCustomerPair(
            formData.sellerType,
            formData.customerId,
            result.isMansa
          );

          if (!validation.valid) {
            setSellerValidationError(validation.error || 'Invalid seller-customer combination');
          } else {
            setSellerValidationError('');
          }
        }
      }
    } catch (error) {
      console.error('Error checking customer:', error);
    }
  };

  const availableInventoryGrams = 1250.5;
  const availableInventoryOz = availableFromState || (availableInventoryGrams / 31.1035);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    setShowCalculations(false);

    // Update seller type when seller changes
    if (field === 'sellerId' && value) {
      const selectedSeller = sellers.find(s => s.id === value);
      if (selectedSeller) {
        setFormData((prev) => ({ ...prev, sellerType: selectedSeller.type }));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerId) {
      newErrors.customerId = 'Please select a customer';
    }

    if (!formData.sellerId) {
      newErrors.sellerId = 'Please select a seller';
    }

    // Check for seller validation errors
    if (sellerValidationError) {
      newErrors.sellerId = sellerValidationError;
    }

    const quantity = typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz || '0');
    if (!formData.quantityOz || quantity === 0 || isNaN(quantity) || quantity <= 0) {
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

  const handleSubmit = async () => {
    if (!validateForm() || !showCalculations) return;

    setSubmitting(true);
    try {
      const calculations = calculateSaleProceeds(
        typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz),
        parseFloat(formData.londonAMRate),
        parseFloat(formData.freightCost) || 0,
        parseFloat(formData.otherCosts) || 0
      );

      const currentYear = new Date().getFullYear();
      const { data: latestSale } = await supabase
        .from('sales')
        .select('sale_number')
        .like('sale_number', `SL-${currentYear}-%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let saleNumber;
      if (latestSale?.sale_number) {
        const lastNumber = parseInt(latestSale.sale_number.split('-')[2]);
        saleNumber = `SL-${currentYear}-${String(lastNumber + 1).padStart(3, '0')}`;
      } else {
        saleNumber = `SL-${currentYear}-001`;
      }

      const { data, error } = await supabase
        .from('sales')
        .insert([
          {
            sale_number: saleNumber,
            sale_date: new Date().toISOString().split('T')[0],
            customer_id: formData.customerId,
            seller_id: formData.sellerId,
            seller_type: formData.sellerType,
            quantity_oz: typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz),
            london_am_rate: parseFloat(formData.londonAMRate),
            freight_cost: parseFloat(formData.freightCost) || 0,
            other_costs: parseFloat(formData.otherCosts) || 0,
            gross_proceeds: calculations.grossProceeds,
            net_proceeds: calculations.netProceeds,
            royalties: calculations.royalties,
            final_proceeds: calculations.finalAmount,
            total_amount: calculations.finalAmount,
            currency: 'USD',
            status: INITIAL_SALE_STATUS,
            mechanism_type: formData.mechanismType || null,
            created_by: user?.id
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      alert.success('Sale created successfully!');
      navigate('/sales');
    } catch (error: any) {
      console.error('Error creating sale:', error);

      let errorMessage = 'Failed to create sale. Please try again.';

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = `Database error: ${error.details}`;
      } else if (error?.hint) {
        errorMessage = `Error: ${error.hint}`;
      }

      alert.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const calculations = formData.quantityOz && formData.londonAMRate
    ? calculateSaleProceeds(
        (typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz)) || 0,
        parseFloat(formData.londonAMRate) || 0,
        parseFloat(formData.freightCost) || 0,
        parseFloat(formData.otherCosts) || 0
      )
    : null;

  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/sales')}
              className="flex items-center gap-2"
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                Create New Sale
              </h1>
              <p className="text-gray-600 mt-1">
                {mechanismData
                  ? `Based on ${mechanismData.displayName} simulation`
                  : 'Configure sale details and calculate proceeds'}
              </p>
            </div>
          </div>

          {mechanismData && (
            <Card className="border-2 border-emerald-200 bg-emerald-50/50">
              <CardContent className="py-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900 mb-1">Selected Pricing Mechanism</p>
                      <p className="text-lg font-bold text-emerald-700">{mechanismData.displayName}</p>
                      <p className="text-xs text-emerald-600 mt-1">{mechanismData.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600 mb-1">Price per oz</p>
                      <p className="text-2xl font-bold text-gray-900">${mechanismData.pricePerOz.toFixed(2)}</p>
                      {mechanismData.adjustmentPercentage !== 0 && (
                        <p className={`text-xs font-semibold mt-1 ${
                          mechanismData.adjustmentPercentage > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {mechanismData.adjustmentPercentage > 0 ? '+' : ''}{mechanismData.adjustmentPercentage.toFixed(3)}% adjustment
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-emerald-200">
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Quantity from Simulation</p>
                      <p className="text-lg font-bold text-gray-900">{initialQuantity || 0} oz</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Gross Amount</p>
                      <p className="text-lg font-bold text-gray-900">
                        ${((parseFloat(initialQuantity) || 0) * mechanismData.pricePerOz).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                    onFocus={() => setActiveField('customer')}
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.country}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  label="Seller"
                  required
                  error={errors.sellerId}
                  hint={
                    customerIsMansa
                      ? 'For internal transfer to Mansa, mining companies can be selected'
                      : 'External sales must be from Mansa Resources'
                  }
                >
                  <Select
                    value={formData.sellerId}
                    onChange={(e) => handleInputChange('sellerId', e.target.value)}
                    error={!!errors.sellerId}
                    onFocus={() => setActiveField('seller')}
                  >
                    <option value="">Select a seller</option>
                    {sellers
                      .filter((seller) => {
                        // Business Rule: External customers can only buy from Mansa
                        if (!customerIsMansa && formData.customerId) {
                          return seller.type === 'mansa';
                        }
                        // For Mansa customers, show all sellers
                        return true;
                      })
                      .map((seller) => (
                        <option key={seller.id} value={seller.id}>
                          {seller.name}
                          {seller.type === 'mining_company' && ' (Mining Company)'}
                          {seller.type === 'mansa' && ' (Mansa Resources)'}
                        </option>
                      ))}
                  </Select>
                </FormField>

                {sellerValidationError && (
                  <Alert type="error" title="Invalid Seller Selection">
                    {sellerValidationError}
                  </Alert>
                )}

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
                    label="Quantity to Sell"
                    required
                    error={errors.quantityOz}
                  >
                    <WeightInput
                      value={ouncesToGrams(typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz || '0'))}
                      onChange={(grams) => handleInputChange('quantityOz', gramsToOunces(grams))}
                      placeholder="Enter quantity"
                      error={!!errors.quantityOz}
                      defaultUnit="oz"
                      showConversion={true}
                      onFocus={() => setActiveField('quantity')}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Max available: {availableInventoryOz.toFixed(3)} oz ({(availableInventoryOz * 31.1034768).toFixed(2)} g)
                    </p>
                  </FormField>

                  <FormField
                    label="Sale Price (USD/oz)"
                    required
                    error={errors.londonAMRate}
                    hint={mechanismData ? `From ${mechanismData.displayName} - Price is locked` : 'Current market rate'}
                  >
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.londonAMRate}
                      onChange={(e) => handleInputChange('londonAMRate', e.target.value)}
                      error={!!errors.londonAMRate}
                      placeholder="0.00"
                      onFocus={() => setActiveField('price')}
                      className={mechanismData ? 'bg-emerald-50' : ''}
                      disabled={!!mechanismData}
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
                      onFocus={() => setActiveField('freight')}
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
                      onFocus={() => setActiveField('costs')}
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

          {showCalculations && calculations && selectedCustomer && (
            <Card className="border-2 border-primary-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary-50 to-blue-50 border-b-2 border-primary-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Sale Calculations Report</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Review and Submit to Customer</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Sale Date</p>
                    <p className="text-sm font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Customer Name</p>
                      <p className="text-lg font-bold text-gray-900">{selectedCustomer.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{selectedCustomer.email} • {selectedCustomer.country}</p>
                    </div>
                    {selectedCustomer.isBestCustomer && (
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-full">
                        <Award className="h-4 w-4 text-yellow-600" />
                        <span className="text-xs font-semibold text-yellow-700">Best Customer</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="group relative flex justify-between items-center py-2 px-4 hover:bg-gray-50 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Quantity</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Base quantity for sale</div>
                      </div>
                    </div>
                    <span className="text-base font-bold text-gray-900">
                      {parseFloat(formData.quantityOz).toFixed(3)} oz
                    </span>
                  </div>

                  <div className="group relative flex justify-between items-center py-2 px-4 hover:bg-gray-50 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">London AM Rate</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Current market rate per ounce</div>
                      </div>
                    </div>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(parseFloat(formData.londonAMRate))} / oz
                    </span>
                  </div>

                  <div className="h-px bg-gray-200 my-1.5"></div>

                  <div className="group relative flex justify-between items-center py-2.5 px-4 bg-green-50 hover:bg-green-100 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-900">Gross Proceeds</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-32 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg z-10 whitespace-nowrap">
                        Formula: Quantity × London AM Rate<br/>
                        {parseFloat(formData.quantityOz).toFixed(3)} oz × {formatCurrency(parseFloat(formData.londonAMRate))}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-green-700">
                      {formatCurrency(calculations.grossProceeds)}
                    </span>
                  </div>

                  {calculations.freight > 0 && (
                    <div className="group relative flex justify-between items-center py-2 px-4 hover:bg-gray-50 rounded transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">Freight Cost</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Transportation expenses</div>
                        </div>
                      </div>
                      <span className="text-base font-bold text-red-600">
                        -{formatCurrency(calculations.freight)}
                      </span>
                    </div>
                  )}

                  {calculations.otherCosts > 0 && (
                    <div className="group relative flex justify-between items-center py-2 px-4 hover:bg-gray-50 rounded transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">Other Costs</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Additional expenses</div>
                        </div>
                      </div>
                      <span className="text-base font-bold text-red-600">
                        -{formatCurrency(calculations.otherCosts)}
                      </span>
                    </div>
                  )}

                  <div className="h-px bg-gray-300 my-1.5"></div>

                  <div className="group relative flex justify-between items-center py-2.5 px-4 bg-blue-50 hover:bg-blue-100 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-blue-900">Net Proceeds</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-32 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg z-10 whitespace-nowrap">
                        Formula: Gross Proceeds - Total Costs<br/>
                        {formatCurrency(calculations.grossProceeds)} - {formatCurrency(calculations.freight + calculations.otherCosts)}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-blue-700">
                      {formatCurrency(calculations.netProceeds)}
                    </span>
                  </div>

                  <div className="group relative flex justify-between items-center py-2 px-4 hover:bg-gray-50 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">Net Smelted Royalties (3%)</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-56 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg z-10 whitespace-nowrap">
                        Formula: Net Proceeds × 3%<br/>
                        {formatCurrency(calculations.netProceeds)} × 0.03
                      </div>
                    </div>
                    <span className="text-base font-bold text-red-600">
                      -{formatCurrency(calculations.royalties)}
                    </span>
                  </div>

                  <div className="h-1 bg-gradient-to-r from-primary-200 to-blue-200 my-2 rounded-full"></div>

                  <div className="group relative flex justify-between items-center py-3 px-4 bg-gradient-to-r from-primary-100 to-blue-100 border-2 border-primary-300 rounded-lg shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">Final Proceeds</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-40 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg z-10 whitespace-nowrap">
                        Formula: Net Proceeds - Royalties<br/>
                        {formatCurrency(calculations.netProceeds)} - {formatCurrency(calculations.royalties)}
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-primary-700">
                      {formatCurrency(calculations.finalAmount)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> This calculation is subject to management approval. Final amount will be communicated to the customer via email upon approval.
                  </p>
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
              disabled={!showCalculations || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit to Customer for Approval'}
            </Button>
          </div>
        </div>

        {/* Right Pane - Field Guide Panel */}
        <div className="hidden xl:block xl:w-96">
          <div className="sticky top-6">
            <Card className="overflow-hidden border-2 border-blue-200 shadow-lg">
              <CardHeader className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">Field Guide</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Currently Editing Section */}
                  {activeField && (
                    <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                      <h3 className="text-sm font-bold text-blue-900 mb-1 uppercase tracking-wide">
                        Currently Editing
                      </h3>
                      <p className="text-sm font-semibold text-blue-700">
                        {activeField === 'customer' && 'Customer Selection'}
                        {activeField === 'seller' && 'Seller Selection'}
                        {activeField === 'quantity' && 'Quantity (Troy Ounces)'}
                        {activeField === 'price' && 'Sale Price'}
                        {activeField === 'freight' && 'Freight Cost'}
                        {activeField === 'costs' && 'Other Costs'}
                      </p>
                    </div>
                  )}

                  {/* Quick Tips */}
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      QUICK TIPS
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-gray-700">Click or focus on any field to see its guidance</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-gray-700">Required fields are marked with an asterisk (*)</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-gray-700">Calculations update automatically as you type</p>
                      </div>
                    </div>
                  </div>

                  {/* Creating a Sale Steps */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-sm text-gray-900 mb-3">Creating a Sale</h4>
                    <div className="space-y-3 text-xs text-gray-600">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">1</div>
                        <div>
                          <p className="font-semibold text-gray-900">Select Customer</p>
                          <p className="text-gray-600">Choose from active customers dropdown</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">2</div>
                        <div>
                          <p className="font-semibold text-gray-900">Select Seller</p>
                          <p className="text-gray-600">Mining company or Mansa (based on business rules)</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">3</div>
                        <div>
                          <p className="font-semibold text-gray-900">Review Statistics</p>
                          <p className="text-gray-600">Check customer's YTD performance</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">4</div>
                        <div>
                          <p className="font-semibold text-gray-900">Enter Quantity</p>
                          <p className="text-gray-600">Max: {availableInventoryOz.toFixed(2)} oz available</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">5</div>
                        <div>
                          <p className="font-semibold text-gray-900">Confirm Price</p>
                          <p className="text-gray-600">{mechanismData ? 'Pre-filled from simulation' : 'Enter sale price per oz'}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">6</div>
                        <div>
                          <p className="font-semibold text-gray-900">Add Costs</p>
                          <p className="text-gray-600">Include freight and other expenses</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">7</div>
                        <div>
                          <p className="font-semibold text-gray-900">Calculate Proceeds</p>
                          <p className="text-gray-600">Click "Calculate" to preview</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">8</div>
                        <div>
                          <p className="font-semibold text-gray-900">Submit to Customer</p>
                          <p className="text-gray-600">Send directly for customer approval</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calculation Formula */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-sm text-gray-900 mb-3">Calculation Formula</h4>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg text-xs space-y-2 text-gray-700 font-mono">
                      <div className="flex justify-between">
                        <span>Gross Proceeds</span>
                        <span className="text-gray-500">=</span>
                        <span>Qty × Price</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Proceeds</span>
                        <span className="text-gray-500">=</span>
                        <span>Gross - Costs</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Royalties (3%)</span>
                        <span className="text-gray-500">=</span>
                        <span>Net × 0.03</span>
                      </div>
                      <div className="border-t border-gray-300 pt-2 mt-2 font-bold text-blue-700 flex justify-between">
                        <span>Final Amount</span>
                        <span className="text-gray-500">=</span>
                        <span>Net - Royalties</span>
                      </div>
                    </div>
                  </div>

                  {/* Approval Process */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-sm text-gray-900 mb-3">Approval Process</h4>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">Direct to Customer</p>
                          <p className="text-gray-600">Sale sent directly to customer for approval</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">Customer Confirms</p>
                          <p className="text-gray-600">Customer receives email and approves</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">Payment Processing</p>
                          <p className="text-gray-600">Track payment and complete sale</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Information */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-sm text-gray-900 mb-3">Key Information</h4>
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex items-start gap-2">
                        <Award className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p><strong className="text-gray-900">Best Customer:</strong> Highest purchase volume badge</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p><strong className="text-gray-900">YTD Stats:</strong> Year-to-date customer performance</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Package className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p><strong className="text-gray-900">Max Quantity:</strong> {availableInventoryOz.toFixed(2)} oz available</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-3.5 w-3.5 text-purple-600 flex-shrink-0 mt-0.5" />
                        <p><strong className="text-gray-900">Royalties:</strong> 3% automatically deducted</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
