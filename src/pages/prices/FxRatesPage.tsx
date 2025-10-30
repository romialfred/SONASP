import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import {
  TrendingUp, RefreshCw, Plus,
  Calendar, DollarSign, Filter, BarChart, FileDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { FxAnalysisTab } from '@/components/fx/FxAnalysisTab';
import { FxRateComparison } from '@/components/fx/FxRateComparison';
import { LiveFxRatePanel } from '@/components/prices/LiveFxRatePanel';
import * as XLSX from 'xlsx';
import { useAlert } from '@/hooks/useAlert';

type TabType = 'daily' | 'monthly' | 'customer' | 'analysis' | 'comparison';

interface FxRateSource {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface DailyRate {
  id: string;
  rate_date: string;
  currency_pair: string;
  source_id: string;
  source_name?: string;
  rate: number;
  bid_rate: number | null;
  ask_rate: number | null;
  spread: number | null;
  notes: string | null;
}

interface MonthlyRate {
  id: string;
  year: number;
  month: number;
  currency_pair: string;
  source_id: string;
  source_name?: string;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
  opening_rate: number;
  closing_rate: number;
  data_points: number;
}

interface CustomerRate {
  id: string;
  customer_id: string;
  customer_name?: string;
  transaction_date: string;
  currency_pair: string;
  rate_paid: number;
  amount: number;
  market_rate: number | null;
  spread_percentage: number | null;
  reference_number: string | null;
}

const CURRENCY_PAIRS = [
  { value: 'EUR/USD', label: 'EUR/USD - Euro to US Dollar' },
  { value: 'USD/XOF', label: 'USD/XOF - US Dollar to West African CFA' },
  { value: 'USD/GNF', label: 'USD/GNF - US Dollar to Guinean Franc' },
  { value: 'EUR/GNF', label: 'EUR/GNF - Euro to Guinean Franc' },
  { value: 'XOF/GNF', label: 'XOF/GNF - West African CFA to Guinean Franc' },
];

export function FxRatesPage() {
  const alert = useAlert();
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [sources, setSources] = useState<FxRateSource[]>([]);
  const [dailyRates, setDailyRates] = useState<DailyRate[]>([]);
  const [monthlyRates, setMonthlyRates] = useState<MonthlyRate[]>([]);
  const [customerRates, setCustomerRates] = useState<CustomerRate[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomerRateModal, setShowCustomerRateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

  // Form data for adding rates
  const [dailyFormData, setDailyFormData] = useState({
    rate_date: new Date().toISOString().split('T')[0],
    currency_pair: 'EUR/USD',
    source_id: '',
    rate: '',
    bid_rate: '',
    ask_rate: '',
    notes: '',
  });

  const [customerFormData, setCustomerFormData] = useState({
    customer_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    currency_pair: 'EUR/USD',
    rate_paid: '',
    amount: '',
    market_rate: '',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    loadSources();
    if (activeTab === 'customer') {
      loadCustomers();
    }
  }, []);

  useEffect(() => {
    loadTabData();
  }, [activeTab, currencyFilter, sourceFilter, dateFilter, customerFilter, monthFilter, yearFilter]);

  const loadSources = async () => {
    const { data, error } = await supabase
      .from('fx_rate_sources')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setSources(data);
      if (data.length > 0 && !dailyFormData.source_id) {
        setDailyFormData(prev => ({ ...prev, source_id: data[0].id }));
      }
    }
  };

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'daily') {
        await loadDailyRates();
      } else if (activeTab === 'monthly') {
        await loadMonthlyRates();
      } else if (activeTab === 'customer') {
        await loadCustomerRates();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDailyRates = async () => {
    let query = supabase
      .from('fx_rates_daily')
      .select(`
        *,
        fx_rate_sources!inner(name, code)
      `)
      .order('rate_date', { ascending: false })
      .limit(200);

    if (currencyFilter !== 'all') {
      query = query.eq('currency_pair', currencyFilter);
    }
    if (sourceFilter !== 'all') {
      query = query.eq('source_id', sourceFilter);
    }
    if (dateFilter) {
      query = query.eq('rate_date', dateFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setDailyRates(data.map(rate => ({
        ...rate,
        source_name: rate.fx_rate_sources?.name || 'Unknown',
      })));
    }
  };

  const loadMonthlyRates = async () => {
    let query = supabase
      .from('fx_rates_monthly_aggregated')
      .select(`
        *,
        fx_rate_sources!inner(name, code)
      `)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(200);

    if (currencyFilter !== 'all') {
      query = query.eq('currency_pair', currencyFilter);
    }
    if (sourceFilter !== 'all') {
      query = query.eq('source_id', sourceFilter);
    }
    if (yearFilter) {
      query = query.eq('year', parseInt(yearFilter));
    }
    if (monthFilter) {
      query = query.eq('month', parseInt(monthFilter));
    }

    const { data, error } = await query;

    if (!error && data) {
      setMonthlyRates(data.map(rate => ({
        ...rate,
        source_name: rate.fx_rate_sources?.name || 'Unknown',
      })));
    }
  };

  const loadCustomerRates = async () => {
    let query = supabase
      .from('customer_fx_rates')
      .select(`
        *,
        customers!inner(name, email)
      `)
      .order('transaction_date', { ascending: false })
      .limit(200);

    if (customerFilter !== 'all') {
      query = query.eq('customer_id', customerFilter);
    }
    if (currencyFilter !== 'all') {
      query = query.eq('currency_pair', currencyFilter);
    }
    if (dateFilter) {
      query = query.eq('transaction_date', dateFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setCustomerRates(data.map(rate => ({
        ...rate,
        customer_name: rate.customers?.name || 'Unknown',
      })));
    }
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setCustomers(data);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTabData();
    setRefreshing(false);
  };

  const handleAddDailyRate = async () => {
    try {
      const spread = dailyFormData.bid_rate && dailyFormData.ask_rate
        ? parseFloat(dailyFormData.ask_rate) - parseFloat(dailyFormData.bid_rate)
        : null;

      const { error } = await supabase.from('fx_rates_daily').insert({
        rate_date: dailyFormData.rate_date,
        currency_pair: dailyFormData.currency_pair,
        source_id: dailyFormData.source_id,
        rate: parseFloat(dailyFormData.rate),
        bid_rate: dailyFormData.bid_rate ? parseFloat(dailyFormData.bid_rate) : null,
        ask_rate: dailyFormData.ask_rate ? parseFloat(dailyFormData.ask_rate) : null,
        spread: spread,
        notes: dailyFormData.notes || null,
      });

      if (error) throw error;

      setShowAddModal(false);
      await loadDailyRates();
      resetDailyForm();
    } catch (error: any) {
      console.error('Error adding daily rate:', error);
      alert.error('Error adding rate: ' + error.message);
    }
  };

  const handleAddCustomerRate = async () => {
    try {
      const marketRate = parseFloat(customerFormData.market_rate);
      const ratePaid = parseFloat(customerFormData.rate_paid);
      const spreadPercentage = marketRate > 0
        ? ((ratePaid - marketRate) / marketRate) * 100
        : null;

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('customer_fx_rates').insert({
        customer_id: customerFormData.customer_id,
        transaction_date: customerFormData.transaction_date,
        currency_pair: customerFormData.currency_pair,
        rate_paid: ratePaid,
        amount: parseFloat(customerFormData.amount),
        market_rate: marketRate || null,
        spread_percentage: spreadPercentage,
        reference_number: customerFormData.reference_number || null,
        notes: customerFormData.notes || null,
        created_by: userData.user?.id,
      });

      if (error) throw error;

      setShowCustomerRateModal(false);
      await loadCustomerRates();
      resetCustomerForm();
    } catch (error: any) {
      console.error('Error adding customer rate:', error);
      alert.error('Error adding customer rate: ' + error.message);
    }
  };

  const resetDailyForm = () => {
    setDailyFormData({
      rate_date: new Date().toISOString().split('T')[0],
      currency_pair: 'EUR/USD',
      source_id: sources[0]?.id || '',
      rate: '',
      bid_rate: '',
      ask_rate: '',
      notes: '',
    });
  };

  const resetCustomerForm = () => {
    setCustomerFormData({
      customer_id: '',
      transaction_date: new Date().toISOString().split('T')[0],
      currency_pair: 'EUR/USD',
      rate_paid: '',
      amount: '',
      market_rate: '',
      reference_number: '',
      notes: '',
    });
  };

  const clearFilters = () => {
    setCurrencyFilter('all');
    setSourceFilter('all');
    setDateFilter('');
    setCustomerFilter('all');
    setMonthFilter('');
    setYearFilter(new Date().getFullYear().toString());
  };

  const formatRate = (rate: number, pair: string) => {
    if (pair === 'XOF/GNF') return rate.toFixed(4);
    if (pair === 'EUR/USD') return rate.toFixed(5);
    return rate.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getMonthName = (month: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  };

  const exportToExcel = () => {
    let data: any[] = [];
    let filename = '';
    let sheetName = '';

    if (activeTab === 'daily') {
      data = dailyRates.map(rate => ({
        Date: rate.rate_date,
        'Currency Pair': rate.currency_pair,
        Source: rate.source_name,
        Rate: rate.rate,
        Bid: rate.bid_rate || '-',
        Ask: rate.ask_rate || '-',
        Spread: rate.spread || '-',
        Notes: rate.notes || '-',
      }));
      filename = 'Daily_FX_Rates.xlsx';
      sheetName = 'Daily Rates';
    } else if (activeTab === 'monthly') {
      data = monthlyRates.map(rate => ({
        Period: `${getMonthName(rate.month)} ${rate.year}`,
        'Currency Pair': rate.currency_pair,
        Source: rate.source_name,
        'Avg Rate': rate.avg_rate,
        'Min Rate': rate.min_rate,
        'Max Rate': rate.max_rate,
        'Opening': rate.opening_rate,
        'Closing': rate.closing_rate,
        'Data Points': rate.data_points,
      }));
      filename = 'Monthly_FX_Rates.xlsx';
      sheetName = 'Monthly Rates';
    } else if (activeTab === 'customer') {
      data = customerRates.map(rate => ({
        Date: rate.transaction_date,
        Customer: rate.customer_name,
        'Currency Pair': rate.currency_pair,
        'Rate Paid': rate.rate_paid,
        'Market Rate': rate.market_rate || '-',
        'Spread %': rate.spread_percentage ? `${rate.spread_percentage.toFixed(2)}%` : '-',
        Amount: rate.amount,
        Reference: rate.reference_number || '-',
      }));
      filename = 'Customer_FX_Rates.xlsx';
      sheetName = 'Customer Rates';
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Set column widths
    const colWidths = Object.keys(data[0] || {}).map(() => ({ wch: 15 }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, filename);
  };

  // Prepare chart data
  const getDailyChartData = () => {
    const grouped = dailyRates.reduce((acc, rate) => {
      if (!acc[rate.currency_pair]) {
        acc[rate.currency_pair] = { name: rate.currency_pair, count: 0, avgRate: 0, total: 0 };
      }
      acc[rate.currency_pair].count++;
      acc[rate.currency_pair].total += rate.rate;
      return acc;
    }, {} as Record<string, { name: string; count: number; avgRate: number; total: number }>);

    return Object.values(grouped).map(item => ({
      name: item.name,
      'Rate Count': item.count,
      'Avg Rate': item.total / item.count,
    }));
  };

  const getMonthlyChartData = () => {
    return monthlyRates.slice(0, 10).map(rate => ({
      name: `${getMonthName(rate.month)} ${rate.year}`,
      [rate.currency_pair]: rate.avg_rate,
    }));
  };

  const getCustomerChartData = () => {
    const grouped = customerRates.reduce((acc, rate) => {
      if (!acc[rate.customer_name || 'Unknown']) {
        acc[rate.customer_name || 'Unknown'] = { name: rate.customer_name || 'Unknown', count: 0, totalAmount: 0 };
      }
      acc[rate.customer_name || 'Unknown'].count++;
      acc[rate.customer_name || 'Unknown'].totalAmount += rate.amount;
      return acc;
    }, {} as Record<string, { name: string; count: number; totalAmount: number }>);

    return Object.values(grouped).slice(0, 10).map(item => ({
      name: item.name,
      'Transaction Count': item.count,
      'Total Amount': item.totalAmount,
    }));
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">FX Rates Management</h1>
            <p className="text-gray-600 mt-1">Track and manage exchange rates from multiple sources</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {activeTab !== 'analysis' && activeTab !== 'comparison' && (
              <Button
                variant="outline"
                onClick={exportToExcel}
                disabled={loading}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            )}
            {activeTab === 'daily' && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Daily Rate
              </Button>
            )}
            {activeTab === 'customer' && (
              <Button onClick={() => setShowCustomerRateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Customer Rate
              </Button>
            )}
          </div>
        </div>

        {/* Live FX Rates Panel */}
        <LiveFxRatePanel />

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('daily')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'daily'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Daily Rates
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'monthly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Monthly Aggregated
            </button>
            <button
              onClick={() => setActiveTab('customer')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customer'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Customer Rates
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'comparison'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Filter className="w-4 h-4 inline mr-2" />
              Compare Sources
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analysis'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart className="w-4 h-4 inline mr-2" />
              FX Rate Analysis
            </button>
          </nav>
        </div>

        {/* Filters */}
        {activeTab !== 'analysis' && activeTab !== 'comparison' && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <FormField label="Currency Pair">
                  <Select
                    value={currencyFilter}
                    onChange={(e) => setCurrencyFilter(e.target.value)}
                  >
                    <option value="all">All Currency Pairs</option>
                    {CURRENCY_PAIRS.map(pair => (
                      <option key={pair.value} value={pair.value}>{pair.label}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Source">
                  <Select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                  >
                    <option value="all">All Sources</option>
                    {sources.map(source => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </Select>
                </FormField>

                {activeTab === 'daily' && (
                  <FormField label="Date">
                    <Input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                  </FormField>
                )}

                {activeTab === 'monthly' && (
                  <>
                    <FormField label="Year">
                      <Input
                        type="number"
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        placeholder="YYYY"
                        min="2020"
                        max="2030"
                      />
                    </FormField>
                    <FormField label="Month">
                      <Select
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                      >
                        <option value="">All Months</option>
                        <option value="1">January</option>
                        <option value="2">February</option>
                        <option value="3">March</option>
                        <option value="4">April</option>
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </Select>
                    </FormField>
                  </>
                )}

                {activeTab === 'customer' && (
                  <>
                    <FormField label="Customer">
                      <Select
                        value={customerFilter}
                        onChange={(e) => setCustomerFilter(e.target.value)}
                      >
                        <option value="all">All Customers</option>
                        {customers.map(customer => (
                          <option key={customer.id} value={customer.id}>{customer.name}</option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Date">
                      <Input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                      />
                    </FormField>
                  </>
                )}

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparison Tab Content */}
        {activeTab === 'comparison' && <FxRateComparison />}

        {/* Analysis Tab Content */}
        {activeTab === 'analysis' && <FxAnalysisTab />}

        {/* Content for other tabs */}
        {activeTab !== 'analysis' && activeTab !== 'comparison' && loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading rates...</p>
            </CardContent>
          </Card>
        ) : activeTab !== 'analysis' && activeTab !== 'comparison' ? (
          <>
            {/* Chart Section */}
            {activeTab === 'daily' && dailyRates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Rate Distribution by Currency Pair</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChartWidget
                    data={getDailyChartData()}
                    bars={[
                      { dataKey: 'Rate Count', color: '#3b82f6', name: 'Rate Count' },
                      { dataKey: 'Avg Rate', color: '#10b981', name: 'Avg Rate' }
                    ]}
                    height={300}
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'monthly' && monthlyRates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Rate Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChartWidget
                    data={getMonthlyChartData()}
                    bars={CURRENCY_PAIRS.map((p, idx) => ({
                      dataKey: p.value,
                      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
                      name: p.value
                    })).filter(bar =>
                      monthlyRates.some(r => r.currency_pair === bar.dataKey)
                    )}
                    height={300}
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'customer' && customerRates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Transaction Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChartWidget
                    data={getCustomerChartData()}
                    bars={[
                      { dataKey: 'Transaction Count', color: '#3b82f6', name: 'Transaction Count' }
                    ]}
                    height={300}
                  />
                </CardContent>
              </Card>
            )}

            {/* Daily Rates Tab */}
            {activeTab === 'daily' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Daily Exchange Rates ({dailyRates.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Export to Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency Pair</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bid</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ask</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spread</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {dailyRates.map((rate) => (
                          <tr key={rate.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatDate(rate.rate_date)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">
                              {rate.currency_pair}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {rate.source_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                              {formatRate(rate.rate, rate.currency_pair)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              {rate.bid_rate ? formatRate(rate.bid_rate, rate.currency_pair) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              {rate.ask_rate ? formatRate(rate.ask_rate, rate.currency_pair) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              {rate.spread ? rate.spread.toFixed(4) : '-'}
                            </td>
                          </tr>
                        ))}
                        {dailyRates.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                              No daily rates found. Try adjusting your filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly Rates Tab */}
            {activeTab === 'monthly' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Monthly Aggregated Rates ({monthlyRates.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Export to Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency Pair</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Rate</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opening</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Closing</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Data Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {monthlyRates.map((rate) => (
                          <tr key={rate.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {getMonthName(rate.month)} {rate.year}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">
                              {rate.currency_pair}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {rate.source_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                              {formatRate(rate.avg_rate, rate.currency_pair)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-600">
                              {formatRate(rate.min_rate, rate.currency_pair)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-green-600">
                              {formatRate(rate.max_rate, rate.currency_pair)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              {formatRate(rate.opening_rate, rate.currency_pair)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              {formatRate(rate.closing_rate, rate.currency_pair)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-500">
                              {rate.data_points}
                            </td>
                          </tr>
                        ))}
                        {monthlyRates.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                              No monthly rates found. Try adjusting your filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer Rates Tab */}
            {activeTab === 'customer' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Customer Exchange Rates ({customerRates.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Export to Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency Pair</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate Paid</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Market Rate</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spread %</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {customerRates.map((rate) => (
                          <tr key={rate.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatDate(rate.transaction_date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {rate.customer_name}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">
                              {rate.currency_pair}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                              {formatRate(rate.rate_paid, rate.currency_pair)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              {rate.market_rate ? formatRate(rate.market_rate, rate.currency_pair) : '-'}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right font-medium ${
                              rate.spread_percentage && rate.spread_percentage > 0 ? 'text-red-600' :
                              rate.spread_percentage && rate.spread_percentage < 0 ? 'text-green-600' :
                              'text-gray-600'
                            }`}>
                              {rate.spread_percentage ? `${rate.spread_percentage.toFixed(2)}%` : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {rate.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {rate.reference_number || '-'}
                            </td>
                          </tr>
                        ))}
                        {customerRates.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              No customer rates found. Try adjusting your filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}

        {/* Add Daily Rate Modal */}
        {showAddModal && (
          <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="lg">
            <ModalHeader>Add Daily Exchange Rate</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <FormField label="Date" required>
                  <Input
                    type="date"
                    value={dailyFormData.rate_date}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, rate_date: e.target.value })}
                  />
                </FormField>

                <FormField label="Currency Pair" required>
                  <Select
                    value={dailyFormData.currency_pair}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, currency_pair: e.target.value })}
                  >
                    {CURRENCY_PAIRS.map(pair => (
                      <option key={pair.value} value={pair.value}>{pair.label}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Source" required>
                  <Select
                    value={dailyFormData.source_id}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, source_id: e.target.value })}
                  >
                    {sources.map(source => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Rate" required>
                  <Input
                    type="number"
                    step="0.00001"
                    value={dailyFormData.rate}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, rate: e.target.value })}
                    placeholder="0.00000"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Bid Rate">
                    <Input
                      type="number"
                      step="0.00001"
                      value={dailyFormData.bid_rate}
                      onChange={(e) => setDailyFormData({ ...dailyFormData, bid_rate: e.target.value })}
                      placeholder="Optional"
                    />
                  </FormField>

                  <FormField label="Ask Rate">
                    <Input
                      type="number"
                      step="0.00001"
                      value={dailyFormData.ask_rate}
                      onChange={(e) => setDailyFormData({ ...dailyFormData, ask_rate: e.target.value })}
                      placeholder="Optional"
                    />
                  </FormField>
                </div>

                <FormField label="Notes">
                  <Input
                    value={dailyFormData.notes}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </FormField>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDailyRate}>
                Add Rate
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {/* Add Customer Rate Modal */}
        {showCustomerRateModal && (
          <Modal isOpen={showCustomerRateModal} onClose={() => setShowCustomerRateModal(false)} size="lg">
            <ModalHeader>Add Customer Exchange Rate</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <FormField label="Customer" required>
                  <Select
                    value={customerFormData.customer_id}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, customer_id: e.target.value })}
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Transaction Date" required>
                  <Input
                    type="date"
                    value={customerFormData.transaction_date}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, transaction_date: e.target.value })}
                  />
                </FormField>

                <FormField label="Currency Pair" required>
                  <Select
                    value={customerFormData.currency_pair}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, currency_pair: e.target.value })}
                  >
                    {CURRENCY_PAIRS.map(pair => (
                      <option key={pair.value} value={pair.value}>{pair.label}</option>
                    ))}
                  </Select>
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Rate Paid" required>
                    <Input
                      type="number"
                      step="0.00001"
                      value={customerFormData.rate_paid}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, rate_paid: e.target.value })}
                      placeholder="0.00000"
                    />
                  </FormField>

                  <FormField label="Market Rate">
                    <Input
                      type="number"
                      step="0.00001"
                      value={customerFormData.market_rate}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, market_rate: e.target.value })}
                      placeholder="Optional"
                    />
                  </FormField>
                </div>

                <FormField label="Amount" required>
                  <Input
                    type="number"
                    step="0.01"
                    value={customerFormData.amount}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </FormField>

                <FormField label="Reference Number">
                  <Input
                    value={customerFormData.reference_number}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, reference_number: e.target.value })}
                    placeholder="Optional"
                  />
                </FormField>

                <FormField label="Notes">
                  <Input
                    value={customerFormData.notes}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                    placeholder="Optional notes"
                  />
                </FormField>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowCustomerRateModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCustomerRate}>
                Add Rate
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
}
