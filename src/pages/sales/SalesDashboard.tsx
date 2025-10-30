import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus, ArrowRight, XCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { formatCurrency, formatWeight } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';
import {
  saleSummaryListSchema,
  normalizeSaleStatus,
  extractCustomerName,
  SaleStatus,
} from '@/lib/schemas/sales';

interface Sale {
  id: string;
  saleNumber: string;
  customer: string;
  quantity: number;
  amount: number;
  status: SaleStatus;
  createdDate: string;
}

type StatusDisplay = {
  label: string;
  color: string;
  icon: LucideIcon;
};

const STATUS_DISPLAY_MAP: Partial<Record<SaleStatus, StatusDisplay>> & {
  pending: StatusDisplay;
} = {
  pending: {
    label: 'Pending Approval',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: Clock,
  },
  approved: {
    label: 'Management Approved',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: CheckCircle,
  },
  customer_approved: {
    label: 'Customer Approved',
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: CheckCircle,
  },
  payment_received: {
    label: 'Payment Received',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: DollarSign,
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: XCircle,
  },
};

export function SalesDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SaleStatus>('all');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const [metrics, setMetrics] = useState({
    availableInventory: 0,
    pendingSales: 0,
    monthlyRevenue: 0,
    completedSales: 0,
    pendingPayment: 0,
  });
  const [monthlySalesData, setMonthlySalesData] = useState<Array<{ name: string; sales: number; revenue: number }>>([]);
  const [customerPerformance, setCustomerPerformance] = useState({
    topCustomer: 'N/A',
    avgOrderValue: 0,
    paymentSuccessRate: 0,
  });

  const loadMetrics = useCallback(async () => {
    try {
      console.log('[SalesDashboard] Loading metrics...');

      // Load sales metrics first (this is critical)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('status, final_proceeds, created_at');

      if (salesError) {
        console.error('[SalesDashboard] Error loading sales:', salesError);
        throw salesError;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const pending = salesData?.filter(s => s.status === 'approved' || s.status === 'customer_pending')?.length || 0;
      const monthlyRevenue = salesData?.filter(s => new Date(s.created_at) >= startOfMonth && (s.status === 'completed' || s.status === 'payment_received'))?.reduce((sum, s) => sum + (s.final_proceeds || 0), 0) || 0;
      const completedThisMonth = salesData?.filter(s => new Date(s.created_at) >= startOfMonth && (s.status === 'completed' || s.status === 'payment_received'))?.length || 0;
      const pendingPayment = salesData?.filter(s => s.status === 'customer_approved' || s.status === 'waiting_for_payment')?.length || 0;

      // Try to load inventory (optional - won't break if table doesn't exist)
      let totalInventory = 0;
      try {
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('gold_inventory')
          .select('available_for_sale_oz')
          .eq('is_active', true);

        if (inventoryError) {
          console.warn('[SalesDashboard] gold_inventory table not available or column missing:', inventoryError.message);
          // Fallback: calculate from batches
          const { data: batchesData } = await supabase
            .from('batches')
            .select('final_weight_oz')
            .eq('status', 'available_for_sale');

          totalInventory = batchesData?.reduce((sum, b) => sum + (b.final_weight_oz || 0), 0) || 0;
        } else {
          totalInventory = inventoryData?.reduce((sum, item) => sum + (item.available_for_sale_oz || 0), 0) || 0;
        }
      } catch (invError) {
        console.warn('[SalesDashboard] Inventory check failed, using 0:', invError);
        totalInventory = 0;
      }

      console.log('[SalesDashboard] Metrics loaded:', {
        totalInventory,
        pending,
        monthlyRevenue,
        completedThisMonth,
        pendingPayment
      });

      setMetrics({
        availableInventory: totalInventory,
        pendingSales: pending,
        monthlyRevenue,
        completedSales: completedThisMonth,
        pendingPayment,
      });
    } catch (error: any) {
      console.error('[SalesDashboard] Error loading metrics:', error);
      setPageError('Failed to load sales metrics: ' + error.message);
    }
  }, []);

  const loadMonthlySalesData = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sales')
        .select('created_at, final_proceeds, status')
        .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString());

      if (!data) {
        setMonthlySalesData([]);
        return;
      }

      const monthlyData: Record<string, { sales: number; revenue: number }> = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      months.forEach((month, index) => {
        monthlyData[month] = { sales: 0, revenue: 0 };
      });

      data.forEach(sale => {
        const date = new Date(sale.created_at);
        const monthName = months[date.getMonth()];
        if (monthlyData[monthName]) {
          monthlyData[monthName].sales += 1;
          if (sale.status === 'completed' || sale.status === 'payment_received') {
            monthlyData[monthName].revenue += sale.final_proceeds || 0;
          }
        }
      });

      const chartData = months.map(month => ({
        name: month,
        sales: monthlyData[month].sales,
        revenue: Math.round(monthlyData[month].revenue / 1000),
      }));

      setMonthlySalesData(chartData);
    } catch (error) {
      console.error('Error loading monthly sales data:', error);
      setMonthlySalesData([]);
    }
  }, []);

  const loadCustomerPerformance = useCallback(async () => {
    try {
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          final_proceeds,
          customer:customers(name),
          status
        `);

      if (!salesData || salesData.length === 0) {
        return;
      }

      const customerTotals: Record<string, number> = {};
      let totalCompleted = 0;
      let totalSales = 0;

      salesData.forEach(sale => {
        const customerName = (sale.customer as any)?.name || 'Unknown';
        if (!customerTotals[customerName]) {
          customerTotals[customerName] = 0;
        }
        customerTotals[customerName] += sale.final_proceeds || 0;
        totalSales += sale.final_proceeds || 0;

        if (sale.status === 'completed' || sale.status === 'payment_received') {
          totalCompleted++;
        }
      });

      const topCustomer = Object.entries(customerTotals).sort((a, b) => b[1] - a[1])[0];
      const avgOrderValue = salesData.length > 0 ? totalSales / salesData.length : 0;
      const paymentSuccessRate = salesData.length > 0 ? (totalCompleted / salesData.length) * 100 : 0;

      setCustomerPerformance({
        topCustomer: topCustomer ? topCustomer[0] : 'N/A',
        avgOrderValue,
        paymentSuccessRate,
      });
    } catch (error) {
      console.error('Error loading customer performance:', error);
    }
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const query = supabase
        .from('sales')
        .select(`
          *,
          customer:customers(name, email, country)
        `)
        .order('created_at', { ascending: false });

      const response = await query;

      if (response.error) {
        throw response.error;
      }

      const supabaseData = Array.isArray(response.data) ? response.data : [];
      const parsed = saleSummaryListSchema.safeParse(supabaseData);

      if (!parsed.success) {
        console.error('Sales data validation failed', parsed.error.issues);
        if (!mountedRef.current) {
          return;
        }
        setSales([]);
        setPageError('We received unexpected sales data. Please try again in a moment.');
        return;
      }

      if (!mountedRef.current) {
        return;
      }

      const salesData: Sale[] = parsed.data.map((sale) => ({
        id: sale.id,
        saleNumber: sale.sale_number,
        customer: extractCustomerName(sale.customer),
        quantity: sale.quantity_oz,
        amount: sale.final_proceeds,
        status: normalizeSaleStatus(sale.status ?? undefined),
        createdDate: sale.created_at,
      }));

      setSales(salesData);

      await Promise.all([
        loadMetrics(),
        loadMonthlySalesData(),
        loadCustomerPerformance(),
      ]);
    } catch (error) {
      console.error('Error fetching sales:', error);
      if (!mountedRef.current) {
        return;
      }
      setPageError(
        error instanceof Error ? error.message : 'Failed to load sales. Please try again.'
      );
      setSales([]);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [loadMetrics, loadMonthlySalesData, loadCustomerPerformance]);

  useEffect(() => {
    mountedRef.current = true;
    void loadSales();

    return () => {
      mountedRef.current = false;
    };
  }, [loadSales]);

  const handleRetry = () => {
      if (!mountedRef.current) {
        return;
      }
      void loadSales();
  };

  const metricsDisplay = [
    {
      title: 'Available Inventory',
      value: formatWeight(metrics.availableInventory, 'oz'),
      change: 'Fine gold ready for sale',
      changeType: 'neutral' as const,
      icon: DollarSign,
      iconColor: 'text-primary-500',
    },
    {
      title: 'Pending Sales',
      value: String(metrics.pendingSales),
      change: 'Awaiting approval',
      changeType: 'neutral' as const,
      icon: Clock,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Monthly Revenue',
      value: formatCurrency(metrics.monthlyRevenue),
      change: 'Current month total',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Completed Sales (MTD)',
      value: String(metrics.completedSales),
      change: `${metrics.pendingPayment} pending payment`,
      changeType: 'neutral' as const,
      icon: CheckCircle,
      iconColor: 'text-accent-500',
    },
  ];

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.saleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('nav.sales')}
            </h1>
            <p className="text-gray-600 mt-1">Sales Management Dashboard</p>
          </div>
          <div className="relative group">
            <Button
              onClick={() => {
                void navigate('/sales/gold-trade-space');
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New Sale
            </Button>
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <p className="text-xs text-blue-900">
                <strong>Note:</strong> Sales can only be created through the Gold Trade Space module for proper pricing mechanism selection.
              </p>
            </div>
          </div>
        </div>

        {pageError && (
          <Alert
            variant="error"
            title="Sales data unavailable"
            className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          >
            <span>{pageError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleRetry();
                }}
              >
              Retry
            </Button>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metricsDisplay.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Sales Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChartWidget
                data={monthlySalesData}
                lines={[
                  { dataKey: 'revenue', color: '#B8860B', name: 'Revenue ($K)' },
                ]}
                height={250}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Top Customer</span>
                  <span className="text-sm font-semibold text-gray-900">{customerPerformance.topCustomer}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Avg Order Value</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(customerPerformance.avgOrderValue)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Payment Success Rate</span>
                  <span className="text-sm font-semibold text-accent-600">{customerPerformance.paymentSuccessRate.toFixed(1)}%</span>
                </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigate('/customers');
                    }}
                    className="w-full"
                  >
                  View All Customers
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Search by sale number or customer..."
                value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                  }}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <select
                value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as 'all' | SaleStatus);
                  }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Management Approved</option>
                <option value="customer_approved">Customer Approved</option>
                <option value="payment_received">Payment Received</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSales.map((sale) => {
                  const status = STATUS_DISPLAY_MAP[sale.status] ?? STATUS_DISPLAY_MAP.pending;
                const StatusIcon = status.icon;

                const unitPrice =
                  sale.quantity > 0 ? formatCurrency(sale.amount / sale.quantity) : 'N/A';

                return (
                    <div
                      key={sale.id}
                      onClick={() => {
                        void navigate(`/sales/${sale.id}`);
                      }}
                    className="group relative p-5 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:shadow-lg transition-all cursor-pointer bg-white"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-700 transition-colors">
                            {sale.saleNumber}
                          </h3>
                          <div className={`flex items-center gap-1 px-2.5 py-1 border rounded-full text-xs font-semibold ${status.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 font-medium">{sale.customer}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(sale.createdDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                        <p className="text-2xl font-bold text-primary-700">
                          {formatCurrency(sale.amount)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Quantity</p>
                        <p className="text-base font-semibold text-gray-900">
                          {sale.quantity.toFixed(3)} oz
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Price per oz</p>
                        <p className="text-base font-semibold text-gray-900">
                          {unitPrice}
                        </p>
                      </div>
                    </div>

                    <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-xs text-primary-600 font-semibold flex items-center gap-1">
                        View Details
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredSales.length === 0 && !pageError && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No sales found matching your criteria</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
