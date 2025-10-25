import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { demoSales, demoCustomers, demoGoldPrices, demoBatches } from '@/lib/demoSeed';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Package, Users } from 'lucide-react';

export function AnalyticsPage() {
  // Sales performance over time
  const salesByDate = demoSales.reduce((acc, sale) => {
    const date = new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.revenue += sale.amount_usd;
      existing.weight += sale.fine_weight_oz;
      existing.count += 1;
    } else {
      acc.push({ date, revenue: sale.amount_usd, weight: sale.fine_weight_oz, count: 1 });
    }
    return acc;
  }, [] as { date: string; revenue: number; weight: number; count: number }[]);

  // Customer analysis
  const customerAnalysis = demoCustomers.map(customer => {
    const customerSales = demoSales.filter(s => s.customer_id === customer.customer_id);
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

  // Gold price correlation with sales
  const priceVsSales = demoGoldPrices.slice(-7).map((price, index) => {
    const date = new Date(price.as_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const daySales = demoSales.filter(s => {
      const saleDate = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return saleDate === date;
    });
    const revenue = daySales.reduce((sum, s) => sum + s.amount_usd, 0);
    return {
      date,
      price: price.price_per_oz_usd,
      revenue: revenue / 1000, // in thousands
    };
  });

  // Batch processing efficiency
  const batchEfficiency = demoBatches.map(batch => ({
    id: batch.batch_id,
    weight: batch.gross_weight_g,
    purity: batch.purity_pct,
    status: batch.status,
  }));

  const totalRevenue = demoSales.reduce((sum, s) => sum + s.amount_usd, 0);
  const avgSaleSize = totalRevenue / demoSales.length;
  const topCustomer = customerAnalysis[0];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Detailed business insights and performance metrics</p>
        </div>

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
                  <p className="text-sm font-bold text-gray-900">{topCustomer.name.split(' ')[0]}</p>
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

        {/* Sales Performance */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Sales Performance Over Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesByDate}>
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

        {/* Gold Price vs Sales Revenue */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Gold Price vs Sales Revenue Correlation</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceVsSales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" label={{ value: 'Price/oz (USD)', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Revenue (K)', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="price" stroke="#fbbf24" strokeWidth={2} name="Gold Price (USD/oz)" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue (K)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Top Customers */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Customers by Revenue</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerAnalysis.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue (USD)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Customer Details Table */}
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
