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
import { ComposedChartWidget } from '@/components/charts/ComposedChartWidget';
import { FxAnalysisTab } from '@/components/fx/FxAnalysisTab';
import { FxRateComparison } from '@/components/fx/FxRateComparison';
import { LiveFxRatePanel } from '@/components/prices/LiveFxRatePanel';
import { downloadExcelWorkbook } from '@/lib/excelExport';
import { useAlert } from '@/hooks/useAlert';

type TabType = 'daily' | 'monthly' | 'customer' | 'analysis' | 'comparison';

interface FxRateSource {
  id: string;
  name: string;
  code: string;
  is_active: boolean | null;
}

interface DailyRate {
  id: string;
  rate_date: string;
  currency_pair: string;
  source_id: string | null;
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
  source_id: string | null;
  source_name?: string;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
  opening_rate: number | null;
  closing_rate: number;
  data_points: number;
}

interface CustomerRate {
  id: string;
  customer_id: string | null;
  customer_name?: string;
  transaction_date: string;
  currency_pair: string;
  rate_paid: number;
  amount: number;
  market_rate: number | null;
  spread_percentage: number | null;
  reference_number: string | null;
}

// Le franc guinéen n'a pas cours au Burkina.
const CURRENCY_PAIRS = [
  { value: 'USD/XOF', label: 'USD/XOF : dollar américain vers franc CFA' },
  { value: 'EUR/XOF', label: 'EUR/XOF : euro vers franc CFA' },
  { value: 'EUR/USD', label: 'EUR/USD : euro vers dollar américain' },
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
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('fx_rates_daily')
      .select(`
        *,
        fx_rate_sources!inner(name, code)
      `)
      .lte('rate_date', today)
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
        source_name: rate.fx_rate_sources?.name || 'Source inconnue',
      })));
    }
  };

  const loadMonthlyRates = async () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

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
      // Filter out future months
      const filteredData = data.filter(rate => {
        if (rate.year < currentYear) return true;
        if (rate.year === currentYear && rate.month <= currentMonth) return true;
        return false;
      });

      setMonthlyRates(filteredData.map(rate => ({
        id: rate.id,
        year: Number(rate.year ?? 0),
        month: Number(rate.month ?? 0),
        currency_pair: rate.currency_pair,
        source_id: rate.source_id,
        source_name: rate.fx_rate_sources?.name || 'Source inconnue',
        avg_rate: Number(rate.avg_rate ?? 0),
        min_rate: Number(rate.min_rate ?? 0),
        max_rate: Number(rate.max_rate ?? 0),
        opening_rate: rate.opening_rate,
        closing_rate: Number(rate.closing_rate ?? 0),
        data_points: Number(rate.data_points ?? 0),
      })));
    }
  };

  const loadCustomerRates = async () => {
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('customer_fx_rates')
      .select(`
        *,
        customers!inner(name, email)
      `)
      .lte('transaction_date', today)
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
        customer_name: rate.customers?.name || 'Client inconnu',
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
      console.error('Erreur lors de l’ajout du taux journalier :', error);
      alert.error('Impossible d’ajouter le taux : ' + error.message);
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
      console.error('Erreur lors de l’ajout du taux client :', error);
      alert.error('Impossible d’ajouter le taux client : ' + error.message);
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

  const formatRate = (rate: number | null, pair: string) => {
    if (rate === null || !Number.isFinite(rate)) return '—';
    if (pair === 'EUR/USD') return rate.toFixed(4);
    return rate.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getMonthName = (month: number) => {
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return months[month - 1];
  };

  const exportToExcel = async () => {
    let data: any[] = [];
    let filename = '';
    let sheetName = '';

    if (activeTab === 'daily') {
      data = dailyRates.map(rate => ({
        Date: rate.rate_date,
        'Paire de devises': rate.currency_pair,
        Source: rate.source_name,
        Taux: rate.rate,
        Achat: rate.bid_rate || '-',
        Vente: rate.ask_rate || '-',
        Écart: rate.spread || '-',
        Notes: rate.notes || '-',
      }));
      filename = 'Taux_de_change_journaliers.xlsx';
      sheetName = 'Taux journaliers';
    } else if (activeTab === 'monthly') {
      data = monthlyRates.map(rate => ({
        Période: `${getMonthName(rate.month)} ${rate.year}`,
        'Paire de devises': rate.currency_pair,
        Source: rate.source_name,
        'Taux moyen': rate.avg_rate,
        'Taux minimal': rate.min_rate,
        'Taux maximal': rate.max_rate,
        Ouverture: rate.opening_rate,
        Clôture: rate.closing_rate,
        'Nombre de relevés': rate.data_points,
      }));
      filename = 'Taux_de_change_mensuels.xlsx';
      sheetName = 'Taux mensuels';
    } else if (activeTab === 'customer') {
      data = customerRates.map(rate => ({
        Date: rate.transaction_date,
        Client: rate.customer_name,
        'Paire de devises': rate.currency_pair,
        'Taux appliqué': rate.rate_paid,
        'Taux de marché': rate.market_rate || '-',
        'Écart (%)': rate.spread_percentage ? `${rate.spread_percentage.toFixed(2)}%` : '-',
        Montant: rate.amount,
        Référence: rate.reference_number || '-',
      }));
      filename = 'Taux_de_change_clients.xlsx';
      sheetName = 'Taux clients';
    }

    await downloadExcelWorkbook([{ name: sheetName, rows: data, widths: Object.keys(data[0] || {}).map(() => 15) }], filename);
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
      'Nombre de taux': item.count,
      'Taux moyen': item.total / item.count,
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
      if (!acc[rate.customer_name || 'Client inconnu']) {
        acc[rate.customer_name || 'Client inconnu'] = { name: rate.customer_name || 'Client inconnu', count: 0, totalAmount: 0 };
      }
      acc[rate.customer_name || 'Client inconnu'].count++;
      acc[rate.customer_name || 'Client inconnu'].totalAmount += rate.amount;
      return acc;
    }, {} as Record<string, { name: string; count: number; totalAmount: number }>);

    return Object.values(grouped).slice(0, 10).map(item => ({
      name: item.name,
      'Nombre de transactions': item.count,
      'Montant total': item.totalAmount,
    }));
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-700">Gestion des taux de change</h1>
            <p className="text-slate-500 text-sm mt-0.5">Suivi et gestion des taux de change provenant de plusieurs sources</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            {activeTab !== 'analysis' && activeTab !== 'comparison' && (
              <Button
                variant="outline"
                onClick={exportToExcel}
                disabled={loading}
                className="text-sm"
              >
                <FileDown className="w-3.5 h-3.5 mr-1.5" />
                Exporter vers Excel
              </Button>
            )}
            {activeTab === 'daily' && (
              <Button onClick={() => setShowAddModal(true)} className="text-sm bg-[#B8860B] hover:bg-[#9a7109]">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Ajouter un taux journalier
              </Button>
            )}
            {activeTab === 'customer' && (
              <Button onClick={() => setShowCustomerRateModal(true)} className="text-sm bg-[#B8860B] hover:bg-[#9a7109]">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Ajouter un taux client
              </Button>
            )}
          </div>
        </div>

        {/* Live FX Rates Panel */}
        <LiveFxRatePanel />

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setActiveTab('daily')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'daily'
                  ? 'border-[#B8860B] text-[#B8860B]'
                  : 'border-transparent text-gray-500 hover:text-slate-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Taux journaliers
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'monthly'
                  ? 'border-[#B8860B] text-[#B8860B]'
                  : 'border-transparent text-gray-500 hover:text-slate-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Agrégats mensuels
            </button>
            <button
              onClick={() => setActiveTab('customer')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'customer'
                  ? 'border-[#B8860B] text-[#B8860B]'
                  : 'border-transparent text-gray-500 hover:text-slate-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Taux clients
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'comparison'
                  ? 'border-[#B8860B] text-[#B8860B]'
                  : 'border-transparent text-gray-500 hover:text-slate-700 hover:border-gray-300'
              }`}
            >
              <Filter className="w-4 h-4 inline mr-2" />
              Comparer les sources
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'analysis'
                  ? 'border-[#B8860B] text-[#B8860B]'
                  : 'border-transparent text-gray-500 hover:text-slate-700 hover:border-gray-300'
              }`}
            >
              <BarChart className="w-4 h-4 inline mr-2" />
              Analyse des taux de change
            </button>
          </nav>
        </div>

        {/* Filters */}
        {activeTab !== 'analysis' && activeTab !== 'comparison' && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <FormField label="Paire de devises">
                  <Select
                    value={currencyFilter}
                    onChange={(e) => setCurrencyFilter(e.target.value)}
                  >
                    <option value="all">Toutes les paires de devises</option>
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
                    <option value="all">Toutes les sources</option>
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
                    <FormField label="Année">
                      <Input
                        type="number"
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        placeholder="YYYY"
                        min="2020"
                        max="2030"
                      />
                    </FormField>
                    <FormField label="Mois">
                      <Select
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                      >
                        <option value="">Tous les mois</option>
                        <option value="1">Janvier</option>
                        <option value="2">Février</option>
                        <option value="3">Mars</option>
                        <option value="4">Avril</option>
                        <option value="5">Mai</option>
                        <option value="6">Juin</option>
                        <option value="7">Juillet</option>
                        <option value="8">Août</option>
                        <option value="9">Septembre</option>
                        <option value="10">Octobre</option>
                        <option value="11">Novembre</option>
                        <option value="12">Décembre</option>
                      </Select>
                    </FormField>
                  </>
                )}

                {activeTab === 'customer' && (
                  <>
                    <FormField label="Client">
                      <Select
                        value={customerFilter}
                        onChange={(e) => setCustomerFilter(e.target.value)}
                      >
                        <option value="all">Tous les clients</option>
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
                    Réinitialiser les filtres
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
              <p className="mt-4 text-gray-600">Chargement des taux…</p>
            </CardContent>
          </Card>
        ) : activeTab !== 'analysis' && activeTab !== 'comparison' ? (
          <>
            {/* Chart Section */}
            {activeTab === 'daily' && dailyRates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Répartition des taux par paire de devises</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChartWidget
                    data={getDailyChartData()}
                    bars={[
                      { dataKey: 'Nombre de taux', color: '#3b82f6', name: 'Nombre de taux' },
                      { dataKey: 'Taux moyen', color: '#10b981', name: 'Taux moyen' }
                    ]}
                    height={300}
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'monthly' && monthlyRates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Évolution mensuelle des taux</CardTitle>
                </CardHeader>
                <CardContent>
                  <ComposedChartWidget
                    data={getMonthlyChartData()}
                    bars={[
                      { dataKey: 'USD/XOF', color: '#10b981', name: 'USD/XOF', yAxisId: 'left' }
                    ].filter(bar =>
                      monthlyRates.some(r => r.currency_pair === bar.dataKey)
                    )}
                    lines={[
                      { dataKey: 'EUR/XOF', color: '#f59e0b', name: 'EUR/XOF', yAxisId: 'right' }
                    ].filter(line =>
                      monthlyRates.some(r => r.currency_pair === line.dataKey)
                    )}
                    height={300}
                  />
                </CardContent>
              </Card>
            )}

            {activeTab === 'customer' && customerRates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vue d’ensemble des transactions clients</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChartWidget
                    data={getCustomerChartData()}
                    bars={[
                      { dataKey: 'Nombre de transactions', color: '#3b82f6', name: 'Nombre de transactions' }
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
                    <CardTitle>Taux de change journaliers ({dailyRates.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Exporter vers Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paire de devises</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Achat</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vente</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Écart</th>
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
                              Aucun taux journalier ne correspond aux filtres sélectionnés.
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
                    <CardTitle>Agrégats mensuels des taux ({monthlyRates.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Exporter vers Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paire de devises</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux moyen</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ouverture</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Clôture</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Nombre de relevés</th>
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
                              Aucun agrégat mensuel ne correspond aux filtres sélectionnés.
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
                    <CardTitle>Taux de change clients ({customerRates.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Exporter vers Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paire de devises</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux appliqué</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux de marché</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Écart (%)</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
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
                              {rate.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {rate.reference_number || '-'}
                            </td>
                          </tr>
                        ))}
                        {customerRates.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              Aucun taux client ne correspond aux filtres sélectionnés.
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
            <ModalHeader>Ajouter un taux de change journalier</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <FormField label="Date" required>
                  <Input
                    type="date"
                    value={dailyFormData.rate_date}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, rate_date: e.target.value })}
                  />
                </FormField>

                <FormField label="Paire de devises" required>
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

                <FormField label="Taux" required>
                  <Input
                    type="number"
                    step="0.00001"
                    value={dailyFormData.rate}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, rate: e.target.value })}
                    placeholder="0.00000"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Taux d’achat">
                    <Input
                      type="number"
                      step="0.00001"
                      value={dailyFormData.bid_rate}
                      onChange={(e) => setDailyFormData({ ...dailyFormData, bid_rate: e.target.value })}
                      placeholder="Facultatif"
                    />
                  </FormField>

                  <FormField label="Taux de vente">
                    <Input
                      type="number"
                      step="0.00001"
                      value={dailyFormData.ask_rate}
                      onChange={(e) => setDailyFormData({ ...dailyFormData, ask_rate: e.target.value })}
                      placeholder="Facultatif"
                    />
                  </FormField>
                </div>

                <FormField label="Notes">
                  <Input
                    value={dailyFormData.notes}
                    onChange={(e) => setDailyFormData({ ...dailyFormData, notes: e.target.value })}
                    placeholder="Notes facultatives"
                  />
                </FormField>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleAddDailyRate}>
                Ajouter le taux
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {/* Add Customer Rate Modal */}
        {showCustomerRateModal && (
          <Modal isOpen={showCustomerRateModal} onClose={() => setShowCustomerRateModal(false)} size="lg">
            <ModalHeader>Ajouter un taux de change client</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <FormField label="Client" required>
                  <Select
                    value={customerFormData.customer_id}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, customer_id: e.target.value })}
                  >
                    <option value="">Sélectionner un client</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Date de la transaction" required>
                  <Input
                    type="date"
                    value={customerFormData.transaction_date}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, transaction_date: e.target.value })}
                  />
                </FormField>

                <FormField label="Paire de devises" required>
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
                  <FormField label="Taux appliqué" required>
                    <Input
                      type="number"
                      step="0.00001"
                      value={customerFormData.rate_paid}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, rate_paid: e.target.value })}
                      placeholder="0.00000"
                    />
                  </FormField>

                  <FormField label="Taux de marché">
                    <Input
                      type="number"
                      step="0.00001"
                      value={customerFormData.market_rate}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, market_rate: e.target.value })}
                      placeholder="Facultatif"
                    />
                  </FormField>
                </div>

                <FormField label="Montant" required>
                  <Input
                    type="number"
                    step="0.01"
                    value={customerFormData.amount}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </FormField>

                <FormField label="Numéro de référence">
                  <Input
                    value={customerFormData.reference_number}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, reference_number: e.target.value })}
                    placeholder="Facultatif"
                  />
                </FormField>

                <FormField label="Notes">
                  <Input
                    value={customerFormData.notes}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                    placeholder="Notes facultatives"
                  />
                </FormField>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowCustomerRateModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleAddCustomerRate}>
                Ajouter le taux
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
}
