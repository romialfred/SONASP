import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { demoSales, demoCustomers, demoGoldPrices, demoBatches } from '@/lib/demoSeed';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Package, Users, Filter, Calendar } from 'lucide-react';

type TimeRange = '3m' | '6m' | '12m' | 'all';

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('6m');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');

  const segments = ['all', ...Array.from(new Set(demoCustomers.map(c => c.segment)))];

  const getDateRange = (range: TimeRange) => {
    const now = new Date();
    const months = range === '3m' ? 3 : range === '6m' ? 6 : range === '12m' ? 12 : 36;
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return startDate;
  };

  // MONTHLY Sales Performance
  const monthlySalesData = useMemo(() => {
    const startDate = getDateRange(timeRange);
    const filteredSales = demoSales.filter(sale => new Date(sale.date) >= startDate);

    const monthlyMap = filteredSales.reduce((acc, sale) => {
      const monthKey = new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      if (!acc[monthKey]) {
        acc[monthKey] = { date: monthKey, revenue: 0, weight: 0 };
      }
      acc[monthKey].revenue += sale.amount_usd;
      acc[monthKey].weight += sale.fine_weight_oz;
      return acc;
    }, {} as Record<string, { date: string; revenue: number; weight: number }>);

    return Object.values(monthlyMap).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [timeRange]);

  // MONTHLY Gold Price vs Revenue
  const monthlyPriceCorrelation = useMemo(() => {
    const startDate = getDateRange(timeRange);

    const pricesByMonth = demoGoldPrices.reduce((acc, price) => {
      const priceDate = new Date(price.as_of);
      if (priceDate >= startDate) {
        const monthKey = priceDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(price.price_per_oz_usd);
      }
      return acc;
    }, {} as Record<string, number[]>);

    const salesByMonth = demoSales.reduce((acc, sale) => {
      const saleDate = new Date(sale.date);
      if (saleDate >= startDate) {
        const monthKey = saleDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!acc[monthKey]) acc[monthKey] = 0;
        acc[monthKey] += sale.amount_usd;
      }
      return acc;
    }, {} as Record<string, number>);

    const monthKeys = Array.from(new Set([...Object.keys(pricesByMonth), ...Object.keys(salesByMonth)]));

    return monthKeys.map(month => ({
      date: month,
      price: pricesByMonth[month] ? Math.round(pricesByMonth[month].reduce((a, b) => a + b, 0) / pricesByMonth[month].length) : 0,
      revenue: Math.round((salesByMonth[month] || 0) / 1000),
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [timeRange]);

  // TOP 3 Customers by MONTH
  const topCustomersMonthly = useMemo(() => {
    const startDate = getDateRange(timeRange);
    const filteredSales = demoSales.filter(sale => {
      const saleDate = new Date(sale.date);
      const matchesTime = saleDate >= startDate;
      if (selectedSegment === 'all') return matchesTime;
      const customer = demoCustomers.find(c => c.customer_id === sale.customer_id);
      return matchesTime && customer?.segment === selectedSegment;
    });

    // Get top 3 customers
    const customerTotals = demoCustomers.map(customer => {
      const customerSales = filteredSales.filter(s => s.customer_id === customer.customer_id);
      const totalRevenue = customerSales.reduce((sum, s) => sum + s.amount_usd, 0);
      return { customer, totalRevenue, sales: customerSales };
    }).filter(c => c.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 3);

    // Aggregate by month
    const monthlyData: Record<string, any> = {};
    customerTotals.forEach(({ customer, sales }) => {
      sales.forEach(sale => {
        const monthKey = new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { month: monthKey };
        if (!monthlyData[monthKey][customer.name]) monthlyData[monthKey][customer.name] = 0;
        monthlyData[monthKey][customer.name] += sale.amount_usd;
      });
    });

    return Object.values(monthlyData).sort((a: any, b: any) =>
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );
  }, [timeRange, selectedSegment]);

  const top3CustomerNames = useMemo(() => {
    const startDate = getDateRange(timeRange);
    const filteredSales = demoSales.filter(sale => new Date(sale.date) >= startDate);

    return demoCustomers.map(customer => {
      const customerSales = filteredSales.filter(s => s.customer_id === customer.customer_id);
      const totalRevenue = customerSales.reduce((sum, s) => sum + s.amount_usd, 0);
      return { name: customer.name, revenue: totalRevenue };
    }).filter(c => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map(c => c.name);
  }, [timeRange]);

  // Customer analysis for table
  const customerAnalysis = useMemo(() => {
    const startDate = getDateRange(timeRange);
    const filteredSales = demoSales.filter(sale => {
      const saleDate = new Date(sale.date);
      const matchesTime = saleDate >= startDate;
      if (selectedSegment === 'all') return matchesTime;
      const customer = demoCustomers.find(c => c.customer_id === sale.customer_id);
      return matchesTime && customer?.segment === selectedSegment;
    });

    return demoCustomers.map(customer => {
      const customerSales = filteredSales.filter(s => s.customer_id === customer.customer_id);
      const totalRevenue = customerSales.reduce((sum, s) => sum + s.amount_usd, 0);
      const totalWeight = customerSales.reduce((sum, s) => sum + s.fine_weight_oz, 0);
      return {
        name: customer.name,
        segment: customer.segment,
        revenue: totalRevenue,
        weight: totalWeight,
        salesCount: customerSales.length,
      };
    }).filter(c => c.salesCount > 0).sort((a, b) => b.revenue - a.revenue);
  }, [timeRange, selectedSegment]);

  const totalRevenue = demoSales.reduce((sum, s) => sum + s.amount_usd, 0);
  const avgSaleSize = totalRevenue / demoSales.length;
  const topCustomer = customerAnalysis[0];

  const customerColors = ['#8b5cf6', '#06b6d4', '#f59e0b'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Detailed business insights and performance metrics</p>
        </div>

        {/* Filters Section */}
        <Card>
          <div className="p-4 bg-gray-50">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-700">Filters:</span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600" />
                <label className="text-sm text-gray-600">Time Range:</label>
                <Select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                  className="min-w-[150px]"
                >
                  <option value="3m">Last 3 Months</option>
                  <option value="6m">Last 6 Months</option>
                  <option value="12m">Last 12 Months</option>
                  <option value="all">All Time</option>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-600" />
                <label className="text-sm text-gray-600">Segment:</label>
                <Select
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value)}
                  className="min-w-[150px]"
                >
                  {segments.map(segment => (
                    <option key={segment} value={segment}>
                      {segment === 'all' ? 'All Segments' : segment}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* Key Insights */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Avg Sale Size</p>
                  <p className="text-lg font-bold text-gray-900">${(avgSaleSize / 1000).toFixed(1)}K</p>
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
                  <p className="text-xs text-gray-600">Total Batches</p>
                  <p className="text-lg font-bold text-gray-900">{demoBatches.length}</p>
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
                  <p className="text-xs text-gray-600">Top Customer</p>
                  <p className="text-sm font-bold text-gray-900">{topCustomer ? topCustomer.name.split(' ')[0] : 'HSBC'}</p>
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
                  <p className="text-lg font-bold text-gray-900">+18.5%</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sales Performance Over Time - MONTHLY */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Sales Performance Over Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [`$${value.toLocaleString()}`, 'Revenue'];
                    if (name === 'weight') return [`${value.toFixed(2)} oz`, 'Weight'];
                    return [value, name];
                  }} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#f59e0b" fill="#fbbf24" name="Revenue (USD)" />
                  <Area yAxisId="right" type="monotone" dataKey="weight" stroke="#3b82f6" fill="#60a5fa" name="Weight (oz)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Gold Price vs Sales Revenue - MONTHLY */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Gold Price vs Sales Revenue Correlation</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyPriceCorrelation}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" label={{ value: 'Price/oz (USD)', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Revenue (K)', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="price" stroke="#fbbf24" strokeWidth={2} name="Gold Price (USD/oz)" dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue (K)" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Top 3 Customers by Month */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Customers by Revenue</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCustomersMonthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                  <Legend />
                  {top3CustomerNames.map((name, index) => (
                    <Bar key={name} dataKey={name} fill={customerColors[index]} name={name} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Customer Performance Details */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Customer Performance Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Segment</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales Count</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Weight (oz)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Sale Size</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customerAnalysis.map(customer => (
                    <tr key={customer.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{customer.segment}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{customer.salesCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{customer.weight.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                        ${customer.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        ${(customer.revenue / customer.salesCount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
