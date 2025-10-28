import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, TrendingUp, Users, DollarSign, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { BarChartWidget } from '@/components/charts/BarChartWidget';

interface DashboardStats {
  ytdRevenue: number;
  thisMonthRevenue: number;
  previousMonthRevenue: number;
  activeBatches: number;
  activeCustomers: number;
  monthlyGrowth: number;
}

interface MonthlySale {
  month: string;
  revenue: number;
  quantity: number;
  salesCount: number;
}

interface RecentSale {
  id: string;
  sale_number: string;
  customer_name: string;
  total_amount: number;
  quantity_oz: number;
  sale_date: string;
  status: string;
}

export function Dashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch sales data with customers
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          total_amount,
          quantity_oz,
          sale_date,
          status,
          created_at,
          customer_id,
          customers (
            name
          )
        `)
        .order('sale_date', { ascending: false });

      if (salesError) throw salesError;

      // Fetch active batches count
      const { count: batchesCount, error: batchesError } = await supabase
        .from('batches')
        .select('*', { count: 'exact', head: true })
        .in('status', ['created', 'validated_for_transport', 'received_airport', 'received_refinery', 'processing']);

      if (batchesError) throw batchesError;

      // Fetch active customers count
      const { count: customersCount, error: customersError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (customersError) throw customersError;

      // Calculate stats
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const ytdStart = new Date(currentYear, 0, 1);
      const thisMonthStart = new Date(currentYear, currentMonth, 1);
      const previousMonthStart = new Date(currentYear, currentMonth - 1, 1);
      const previousMonthEnd = new Date(currentYear, currentMonth, 0);

      let ytdRevenue = 0;
      let thisMonthRevenue = 0;
      let previousMonthRevenue = 0;

      salesData?.forEach((sale: any) => {
        const saleDate = new Date(sale.sale_date || sale.created_at);
        const amount = sale.total_amount || 0;

        if (saleDate >= ytdStart) {
          ytdRevenue += amount;
        }
        if (saleDate >= thisMonthStart) {
          thisMonthRevenue += amount;
        }
        if (saleDate >= previousMonthStart && saleDate <= previousMonthEnd) {
          previousMonthRevenue += amount;
        }
      });

      const monthlyGrowth = previousMonthRevenue > 0
        ? ((thisMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : 0;

      setStats({
        ytdRevenue,
        thisMonthRevenue,
        previousMonthRevenue,
        activeBatches: batchesCount || 0,
        activeCustomers: customersCount || 0,
        monthlyGrowth,
      });

      // Calculate monthly sales for last 12 months
      const monthlyData: { [key: string]: MonthlySale } = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Initialize last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyData[monthKey] = {
          month: monthLabel,
          revenue: 0,
          quantity: 0,
          salesCount: 0,
        };
      }

      // Aggregate sales by month
      salesData?.forEach((sale: any) => {
        const saleDate = new Date(sale.sale_date || sale.created_at);
        const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

        if (monthlyData[monthKey]) {
          monthlyData[monthKey].revenue += sale.total_amount || 0;
          monthlyData[monthKey].quantity += sale.quantity_oz || 0;
          monthlyData[monthKey].salesCount += 1;
        }
      });

      setMonthlySales(Object.values(monthlyData));

      // Get recent sales
      const recent = (salesData || []).slice(0, 10).map((sale: any) => ({
        id: sale.id,
        sale_number: sale.sale_number,
        customer_name: sale.customers?.name || 'Unknown',
        total_amount: sale.total_amount || 0,
        quantity_oz: sale.quantity_oz || 0,
        sale_date: sale.sale_date || sale.created_at,
        status: sale.status,
      }));

      setRecentSales(recent);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            {t('nav.dashboard')}
          </h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's an overview of your operations.</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Revenue Card with YTD, This Month, Previous Month */}
          <Card className="col-span-1 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-5 w-5 text-accent-500" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Year to Date (YTD)</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(stats?.ytdRevenue || 0)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">This Month</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(stats?.thisMonthRevenue || 0)}
                    </div>
                    {stats && stats.monthlyGrowth !== 0 && (
                      <div className={`flex items-center gap-1 text-xs mt-1 ${
                        stats.monthlyGrowth > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stats.monthlyGrowth > 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {Math.abs(stats.monthlyGrowth).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Previous Month</div>
                    <div className="text-lg font-semibold text-gray-600">
                      {formatCurrency(stats?.previousMonthRevenue || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Batches
              </CardTitle>
              <Package className="h-5 w-5 text-primary-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeBatches || 0}</div>
              <p className="text-xs text-gray-500 mt-1">In processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Customers
              </CardTitle>
              <Users className="h-5 w-5 text-secondary-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeCustomers || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Total customers</p>
            </CardContent>
          </Card>
        </div>

        {/* Last 12 Months Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Last 12 Months Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <LineChartWidget
                data={monthlySales.map(m => ({
                  name: m.month,
                  value: m.revenue,
                }))}
                dataKey="value"
                lineColor="#10B981"
                title=""
                showGrid
              />
            </div>
          </CardContent>
        </Card>

        {/* Monthly Sales Summary & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Sales Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Sales Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <BarChartWidget
                  data={monthlySales.slice(-6).map(m => ({
                    name: m.month,
                    value: m.salesCount,
                  }))}
                  dataKey="value"
                  barColor="#B8860B"
                  title=""
                  showGrid
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Sales Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {recentSales.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No recent sales</p>
                ) : (
                  recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-accent-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-gray-900 truncate">
                            {sale.sale_number}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            sale.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : sale.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {sale.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{sale.customer_name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(sale.total_amount)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatNumber(sale.quantity_oz)} oz
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(sale.sale_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
