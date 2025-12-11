import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Package, AlertCircle, CheckCircle, Building2, User, FileText, Download, Eye } from 'lucide-react';
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
import { calculateSaleProceeds, formatCurrency } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { INITIAL_SALE_STATUS } from '@/constants/salesStatuses';
import {
  getAuthorizedCustomersForMine,
  checkSaleAuthorization,
  type AuthorizedCustomer
} from '@/services/goldSalesSettingsService';
import { getInventoryBySeller } from '@/services/inventoryService';
import {
  generateSaleInvoicePDF,
  downloadInvoicePDF,
  type InvoiceData
} from '@/services/saleInvoiceService';

interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
}

export function SaleCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const alert = useAlert();

  // Extract data from navigation state (from Gold Trade Space simulation)
  const mechanismData = (location.state as any)?.mechanismData as PricingMechanism | undefined;
  const initialQuantity = (location.state as any)?.quantityOz || 0;
  const availableFromState = (location.state as any)?.availableStockOz;

  const [formData, setFormData] = useState({
    customerId: '',
    miningCompanyId: '',
    quantityOz: initialQuantity || 0,
    londonAMRate: mechanismData?.pricePerOz.toFixed(2) || '',
    freightCost: '',
    otherCosts: '',
    mechanismType: mechanismData?.mechanism || '',
    mechanismDisplayName: mechanismData?.displayName || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCalculations, setShowCalculations] = useState(false);
  const [authorizedCustomers, setAuthorizedCustomers] = useState<AuthorizedCustomer[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [selectedMiningCompany, setSelectedMiningCompany] = useState<MiningCompany | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<AuthorizedCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableInventory, setAvailableInventory] = useState({ availableOz: 0, availableGrams: 0 });
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [invoicePdfBlob, setInvoicePdfBlob] = useState<Blob | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    fetchMiningCompanies();
  }, []);

  useEffect(() => {
    if (formData.miningCompanyId) {
      fetchAuthorizedCustomers();
      fetchInventory();
    } else {
      setAuthorizedCustomers([]);
      setAvailableInventory({ availableOz: 0, availableGrams: 0 });
    }
  }, [formData.miningCompanyId]);

  useEffect(() => {
    if (formData.customerId && authorizedCustomers.length > 0) {
      const customer = authorizedCustomers.find(c => c.customer_id === formData.customerId);
      setSelectedCustomer(customer || null);
    } else {
      setSelectedCustomer(null);
    }
  }, [formData.customerId, authorizedCustomers]);

  const fetchMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name, abbreviation, country')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setMiningCompanies(data || []);

      // Auto-select first mining company if only one exists
      if (data && data.length === 1) {
        setFormData(prev => ({ ...prev, miningCompanyId: data[0].id }));
        setSelectedMiningCompany(data[0]);
      }
    } catch (error) {
      console.error('Error fetching mining companies:', error);
      alert.error('Failed to load sellers');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuthorizedCustomers = async () => {
    if (!formData.miningCompanyId) return;

    try {
      const result = await getAuthorizedCustomersForMine(formData.miningCompanyId);
      if (result.success) {
        setAuthorizedCustomers(result.data);
      } else {
        console.error('Error fetching authorized customers:', result.error);
        alert.error('Failed to load authorized customers');
        setAuthorizedCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching authorized customers:', error);
      alert.error('Failed to load customers');
      setAuthorizedCustomers([]);
    }
  };

  const fetchInventory = async () => {
    if (!formData.miningCompanyId) return;

    try {
      setLoadingInventory(true);
      const result = await getInventoryBySeller(formData.miningCompanyId, 'mining_company');
      if (result.success) {
        setAvailableInventory({
          availableOz: result.availableOz,
          availableGrams: result.availableGrams
        });
      } else {
        setAvailableInventory({ availableOz: 0, availableGrams: 0 });
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setAvailableInventory({ availableOz: 0, availableGrams: 0 });
    } finally {
      setLoadingInventory(false);
    }
  };

  const availableInventoryOz = availableFromState || availableInventory.availableOz;

  const handleInputChange = (field: string, value: string) => {
    if (field === 'miningCompanyId') {
      const company = miningCompanies.find(c => c.id === value);
      setSelectedMiningCompany(company || null);
      setFormData(prev => ({
        ...prev,
        miningCompanyId: value,
        customerId: '' // Reset customer when mining company changes
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setShowCalculations(false);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.miningCompanyId) {
      newErrors.miningCompanyId = 'Please select a seller';
    }

    if (!formData.customerId) {
      newErrors.customerId = 'Please select a customer';
    }

    const quantity = typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz || '0');
    if (!formData.quantityOz || quantity === 0 || isNaN(quantity) || quantity <= 0) {
      newErrors.quantityOz = 'Please enter a valid quantity';
    } else if (quantity > availableInventoryOz) {
      newErrors.quantityOz = `Quantity exceeds available inventory (${availableInventoryOz.toFixed(3)} oz)`;
    }

    const londonRate = parseFloat(formData.londonAMRate);
    if (!formData.londonAMRate || isNaN(londonRate) || londonRate <= 0) {
      newErrors.londonAMRate = 'Please enter a valid sale price';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateInvoicePreview = async () => {
    if (!calculations || !selectedMiningCompany || !selectedCustomer) return;

    try {
      setGeneratingPdf(true);

      // Fetch full customer details
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', formData.customerId)
        .single();

      const invoiceData: InvoiceData = {
        invoiceNumber: `DRAFT-${Date.now()}`,
        invoiceDate: new Date().toISOString().split('T')[0],

        // Seller Information
        sellerName: selectedMiningCompany.name,
        sellerAddress: selectedMiningCompany.abbreviation,
        sellerCity: '',
        sellerCountry: selectedMiningCompany.country,
        sellerEmail: '',
        sellerPhone: '',

        // Customer Information
        customerName: selectedCustomer.customer_name,
        customerAddress: customerData?.address || '',
        customerCity: '',
        customerCountry: customerData?.country || '',
        customerEmail: customerData?.email || '',
        customerPhone: customerData?.phone || '',

        // Sale Details
        quantityOz: typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz),
        quantityGrams: (typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz)) * 31.1035,
        pricePerOz: parseFloat(formData.londonAMRate),
        currency: 'USD',

        // Pricing Details
        grossProceeds: calculations.grossProceeds,
        freightCost: calculations.freight,
        otherCosts: calculations.otherCosts,
        netProceeds: calculations.netProceeds,
        royaltiesPercentage: 3,
        royaltiesAmount: calculations.royalties,
        finalAmount: calculations.finalAmount,

        // Additional Info
        mechanismType: formData.mechanismType,
        mechanismDisplayName: formData.mechanismDisplayName,
        paymentTerms: mechanismData ? `Payment terms: ${mechanismData.settlementDays} days` : undefined,
        notes: 'This is a draft invoice. Final invoice will be generated after sale approval.'
      };

      const pdfBlob = await generateSaleInvoicePDF(invoiceData);
      setInvoicePdfBlob(pdfBlob);
    } catch (error) {
      console.error('Error generating invoice preview:', error);
      alert.error('Failed to generate invoice preview');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleCalculate = async () => {
    if (!validateForm()) return;

    // Check authorization
    if (formData.miningCompanyId && formData.customerId) {
      const quantity = typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz);
      const result = await checkSaleAuthorization(
        formData.miningCompanyId,
        formData.customerId,
        quantity,
        availableInventoryOz
      );

      if (!result.success || !result.data?.is_authorized) {
        alert.error(result.data?.reason || 'Sale not authorized');
        return;
      }
    }

    setShowCalculations(true);

    // Generate invoice preview automatically
    setTimeout(() => {
      generateInvoicePreview();
    }, 100);
  };

  const handleDownloadInvoice = () => {
    if (!invoicePdfBlob) return;
    downloadInvoicePDF(invoicePdfBlob, `DRAFT-${Date.now()}`);
  };

  const handlePreviewInvoice = () => {
    if (!invoicePdfBlob) return;
    const url = URL.createObjectURL(invoicePdfBlob);
    window.open(url, '_blank');
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
            seller_id: formData.miningCompanyId,
            seller_type: 'mining_company',
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
        alert.error('Failed to create sale. Please try again.');
        throw error;
      }

      alert.showSuccess(`Sale ${saleNumber} created successfully!`);
      navigate('/sales');
    } catch (error: any) {
      console.error('Error creating sale:', error);
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
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
                ? `Based on ${mechanismData.displayName} pricing mechanism`
                : 'Configure gold sale parameters'}
            </p>
          </div>
        </div>

        {/* Pricing Mechanism Info (from Gold Trade Space) */}
        {mechanismData && (
          <Card className="border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 to-teal-50">
            <CardHeader className="border-b border-emerald-200 bg-emerald-100/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-emerald-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Selected Pricing Mechanism
                  </CardTitle>
                  <p className="text-sm text-emerald-700 mt-1">{mechanismData.description}</p>
                </div>
                <div className="px-4 py-2 bg-emerald-600 text-white rounded-lg">
                  <p className="text-xs font-semibold mb-1">MECHANISM</p>
                  <p className="text-lg font-bold">{mechanismData.displayName}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-200">
                  <p className="text-xs text-gray-600 mb-1">Price per oz</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    ${mechanismData.pricePerOz.toFixed(2)}
                  </p>
                  {mechanismData.adjustmentPercentage !== 0 && (
                    <p className={`text-xs font-semibold mt-1 ${
                      mechanismData.adjustmentPercentage > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {mechanismData.adjustmentPercentage > 0 ? '+' : ''}{mechanismData.adjustmentPercentage.toFixed(3)}%
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-200">
                  <p className="text-xs text-gray-600 mb-1">Simulated Quantity</p>
                  <p className="text-2xl font-bold text-gray-900">{initialQuantity.toFixed(3)} oz</p>
                  <p className="text-xs text-gray-500 mt-1">{(initialQuantity * 31.1035).toFixed(2)} g</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-200">
                  <p className="text-xs text-gray-600 mb-1">Estimated Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${((initialQuantity || 0) * mechanismData.pricePerOz).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-200">
                  <p className="text-xs text-gray-600 mb-1">Value Date</p>
                  <p className="text-lg font-bold text-gray-900">
                    {new Date(mechanismData.valueDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{mechanismData.settlementDays} days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seller and Customer Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Seller & Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Seller (Mining Company) */}
              <div>
                <FormField
                  label="Seller (Mining Company)"
                  required
                  error={errors.miningCompanyId}
                  hint="The mining company selling the gold"
                >
                  <Select
                    value={formData.miningCompanyId}
                    onChange={(e) => handleInputChange('miningCompanyId', e.target.value)}
                    error={!!errors.miningCompanyId}
                    disabled={miningCompanies.length === 1}
                  >
                    <option value="">Select seller</option>
                    {miningCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name} ({company.abbreviation}) - {company.country}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {selectedMiningCompany && (
                  <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{selectedMiningCompany.name}</p>
                        <p className="text-sm text-gray-600">{selectedMiningCompany.abbreviation} • {selectedMiningCompany.country}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Available Inventory</p>
                        <p className="text-lg font-bold text-blue-700">
                          {loadingInventory ? '...' : `${availableInventoryOz.toFixed(3)} oz`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {loadingInventory ? '' : `${availableInventory.availableGrams.toFixed(2)} g`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer */}
              <div>
                <FormField
                  label="Customer (Authorized Buyer)"
                  required
                  error={errors.customerId}
                  hint={
                    !formData.miningCompanyId
                      ? 'Select a seller first to see authorized customers'
                      : authorizedCustomers.length === 0
                        ? 'No authorized customers found for this seller'
                        : 'Select from authorized customers based on Gold Sales Settings'
                  }
                >
                  <Select
                    value={formData.customerId}
                    onChange={(e) => handleInputChange('customerId', e.target.value)}
                    error={!!errors.customerId}
                    disabled={!formData.miningCompanyId || authorizedCustomers.length === 0}
                  >
                    <option value="">Select customer</option>
                    {authorizedCustomers.map((customer) => (
                      <option key={customer.customer_id} value={customer.customer_id}>
                        {customer.customer_name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {selectedCustomer && (
                  <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-5 w-5 text-purple-600" />
                      <h4 className="font-semibold text-gray-900">{selectedCustomer.customer_name}</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">Max Stock %</p>
                        <p className="text-lg font-bold text-purple-700">{selectedCustomer.max_stock_percentage}%</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">Sale Method</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedCustomer.sale_method}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">Fees</p>
                        <div className="text-xs space-y-1">
                          <p className={selectedCustomer.refining_fees_paid_by_customer ? 'text-green-600' : 'text-red-600'}>
                            Refining: {selectedCustomer.refining_fees_paid_by_customer ? 'Customer' : 'Seller'}
                          </p>
                          <p className={selectedCustomer.transport_fees_paid_by_customer ? 'text-green-600' : 'text-red-600'}>
                            Transport: {selectedCustomer.transport_fees_paid_by_customer ? 'Customer' : 'Seller'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sale Details */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <FormField
                  label="Quantity to Sell"
                  required
                  error={errors.quantityOz}
                >
                  <WeightInput
                    value={ouncesToGrams(typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz || '0'))}
                    onChange={(grams) => handleInputChange('quantityOz', gramsToOunces(grams).toString())}
                    placeholder="Enter quantity"
                    error={!!errors.quantityOz}
                    defaultUnit="oz"
                    showConversion={true}
                  />
                  {formData.miningCompanyId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Max available: {availableInventoryOz.toFixed(3)} oz
                    </p>
                  )}
                </FormField>

                <FormField
                  label="Sale Price (USD/oz)"
                  required
                  error={errors.londonAMRate}
                  hint={mechanismData ? 'Price locked from pricing mechanism' : 'Enter sale price per ounce'}
                >
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.londonAMRate}
                    onChange={(e) => handleInputChange('londonAMRate', e.target.value)}
                    error={!!errors.londonAMRate}
                    placeholder="0.00"
                    className={mechanismData ? 'bg-emerald-50 font-semibold' : ''}
                    disabled={!!mechanismData}
                  />
                </FormField>
              </div>

              {/* Costs */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Freight Cost (USD)"
                  hint="Optional transportation cost"
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
                  hint="Optional additional costs"
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

              <div className="flex justify-end">
                <Button
                  onClick={handleCalculate}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Calculate Invoice
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional Invoice Preview */}
        {showCalculations && calculations && (
          <Card className="border-2 border-blue-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Professional Invoice
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviewInvoice}
                    disabled={!invoicePdfBlob || generatingPdf}
                    className="bg-white text-blue-600 hover:bg-blue-50 border-white"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadInvoice}
                    disabled={!invoicePdfBlob || generatingPdf}
                    className="bg-white text-blue-600 hover:bg-blue-50 border-white"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download PDF
                  </Button>
                </div>
              </div>
              <p className="text-sm text-blue-100 mt-2">
                {generatingPdf ? 'Generating invoice...' : 'Draft invoice ready for download'}
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Seller Info */}
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    SELLER
                  </h3>
                  {selectedMiningCompany && (
                    <>
                      <p className="font-bold text-gray-900">{selectedMiningCompany.name}</p>
                      <p className="text-sm text-gray-600">{selectedMiningCompany.country}</p>
                    </>
                  )}
                </div>

                {/* Customer Info */}
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-purple-500">
                  <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    CUSTOMER
                  </h3>
                  {selectedCustomer && (
                    <>
                      <p className="font-bold text-gray-900">{selectedCustomer.customer_name}</p>
                      <p className="text-sm text-gray-600">Payment Method: {selectedCustomer.sale_method}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Calculation Summary */}
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Fine Gold Quantity</span>
                  <span className="font-semibold text-gray-900">
                    {(typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz)).toFixed(3)} oz
                    <span className="text-sm text-gray-500 ml-2">
                      ({((typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz)) * 31.1035).toFixed(2)} g)
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Price per oz</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(formData.londonAMRate))}</span>
                </div>

                <div className="flex justify-between items-center py-3 bg-green-50 px-3 rounded">
                  <span className="font-semibold text-green-900">Gross Proceeds</span>
                  <span className="text-lg font-bold text-green-700">{formatCurrency(calculations.grossProceeds)}</span>
                </div>

                {calculations.freight > 0 && (
                  <div className="flex justify-between items-center py-2 pl-6">
                    <span className="text-sm text-gray-600">Less: Freight Cost</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(calculations.freight)}</span>
                  </div>
                )}

                {calculations.otherCosts > 0 && (
                  <div className="flex justify-between items-center py-2 pl-6">
                    <span className="text-sm text-gray-600">Less: Other Costs</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(calculations.otherCosts)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-3 bg-blue-50 px-3 rounded">
                  <span className="font-semibold text-blue-900">Net Proceeds</span>
                  <span className="text-lg font-bold text-blue-700">{formatCurrency(calculations.netProceeds)}</span>
                </div>

                <div className="flex justify-between items-center py-2 pl-6">
                  <span className="text-sm text-gray-600">Less: Royalties (3%)</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(calculations.royalties)}</span>
                </div>

                <div className="flex justify-between items-center py-4 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 rounded-lg shadow-lg mt-4">
                  <span className="text-lg font-bold text-white">TOTAL AMOUNT</span>
                  <span className="text-2xl font-bold text-white">{formatCurrency(calculations.finalAmount)}</span>
                </div>
              </div>

              {/* PDF Notice */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-900">Professional Invoice PDF</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      The professional PDF invoice includes company logos, detailed seller/customer information,
                      line items, payment terms, and meets international invoicing standards.
                      Use the buttons above to preview or download.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!showCalculations || submitting}
            className="px-8"
          >
            {submitting ? 'Creating Sale...' : 'Create Sale'}
          </Button>
        </div>

        {/* Info Alert */}
        {showCalculations && (
          <Alert type="info" title="Next Steps">
            After creating this sale, the customer will receive an email notification for approval.
            Once approved, you can proceed with payment processing.
          </Alert>
        )}
      </div>
    </MainLayout>
  );
}
