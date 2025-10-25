import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus, ArrowRight } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { formatCurrency, formatWeight } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';

interface Sale {
  id: string;
  saleNumber: string;
  customer: string;
  quantity: number;
  amount: number;
  status: 'pending' | 'approved' | 'customer_approved' | 'payment_received' | 'completed';
  createdDate: string;
}

export function SalesDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(name, email, country)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const salesData: Sale[] = (data || []).map(sale => ({
        id: sale.id,
        saleNumber: sale.sale_number,
        customer: sale.customer?.name || 'Unknown Customer',
        quantity: parseFloat(sale.quantity_oz || 0),
        amount: parseFloat(sale.final_proceeds || 0),
        status: sale.status,
        createdDate: sale.created_at
      }));

      setSales(salesData);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableInventory = {
    gold: 1250.5,
    silver: 450.2,
  };

  const metrics = [
    {
      title: 'Available Inventory',
      value: formatWeight(availableInventory.gold * 31.1035, 'oz'),
      change: '145.2g fine gold ready',
      changeType: 'neutral' as const,
      icon: DollarSign,
      iconColor: 'text-primary-500',
    },
    {
      title: 'Pending Sales',
      value: '8',
      change: 'Awaiting approval',
      changeType: 'neutral' as const,
      icon: Clock,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Monthly Revenue',
      value: formatCurrency(456780),
      change: '+18% from last month',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Completed Sales (MTD)',
      value: '23',
      change: '12 pending payment',
      changeType: 'neutral' as const,
      icon: CheckCircle,
      iconColor: 'text-accent-500',
    },
  ];


  const monthlySalesData = [
    { name: 'Jan', sales: 12, revenue: 420 },
    { name: 'Feb', sales: 14, revenue: 485 },
    { name: 'Mar', sales: 16, revenue: 532 },
    { name: 'Apr', sales: 18, revenue: 612 },
    { name: 'May', sales: 15, revenue: 521 },
    { name: 'Jun', sales: 20, revenue: 698 },
    { name: 'Jul', sales: 19, revenue: 654 },
    { name: 'Aug', sales: 21, revenue: 735 },
    { name: 'Sep', sales: 22, revenue: 768 },
    { name: 'Oct', sales: 23, revenue: 812 },
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
          <Button
            onClick={() => navigate('/sales/new')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Sale
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
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
                  <span className="text-sm font-semibold text-gray-900">Premium Gold Ltd.</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Avg Order Value</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(158450)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Payment Success Rate</span>
                  <span className="text-sm font-semibold text-accent-600">98.5%</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/customers')}
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Management Approved</option>
                <option value="customer_approved">Customer Approved</option>
                <option value="payment_received">Payment Received</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSales.map((sale) => {
                const statusConfig = {
                  pending: {
                    label: 'Pending Approval',
                    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                    icon: Clock
                  },
                  approved: {
                    label: 'Management Approved',
                    color: 'bg-blue-100 text-blue-800 border-blue-300',
                    icon: CheckCircle
                  },
                  customer_approved: {
                    label: 'Customer Approved',
                    color: 'bg-green-100 text-green-800 border-green-300',
                    icon: CheckCircle
                  },
                  payment_received: {
                    label: 'Payment Received',
                    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                    icon: DollarSign
                  },
                  completed: {
                    label: 'Completed',
                    color: 'bg-gray-100 text-gray-800 border-gray-300',
                    icon: CheckCircle
                  },
                };

                const status = statusConfig[sale.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={sale.id}
                    onClick={() => navigate(`/sales/${sale.id}`)}
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
                          {formatCurrency(sale.amount / sale.quantity)}
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

              {filteredSales.length === 0 && (
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
