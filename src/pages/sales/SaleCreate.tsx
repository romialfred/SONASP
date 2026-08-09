import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Package, Building2, User, FileText, Lock } from 'lucide-react';
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
import { InvoicePreviewPanel, type InvoicePreviewData } from '@/components/sales/InvoicePreviewPanel';
import { formatNumberInWords } from '@/utils/numberToWords';
import { createSaleInventoryTransactions } from '@/services/inventoryTransactionService';

interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
}

export function SaleCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const alert = useAlert();

  // Extract data from navigation state (from Gold Trade Space simulation or Inventory)
  const mechanismData = (location.state as any)?.mechanismData as PricingMechanism | undefined;
  const initialQuantity = (location.state as any)?.quantityOz || 0;
  const availableFromState = (location.state as any)?.availableStockOz;
  const preselectedSellerId = (location.state as any)?.preselectedSellerId; // New: preselected seller from inventory
  const isSellerLocked = (location.state as any)?.lockSeller || false; // New: lock seller field
  const preselectedCustomerId = (location.state as any)?.preselectedCustomerId; // New: preselected customer

  const [formData, setFormData] = useState({
    customerId: preselectedCustomerId || '',
    miningCompanyId: preselectedSellerId || '',
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
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState<InvoicePreviewData | null>(null);

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

  // Auto-update invoice preview when form data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.miningCompanyId && formData.customerId && formData.quantityOz && formData.londonAMRate) {
        updateInvoicePreviewData();
      } else {
        setShowInvoicePreview(false);
        setInvoicePreviewData(null);
      }
    }, 500); // Debounce to avoid too many updates

    return () => clearTimeout(timer);
  }, [formData.miningCompanyId, formData.customerId, formData.quantityOz, formData.londonAMRate, formData.freightCost, formData.otherCosts]);

  const fetchMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name, abbreviation, country')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setMiningCompanies(data || []);

      // If preselectedSellerId is provided, set that seller
      if (preselectedSellerId && data) {
        const selectedCompany = data.find(c => c.id === preselectedSellerId);
        if (selectedCompany) {
          setSelectedMiningCompany(selectedCompany);
        }
      }
      // Auto-select first mining company if only one exists
      else if (data && data.length === 1) {
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
    // Prevent changing seller if locked
    if (field === 'miningCompanyId' && isSellerLocked) {
      return;
    }

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
    // Don't hide preview - let the auto-update effect handle it
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.miningCompanyId) {
      newErrors.miningCompanyId = 'Please select a seller';
    }

    // Check if seller has inventory
    if (formData.miningCompanyId && availableInventoryOz === 0) {
      newErrors.miningCompanyId = 'This mining company has no inventory available. Please add gold to inventory first.';
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

  const updateInvoicePreviewData = async () => {
    if (!calculations || !selectedMiningCompany || !selectedCustomer) return;

    // Fetch full customer details
    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', formData.customerId)
      .single();

    // Fetch full mining company details
    const { data: miningCompanyData } = await supabase
      .from('mining_companies')
      .select('*')
      .eq('id', formData.miningCompanyId)
      .single();

    const quantityOz = typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz);
    const quantityGrams = quantityOz * 31.1034768;
    const quantityKg = quantityGrams / 1000;
    const pricePerOz = parseFloat(formData.londonAMRate);
    const pricePerKg = pricePerOz * (1000 / 31.1034768); // Convert $/oz to $/kg

    // Calculate amount in words
    const finalAmountInWords = formatNumberInWords(calculations.finalAmount);

    const previewData: InvoicePreviewData = {
      // Seller Information
      sellerName: miningCompanyData?.name || selectedMiningCompany.name,
      sellerAddress: miningCompanyData?.abbreviation || selectedMiningCompany.abbreviation,
      sellerCity: miningCompanyData?.city || '',
      sellerCountry: miningCompanyData?.country || selectedMiningCompany.country,
      sellerPhone: miningCompanyData?.contact_person_phone || '',

      // Customer Information
      customerName: selectedCustomer.customer_name,
      customerAddress: customerData?.address || '',
      customerCity: customerData?.city || '',
      customerCountry: customerData?.country || '',
      customerPhone: customerData?.phone || '',

      // Invoice Details
      invoiceDate: new Date().toISOString(),

      // Sale Details
      quantityOz: quantityOz,
      quantityGrams: quantityGrams,
      quantityKg: quantityKg,
      pricePerOz: pricePerOz,
      pricePerKg: pricePerKg,
      currency: 'USD',

      // Pricing Details
      grossProceeds: calculations.grossProceeds,
      freightCost: calculations.freight,
      otherCosts: calculations.otherCosts,
      netProceeds: calculations.netProceeds,
      royaltiesPercentage: 3,
      royaltiesAmount: calculations.royalties,
      finalAmount: calculations.finalAmount,
      finalAmountInWords: finalAmountInWords,
      estimatedValue: calculations.grossProceeds,

      // Additional Info
      mechanismType: formData.mechanismType,
      mechanismDisplayName: formData.mechanismDisplayName,
      valueDate: mechanismData?.valueDate,
      settlementDays: mechanismData?.settlementDays
    };

    setInvoicePreviewData(previewData);
    setShowInvoicePreview(true);
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

    // Generate invoice preview data only (no PDF generation)
    setTimeout(() => {
      updateInvoicePreviewData();
    }, 100);
  };

  const handleSubmit = async () => {
    if (!validateForm() || !showCalculations) return;

    setSubmitting(true);
    try {
      const requestedQuantityOz = typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz);

      // CRITICAL: Validate stock availability before creating sale
      // Get available stock for the selected mining company
      const { data: availableStock, error: stockError } = await supabase
        .from('daily_production')
        .select('quantity_grams')
        .eq('mining_company_id', formData.miningCompanyId)
        .eq('status', 'in_safe');

      if (stockError) {
        console.error('Error checking stock:', stockError);
        alert.error('Unable to verify stock availability. Please try again.');
        throw stockError;
      }

      const totalAvailableGrams = (availableStock || []).reduce((sum, item) => sum + (item.quantity_grams || 0), 0);
      const totalAvailableOz = totalAvailableGrams / 31.1034768;

      // Get already sold quantity for this mining company
      const { data: existingSales, error: salesError } = await supabase
        .from('sales')
        .select('quantity_oz')
        .eq('seller_id', formData.miningCompanyId);

      if (salesError) {
        console.error('Error checking existing sales:', salesError);
        alert.error('Unable to verify existing sales. Please try again.');
        throw salesError;
      }

      const totalSoldOz = (existingSales || []).reduce((sum, sale) => sum + (sale.quantity_oz || 0), 0);
      const remainingAvailableOz = totalAvailableOz - totalSoldOz;

      // Validate: requested quantity must not exceed remaining available stock
      if (requestedQuantityOz > remainingAvailableOz) {
        const deficitOz = requestedQuantityOz - remainingAvailableOz;
        const deficitGrams = deficitOz * 31.1034768;

        alert.error(
          `Stock insuffisant! Vous essayez de vendre ${requestedQuantityOz.toFixed(2)} oz ` +
          `mais seulement ${remainingAvailableOz.toFixed(2)} oz sont disponibles. ` +
          `Déficit: ${deficitOz.toFixed(2)} oz (${deficitGrams.toFixed(2)}g)`
        );

        setSubmitting(false);
        return;
      }

      const calculations = calculateSaleProceeds(
        requestedQuantityOz,
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
            is_internal_sale: false,
            quantity_oz: requestedQuantityOz,
            london_am_rate: parseFloat(formData.londonAMRate),
            freight_cost: parseFloat(formData.freightCost) || 0,
            other_costs: parseFloat(formData.otherCosts) || 0,
            gross_proceeds: calculations.grossProceeds,
            net_proceeds: calculations.netProceeds,
            royalty_amount: calculations.royalties,
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

      // Create inventory transactions (exit for seller, entry for buyer)
      if (data) {
        const inventoryResult = await createSaleInventoryTransactions(
          data.id,
          formData.miningCompanyId,
          'mining_company',
          formData.customerId,
          requestedQuantityOz,
          user?.id
        );

        if (!inventoryResult.success) {
          console.warn('Warning: Sale created but inventory transactions failed:', inventoryResult.error);
          alert.warning(
            `Sale ${saleNumber} created successfully, but inventory tracking encountered an issue. ` +
            `Please verify inventory manually.`
          );
        } else {
          console.log('Inventory transactions created successfully');
        }
      }

      // Success - navigate to sales dashboard
      alert.success(`Sale ${saleNumber} created successfully!`);
      setTimeout(() => {
        navigate('/sales');
      }, 100);
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
      <div className={`transition-all duration-300 space-y-6 ${showInvoicePreview ? 'max-w-5xl mr-[600px] ml-auto' : 'max-w-5xl mx-auto'}`}>
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
            <CardHeader className="border-b border-emerald-200 bg-emerald-100/50 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-emerald-900 flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" />
                    Selected Pricing Mechanism
                  </CardTitle>
                  <p className="text-xs text-emerald-700 mt-0.5">{mechanismData.description}</p>
                </div>
                <div className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg">
                  <p className="text-xs mb-0.5">MECHANISM</p>
                  <p className="text-base">{mechanismData.displayName}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white rounded-lg px-2.5 py-2 shadow-sm border border-emerald-200">
                  <p className="text-xs text-gray-600 mb-0.5">Price per oz</p>
                  <p className="text-lg text-emerald-700">
                    ${mechanismData.pricePerOz.toFixed(2)}
                  </p>
                  {mechanismData.adjustmentPercentage !== 0 && (
                    <p className={`text-xs mt-0.5 ${
                      mechanismData.adjustmentPercentage > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {mechanismData.adjustmentPercentage > 0 ? '+' : ''}{mechanismData.adjustmentPercentage.toFixed(3)}%
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-lg px-2.5 py-2 shadow-sm border border-emerald-200">
                  <p className="text-xs text-gray-600 mb-0.5">Simulated Quantity</p>
                  <p className="text-lg text-gray-900">
                    {(typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz || '0')).toFixed(3)} oz
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {((typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz || '0')) * 31.1034768).toFixed(2)} g
                  </p>
                </div>
                <div className="bg-white rounded-lg px-2.5 py-2 shadow-sm border border-emerald-200">
                  <p className="text-xs text-gray-600 mb-0.5">Estimated Value</p>
                  <p className="text-lg text-gray-900">
                    ${(((typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz || '0'))) * mechanismData.pricePerOz).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg px-2.5 py-2 shadow-sm border border-emerald-200">
                  <p className="text-xs text-gray-600 mb-0.5">Value Date</p>
                  <p className="text-sm text-gray-900">
                    {new Date(mechanismData.valueDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{mechanismData.settlementDays} days</p>
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
              {/* Seller (Mining Company) - READ ONLY DISPLAY */}
              <div>
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Seller (Mining Company)
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <p className="text-xs text-gray-600">Seller is determined by stock ownership from inventory</p>
                </div>

                {!selectedMiningCompany && formData.miningCompanyId === '' && (
                  <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    <Building2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No seller selected</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Please start from Inventory Management or Gold Trade Space to select stock
                    </p>
                  </div>
                )}

                {selectedMiningCompany && (
                  <div>
                    <div className="px-4 py-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 ml-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            <h3 className="text-base text-gray-900">{selectedMiningCompany.name}</h3>
                          </div>

                          <div className="space-y-1 text-sm ml-6">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">Code:</span>
                              <span className="text-gray-900">{selectedMiningCompany.abbreviation}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">Country:</span>
                              <span className="text-gray-900">{selectedMiningCompany.country}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right ml-4 bg-white rounded-lg px-3 py-2 border border-blue-200 shadow-sm">
                          <p className="text-xs text-gray-600 mb-0.5">Available Inventory</p>
                          <p className={`text-xl ${availableInventoryOz > 0 ? 'text-blue-700' : 'text-red-600'}`}>
                            {loadingInventory ? '...' : `${availableInventoryOz.toFixed(3)} oz`}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {loadingInventory ? '' : `${availableInventory.availableGrams.toFixed(2)} g`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <div className="flex items-center gap-2 text-xs text-blue-800">
                          <Lock className="h-3 w-3" />
                          <span>Seller information is based on stock ownership and cannot be changed</span>
                        </div>
                      </div>
                    </div>

                    {!loadingInventory && availableInventoryOz === 0 && (
                      <Alert type="warning" title="No Inventory Available" className="mt-3">
                        This mining company currently has no gold available in inventory.
                        Gold must be refined and added to inventory before creating a sale.
                      </Alert>
                    )}
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
                  <div className="mt-3 px-4 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 ml-2">
                      <User className="h-4 w-4 text-purple-600" />
                      <h4 className="text-sm text-gray-900">{selectedCustomer.customer_name}</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-2 ml-6">
                      <div className="bg-white rounded-lg px-2.5 py-2 shadow-sm">
                        <p className="text-xs text-gray-600 mb-0.5">Max Stock %</p>
                        <p className="text-base text-purple-700">{selectedCustomer.max_stock_percentage}%</p>
                      </div>
                      <div className="bg-white rounded-lg px-2.5 py-2 shadow-sm">
                        <p className="text-xs text-gray-600 mb-0.5">Sale Method</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.sale_method}</p>
                      </div>
                      <div className="bg-white rounded-lg px-2.5 py-2 shadow-sm">
                        <p className="text-xs text-gray-600 mb-0.5">Fees</p>
                        <div className="text-xs space-y-0.5">
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
          <Card className="border-2 border-slate-300 shadow-lg">
            <CardHeader className="bg-[#B8860B] text-white py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Professional Invoice
              </CardTitle>
              <p className="text-sm text-white/90 mt-1">
                Invoice calculation summary
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Seller Info */}
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-[#B8860B]">
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
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-slate-600">
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
                      ({((typeof formData.quantityOz === 'number' ? formData.quantityOz : parseFloat(formData.quantityOz)) * 31.1034768).toFixed(2)} g)
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Price per oz</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(formData.londonAMRate))}</span>
                </div>

                <div className="flex justify-between items-center py-3 bg-amber-50 px-3 rounded">
                  <span className="font-semibold text-amber-900">Gross Proceeds</span>
                  <span className="text-lg font-bold text-amber-800">{formatCurrency(calculations.grossProceeds)}</span>
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

                <div className="flex justify-between items-center py-3 bg-slate-50 px-3 rounded">
                  <span className="font-semibold text-slate-800">Net Proceeds</span>
                  <span className="text-lg font-bold text-slate-700">{formatCurrency(calculations.netProceeds)}</span>
                </div>

                <div className="flex justify-between items-center py-2 pl-6">
                  <span className="text-sm text-gray-600">Less: Royalties (3%)</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(calculations.royalties)}</span>
                </div>

                <div className="flex justify-between items-center py-4 bg-gradient-to-r from-[#B8860B] to-[#8B6914] px-4 rounded-lg shadow-lg mt-4">
                  <span className="text-lg font-bold text-white">TOTAL AMOUNT</span>
                  <span className="text-2xl font-bold text-white">{formatCurrency(calculations.finalAmount)}</span>
                </div>
              </div>

              {/* PDF Notice */}
              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Professional Invoice PDF</p>
                    <p className="text-xs text-slate-700 mt-1">
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

      {/* Invoice Preview Panel */}
      <InvoicePreviewPanel
        data={invoicePreviewData}
        isVisible={showInvoicePreview}
      />
    </MainLayout>
  );
}
