import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import {
  TrendingUp, Calendar, DollarSign,
  BarChart3, ArrowUpRight, ArrowDownRight, AlertCircle
} from 'lucide-react';
import { Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ComposedChart } from '@/lib/recharts';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { LiveGoldMarketPanel } from '@/components/sales/LiveGoldMarketPanel';

interface DailyPrice {
  price_date: string;
  london_am_rate: number;
  london_pm_rate: number | null;
  spot_price: number | null;
  average_price: number;
  high_price: number;
  low_price: number;
}

interface MonthlyAggregate {
  year: number;
  month: number;
  average_price: number;
  high_price: number;
  low_price: number;
  /** Nullables en base : un mois peut n'avoir ni ouverture ni clôture. */
  opening_price: number | null;
  closing_price: number | null;
  total_days: number | null;
}

interface SalesPriceAnalysis {
  sale_id: string | null;
  sale_number: string | null;
  sale_date: string;
  year: number;
  month: number;
  quantity_oz: number;
  sale_price_per_oz: number;
  market_price_per_oz: number;
  variance_usd: number;
  variance_percent: number;
  customer_name: string;
}

interface MonthlySalesVsMarket {
  year: number | null;
  month: number | null;
  total_sales: number;
  total_quantity_oz: number;
  avg_sale_price: number;
  avg_market_price: number;
  avg_variance_usd: number;
  avg_variance_percent: number;
  total_variance_usd: number;
}

export function GoldPricesPage() {
  const { addToast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'comparison'>('daily');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const [dailyPrices, setDailyPrices] = useState<DailyPrice[]>([]);
  const [monthlyAggregates, setMonthlyAggregates] = useState<MonthlyAggregate[]>([]);
  const [salesAnalysis, setSalesAnalysis] = useState<SalesPriceAnalysis[]>([]);
  const [monthlySalesVsMarket, setMonthlySalesVsMarket] = useState<MonthlySalesVsMarket[]>([]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, viewMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewMode === 'daily') {
        await loadDailyPrices();
      } else if (viewMode === 'monthly') {
        await loadMonthlyAggregates();
      } else if (viewMode === 'comparison') {
        await loadSalesComparison();
      }
    } catch (error: any) {
      addToast(error.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDailyPrices = async () => {
    // Fetch daily gold prices from LBMA source stored in database
    // Data is sourced from London Bullion Market Association (LBMA) - the global authority for gold pricing
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('gold_prices_daily')
      .select('*')
      .gte('price_date', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
      .lt('price_date', `${selectedMonth === 12 ? selectedYear + 1 : selectedYear}-${String(selectedMonth === 12 ? 1 : selectedMonth + 1).padStart(2, '0')}-01`)
      .lte('price_date', today)
      .order('price_date', { ascending: true });

    if (error) throw error;
    setDailyPrices(data || []);
  };

  const loadMonthlyAggregates = async () => {
    // Fetch monthly aggregate gold prices from LBMA data
    // This includes average, high, low, opening, and closing prices for each month
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const { data, error } = await supabase
      .from('gold_prices_monthly')
      .select('*')
      .eq('year', selectedYear)
      .order('month', { ascending: true });

    if (error) throw error;

    // Filter out future months if viewing current year
    const filteredData = selectedYear === currentYear
      ? (data || []).filter(m => m.month <= currentMonth)
      : (data || []);

    setMonthlyAggregates(filteredData);
  };

  const loadSalesComparison = async () => {
    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Load sales price analysis
    const { data: salesData, error: salesError } = await supabase
      .from('v_sales_price_analysis')
      .select('*')
      .eq('year', selectedYear)
      .eq('month', selectedMonth)
      .lte('sale_date', today)
      .order('sale_date', { ascending: false });

    if (salesError) throw salesError;
    setSalesAnalysis(salesData || []);

    // Load monthly sales vs market
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('v_monthly_sales_vs_market')
      .select('*')
      .eq('year', selectedYear)
      .order('month', { ascending: false });

    if (monthlyError) throw monthlyError;

    // Filter out future months if viewing current year
    const filteredMonthlyData = selectedYear === currentYear
      ? (monthlyData || []).filter((m) => m.month !== null && m.month <= currentMonth)
      : (monthlyData || []);

    setMonthlySalesVsMarket(filteredMonthlyData);
  };

  const latestPrice = dailyPrices.length > 0 ? dailyPrices[dailyPrices.length - 1] : null;
  const previousPrice = dailyPrices.length > 1 ? dailyPrices[dailyPrices.length - 2] : null;
  const priceChange = latestPrice && previousPrice ? latestPrice.london_am_rate - previousPrice.london_am_rate : 0;
  const priceChangePercent = previousPrice ? (priceChange / previousPrice.london_am_rate) * 100 : 0;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Loading gold prices...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Live Gold Market Panel - Right Side */}
      <LiveGoldMarketPanel onCollapseChange={setIsPanelCollapsed} />

      <div
        className="space-y-6 transition-all duration-300"
        style={{
          marginRight: isPanelCollapsed ? '0' : '320px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary-600" />
              Gold Prices
            </h1>
            <p className="text-gray-600 mt-1">Track daily prices, monthly aggregates, and compare with sales</p>
          </div>
          <div className="flex gap-3">
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-2">
            <button
              onClick={() => setViewMode('daily')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                viewMode === 'daily'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Day by Day Prices
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                viewMode === 'monthly'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Monthly Aggregates
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                viewMode === 'comparison'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Sales vs Market
            </button>
          </nav>
        </div>

        {/* Date Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year
                </label>
                <Select
                  value={selectedYear.toString()}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full"
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
              </div>
              {viewMode !== 'monthly' && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Month
                  </label>
                  <Select
                    value={selectedMonth.toString()}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>{name}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Daily View */}
        {viewMode === 'daily' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Current Price</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {latestPrice ? `$${latestPrice.london_am_rate.toFixed(2)}` : 'N/A'}
                  </p>
                  {previousPrice && latestPrice && (
                    <p className={`text-sm mt-1 flex items-center gap-1 ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {priceChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">London AM Rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Month High</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {dailyPrices.length > 0
                      ? `$${Math.max(...dailyPrices.map(p => p.high_price)).toFixed(2)}`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Highest daily peak</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Month Low</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">
                    {dailyPrices.length > 0
                      ? `$${Math.min(...dailyPrices.map(p => p.low_price)).toFixed(2)}`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Lowest daily dip</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Month Average</p>
                  <p className="text-3xl font-bold text-primary-600 mt-1">
                    {dailyPrices.length > 0
                      ? `$${(dailyPrices.reduce((sum, p) => sum + p.average_price, 0) / dailyPrices.length).toFixed(2)}`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{dailyPrices.length} trading days</p>
                </CardContent>
              </Card>
            </div>

            {/* No Data Message */}
            {dailyPrices.length === 0 && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-amber-900">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-semibold">No LBMA Price Data Available</p>
                      <p className="text-sm mt-1">
                        Historical gold price data from London Bullion Market Association (LBMA) needs to be imported for {monthNames[selectedMonth - 1]} {selectedYear}.
                        Please contact your system administrator to load historical price data.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Price Chart */}
            {dailyPrices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Daily Price Movement - {monthNames[selectedMonth - 1]} {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dailyPrices}>
                      <XAxis
                        dataKey="price_date"
                        tickFormatter={(value) => new Date(value).getDate().toString()}
                      />
                      <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                      />
                      <Legend />
                      <Bar dataKey="high_price" fill="#10b981" name="High" opacity={0.3} />
                      <Bar dataKey="low_price" fill="#ef4444" name="Low" opacity={0.3} />
                      <Line
                        type="monotone"
                        dataKey="london_am_rate"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ fill: '#f59e0b', r: 4 }}
                        name="London AM"
                      />
                      <Line
                        type="monotone"
                        dataKey="average_price"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Daily Avg"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Daily Prices Table */}
            {dailyPrices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Daily Price Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">London AM</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">London PM</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spot</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">High</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Low</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailyPrices.slice().reverse().map((price, index, arr) => {
                        const prevPrice = arr[index + 1];
                        const change = prevPrice ? price.london_am_rate - prevPrice.london_am_rate : 0;
                        return (
                          <tr key={price.price_date} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(price.price_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              ${price.london_am_rate.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              ${price.london_pm_rate?.toFixed(2) || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              ${price.spot_price?.toFixed(2) || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                              ${price.high_price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                              ${price.low_price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {prevPrice ? (
                                <span className={change >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                  {change >= 0 ? '+' : ''}{change.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            )}
          </>
        )}

        {/* Monthly View */}
        {viewMode === 'monthly' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Year Average</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {monthlyAggregates.length > 0
                      ? `$${(monthlyAggregates.reduce((sum, m) => sum + parseFloat(m.average_price.toString()), 0) / monthlyAggregates.length).toFixed(2)}`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{monthlyAggregates.length} months</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Year High</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {monthlyAggregates.length > 0
                      ? `$${Math.max(...monthlyAggregates.map(m => parseFloat(m.high_price.toString()))).toFixed(2)}`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Peak price</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Year Low</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">
                    {monthlyAggregates.length > 0
                      ? `$${Math.min(...monthlyAggregates.map(m => parseFloat(m.low_price.toString()))).toFixed(2)}`
                      : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Lowest price</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Total Trading Days</p>
                  <p className="text-3xl font-bold text-primary-600 mt-1">
                    {monthlyAggregates.length > 0
                      ? monthlyAggregates.reduce((somme, m) => somme + (m.total_days ?? 0), 0)
                      : '0'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Across {monthlyAggregates.length} months</p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Price Trends - {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyAggregates}>
                      <XAxis
                        dataKey="month"
                        tickFormatter={(value) => monthNames[value - 1].substring(0, 3)}
                      />
                      <YAxis domain={['dataMin - 50', 'dataMax + 50']} />
                      <Tooltip
                        labelFormatter={(value) => monthNames[value - 1]}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                      />
                      <Legend />
                      <Bar dataKey="average_price" fill="#3b82f6" name="Average" />
                      <Bar dataKey="high_price" fill="#10b981" name="High" />
                      <Bar dataKey="low_price" fill="#ef4444" name="Low" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Table */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Aggregates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Average</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">High</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Low</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opening</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Closing</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {monthlyAggregates.slice().reverse().map((agg, index, arr) => {
                        const prevAgg = arr[index + 1];
                        const clotureCourante = agg.closing_price === null ? null : Number(agg.closing_price);
                        const cloturePrecedente = prevAgg?.closing_price == null ? null : Number(prevAgg.closing_price);
                        const change = clotureCourante !== null && cloturePrecedente !== null
                          ? clotureCourante - cloturePrecedente
                          : 0;
                        const changePercent = change !== 0 && cloturePrecedente
                          ? (change / cloturePrecedente) * 100
                          : 0;
                        return (
                          <tr key={`${agg.year}-${agg.month}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {monthNames[agg.month - 1]}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              ${parseFloat(agg.average_price.toString()).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                              ${parseFloat(agg.high_price.toString()).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                              ${parseFloat(agg.low_price.toString()).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {agg.opening_price === null ? '—' : `$${Number(agg.opening_price).toFixed(2)}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {agg.closing_price === null ? '—' : `$${Number(agg.closing_price).toFixed(2)}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              {agg.total_days}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {prevAgg ? (
                                <div>
                                  <span className={change >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                    {change >= 0 ? '+' : ''}{change.toFixed(2)}
                                  </span>
                                  <span className={`text-xs ml-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ({changePercent.toFixed(2)}%)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Comparison View */}
        {viewMode === 'comparison' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {salesAnalysis.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">This month</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Total Quantity</p>
                  <p className="text-3xl font-bold text-primary-600 mt-1">
                    {salesAnalysis.reduce((sum, s) => sum + parseFloat(s.quantity_oz.toString()), 0).toFixed(2)} oz
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Gold sold</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Avg Sale Price</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    ${salesAnalysis.length > 0
                      ? (salesAnalysis.reduce((sum, s) => sum + parseFloat(s.sale_price_per_oz?.toString() || '0'), 0) / salesAnalysis.length).toFixed(2)
                      : '0.00'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Per ounce</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Total Variance</p>
                  <p className={`text-3xl font-bold mt-1 ${
                    salesAnalysis.reduce((sum, s) => sum + parseFloat(s.variance_usd?.toString() || '0'), 0) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    ${Math.abs(salesAnalysis.reduce((sum, s) => sum + parseFloat(s.variance_usd?.toString() || '0'), 0)).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {salesAnalysis.reduce((sum, s) => sum + parseFloat(s.variance_usd?.toString() || '0'), 0) >= 0 ? 'Above' : 'Below'} market
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sales vs Market Chart */}
            {monthlySalesVsMarket.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Sales vs Market Comparison - {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={monthlySalesVsMarket.slice().reverse()}>
                        <XAxis
                          dataKey="month"
                          tickFormatter={(value) => monthNames[value - 1].substring(0, 3)}
                        />
                        <YAxis yAxisId="left" orientation="left" label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Variance ($)', angle: 90, position: 'insideRight' }} />
                        <Tooltip
                          labelFormatter={(value) => monthNames[value - 1]}
                          formatter={(value: number, name: string) => {
                            if (name === 'Sales' || name === 'Market') return [`$${value.toFixed(2)}/oz`, name];
                            return [`$${value.toFixed(2)}`, name];
                          }}
                        />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="avg_sale_price"
                          stroke="#10b981"
                          strokeWidth={3}
                          name="Sales"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="avg_market_price"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          name="Market"
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="avg_variance_usd"
                          fill="#f59e0b"
                          name="Variance"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Individual Sales Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary-600" />
                  Sales Price Analysis - {monthNames[selectedMonth - 1]} {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salesAnalysis.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>No sales data available for the selected period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale #</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty (oz)</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sale Price</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Market Price</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance $</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance %</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {salesAnalysis.map((sale) => {
                          const variance = parseFloat(sale.variance_usd?.toString() || '0');
                          const variancePercent = parseFloat(sale.variance_percent?.toString() || '0');
                          return (
                            <tr key={sale.sale_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {sale.sale_number}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(sale.sale_date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {sale.customer_name || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {parseFloat(sale.quantity_oz.toString()).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                ${parseFloat(sale.sale_price_per_oz?.toString() || '0').toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                ${parseFloat(sale.market_price_per_oz?.toString() || '0').toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className={`font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ${Math.abs(variance).toFixed(2)}
                                  {variance >= 0 ? ' ↑' : ' ↓'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className={`font-medium ${variancePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
