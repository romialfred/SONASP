import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Package,
  CreditCard,
  Building2,
  User,
  Calendar,
  FileText,
  Coins,
  Target,
  TrendingDown,
  Award
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

interface Sale {
  id: string;
  sale_number: string;
  sale_date: string;
  customer_id: string;
  customer_name: string;
  quantity_oz: number;
  final_proceeds: number;
  gross_proceeds: number;
  net_proceeds: number;
  london_am_rate: number;
  currency: string;
  mechanism_type: string;
  seller_type: string;
  seller_name: string;
  status: string;
  royalty_amount: number;
  total_costs: number;
}

interface CustomerBank {
  id: string;
  bank_name: string;
  account_number: string;
  swift_code: string;
  currency: string;
  bank_country: string;
}

interface CompanyBank {
  id: string;
  name: string;
  currency: string;
  country: string;
}

interface FxAnalysis {
  customerRate: number;
  revolutRate: number;
  ecbRate: number;
  bceaoRate: number;
  bestRate: number;
  bestSource: string;
  amountWithCustomerRate: number;
  amountWithBestRate: number;
  gainLoss: number;
  gainLossPercent: number;
}

export function PaymentCreateProfessional() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customerBanks, setCustomerBanks] = useState<CustomerBank[]>([]);
  const [companyBanks, setCompanyBanks] = useState<CompanyBank[]>([]);
  const [fxAnalysis, setFxAnalysis] = useState<FxAnalysis | null>(null);

  const [formData, setFormData] = useState({
    saleId: '',
    customerBankId: '',
    paymentCurrency: '',
    companyBankId: '',
    receivedCurrency: '',
    amountReceived: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentReference: '',
    notes: '',
  });

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load sales that are approved by customer and awaiting payment
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          sale_date,
          customer_id,
          quantity_oz,
          london_am_rate,
          gross_proceeds,
          net_proceeds,
          final_proceeds,
          royalty_amount,
          total_costs,
          currency,
          mechanism_type,
          seller_type,
          seller_id,
          status,
          customers!inner(name)
        `)
        .in('status', ['customer_approved', 'waiting_for_payment'])
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      const enrichedSales = await Promise.all(
        (salesData || []).map(async (sale: any) => {
          let sellerName = 'N/A';

          if (sale.seller_type === 'mining_company' && sale.seller_id) {
            const { data: miningData } = await supabase
              .from('mining_companies')
              .select('name')
              .eq('id', sale.seller_id)
              .single();
            sellerName = miningData?.name || 'N/A';
          } else if (sale.seller_type === 'stakeholder' && sale.seller_id) {
            const { data: stakeholderData } = await supabase
              .from('stakeholders')
              .select('name')
              .eq('id', sale.seller_id)
              .single();
            sellerName = stakeholderData?.name || 'N/A';
          }

          return {
            id: sale.id,
            sale_number: sale.sale_number,
            sale_date: sale.sale_date,
            customer_id: sale.customer_id,
            customer_name: sale.customers?.name || 'Unknown',
            quantity_oz: sale.quantity_oz,
            london_am_rate: sale.london_am_rate,
            gross_proceeds: sale.gross_proceeds,
            net_proceeds: sale.net_proceeds,
            final_proceeds: sale.final_proceeds,
            royalty_amount: sale.royalty_amount || 0,
            total_costs: sale.total_costs || 0,
            currency: sale.currency,
            mechanism_type: sale.mechanism_type,
            seller_type: sale.seller_type,
            seller_name: sellerName,
            status: sale.status,
          };
        })
      );

      setSales(enrichedSales);

      // Load company banks
      const { data: companyBanksData, error: companyBanksError } = await supabase
        .from('system_parameters')
        .select('parameter_value')
        .eq('parameter_key', 'company_banks')
        .single();

      if (!companyBanksError && companyBanksData?.parameter_value) {
        const banks = JSON.parse(companyBanksData.parameter_value);
        setCompanyBanks(banks);
      } else {
        setCompanyBanks([
          { id: '1', name: 'Mansa Resources USD Account', currency: 'USD', country: 'USA' },
          { id: '2', name: 'Mansa Resources EUR Account', currency: 'EUR', country: 'France' },
          { id: '3', name: 'Mansa Resources CFA Account', currency: 'XOF', country: 'Guinea' },
        ]);
      }

    } catch (error: any) {
      console.error('Error loading data:', error);
      addToast(error.message || 'Failed to load payment data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaleChange = async (saleId: string) => {
    setFormData({ ...formData, saleId, customerBankId: '', paymentCurrency: '' });
    setCustomerBanks([]);
    setFxAnalysis(null);

    if (!saleId) {
      setSelectedSale(null);
      return;
    }

    const sale = sales.find(s => s.id === saleId);
    setSelectedSale(sale || null);

    if (sale) {
      const { data: banksData, error: banksError } = await supabase
        .from('customer_banks')
        .select('*')
        .eq('customer_id', sale.customer_id);

      if (!banksError && banksData) {
        setCustomerBanks(banksData);
      }
    }
  };

  const calculateFxAnalysis = useCallback(async () => {
    if (!formData.paymentCurrency || !formData.amountReceived || !selectedSale) {
      return;
    }

    const amount = parseFloat(formData.amountReceived);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    try {
      const fromCurrency = formData.paymentCurrency;
      const toCurrency = selectedSale.currency || 'USD';

      const { data: fxRates, error: fxError } = await supabase
        .from('fx_rates')
        .select('*')
        .eq('from_currency', fromCurrency)
        .eq('to_currency', toCurrency)
        .order('date', { ascending: false })
        .limit(10);

      if (fxError) throw fxError;

      const customerRate = fxRates?.find(r => r.source === 'customer')?.rate || 1;
      const revolutRate = fxRates?.find(r => r.source === 'revolut')?.rate || customerRate;
      const ecbRate = fxRates?.find(r => r.source === 'ecb')?.rate || customerRate;
      const bceaoRate = fxRates?.find(r => r.source === 'bceao')?.rate || customerRate;

      const rates = [
        { source: 'Customer Bank', rate: customerRate },
        { source: 'Revolut', rate: revolutRate },
        { source: 'ECB', rate: ecbRate },
        { source: 'BCEAO', rate: bceaoRate },
      ];

      const bestRateData = rates.reduce((best, current) =>
        current.rate > best.rate ? current : best
      );

      const amountWithCustomerRate = amount * customerRate;
      const amountWithBestRate = amount * bestRateData.rate;
      const gainLoss = amountWithBestRate - amountWithCustomerRate;
      const gainLossPercent = (gainLoss / amountWithCustomerRate) * 100;

      setFxAnalysis({
        customerRate,
        revolutRate,
        ecbRate,
        bceaoRate,
        bestRate: bestRateData.rate,
        bestSource: bestRateData.source,
        amountWithCustomerRate,
        amountWithBestRate,
        gainLoss,
        gainLossPercent,
      });

    } catch (error) {
      console.error('Error calculating FX analysis:', error);
    }
  }, [formData.paymentCurrency, formData.amountReceived, selectedSale]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateFxAnalysis();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [calculateFxAnalysis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.saleId || !formData.amountReceived || !selectedSale) {
      addToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setSaving(true);

      let fxAnalysisId = null;

      if (fxAnalysis) {
        const { data: analysisData, error: analysisError } = await supabase
          .from('fx_rate_analysis')
          .insert([{
            payment_id: null,
            sale_id: formData.saleId,
            payment_currency: formData.paymentCurrency,
            received_currency: formData.receivedCurrency,
            virtual_payment_amount: parseFloat(formData.amountReceived),
            virtual_payment_currency: formData.paymentCurrency,
            customer_fx_rate: fxAnalysis.customerRate,
            revolut_fx_rate: fxAnalysis.revolutRate,
            ecb_fx_rate: fxAnalysis.ecbRate,
            bceao_fx_rate: fxAnalysis.bceaoRate,
            best_fx_rate: fxAnalysis.bestRate,
            best_rate_source: fxAnalysis.bestSource,
            amount_with_customer_rate: fxAnalysis.amountWithCustomerRate,
            amount_with_best_rate: fxAnalysis.amountWithBestRate,
            gain_loss_amount: fxAnalysis.gainLoss,
            gain_loss_percent: fxAnalysis.gainLossPercent,
            analysis_date: new Date().toISOString(),
            created_by: user?.id,
          }])
          .select()
          .single();

        if (analysisError) {
          console.error('FX analysis creation error:', analysisError);
        } else {
          fxAnalysisId = analysisData?.id;
        }
      }

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          sale_id: formData.saleId,
          customer_id: selectedSale.customer_id,
          customer_bank_id: formData.customerBankId || null,
          company_bank_id: formData.companyBankId || null,
          amount: parseFloat(formData.amountReceived),
          currency: formData.receivedCurrency || formData.paymentCurrency,
          payment_currency: formData.paymentCurrency,
          received_currency: formData.receivedCurrency,
          fx_rate: fxAnalysis?.customerRate || 1,
          payment_date: formData.paymentDate,
          expected_date: formData.paymentDate,
          actual_date: formData.paymentDate,
          payment_reference: formData.paymentReference,
          bank_reference: formData.paymentReference,
          status: 'pending',
          notes: formData.notes,
          fx_analysis_id: fxAnalysisId,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (paymentError) throw paymentError;

      if (fxAnalysisId) {
        await supabase
          .from('fx_rate_analysis')
          .update({ payment_id: paymentData.id })
          .eq('id', fxAnalysisId);
      }

      const { error: saleUpdateError } = await supabase
        .from('sales')
        .update({
          status: 'virtual_payment',
          updated_at: new Date().toISOString(),
        })
        .eq('id', formData.saleId);

      if (saleUpdateError) {
        console.error('Sale status update error:', saleUpdateError);
      }

      addToast('Payment recorded successfully', 'success');
      navigate('/payments');

    } catch (error: any) {
      console.error('Error creating payment:', error);
      addToast(error.message || 'Failed to create payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    if (status === 'customer_approved') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    if (status === 'waiting_for_payment') return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl shadow-2xl p-8 border border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <CreditCard className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="font-heading text-3xl font-bold text-white mb-2">Payment Recording</h1>
                <p className="text-slate-300 text-sm">Record and analyze customer payment transactions</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/payments')}
              className="flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Payments
            </Button>
          </div>
        </div>

        {sales.length === 0 && (
          <Alert variant="info" title="No Sales Awaiting Payment">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-blue-600 mt-0.5" />
              <p>There are no sales awaiting payment. Sales must be approved by customers before payment can be recorded.</p>
            </div>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Sale Selection */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <Package className="h-5 w-5 text-blue-600" />
                    Sale Selection
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <FormField label="Select Sale" required htmlFor="saleId">
                    <Select
                      id="saleId"
                      value={formData.saleId}
                      onChange={(e) => handleSaleChange(e.target.value)}
                      required
                      className="text-sm"
                    >
                      <option value="">Select a sale...</option>
                      {sales.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {sale.sale_number} - {sale.customer_name} - {formatCurrency(sale.final_proceeds, sale.currency)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </CardContent>
              </Card>

              {/* Payment Details */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                    Payment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Customer Bank" htmlFor="customerBankId">
                      <Select
                        id="customerBankId"
                        value={formData.customerBankId}
                        onChange={(e) => setFormData({ ...formData, customerBankId: e.target.value })}
                        disabled={!selectedSale}
                        className="text-sm"
                      >
                        <option value="">Select customer bank...</option>
                        {customerBanks.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.bank_name} ({bank.currency})
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Payment Currency" required htmlFor="paymentCurrency">
                      <Select
                        id="paymentCurrency"
                        value={formData.paymentCurrency}
                        onChange={(e) => setFormData({ ...formData, paymentCurrency: e.target.value })}
                        required
                        disabled={!selectedSale}
                        className="text-sm"
                      >
                        <option value="">Select currency...</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="XOF">XOF (CFA)</option>
                        <option value="GNF">GNF</option>
                        <option value="CHF">CHF</option>
                      </Select>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Company Bank (Receiver)" htmlFor="companyBankId">
                      <Select
                        id="companyBankId"
                        value={formData.companyBankId}
                        onChange={(e) => setFormData({ ...formData, companyBankId: e.target.value })}
                        disabled={!selectedSale}
                        className="text-sm"
                      >
                        <option value="">Select company bank...</option>
                        {companyBanks.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.name} ({bank.currency})
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Received Currency" htmlFor="receivedCurrency">
                      <Select
                        id="receivedCurrency"
                        value={formData.receivedCurrency}
                        onChange={(e) => setFormData({ ...formData, receivedCurrency: e.target.value })}
                        disabled={!selectedSale}
                        className="text-sm"
                      >
                        <option value="">Same as payment currency</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="XOF">XOF (CFA)</option>
                        <option value="GNF">GNF</option>
                        <option value="CHF">CHF</option>
                      </Select>
                    </FormField>
                  </div>

                  <FormField label="Amount Received" required htmlFor="amountReceived">
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="amountReceived"
                        type="number"
                        step="0.01"
                        value={formData.amountReceived}
                        onChange={(e) => setFormData({ ...formData, amountReceived: e.target.value })}
                        placeholder="Enter amount received"
                        required
                        disabled={!selectedSale}
                        className="pl-10"
                      />
                    </div>
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Payment Date" required htmlFor="paymentDate">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          id="paymentDate"
                          type="date"
                          value={formData.paymentDate}
                          onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                          required
                          disabled={!selectedSale}
                          className="pl-10"
                        />
                      </div>
                    </FormField>

                    <FormField label="Payment Reference" htmlFor="paymentReference">
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          id="paymentReference"
                          type="text"
                          value={formData.paymentReference}
                          onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                          placeholder="Reference number"
                          disabled={!selectedSale}
                          className="pl-10"
                        />
                      </div>
                    </FormField>
                  </div>

                  <FormField label="Notes" htmlFor="notes">
                    <textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                      rows={3}
                      placeholder="Additional notes..."
                      disabled={!selectedSale}
                    />
                  </FormField>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Sale Info & FX Analysis */}
            <div className="space-y-6">
              {/* Sale Information Panel */}
              {selectedSale && (
                <Card className="border-0 shadow-lg sticky top-6">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-200 pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                        <Award className="h-5 w-5 text-slate-600" />
                        Sale Information
                      </CardTitle>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(selectedSale.status)}`}>
                        {selectedSale.status.replace(/_/g, ' ').toUpperCase()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {/* Sale Header */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-gray-900">{selectedSale.sale_number}</h3>
                        <Package className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{selectedSale.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(selectedSale.sale_date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Target className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs text-emerald-700 font-medium">Final Proceeds</p>
                            <p className="text-lg font-bold text-emerald-900">
                              {formatCurrency(selectedSale.final_proceeds, selectedSale.currency)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Coins className="h-4 w-4 text-gray-500" />
                            <p className="text-xs text-gray-600">Quantity</p>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{selectedSale.quantity_oz.toFixed(3)} oz</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-gray-500" />
                            <p className="text-xs text-gray-600">London AM</p>
                          </div>
                          <p className="text-sm font-bold text-gray-900">
                            {formatCurrency(selectedSale.london_am_rate, 'USD')}
                          </p>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-blue-700">Gross Proceeds</span>
                          <span className="text-sm font-semibold text-blue-900">
                            {formatCurrency(selectedSale.gross_proceeds, selectedSale.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-red-700">Royalties (3%)</span>
                          <span className="text-sm font-semibold text-red-900">
                            -{formatCurrency(selectedSale.royalty_amount, selectedSale.currency)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-gray-600" />
                          <span className="text-xs text-gray-600 font-medium">Seller</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{selectedSale.seller_name}</p>
                        <p className="text-xs text-gray-500 mt-1">Mechanism: {selectedSale.mechanism_type || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* FX Rate Analysis */}
              {selectedSale && (
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                    <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                      <TrendingUp className="h-5 w-5 text-amber-600" />
                      FX Rate Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {!fxAnalysis ? (
                      <div className="text-center py-8 text-gray-500">
                        <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-sm">Enter amount to see FX analysis</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Exchange Rates */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Exchange Rates Comparison
                          </p>
                          <div className="space-y-2">
                            {[
                              { label: 'Customer Bank', rate: fxAnalysis.customerRate },
                              { label: 'Revolut', rate: fxAnalysis.revolutRate },
                              { label: 'ECB', rate: fxAnalysis.ecbRate },
                              { label: 'BCEAO', rate: fxAnalysis.bceaoRate },
                            ].map((item, index) => (
                              <div key={index} className="flex justify-between items-center text-sm py-1">
                                <span className="text-gray-600">{item.label}:</span>
                                <span className="font-bold text-gray-900">{item.rate.toFixed(4)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Amount Comparison */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-600 mb-1">Customer Rate</p>
                            <p className="text-base font-bold text-gray-900">
                              {formatCurrency(fxAnalysis.amountWithCustomerRate, selectedSale.currency)}
                            </p>
                          </div>
                          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                            <p className="text-xs text-emerald-700 mb-1">Best Rate</p>
                            <p className="text-base font-bold text-emerald-900">
                              {formatCurrency(fxAnalysis.amountWithBestRate, selectedSale.currency)}
                            </p>
                          </div>
                        </div>

                        {/* Gain/Loss */}
                        <div className={`p-4 rounded-lg border-2 ${fxAnalysis.gainLoss >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                          {fxAnalysis.gainLoss >= 0 ? (
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="h-6 w-6 text-emerald-600" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-emerald-900 mb-1">Potential Gain</p>
                                <p className="text-2xl font-bold text-emerald-700">
                                  +{formatCurrency(Math.abs(fxAnalysis.gainLoss), selectedSale.currency)}
                                </p>
                                <p className="text-xs text-emerald-700 mt-2 bg-emerald-100 px-2 py-1 rounded inline-flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  {fxAnalysis.bestSource} offers {fxAnalysis.gainLossPercent.toFixed(2)}% better rate
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <TrendingDown className="h-6 w-6 text-red-600" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-900 mb-1">Lost Opportunity</p>
                                <p className="text-2xl font-bold text-red-700">
                                  -{formatCurrency(Math.abs(fxAnalysis.gainLoss), selectedSale.currency)}
                                </p>
                                <p className="text-xs text-red-700 mt-2 bg-red-100 px-2 py-1 rounded inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Customer rate is {Math.abs(fxAnalysis.gainLossPercent).toFixed(2)}% less favorable
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/payments')}
                  className="flex-1"
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg"
                  disabled={saving || !selectedSale || !formData.amountReceived}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Record Payment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
