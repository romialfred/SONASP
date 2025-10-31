import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, DollarSign, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
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
  currency: string;
  mechanism_type: string;
  seller_type: string;
  seller_name: string;
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

interface FxRate {
  source: string;
  rate: number;
  updated_at: string;
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

export function PaymentCreate() {
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

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          sale_date,
          customer_id,
          quantity_oz,
          final_proceeds,
          currency,
          mechanism_type,
          seller_type,
          seller_id,
          customers!inner(name)
        `)
        .eq('status', 'waiting_for_payment')
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
            final_proceeds: sale.final_proceeds,
            currency: sale.currency,
            mechanism_type: sale.mechanism_type,
            seller_type: sale.seller_type,
            seller_name: sellerName,
          };
        })
      );

      setSales(enrichedSales);

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

      addToast('Payment created successfully', 'success');
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

  if (loading) {
    return (
      <MainLayout>
        <Loading message="Loading payment form..." />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/payments')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">Create Payment</h1>
              <p className="text-gray-600 mt-1">Record customer payment and analyze FX rates</p>
            </div>
          </div>
        </div>

        {sales.length === 0 && (
          <Alert variant="info" title="No Sales Awaiting Payment">
            There are no sales with status "waiting_for_payment". Please ensure sales are approved by customers first.
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sale Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField label="Select Sale" required htmlFor="saleId">
                    <Select
                      id="saleId"
                      value={formData.saleId}
                      onChange={(e) => handleSaleChange(e.target.value)}
                      required
                    >
                      <option value="">Select a sale...</option>
                      {sales.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {sale.sale_number} - {sale.customer_name} - {formatCurrency(sale.final_proceeds, sale.currency)}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  {selectedSale && (
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Customer</p>
                          <p className="font-medium">{selectedSale.customer_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Sale Date</p>
                          <p className="font-medium">{new Date(selectedSale.sale_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Quantity</p>
                          <p className="font-medium">{selectedSale.quantity_oz.toFixed(3)} oz</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Amount</p>
                          <p className="font-medium text-lg">{formatCurrency(selectedSale.final_proceeds, selectedSale.currency)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Mechanism</p>
                          <p className="font-medium">{selectedSale.mechanism_type || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Seller</p>
                          <p className="font-medium">{selectedSale.seller_name}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Customer Bank" htmlFor="customerBankId">
                      <Select
                        id="customerBankId"
                        value={formData.customerBankId}
                        onChange={(e) => setFormData({ ...formData, customerBankId: e.target.value })}
                        disabled={!selectedSale}
                      >
                        <option value="">Select customer bank...</option>
                        {customerBanks.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.bank_name} ({bank.currency}) - {bank.bank_country}
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
                      >
                        <option value="">Select currency...</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="XOF">XOF (CFA)</option>
                        <option value="GNF">GNF</option>
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
                      >
                        <option value="">Same as payment currency</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="XOF">XOF (CFA)</option>
                        <option value="GNF">GNF</option>
                      </Select>
                    </FormField>
                  </div>

                  <FormField label="Amount Received" required htmlFor="amountReceived">
                    <Input
                      id="amountReceived"
                      type="number"
                      step="0.01"
                      value={formData.amountReceived}
                      onChange={(e) => setFormData({ ...formData, amountReceived: e.target.value })}
                      placeholder="Enter amount received"
                      required
                      disabled={!selectedSale}
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Payment Date" required htmlFor="paymentDate">
                      <Input
                        id="paymentDate"
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                        required
                        disabled={!selectedSale}
                      />
                    </FormField>

                    <FormField label="Payment Reference" htmlFor="paymentReference">
                      <Input
                        id="paymentReference"
                        type="text"
                        value={formData.paymentReference}
                        onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                        placeholder="Reference number"
                        disabled={!selectedSale}
                      />
                    </FormField>
                  </div>

                  <FormField label="Notes" htmlFor="notes">
                    <textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      rows={3}
                      placeholder="Additional notes..."
                      disabled={!selectedSale}
                    />
                  </FormField>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    FX Rate Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!fxAnalysis ? (
                    <div className="text-center py-8 text-gray-500">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>Enter amount to see FX analysis</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-600 mb-2">Exchange Rates Comparison</p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Customer Bank:</span>
                            <span className="font-medium">{fxAnalysis.customerRate.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Revolut:</span>
                            <span className="font-medium">{fxAnalysis.revolutRate.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>ECB:</span>
                            <span className="font-medium">{fxAnalysis.ecbRate.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>BCEAO:</span>
                            <span className="font-medium">{fxAnalysis.bceaoRate.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-2">Amount Comparison</p>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-600">With Customer Rate</p>
                            <p className="text-lg font-bold">
                              {formatCurrency(fxAnalysis.amountWithCustomerRate, selectedSale?.currency || 'USD')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">With Best Rate ({fxAnalysis.bestSource})</p>
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(fxAnalysis.amountWithBestRate, selectedSale?.currency || 'USD')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg ${fxAnalysis.gainLoss >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                        {fxAnalysis.gainLoss >= 0 ? (
                          <div className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-900">Potential Gain</p>
                              <p className="text-2xl font-bold text-green-600">
                                {formatCurrency(Math.abs(fxAnalysis.gainLoss), selectedSale?.currency || 'USD')}
                              </p>
                              <p className="text-xs text-green-700 mt-1">
                                {fxAnalysis.bestSource} offers {fxAnalysis.gainLossPercent.toFixed(2)}% better rate
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-900">Lost Opportunity</p>
                              <p className="text-2xl font-bold text-red-600">
                                {formatCurrency(Math.abs(fxAnalysis.gainLoss), selectedSale?.currency || 'USD')}
                              </p>
                              <p className="text-xs text-red-700 mt-1">
                                Customer rate is {Math.abs(fxAnalysis.gainLossPercent).toFixed(2)}% less favorable
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <Alert variant="info" title="Analysis Saved">
                        This analysis will be saved for future FX rate reports
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>

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
                  className="flex-1 flex items-center justify-center gap-2"
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
                      Create Payment
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
