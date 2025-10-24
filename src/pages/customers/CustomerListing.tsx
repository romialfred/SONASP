import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Download, TrendingUp, DollarSign } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { formatCurrency } from '@/utils/salesUtils';

interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
  phone: string;
  totalPurchases: number;
  totalSpent: number;
  lastPurchaseDate: string;
  status: 'active' | 'inactive' | 'pending';
  paymentRate: number;
}

export function CustomerListing() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const customers: Customer[] = [
    {
      id: '1',
      name: 'Premium Gold Ltd.',
      email: 'contact@premiumgold.com',
      country: 'Switzerland',
      phone: '+41 44 123 4567',
      totalPurchases: 45,
      totalSpent: 6780450,
      lastPurchaseDate: '2024-10-20',
      status: 'active',
      paymentRate: 98.5,
    },
    {
      id: '2',
      name: 'Global Metals Inc.',
      email: 'sales@globalmetals.com',
      country: 'UAE',
      phone: '+971 4 567 8901',
      totalPurchases: 38,
      totalSpent: 5432100,
      lastPurchaseDate: '2024-10-18',
      status: 'active',
      paymentRate: 95.2,
    },
    {
      id: '3',
      name: 'Swiss Refineries SA',
      email: 'info@swissref.ch',
      country: 'Switzerland',
      phone: '+41 22 987 6543',
      totalPurchases: 52,
      totalSpent: 8901230,
      lastPurchaseDate: '2024-10-22',
      status: 'active',
      paymentRate: 99.1,
    },
    {
      id: '4',
      name: 'Asian Gold Trading',
      email: 'trading@asiangold.com',
      country: 'Singapore',
      phone: '+65 6789 1234',
      totalPurchases: 29,
      totalSpent: 4123890,
      lastPurchaseDate: '2024-09-15',
      status: 'inactive',
      paymentRate: 92.8,
    },
  ];

  const metrics = [
    {
      title: 'Total Customers',
      value: '18',
      change: '+3 this quarter',
      changeType: 'positive' as const,
      icon: Users,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Active Customers',
      value: '15',
      change: '83% of total',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Total Revenue (YTD)',
      value: formatCurrency(25237670),
      change: '+24% from last year',
      changeType: 'positive' as const,
      icon: DollarSign,
      iconColor: 'text-primary-500',
    },
    {
      title: 'Avg Order Value',
      value: formatCurrency(158450),
      change: '+8% this quarter',
      changeType: 'positive' as const,
      icon: DollarSign,
      iconColor: 'text-accent-500',
    },
  ];

  const columns = [
    { key: 'name', label: 'Customer Name' },
    { key: 'country', label: 'Country' },
    { key: 'email', label: 'Email' },
    {
      key: 'totalPurchases',
      label: 'Purchases',
      render: (customer: Customer) => (
        <span className="font-medium">{customer.totalPurchases}</span>
      ),
    },
    {
      key: 'totalSpent',
      label: 'Total Spent',
      render: (customer: Customer) => formatCurrency(customer.totalSpent),
    },
    {
      key: 'paymentRate',
      label: 'Payment Rate',
      render: (customer: Customer) => (
        <span className={customer.paymentRate >= 95 ? 'text-accent-600' : 'text-orange-600'}>
          {customer.paymentRate.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (customer: Customer) => {
        const statusMap = {
          active: { label: 'Active', variant: 'success' as const },
          inactive: { label: 'Inactive', variant: 'neutral' as const },
          pending: { label: 'Pending', variant: 'warning' as const },
        };
        const status = statusMap[customer.status];
        return <StatusBadge label={status.label} variant={status.variant} />;
      },
    },
  ];

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = countryFilter === 'all' || customer.country === countryFilter;
    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
    return matchesSearch && matchesCountry && matchesStatus;
  });

  const countries = Array.from(new Set(customers.map((c) => c.country)));

  const handleExport = () => {
    console.log('Exporting customer data...');
  };

  return (
    <MainLayout userRole="management">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('nav.customers')}
            </h1>
            <p className="text-gray-600 mt-1">Customer Relationship Management</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              onClick={() => navigate('/customers/new')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Customer Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Countries</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <Table
              columns={columns}
              data={filteredCustomers}
              onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
