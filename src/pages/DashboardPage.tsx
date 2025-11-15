import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { GoldPriceLive } from '@/components/dashboard/GoldPriceLive';
import { CustomerAccountsWidget } from '@/components/dashboard/CustomerAccountsWidget';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { DollarSign, Package, TrendingUp, ShoppingCart, Activity } from 'lucide-react';
import { ComposedChart, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { calculateInventoryMetrics } from '@/services/inventoryService';


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
              name
            )
          `)
          .gte('created_at', twelveMonthsAgo.toISOString())
          .order('created_at', { ascending: false });

        if (!salesError && salesData) {
          setSales(salesData as any);
        }

        // Calculate available stock from gold_inventory using the same method as InventoryManagement
        const metricsResult = await calculateInventoryMetrics();
        if (metricsResult.success) {
          setAvailableStock(metricsResult.metrics.availableStock);
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

  // Batch status distribution - Using actual BATCH_STATUSES
  const statusMapping: Record<string, string> = {
    [BATCH_STATUSES.PENDING_FACTORY_APPROVAL]: 'Created',
    [BATCH_STATUSES.APPROVED_FOR_TRANSPORT]: 'Approved for Transport',
    [BATCH_STATUSES.WAITING_AIRPORT_RECEIPT]: 'In Transit to Airport',
    [BATCH_STATUSES.RECEIVED_AT_AIRPORT]: 'At Airport',
    [BATCH_STATUSES.VALIDATED_FOR_REFINERY]: 'Validated for Refinery',
    [BATCH_STATUSES.WAITING_REFINERY_RECEIPT]: 'In Transit to Refinery',
    [BATCH_STATUSES.RECEIVED_AT_REFINERY]: 'At Refinery',
    [BATCH_STATUSES.VALIDATED_FOR_PROCESSING]: 'Ready for Processing',
    [BATCH_STATUSES.PROCESSING]: 'Processing',
    [BATCH_STATUSES.IN_INVENTORY]: 'In Inventory',
    [BATCH_STATUSES.READY_FOR_SALE]: 'Ready for Sale',
    [BATCH_STATUSES.ALLOCATED_TO_SALE]: 'Allocated',
    [BATCH_STATUSES.SOLD]: 'Sold',
    [BATCH_STATUSES.CANCELLED]: 'Cancelled',
  };

  const statusColors: Record<string, string> = {
    [BATCH_STATUSES.PENDING_FACTORY_APPROVAL]: '#94a3b8',
    [BATCH_STATUSES.APPROVED_FOR_TRANSPORT]: '#3b82f6',
    [BATCH_STATUSES.WAITING_AIRPORT_RECEIPT]: '#2563eb',
    [BATCH_STATUSES.RECEIVED_AT_AIRPORT]: '#f59e0b',
    [BATCH_STATUSES.VALIDATED_FOR_REFINERY]: '#8b5cf6',
    [BATCH_STATUSES.WAITING_REFINERY_RECEIPT]: '#a855f7',
    [BATCH_STATUSES.RECEIVED_AT_REFINERY]: '#ec4899',
    [BATCH_STATUSES.VALIDATED_FOR_PROCESSING]: '#14b8a6',
    [BATCH_STATUSES.PROCESSING]: '#f97316',
    [BATCH_STATUSES.IN_INVENTORY]: '#22c55e',
    [BATCH_STATUSES.READY_FOR_SALE]: '#10b981',
    [BATCH_STATUSES.ALLOCATED_TO_SALE]: '#84cc16',
    [BATCH_STATUSES.SOLD]: '#16a34a',
    [BATCH_STATUSES.CANCELLED]: '#ef4444',
  };

  const totalBatchesForChart = batches.length;
  const statusData = Object.keys(statusMapping)
    .map(status => {
      const count = batches.filter(b => b.status === status).length;
      const percentage = totalBatchesForChart > 0 ? ((count / totalBatchesForChart) * 100).toFixed(1) : '0.0';
      return {
        name: statusMapping[status],
        value: count,
        color: statusColors[status],
        displayName: `${statusMapping[status]} - ${count} (${percentage}%)`,
      };
    })
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
          <div className="relative bg-emerald-50/60 backdrop-blur-sm rounded-xl border border-emerald-200 p-4 hover:shadow-lg transition-all duration-200">
            <div className="absolute top-4 left-4 w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="pl-14">
              <p className="text-xs font-medium text-gray-600 mb-1">
                {t('dashboard.totalRevenue')}
              </p>
              <div className="space-y-0.5">
                <div className="text-xl font-bold text-gray-900">
                  ${totalRevenue > 0 ? (totalRevenue / 1000).toFixed(1) + 'K' : '0'}
                </div>
                <p className="text-xs text-gray-500">
                  {sales.length} {t('sales.completedSales')}
                </p>
              </div>
            </div>
          </div>

          <GoldPriceLive />

          <div className="relative bg-blue-50/60 backdrop-blur-sm rounded-xl border border-blue-200 p-4 hover:shadow-lg transition-all duration-200">
            <div className="absolute top-4 left-4 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="pl-14">
              <p className="text-xs font-medium text-gray-600 mb-1">
                {t('dashboard.activeBatches')}
              </p>
              <div className="space-y-0.5">
                <div className="text-xl font-bold text-gray-900">
                  {totalBatches}
                </div>
                <p className="text-xs text-gray-500">
                  {t('dashboard.processingInProgress')}
                </p>
              </div>
            </div>
          </div>

          <div className="relative bg-amber-50/60 backdrop-blur-sm rounded-xl border border-amber-200 p-4 hover:shadow-lg transition-all duration-200">
            <div className="absolute top-4 left-4 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div className="pl-14">
              <p className="text-xs font-medium text-gray-600 mb-1">
                {t('inventory.availableForSale')}
              </p>
              <div className="space-y-0.5">
                <div className="text-xl font-bold text-gray-900">
                  {availableStock.toFixed(2)} oz
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    ({(availableStock * 31.1035).toFixed(2)}g)
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {t('inventory.readyToSell')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Accounts Receivable Widget */}
        <CustomerAccountsWidget />

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
                <div className="h-96 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index, name }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius + 45;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          const percentage = totalBatchesForChart > 0 ? ((value / totalBatchesForChart) * 100).toFixed(0) : '0';

                          return (
                            <g>
                              <circle
                                cx={cx + (outerRadius + 20) * Math.cos(-midAngle * RADIAN)}
                                cy={cy + (outerRadius + 20) * Math.sin(-midAngle * RADIAN)}
                                r="4"
                                fill={statusData[index].color}
                              />
                              <text
                                x={x}
                                y={y - 10}
                                fill={statusData[index].color}
                                textAnchor={x > cx ? 'start' : 'end'}
                                dominantBaseline="central"
                                fontSize="11"
                                fontWeight="700"
                              >
                                {name.toUpperCase()}
                              </text>
                              <text
                                x={x}
                                y={y + 5}
                                fill="#374151"
                                textAnchor={x > cx ? 'start' : 'end'}
                                dominantBaseline="central"
                                fontSize="13"
                                fontWeight="600"
                              >
                                {`${value} (${percentage}%)`}
                              </text>
                            </g>
                          );
                        }}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string, props: any) => {
                          const percentage = totalBatchesForChart > 0 ? ((value / totalBatchesForChart) * 100).toFixed(1) : '0.0';
                          return [`${value} batches (${percentage}%)`, props.payload.name];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <div className="text-5xl font-bold text-gray-900">{totalBatchesForChart}</div>
                    <div className="text-xs font-medium text-gray-500 mt-1">Total Batches</div>
                  </div>
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

        {/* Recent Activity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Batch Activity */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Recent Batch Activity
              </h3>
              {batches.length > 0 ? (
                <div className="space-y-3">
                  {batches.slice(0, 5).map(batch => {
                    const statusLabel = statusMapping[batch.status] || batch.status;
                    return (
                      <div key={batch.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{batch.batch_number}</p>
                            <p className="text-sm text-gray-500">
                              {batch.weight_grams?.toFixed(0) || '0'} g ({batch.weight_ounces?.toFixed(2) || '0.00'} oz)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={batch.status} label={statusLabel} />
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(batch.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  No recent batch activity
                </div>
              )}
            </div>
          </Card>

          {/* Recent Sales Activity */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-600" />
                Recent Sales Activity
              </h3>
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
      </div>
    </MainLayout>
  );
}
