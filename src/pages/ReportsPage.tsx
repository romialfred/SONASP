import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { FileText, Download, Calendar, TrendingUp, DollarSign, Users, Package } from 'lucide-react';
import { demoSales, demoCustomers, demoGoldPrices, demoBatches } from '@/lib/demoSeed';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type ReportType = 'sales' | 'batch' | 'customer' | 'financial' | 'inventory' | 'compliance';
type DateRange = 'last-7-days' | 'last-30-days' | 'last-quarter' | 'last-year' | 'custom';

export function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [dateRange, setDateRange] = useState<DateRange>('last-30-days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generatedReport, setGeneratedReport] = useState<boolean>(false);

  const reportTypes = [
    { id: 'sales' as ReportType, name: 'Sales Report', description: 'Complete sales transactions and revenue' },
    { id: 'batch' as ReportType, name: 'Batch Report', description: 'Batch processing and status overview' },
    { id: 'customer' as ReportType, name: 'Customer Report', description: 'Customer performance and activity' },
    { id: 'financial' as ReportType, name: 'Financial Report', description: 'Revenue, expenses, and profitability' },
    { id: 'inventory' as ReportType, name: 'Inventory Report', description: 'Current gold inventory and movements' },
    { id: 'compliance' as ReportType, name: 'Compliance Report', description: 'Regulatory compliance documentation' },
  ];

  const recentReports = [
    { id: 1, name: 'Monthly Sales Report - October 2025', type: 'Sales', date: '2025-10-25', size: '2.4 MB' },
    { id: 2, name: 'Q3 Financial Summary', type: 'Financial', date: '2025-10-20', size: '1.8 MB' },
    { id: 3, name: 'Customer Performance Analysis', type: 'Customer', date: '2025-10-15', size: '3.1 MB' },
  ];

  // Get date range for filtering
  const getDateRangeValues = () => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (dateRange === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (dateRange === 'last-7-days') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last-30-days') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last-quarter') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last-year') {
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  };

  // Filter data based on date range
  const filteredData = useMemo(() => {
    const { start, end } = getDateRangeValues();

    const filteredSales = demoSales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= start && saleDate <= end;
    });

    const filteredBatches = demoBatches.filter(batch => {
      const batchDate = new Date(batch.created_at);
      return batchDate >= start && batchDate <= end;
    });

    const filteredPrices = demoGoldPrices.filter(price => {
      const priceDate = new Date(price.as_of);
      return priceDate >= start && priceDate <= end;
    });

    return { filteredSales, filteredBatches, filteredPrices };
  }, [dateRange, startDate, endDate]);

  // Sales Report Data
  const salesReportData = useMemo(() => {
    const { filteredSales, filteredPrices } = filteredData;

    // Monthly sales
    const monthlySales = filteredSales.reduce((acc, sale) => {
      const month = new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!acc[month]) acc[month] = { month, revenue: 0, weight: 0, count: 0 };
      acc[month].revenue += sale.amount_usd;
      acc[month].weight += sale.fine_weight_oz;
      acc[month].count += 1;
      return acc;
    }, {} as Record<string, any>);

    const monthlySalesArray = Object.values(monthlySales).sort((a: any, b: any) =>
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );

    // Customer breakdown
    const customerSales = demoCustomers.map(customer => {
      const sales = filteredSales.filter(s => s.customer_id === customer.customer_id);
      const totalRevenue = sales.reduce((sum, s) => sum + s.amount_usd, 0);
      return {
        name: customer.name,
        revenue: totalRevenue,
        count: sales.length,
      };
    }).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Price trends
    const avgPrice = filteredPrices.length > 0
      ? filteredPrices.reduce((sum, p) => sum + p.price_per_oz_usd, 0) / filteredPrices.length
      : 0;

    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.amount_usd, 0);
    const totalWeight = filteredSales.reduce((sum, s) => sum + s.fine_weight_oz, 0);

    return {
      monthlySales: monthlySalesArray,
      customerSales,
      totalRevenue,
      totalWeight,
      avgPrice,
      salesCount: filteredSales.length,
    };
  }, [filteredData]);

  // Variance Analysis
  const varianceAnalysis = useMemo(() => {
    const { filteredBatches } = filteredData;

    const variances = filteredBatches
      .filter(b => b.received_weight_g && b.gross_weight_g)
      .map(batch => ({
        id: batch.batch_id,
        expected: batch.gross_weight_g,
        received: batch.received_weight_g || 0,
        variance: ((batch.received_weight_g || 0) - batch.gross_weight_g) / batch.gross_weight_g * 100,
      }));

    const avgVariance = variances.length > 0
      ? variances.reduce((sum, v) => sum + v.variance, 0) / variances.length
      : 0;

    const varianceByStatus = variances.reduce((acc, v) => {
      const status = Math.abs(v.variance) > 2 ? 'High' : Math.abs(v.variance) > 1 ? 'Medium' : 'Low';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { variances: variances.slice(0, 10), avgVariance, varianceByStatus };
  }, [filteredData]);

  // FX Rate Analysis
  const fxRateAnalysis = useMemo(() => {
    const rates = [
      { currency: 'USD/CFA', rate: 605.50, change: +2.3 },
      { currency: 'USD/GNF', rate: 8620.00, change: -1.2 },
      { currency: 'EUR/USD', rate: 1.08, change: +0.5 },
    ];

    return rates;
  }, []);

  // Price Analysis
  const priceAnalysis = useMemo(() => {
    const { filteredPrices } = filteredData;

    const monthlyPrices = filteredPrices.reduce((acc, price) => {
      const month = new Date(price.as_of).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!acc[month]) acc[month] = [];
      acc[month].push(price.price_per_oz_usd);
      return acc;
    }, {} as Record<string, number[]>);

    const priceData = Object.entries(monthlyPrices).map(([month, prices]) => ({
      month,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    })).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    return priceData;
  }, [filteredData]);

  const handleGenerateReport = () => {
    setGeneratedReport(true);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleExportPDF = () => {
    window.print();
  };

  const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-1">Generate and download business reports</p>
          </div>
          {generatedReport && (
            <Button onClick={handleExportPDF} leftIcon={<Download className="w-4 h-4" />}>
              Export All
            </Button>
          )}
        </div>

        {/* Report Generator */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Generate New Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                <Select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                >
                  {reportTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <Select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                >
                  <option value="last-7-days">Last 7 Days</option>
                  <option value="last-30-days">Last 30 Days</option>
                  <option value="last-quarter">Last Quarter</option>
                  <option value="last-year">Last Year</option>
                  <option value="custom">Custom Range</option>
                </Select>
              </div>

              {dateRange === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex items-end">
                <Button
                  onClick={handleGenerateReport}
                  className="w-full"
                  leftIcon={<FileText className="w-4 h-4" />}
                >
                  Generate Report
                </Button>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Selected:</strong> {reportTypes.find(t => t.id === reportType)?.name}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {reportTypes.find(t => t.id === reportType)?.description}
              </p>
              {dateRange === 'custom' && startDate && endDate && (
                <p className="text-xs text-blue-600 mt-1">
                  <strong>Period:</strong> {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Generated Report */}
        {generatedReport && reportType === 'sales' && (
          <div className="space-y-6 print:space-y-4">
            {/* Report Header */}
            <Card className="print:shadow-none print:border-2">
              <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Sales Performance Report</h2>
                    <p className="text-gray-600 mt-1">
                      Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                    {dateRange === 'custom' && startDate && endDate && (
                      <p className="text-sm text-gray-600 mt-1">
                        Report Period: {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <FileText className="w-12 h-12 text-amber-600" />
                </div>
              </div>
            </Card>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Revenue</p>
                      <p className="text-lg font-bold text-gray-900">
                        ${(salesReportData.totalRevenue / 1000).toFixed(1)}K
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Weight</p>
                      <p className="text-lg font-bold text-gray-900">
                        {salesReportData.totalWeight.toFixed(1)} oz
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Sales Count</p>
                      <p className="text-lg font-bold text-gray-900">{salesReportData.salesCount}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Avg Gold Price</p>
                      <p className="text-lg font-bold text-gray-900">
                        ${salesReportData.avgPrice.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Monthly Sales Chart */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Monthly Sales Performance</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesReportData.monthlySales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#f59e0b" fill="#fbbf24" name="Revenue (USD)" />
                      <Area yAxisId="right" type="monotone" dataKey="weight" stroke="#3b82f6" fill="#60a5fa" name="Weight (oz)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Customer Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Top 5 Customers by Revenue</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesReportData.customerSales} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={150} />
                        <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                        <Bar dataKey="revenue" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Revenue Distribution</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesReportData.customerSales}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.name.split(' ')[0]}: $${(entry.revenue / 1000).toFixed(0)}K`}
                        >
                          {salesReportData.customerSales.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            </div>

            {/* Gold Price Trends */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Gold Price Analysis</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgPrice" stroke="#fbbf24" strokeWidth={2} name="Avg Price" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="minPrice" stroke="#10b981" strokeWidth={2} name="Min Price" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="maxPrice" stroke="#ef4444" strokeWidth={2} name="Max Price" dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Variance Analysis */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Variance Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Average Variance</p>
                    <p className="text-2xl font-bold text-gray-900">{varianceAnalysis.avgVariance.toFixed(2)}%</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Low Variance (&lt;1%)</p>
                    <p className="text-2xl font-bold text-green-700">{varianceAnalysis.varianceByStatus.Low || 0}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-gray-600">High Variance (&gt;2%)</p>
                    <p className="text-2xl font-bold text-red-700">{varianceAnalysis.varianceByStatus.High || 0}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch ID</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expected (g)</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received (g)</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {varianceAnalysis.variances.map(v => (
                        <tr key={v.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{v.expected.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{v.received.toFixed(2)}</td>
                          <td className={`px-4 py-3 text-sm font-medium text-right ${
                            Math.abs(v.variance) > 2 ? 'text-red-600' :
                            Math.abs(v.variance) > 1 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {v.variance > 0 ? '+' : ''}{v.variance.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {/* FX Rate Analysis */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Foreign Exchange Rates</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {fxRateAnalysis.map(rate => (
                    <div key={rate.currency} className="p-4 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600">{rate.currency}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{rate.rate.toFixed(2)}</p>
                      <p className={`text-sm font-medium mt-1 ${rate.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {rate.change >= 0 ? '↑' : '↓'} {Math.abs(rate.change)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Sales Details Table */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Detailed Sales Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales Count</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Sale Size</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {salesReportData.customerSales.map(customer => (
                        <tr key={customer.name}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{customer.count}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            ${customer.revenue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">
                            ${(customer.revenue / customer.count).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Report Templates */}
        {!generatedReport && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportTypes.map(type => (
              <Card key={type.id}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{type.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{type.description}</p>
                      <button
                        onClick={() => {
                          setReportType(type.id);
                          handleGenerateReport();
                        }}
                        className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium"
                      >
                        Generate →
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Recent Reports */}
        {!generatedReport && (
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Reports</h3>
              <div className="space-y-3">
                {recentReports.map(report => (
                  <div key={report.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{report.name}</p>
                        <p className="text-sm text-gray-500">
                          {report.type} • {new Date(report.date).toLocaleDateString()} • {report.size}
                        </p>
                      </div>
                    </div>
                    <button className="text-amber-600 hover:text-amber-700 flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Download</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
