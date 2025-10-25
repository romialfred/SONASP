import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { FileText, Download, Calendar, TrendingUp, DollarSign, Users, Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { demoSales, demoCustomers, demoGoldPrices, demoBatches } from '@/lib/demoSeed';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart } from 'recharts';

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

    const customerSales = demoCustomers.map(customer => {
      const sales = filteredSales.filter(s => s.customer_id === customer.customer_id);
      const totalRevenue = sales.reduce((sum, s) => sum + s.amount_usd, 0);
      return {
        name: customer.name,
        revenue: totalRevenue,
        count: sales.length,
        avgSale: sales.length > 0 ? totalRevenue / sales.length : 0,
      };
    }).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const avgPrice = filteredPrices.length > 0
      ? filteredPrices.reduce((sum, p) => sum + p.price_per_oz_usd, 0) / filteredPrices.length
      : 0;

    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.amount_usd, 0);
    const totalWeight = filteredSales.reduce((sum, s) => sum + s.fine_weight_oz, 0);

    const growthRate = monthlySalesArray.length >= 2
      ? ((monthlySalesArray[monthlySalesArray.length - 1].revenue - monthlySalesArray[0].revenue) / monthlySalesArray[0].revenue) * 100
      : 0;

    return {
      monthlySales: monthlySalesArray,
      customerSales,
      totalRevenue,
      totalWeight,
      avgPrice,
      salesCount: filteredSales.length,
      growthRate,
    };
  }, [filteredData]);

  // Batch Report Data
  const batchReportData = useMemo(() => {
    const { filteredBatches } = filteredData;

    const statusBreakdown = filteredBatches.reduce((acc, batch) => {
      acc[batch.status] = (acc[batch.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusData = Object.entries(statusBreakdown).map(([status, count]) => ({
      status,
      count,
    }));

    const monthlyBatches = filteredBatches.reduce((acc, batch) => {
      const month = new Date(batch.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!acc[month]) acc[month] = { month, created: 0, processed: 0, weight: 0 };
      acc[month].created += 1;
      if (batch.status === 'refined' || batch.status === 'sold') acc[month].processed += 1;
      acc[month].weight += batch.gross_weight_g;
      return acc;
    }, {} as Record<string, any>);

    const monthlyBatchesArray = Object.values(monthlyBatches).sort((a: any, b: any) =>
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );

    const processingTime = filteredBatches.filter(b => b.refined_at && b.created_at).map(b => {
      const created = new Date(b.created_at).getTime();
      const refined = new Date(b.refined_at!).getTime();
      return Math.round((refined - created) / (1000 * 60 * 60 * 24));
    });

    const avgProcessingTime = processingTime.length > 0
      ? processingTime.reduce((a, b) => a + b, 0) / processingTime.length
      : 0;

    return {
      statusData,
      monthlyBatches: monthlyBatchesArray,
      totalBatches: filteredBatches.length,
      totalWeight: filteredBatches.reduce((sum, b) => sum + b.gross_weight_g, 0),
      avgProcessingTime,
      completionRate: (statusBreakdown['sold'] || 0) / filteredBatches.length * 100,
    };
  }, [filteredData]);

  // Customer Report Data
  const customerReportData = useMemo(() => {
    const { filteredSales } = filteredData;

    const customerDetails = demoCustomers.map(customer => {
      const sales = filteredSales.filter(s => s.customer_id === customer.customer_id);
      const totalRevenue = sales.reduce((sum, s) => sum + s.amount_usd, 0);
      const totalWeight = sales.reduce((sum, s) => sum + s.fine_weight_oz, 0);

      const monthlySales = sales.reduce((acc, sale) => {
        const month = new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!acc[month]) acc[month] = 0;
        acc[month] += sale.amount_usd;
        return acc;
      }, {} as Record<string, number>);

      return {
        name: customer.name,
        segment: customer.segment,
        revenue: totalRevenue,
        weight: totalWeight,
        salesCount: sales.length,
        avgSale: sales.length > 0 ? totalRevenue / sales.length : 0,
        monthlySales,
      };
    }).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue);

    const segmentBreakdown = customerDetails.reduce((acc, c) => {
      if (!acc[c.segment]) acc[c.segment] = { segment: c.segment, revenue: 0, count: 0 };
      acc[c.segment].revenue += c.revenue;
      acc[c.segment].count += 1;
      return acc;
    }, {} as Record<string, any>);

    const segmentData = Object.values(segmentBreakdown);

    return {
      customerDetails,
      segmentData,
      totalCustomers: customerDetails.length,
      totalRevenue: customerDetails.reduce((sum, c) => sum + c.revenue, 0),
    };
  }, [filteredData]);

  // Financial Report Data
  const financialReportData = useMemo(() => {
    const { filteredSales } = filteredData;

    const monthlyFinancials = filteredSales.reduce((acc, sale) => {
      const month = new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!acc[month]) acc[month] = { month, revenue: 0, costs: 0, profit: 0 };
      acc[month].revenue += sale.amount_usd;
      acc[month].costs += sale.amount_usd * 0.15;
      acc[month].profit = acc[month].revenue - acc[month].costs;
      return acc;
    }, {} as Record<string, any>);

    const monthlyFinancialsArray = Object.values(monthlyFinancials).sort((a: any, b: any) =>
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );

    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.amount_usd, 0);
    const totalCosts = totalRevenue * 0.15;
    const totalProfit = totalRevenue - totalCosts;
    const profitMargin = (totalProfit / totalRevenue) * 100;

    return {
      monthlyFinancials: monthlyFinancialsArray,
      totalRevenue,
      totalCosts,
      totalProfit,
      profitMargin,
    };
  }, [filteredData]);

  // Inventory Report Data
  const inventoryReportData = useMemo(() => {
    const { filteredBatches, filteredSales } = filteredData;

    const availableWeight = filteredBatches
      .filter(b => b.status !== 'sold')
      .reduce((sum, b) => sum + (b.refined_weight_g || b.gross_weight_g), 0);

    const soldWeight = filteredSales.reduce((sum, s) => sum + s.fine_weight_oz * 31.1035, 0);

    const monthlyInventory = filteredBatches.reduce((acc, batch) => {
      const month = new Date(batch.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!acc[month]) acc[month] = { month, received: 0, processed: 0, sold: 0 };
      acc[month].received += batch.gross_weight_g;
      if (batch.refined_weight_g) acc[month].processed += batch.refined_weight_g;
      return acc;
    }, {} as Record<string, any>);

    filteredSales.forEach(sale => {
      const month = new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (monthlyInventory[month]) {
        monthlyInventory[month].sold += sale.fine_weight_oz * 31.1035;
      }
    });

    const monthlyInventoryArray = Object.values(monthlyInventory).sort((a: any, b: any) =>
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );

    return {
      monthlyInventory: monthlyInventoryArray,
      availableWeight,
      soldWeight,
      totalBatches: filteredBatches.length,
      turnoverRate: (soldWeight / (availableWeight + soldWeight)) * 100,
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
      ? variances.reduce((sum, v) => sum + Math.abs(v.variance), 0) / variances.length
      : 0;

    const varianceByStatus = variances.reduce((acc, v) => {
      const status = Math.abs(v.variance) > 2 ? 'High' : Math.abs(v.variance) > 1 ? 'Medium' : 'Low';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { variances: variances.slice(0, 10), avgVariance, varianceByStatus };
  }, [filteredData]);

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

  const AnalysisBox = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">{children}</div>
      </div>
    </div>
  );

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

        {/* SALES REPORT */}
        {generatedReport && reportType === 'sales' && (
          <div className="space-y-6 print:space-y-4">
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
                      <p className="text-xs text-gray-600">Growth Rate</p>
                      <p className="text-lg font-bold text-gray-900">
                        {salesReportData.growthRate > 0 ? '+' : ''}{salesReportData.growthRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

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
                <AnalysisBox>
                  <strong>Analysis:</strong> The sales performance chart shows a {salesReportData.growthRate > 0 ? 'positive' : 'negative'} trend with a {Math.abs(salesReportData.growthRate).toFixed(1)}% growth rate.
                  Total revenue of ${(salesReportData.totalRevenue / 1000).toFixed(1)}K was generated from {salesReportData.salesCount} transactions.
                  The correlation between revenue and weight indicates {salesReportData.totalWeight > 100 ? 'strong' : 'moderate'} sales volume with an average price of ${salesReportData.avgPrice.toFixed(0)} per ounce.
                </AnalysisBox>
              </div>
            </Card>

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
                  <AnalysisBox>
                    <strong>Customer Concentration:</strong> The top customer {salesReportData.customerSales[0]?.name} accounts for ${(salesReportData.customerSales[0]?.revenue / 1000).toFixed(0)}K ({((salesReportData.customerSales[0]?.revenue / salesReportData.totalRevenue) * 100).toFixed(1)}% of total revenue).
                    {salesReportData.customerSales.length >= 3 && ` The top 3 customers represent ${(((salesReportData.customerSales[0]?.revenue + salesReportData.customerSales[1]?.revenue + salesReportData.customerSales[2]?.revenue) / salesReportData.totalRevenue) * 100).toFixed(1)}% of revenue, indicating ${((salesReportData.customerSales[0]?.revenue + salesReportData.customerSales[1]?.revenue + salesReportData.customerSales[2]?.revenue) / salesReportData.totalRevenue) > 0.7 ? 'high customer concentration risk' : 'healthy customer diversification'}.`}
                  </AnalysisBox>
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
                  <AnalysisBox>
                    <strong>Revenue Balance:</strong> Revenue is distributed across {salesReportData.customerSales.length} active customers. The largest customer represents {((salesReportData.customerSales[0]?.revenue / salesReportData.totalRevenue) * 100).toFixed(0)}% of total revenue.
                    Average transaction size is ${(salesReportData.totalRevenue / salesReportData.salesCount / 1000).toFixed(1)}K per sale.
                  </AnalysisBox>
                </div>
              </Card>
            </div>

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
                <AnalysisBox>
                  <strong>Price Volatility:</strong> Gold prices averaged ${salesReportData.avgPrice.toFixed(0)} per ounce during the period.
                  {priceAnalysis.length > 1 && ` Price volatility of ${((priceAnalysis[priceAnalysis.length - 1].maxPrice - priceAnalysis[priceAnalysis.length - 1].minPrice) / priceAnalysis[priceAnalysis.length - 1].avgPrice * 100).toFixed(1)}% in the latest month indicates ${((priceAnalysis[priceAnalysis.length - 1].maxPrice - priceAnalysis[priceAnalysis.length - 1].minPrice) / priceAnalysis[priceAnalysis.length - 1].avgPrice * 100) > 5 ? 'high market volatility' : 'stable market conditions'}.`}
                  {' '}This price movement directly impacts profit margins and should be monitored for optimal sales timing.
                </AnalysisBox>
              </div>
            </Card>
          </div>
        )}

        {/* BATCH REPORT */}
        {generatedReport && reportType === 'batch' && (
          <div className="space-y-6 print:space-y-4">
            <Card className="print:shadow-none print:border-2">
              <div className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Batch Processing Report</h2>
                    <p className="text-gray-600 mt-1">
                      Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <Package className="w-12 h-12 text-blue-600" />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Batches</p>
                      <p className="text-lg font-bold text-gray-900">{batchReportData.totalBatches}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Completion Rate</p>
                      <p className="text-lg font-bold text-gray-900">{batchReportData.completionRate.toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Avg Processing Time</p>
                      <p className="text-lg font-bold text-gray-900">{batchReportData.avgProcessingTime.toFixed(0)} days</p>
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
                      <p className="text-xs text-gray-600">Total Weight</p>
                      <p className="text-lg font-bold text-gray-900">{(batchReportData.totalWeight / 1000).toFixed(1)} kg</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Monthly Batch Processing</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={batchReportData.monthlyBatches}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="created" fill="#3b82f6" name="Created" />
                      <Bar dataKey="processed" fill="#10b981" name="Processed" />
                      <Line type="monotone" dataKey="weight" stroke="#f59e0b" strokeWidth={2} name="Weight (g)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <AnalysisBox>
                  <strong>Processing Efficiency:</strong> {batchReportData.totalBatches} batches were processed with an average completion time of {batchReportData.avgProcessingTime.toFixed(0)} days.
                  The {batchReportData.completionRate.toFixed(0)}% completion rate indicates {batchReportData.completionRate > 80 ? 'excellent' : batchReportData.completionRate > 60 ? 'good' : 'poor'} operational efficiency.
                  Total processed weight of {(batchReportData.totalWeight / 1000).toFixed(1)}kg demonstrates {batchReportData.totalWeight > 5000 ? 'high' : 'moderate'} throughput capacity.
                </AnalysisBox>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Batch Status Distribution</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={batchReportData.statusData}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.status}: ${entry.count}`}
                        >
                          {batchReportData.statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <AnalysisBox>
                    <strong>Status Overview:</strong> Batch distribution across {batchReportData.statusData.length} different statuses shows current pipeline state.
                    {batchReportData.statusData[0] && ` The majority status is "${batchReportData.statusData[0].status}" with ${batchReportData.statusData[0].count} batches.`}
                    {' '}Monitor pending batches to ensure timely processing and minimize bottlenecks.
                  </AnalysisBox>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Variance Analysis Summary</h3>
                  <div className="grid grid-cols-1 gap-4 mt-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Average Variance</p>
                      <p className="text-2xl font-bold text-gray-900">{varianceAnalysis.avgVariance.toFixed(2)}%</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Low Variance (&lt;1%)</p>
                      <p className="text-2xl font-bold text-green-700">{varianceAnalysis.varianceByStatus.Low || 0} batches</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-gray-600">High Variance (&gt;2%)</p>
                      <p className="text-2xl font-bold text-red-700">{varianceAnalysis.varianceByStatus.High || 0} batches</p>
                    </div>
                  </div>
                  <AnalysisBox>
                    <strong>Quality Control:</strong> Average variance of {varianceAnalysis.avgVariance.toFixed(2)}% is {varianceAnalysis.avgVariance < 1 ? 'within acceptable limits' : 'above target threshold'}.
                    {varianceAnalysis.varianceByStatus.High > 0 && ` ${varianceAnalysis.varianceByStatus.High} high-variance batches require investigation for process improvements.`}
                    {' '}Maintaining low variance ensures accurate inventory management and customer satisfaction.
                  </AnalysisBox>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* CUSTOMER REPORT */}
        {generatedReport && reportType === 'customer' && (
          <div className="space-y-6 print:space-y-4">
            <Card className="print:shadow-none print:border-2">
              <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Customer Performance Report</h2>
                    <p className="text-gray-600 mt-1">
                      Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <Users className="w-12 h-12 text-purple-600" />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Active Customers</p>
                      <p className="text-lg font-bold text-gray-900">{customerReportData.totalCustomers}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Revenue</p>
                      <p className="text-lg font-bold text-gray-900">${(customerReportData.totalRevenue / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Avg Customer Value</p>
                      <p className="text-lg font-bold text-gray-900">
                        ${(customerReportData.totalRevenue / customerReportData.totalCustomers / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Top Customers by Revenue</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerReportData.customerDetails.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={180} />
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                      <Bar dataKey="revenue" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <AnalysisBox>
                  <strong>Customer Portfolio:</strong> {customerReportData.totalCustomers} active customers generated ${(customerReportData.totalRevenue / 1000).toFixed(0)}K in revenue.
                  Top customer {customerReportData.customerDetails[0]?.name} contributed ${(customerReportData.customerDetails[0]?.revenue / 1000).toFixed(0)}K ({((customerReportData.customerDetails[0]?.revenue / customerReportData.totalRevenue) * 100).toFixed(0)}%).
                  Average customer value of ${(customerReportData.totalRevenue / customerReportData.totalCustomers / 1000).toFixed(0)}K indicates {(customerReportData.totalRevenue / customerReportData.totalCustomers) > 30000 ? 'high-value' : 'standard'} customer base.
                </AnalysisBox>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Customer Segment Distribution</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={customerReportData.segmentData}
                        dataKey="revenue"
                        nameKey="segment"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.segment}: $${(entry.revenue / 1000).toFixed(0)}K`}
                      >
                        {customerReportData.segmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <AnalysisBox>
                  <strong>Segment Analysis:</strong> Customer base spans {customerReportData.segmentData.length} segments with varying contribution levels.
                  {customerReportData.segmentData[0] && ` ${customerReportData.segmentData[0].segment} segment leads with ${customerReportData.segmentData[0].count} customers generating $${(customerReportData.segmentData[0].revenue / 1000).toFixed(0)}K.`}
                  {' '}Diversification across segments reduces dependency risk and provides growth opportunities in each market.
                </AnalysisBox>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Customer Performance Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Segment</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Sale</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customerReportData.customerDetails.slice(0, 10).map(customer => (
                        <tr key={customer.name}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{customer.segment}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{customer.salesCount}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            ${customer.revenue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">
                            ${customer.avgSale.toLocaleString()}
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

        {/* FINANCIAL REPORT */}
        {generatedReport && reportType === 'financial' && (
          <div className="space-y-6 print:space-y-4">
            <Card className="print:shadow-none print:border-2">
              <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Financial Performance Report</h2>
                    <p className="text-gray-600 mt-1">
                      Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <DollarSign className="w-12 h-12 text-green-600" />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Revenue</p>
                      <p className="text-lg font-bold text-gray-900">${(financialReportData.totalRevenue / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Costs</p>
                      <p className="text-lg font-bold text-gray-900">${(financialReportData.totalCosts / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Net Profit</p>
                      <p className="text-lg font-bold text-gray-900">${(financialReportData.totalProfit / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Profit Margin</p>
                      <p className="text-lg font-bold text-gray-900">{financialReportData.profitMargin.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Monthly Financial Performance</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={financialReportData.monthlyFinancials}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                      <Bar dataKey="costs" fill="#ef4444" name="Costs" />
                      <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={3} name="Profit" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <AnalysisBox>
                  <strong>Financial Health:</strong> Total revenue of ${(financialReportData.totalRevenue / 1000).toFixed(0)}K with costs of ${(financialReportData.totalCosts / 1000).toFixed(0)}K yields ${(financialReportData.totalProfit / 1000).toFixed(0)}K in net profit.
                  The {financialReportData.profitMargin.toFixed(1)}% profit margin is {financialReportData.profitMargin > 80 ? 'excellent' : financialReportData.profitMargin > 60 ? 'good' : 'below target'}.
                  {' '}Consistent profitability demonstrates strong operational efficiency and pricing strategy effectiveness.
                </AnalysisBox>
              </div>
            </Card>
          </div>
        )}

        {/* INVENTORY REPORT */}
        {generatedReport && reportType === 'inventory' && (
          <div className="space-y-6 print:space-y-4">
            <Card className="print:shadow-none print:border-2">
              <div className="p-6 bg-gradient-to-r from-orange-50 to-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Inventory Management Report</h2>
                    <p className="text-gray-600 mt-1">
                      Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <Package className="w-12 h-12 text-orange-600" />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Available Stock</p>
                      <p className="text-lg font-bold text-gray-900">{(inventoryReportData.availableWeight / 31.1035).toFixed(0)} oz</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Sold Weight</p>
                      <p className="text-lg font-bold text-gray-900">{(inventoryReportData.soldWeight / 31.1035).toFixed(0)} oz</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Turnover Rate</p>
                      <p className="text-lg font-bold text-gray-900">{inventoryReportData.turnoverRate.toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Batches</p>
                      <p className="text-lg font-bold text-gray-900">{inventoryReportData.totalBatches}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Monthly Inventory Movement</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={inventoryReportData.monthlyInventory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="received" fill="#3b82f6" name="Received (g)" />
                      <Bar dataKey="processed" fill="#10b981" name="Processed (g)" />
                      <Line type="monotone" dataKey="sold" stroke="#ef4444" strokeWidth={3} name="Sold (g)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <AnalysisBox>
                  <strong>Inventory Dynamics:</strong> Current available stock of {(inventoryReportData.availableWeight / 31.1035).toFixed(0)} oz with {inventoryReportData.turnoverRate.toFixed(0)}% turnover rate.
                  {inventoryReportData.soldWeight / 31.1035} oz sold from {inventoryReportData.totalBatches} batches indicates {inventoryReportData.turnoverRate > 70 ? 'high' : inventoryReportData.turnoverRate > 40 ? 'moderate' : 'low'} inventory velocity.
                  {' '}Optimal inventory levels balance availability for immediate sales with minimized holding costs.
                </AnalysisBox>
              </div>
            </Card>
          </div>
        )}

        {/* COMPLIANCE REPORT */}
        {generatedReport && reportType === 'compliance' && (
          <div className="space-y-6 print:space-y-4">
            <Card className="print:shadow-none print:border-2">
              <div className="p-6 bg-gradient-to-r from-slate-50 to-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Compliance & Audit Report</h2>
                    <p className="text-gray-600 mt-1">
                      Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <CheckCircle className="w-12 h-12 text-gray-600" />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Compliant Batches</p>
                      <p className="text-lg font-bold text-gray-900">{filteredData.filteredBatches.length}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Documented Sales</p>
                      <p className="text-lg font-bold text-gray-900">{filteredData.filteredSales.length}</p>
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
                      <p className="text-xs text-gray-600">Verified Customers</p>
                      <p className="text-lg font-bold text-gray-900">{demoCustomers.length}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Pending Reviews</p>
                      <p className="text-lg font-bold text-gray-900">0</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Compliance Status Overview</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Batch Documentation</p>
                        <p className="text-sm text-gray-600">All batches have complete documentation</p>
                      </div>
                    </div>
                    <span className="text-green-600 font-semibold">100%</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Customer Verification</p>
                        <p className="text-sm text-gray-600">KYC verification complete for all customers</p>
                      </div>
                    </div>
                    <span className="text-green-600 font-semibold">100%</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Transaction Records</p>
                        <p className="text-sm text-gray-600">Complete audit trail for all sales</p>
                      </div>
                    </div>
                    <span className="text-green-600 font-semibold">100%</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Variance Management</p>
                        <p className="text-sm text-gray-600">Weight variances within acceptable limits</p>
                      </div>
                    </div>
                    <span className="text-green-600 font-semibold">98%</span>
                  </div>
                </div>
                <AnalysisBox>
                  <strong>Compliance Assessment:</strong> All regulatory requirements are met with 100% documentation completion.
                  {filteredData.filteredBatches.length} batches and {filteredData.filteredSales.length} sales transactions have complete audit trails.
                  {' '}Zero pending compliance reviews indicates robust controls and processes. Continuous monitoring ensures ongoing adherence to industry standards and regulatory requirements.
                </AnalysisBox>
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
