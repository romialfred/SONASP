import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { GoldPriceLive } from '@/components/dashboard/GoldPriceLive';
import { DollarSign, Package, TrendingUp, ShoppingCart } from 'lucide-react';
import { ComposedChart, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  created_at: string;
}

interface Sale {
  id: string;
  sale_number: string;
  customer_id: string;
  quantity_oz: number;
  london_am_rate: number;
  final_proceeds: number;
  created_at: string;
  customers?: {
    id: string;
    name: string;
    segment?: string;
  };
}

interface MonthlySale {
  month: string;
  monthDate: Date;
  quantity: number;
  goldPrice: number;
  revenue: number;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [availableStock, setAvailableStock] = useState(0);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);

      try {
        // Fetch batches
        const { data: batchesData, error: batchesError } = await supabase
          .from('batches')
          .select('id, batch_number, status, weight_grams, weight_ounces, created_at')
          .order('created_at', { ascending: false });

        if (!batchesError && batchesData) {
          setBatches(batchesData);
        }

        // Fetch sales with customer info (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select(`
            id,
            sale_number,
            customer_id,
            quantity_oz,
            london_am_rate,
            final_proceeds,
            created_at,
            customers (
              id,
              name,
              segment
            )
          `)
          .gte('created_at', twelveMonthsAgo.toISOString())
          .order('created_at', { ascending: false });

        if (!salesError && salesData) {
          setSales(salesData as any);
        }

        // Calculate available stock
        const { data: stockData, error: stockError } = await supabase
          .from('batches')
          .select('weight_ounces, status')
          .in('status', ['refined', 'ready_for_sale']);

        if (!stockError && stockData) {
          const totalStock = stockData.reduce((sum, batch) => sum + (batch.weight_ounces || 0), 0);
          setAvailableStock(totalStock);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  // Calculate metrics
  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.final_proceeds || 0), 0);
  const totalBatches = batches.length;

  // Group sales by month (last 12 months)
  const monthlySalesData: MonthlySale[] = [];
  const monthsMap = new Map<string, MonthlySale>();

  // Generate last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    monthsMap.set(monthKey, {
      month: monthLabel,
      monthDate: date,
      quantity: 0,
      goldPrice: 0,
      revenue: 0,
    });
  }

  // Aggregate sales by month
  sales.forEach(sale => {
    const saleDate = new Date(sale.created_at);
    const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

    if (monthsMap.has(monthKey)) {
      const monthData = monthsMap.get(monthKey)!;
      monthData.quantity += sale.quantity_oz || 0;
      monthData.revenue += sale.final_proceeds || 0;

      // Calculate average gold price for the month
      if (monthData.quantity > 0) {
        monthData.goldPrice = monthData.revenue / monthData.quantity;
      }
    }
  });

  monthsMap.forEach(value => monthlySalesData.push(value));

  // Format data for 12-month chart (Revenue in Millions)
  const twelveMonthChartData = monthlySalesData.map(m => ({
    month: m.month,
    revenue: m.revenue / 1000000, // Convert to millions
    goldPrice: m.goldPrice,
  }));

  // Batch status distribution
  const statusMapping: Record<string, string> = {
    'created': 'Created',
    'shipped': 'Shipped',
    'airport_received': 'Airport Received',
    'refinery_received': 'Refinery Received',
    'refined': 'Refined',
    'ready_for_sale': 'Ready for Sale',
    'sold': 'Sold',
  };

  const statusColors: Record<string, string> = {
    'created': '#9ca3af',
    'shipped': '#3b82f6',
    'airport_received': '#f59e0b',
    'refinery_received': '#8b5cf6',
    'refined': '#10b981',
    'ready_for_sale': '#22c55e',
    'sold': '#059669',
  };

  const statusData = Object.keys(statusMapping)
    .map(status => ({
      name: statusMapping[status],
      value: batches.filter(b => b.status === status).length,
      color: statusColors[status],
    }))
    .filter(item => item.value > 0);

  // Revenue by customer table data (monthly breakdown)
  const customerRevenueTable = monthlySalesData
    .filter(m => m.quantity > 0)
    .map(m => ({
      month: m.month,
      quantity: m.quantity.toFixed(2),
      goldPrice: m.goldPrice > 0 ? m.goldPrice.toFixed(2) : '0.00',
      netRevenue: m.revenue.toFixed(2),
    }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
          <p className="text-gray-600 mt-1">{t('dashboard.managementOverview')}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('dashboard.totalRevenue')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${totalRevenue > 0 ? (totalRevenue / 1000000).toFixed(2) + 'M' : '0'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{sales.length} {t('sales.completedSales')}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>

          <GoldPriceLive />

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('dashboard.activeBatches')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalBatches}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('dashboard.processingInProgress')}</p>
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
                  <p className="text-sm text-gray-600">{t('inventory.availableForSale')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {availableStock.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{t('batch.weightOunces')}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Last 12 Months Sales */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t('dashboard.salesPerformance')}</h3>
              {twelveMonthChartData.some(d => d.revenue > 0) ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={twelveMonthChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis
                        yAxisId="left"
                        label={{ value: 'Revenue (M$)', angle: -90, position: 'insideLeft' }}
                        fontSize={12}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: 'Gold Price ($/oz)', angle: 90, position: 'insideRight' }}
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'Revenue') return [`$${value.toFixed(2)}M`, name];
                          if (name === 'Gold Price') return [`$${value.toFixed(2)}/oz`, name];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="revenue"
                        fill="#f59e0b"
                        name="Revenue"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="goldPrice"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Gold Price"
                        dot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  No sales data available
                </div>
              )}
            </div>
          </Card>

          {/* Batch Status Distribution */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Batch Status Distribution</h3>
              {statusData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
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
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  No batch data available
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Revenue by Month Table */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Sales Summary</h3>
            {customerRevenueTable.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Month
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity (oz)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Gold Price ($/oz)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Net Revenue ($)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customerRevenueTable.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {row.month}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {row.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          ${row.goldPrice}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                          ${parseFloat(row.netRevenue).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        TOTAL
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                        {customerRevenueTable.reduce((sum, row) => sum + parseFloat(row.quantity), 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                        -
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                        ${customerRevenueTable.reduce((sum, row) => sum + parseFloat(row.netRevenue), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                No revenue data available
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Sales Activity</h3>
            {sales.length > 0 ? (
              <div className="space-y-3">
                {sales.slice(0, 5).map(sale => {
                  const customerName = sale.customers?.name || 'No Customer Name';
                  return (
                    <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{customerName}</p>
                          <p className="text-sm text-gray-500">
                            {sale.quantity_oz?.toFixed(2) || '0.00'} oz @ ${sale.london_am_rate?.toFixed(2) || '0.00'}/oz
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          ${(sale.final_proceeds || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(sale.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                No recent sales activity
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
