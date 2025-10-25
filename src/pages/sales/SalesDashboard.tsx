import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { formatCurrency, formatWeight } from '@/utils/salesUtils';

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

  const pendingSales: Sale[] = [
    {
      id: '1',
      saleNumber: 'SL-2024-042',
      customer: 'Premium Gold Ltd.',
      quantity: 42.5,
      amount: 156450,
      status: 'pending',
      createdDate: '2024-10-20',
    },
    {
      id: '2',
      saleNumber: 'SL-2024-043',
      customer: 'Global Metals Inc.',
      quantity: 38.2,
      amount: 140538,
      status: 'approved',
      createdDate: '2024-10-21',
    },
    {
      id: '3',
      saleNumber: 'SL-2024-044',
      customer: 'Swiss Refineries SA',
      quantity: 55.8,
      amount: 205242,
      status: 'customer_approved',
      createdDate: '2024-10-22',
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

  const columns = [
    { key: 'saleNumber', label: 'Sale Number' },
    { key: 'customer', label: 'Customer' },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (sale: Sale) => formatWeight(sale.quantity * 31.1035, 'oz'),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (sale: Sale) => formatCurrency(sale.amount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (sale: Sale) => {
        const statusMap = {
          pending: { label: 'Pending Approval', variant: 'warning' as const },
          approved: { label: 'Management Approved', variant: 'info' as const },
          customer_approved: { label: 'Customer Approved', variant: 'success' as const },
          payment_received: { label: 'Payment Received', variant: 'success' as const },
          completed: { label: 'Completed', variant: 'success' as const },
        };
        const status = statusMap[sale.status] || { label: sale.status, variant: 'info' as const };
        return <StatusBadge label={status.label} variant={status.variant} />;
      },
    },
    {
      key: 'createdDate',
      label: 'Created Date',
      render: (sale: Sale) => new Date(sale.createdDate).toLocaleDateString(),
    },
  ];

  const filteredSales = pendingSales.filter((sale) => {
    const matchesSearch =
      sale.saleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            <div className="mb-4 flex flex-wrap gap-4">
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
            <Table
              columns={columns}
              data={filteredSales}
              onRowClick={(sale) => navigate(`/sales/${sale.id}`)}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
