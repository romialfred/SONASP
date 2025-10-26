import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Mail, Phone, MapPin, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { formatCurrency } from '@/utils/salesUtils';

interface Transaction {
  id: string;
  saleNumber: string;
  date: string;
  amount: number;
  quantity: number;
  status: 'completed' | 'pending' | 'payment_pending';
}

export function CustomerProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'communications'>('overview');

  const mockCustomers = [
    {
      id: '1',
      name: 'Premium Gold Ltd.',
      email: 'contact@premiumgold.com',
      phone: '+41 44 123 4567',
      country: 'Switzerland',
      address: 'Bahnhofstrasse 45, 8001 Zurich',
      contactPerson: 'Hans Mueller',
      taxId: 'CHE-123.456.789',
      registeredDate: '2022-03-15',
      status: 'active',
      paymentTerms: 'Net 30 days',
      creditLimit: 500000,
      totalPurchases: 45,
      totalSpent: 6780450,
      averageOrderValue: 150676,
      paymentRate: 98.5,
      lastPurchaseDate: '2024-10-20',
    },
    {
      id: '2',
      name: 'Global Metals Inc.',
      email: 'sales@globalmetals.com',
      phone: '+971 4 567 8901',
      country: 'UAE',
      address: 'Sheikh Zayed Road, Dubai',
      contactPerson: 'Ahmed Al-Maktoum',
      taxId: 'TRN-987654321',
      registeredDate: '2022-06-10',
      status: 'active',
      paymentTerms: 'Net 45 days',
      creditLimit: 750000,
      totalPurchases: 38,
      totalSpent: 5432100,
      averageOrderValue: 142950,
      paymentRate: 95.2,
      lastPurchaseDate: '2024-10-18',
    },
    {
      id: '3',
      name: 'Swiss Refineries SA',
      email: 'info@swissref.ch',
      phone: '+41 22 987 6543',
      country: 'Switzerland',
      address: 'Rue du Rhone 100, 1204 Geneva',
      contactPerson: 'Pierre Dubois',
      taxId: 'CHE-987.654.321',
      registeredDate: '2021-11-20',
      status: 'active',
      paymentTerms: 'Net 30 days',
      creditLimit: 1000000,
      totalPurchases: 52,
      totalSpent: 8901230,
      averageOrderValue: 171178,
      paymentRate: 99.1,
      lastPurchaseDate: '2024-10-22',
    },
    {
      id: '4',
      name: 'Asian Gold Trading',
      email: 'trading@asiangold.com',
      phone: '+65 6789 1234',
      country: 'Singapore',
      address: 'Marina Bay Financial Centre',
      contactPerson: 'Li Wei',
      taxId: 'GST-456789123',
      registeredDate: '2023-01-12',
      status: 'inactive',
      paymentTerms: 'Net 60 days',
      creditLimit: 600000,
      totalPurchases: 29,
      totalSpent: 4123890,
      averageOrderValue: 142203,
      paymentRate: 92.8,
      lastPurchaseDate: '2024-09-15',
    },
  ];

  const customer = mockCustomers.find((c) => c.id === id) || mockCustomers[0];

  const transactions: Transaction[] = [
    {
      id: '1',
      saleNumber: 'SL-2024-042',
      date: '2024-10-20',
      amount: 156450,
      quantity: 42.5,
      status: 'completed',
    },
    {
      id: '2',
      saleNumber: 'SL-2024-038',
      date: '2024-10-15',
      amount: 142300,
      quantity: 38.8,
      status: 'completed',
    },
    {
      id: '3',
      saleNumber: 'SL-2024-035',
      date: '2024-10-10',
      amount: 168900,
      quantity: 45.2,
      status: 'payment_pending',
    },
  ];

  const performanceData = [
    { month: 'Apr', purchases: 3, amount: 425 },
    { month: 'May', purchases: 4, amount: 582 },
    { month: 'Jun', purchases: 5, amount: 695 },
    { month: 'Jul', purchases: 4, amount: 612 },
    { month: 'Aug', purchases: 5, amount: 748 },
    { month: 'Sep', purchases: 6, amount: 823 },
    { month: 'Oct', purchases: 5, amount: 768 },
  ];

  const columns = [
    { key: 'saleNumber', label: 'Sale Number' },
    {
      key: 'date',
      label: 'Date',
      render: (tx: Transaction) => new Date(tx.date).toLocaleDateString(),
    },
    {
      key: 'quantity',
      label: 'Quantity (oz)',
      render: (tx: Transaction) => tx.quantity.toFixed(3),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (tx: Transaction) => formatCurrency(tx.amount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (tx: Transaction) => {
        const statusMap = {
          completed: { label: 'Completed', variant: 'success' as const },
          pending: { label: 'Pending', variant: 'warning' as const },
          payment_pending: { label: 'Payment Pending', variant: 'info' as const },
        };
        const status = statusMap[tx.status] || { label: 'Unknown', variant: 'neutral' as const };
        return <StatusBadge label={status.label} variant={status.variant} />;
      },
    },
  ];

  const activeSales = [
    { saleNumber: 'SL-2024-044', status: 'pending', amount: 178900 },
    { saleNumber: 'SL-2024-045', status: 'approved', amount: 156200 },
  ];

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/customers')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {customer.name}
            </h1>
            <p className="text-gray-600 mt-1">Customer Profile</p>
          </div>
          <StatusBadge
            label={customer.status === 'active' ? 'Active' : 'Inactive'}
            variant={customer.status === 'active' ? 'success' : 'neutral'}
          />
          <Button
            variant="outline"
            onClick={() => navigate(`/customers/${id}/edit`)}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p className="text-sm text-gray-900">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Phone</p>
                      <p className="text-sm text-gray-900">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Address</p>
                      <p className="text-sm text-gray-900">{customer.address}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Contact Person</p>
                    <p className="text-sm text-gray-900 mt-1">{customer.contactPerson}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tax ID</p>
                    <p className="text-sm text-gray-900 mt-1">{customer.taxId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Payment Terms</p>
                    <p className="text-sm text-gray-900 mt-1">{customer.paymentTerms}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Transaction History</CardTitle>
                  <div className="flex gap-2">
                    <button
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        activeTab === 'overview'
                          ? 'bg-primary-100 text-primary-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      onClick={() => setActiveTab('overview')}
                    >
                      Overview
                    </button>
                    <button
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        activeTab === 'transactions'
                          ? 'bg-primary-100 text-primary-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      onClick={() => setActiveTab('transactions')}
                    >
                      All Transactions
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {activeTab === 'overview' && (
                  <LineChartWidget
                    data={performanceData}
                    lines={[
                      { dataKey: 'amount', color: '#B8860B', name: 'Purchase Amount ($K)' },
                    ]}
                    height={300}
                  />
                )}
                {activeTab === 'transactions' && (
                  <Table
                    columns={columns}
                    data={transactions}
                    onRowClick={(tx) => navigate(`/sales/${tx.id}`)}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Purchases</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{customer.totalPurchases}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Spent</p>
                    <p className="text-2xl font-bold text-primary-700 mt-1">
                      {formatCurrency(customer.totalSpent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Avg Order Value</p>
                    <p className="text-xl font-semibold text-gray-900 mt-1">
                      {formatCurrency(customer.averageOrderValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Payment Success Rate</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xl font-semibold text-accent-600">
                        {customer.paymentRate ?? 0}%
                      </p>
                      <TrendingUp className="h-4 w-4 text-accent-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Last Purchase</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {new Date(customer.lastPurchaseDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeSales.map((sale) => (
                    <div
                      key={sale.saleNumber}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/sales/${sale.saleNumber}`)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-semibold text-gray-900">{sale.saleNumber}</p>
                        <StatusBadge
                          label={sale.status}
                          variant={sale.status === 'approved' ? 'success' : 'warning'}
                        />
                      </div>
                      <p className="text-sm text-gray-600">{formatCurrency(sale.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/sales/new')}
                    className="w-full"
                  >
                    Create New Sale
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/customers/${id}/payments`)}
                    className="w-full"
                  >
                    View Payments
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => console.log('Send email')}
                    className="w-full"
                  >
                    Send Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
