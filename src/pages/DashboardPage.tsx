import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, DollarSign, Package, Users, ShoppingCart } from 'lucide-react';
import { demoBatches, demoSales, demoCustomers, demoGoldPrices } from '@/lib/demoSeed';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function DashboardPage() {
  // Calculate metrics
  const totalBatches = demoBatches.length;
  const totalSales = demoSales.length;
  const totalCustomers = demoCustomers.length;
  const totalRevenue = demoSales.reduce((sum, sale) => sum + sale.amount_usd, 0);
  const totalWeight = demoSales.reduce((sum, sale) => sum + sale.fine_weight_oz, 0);

  const latestPrice = demoGoldPrices[demoGoldPrices.length - 1];
  const previousPrice = demoGoldPrices[demoGoldPrices.length - 2];
  const priceChange = latestPrice.price_per_oz_usd - previousPrice.price_per_oz_usd;
  const priceChangePercent = (priceChange / previousPrice.price_per_oz_usd) * 100;

  // Status distribution
  const statusData = [
    { name: 'Received', value: demoBatches.filter(b => b.status === 'Received').length, color: '#3b82f6' },
    { name: 'In Process', value: demoBatches.filter(b => b.status === 'In Process').length, color: '#f59e0b' },
    { name: 'Shipped', value: demoBatches.filter(b => b.status === 'Shipped').length, color: '#8b5cf6' },
    { name: 'Refined', value: demoBatches.filter(b => b.status === 'Refined').length, color: '#10b981' },
  ];

  // Sales by customer segment
  const segmentSales = demoCustomers.reduce((acc, customer) => {
    const customerSales = demoSales.filter(s => s.customer_id === customer.customer_id);
    const revenue = customerSales.reduce((sum, sale) => sum + sale.amount_usd, 0);

    const existing = acc.find(item => item.segment === customer.segment);
    if (existing) {
      existing.revenue += revenue;
    } else {
      acc.push({ segment: customer.segment, revenue });
    }
    return acc;
  }, [] as { segment: string; revenue: number }[]);

  // Recent sales trend
  const salesTrend = demoSales.slice(-7).map(sale => ({
    date: new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: sale.amount_usd,
  }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of gold sales operations</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${(totalRevenue / 1000).toFixed(0)}K
                  </p>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +12.5% vs last month
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Gold Price</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${latestPrice.price_per_oz_usd.toFixed(0)}
                  </p>
                  <p className={`text-xs mt-1 flex items-center gap-1 ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}% today
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Batches</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalBatches}</p>
                  <p className="text-xs text-gray-500 mt-1">{totalWeight.toFixed(1)} oz total</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalCustomers}</p>
                  <p className="text-xs text-gray-500 mt-1">{totalSales} sales completed</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Sales Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          {/* Batch Status Distribution */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Batch Status Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>

        {/* Revenue by Customer Segment */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue by Customer Segment</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentSales} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="category" dataKey="segment" />
                  <YAxis type="number" />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue (USD)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Sales Activity</h3>
            <div className="space-y-3">
              {demoSales.slice(-5).reverse().map(sale => {
                const customer = demoCustomers.find(c => c.customer_id === sale.customer_id);
                return (
                  <div key={sale.sale_id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer?.name}</p>
                        <p className="text-sm text-gray-500">{sale.fine_weight_oz.toFixed(2)} oz @ ${sale.price_per_oz_usd.toFixed(2)}/oz</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">${sale.amount_usd.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{new Date(sale.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
