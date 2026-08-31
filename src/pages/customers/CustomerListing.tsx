import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, TrendingUp, DollarSign } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { formatCurrency } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/ui/Loading';

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
  paymentRate?: number;
}

export function CustomerListing() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      // Fetch customers from database
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, phone, country, address, status')
        .order('name');

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        throw customersError;
      }

      console.log('Fetched customers:', customersData);

      // Fetch sales data to calculate metrics
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('customer_id, quantity_oz, final_proceeds, created_at, status')
        .in('status', ['management_approved', 'customer_approved', 'payment_received', 'completed']);

      if (salesError) {
        console.error('Error fetching sales:', salesError);
      }

      console.log('Fetched sales:', salesData);

      // Calculate customer metrics
      const customersWithMetrics = (customersData || []).map(customer => {
        const customerSales = (salesData || []).filter(s => s.customer_id === customer.id);
        const totalPurchases = customerSales.length;

        // Calculate total spent with proper error handling
        let totalSpent = 0;
        customerSales.forEach(sale => {
          if (sale.final_proceeds !== null && sale.final_proceeds !== undefined) {
            const proceeds = Number(sale.final_proceeds);
            if (!isNaN(proceeds) && isFinite(proceeds)) {
              totalSpent += proceeds;
            }
          }
        });

        // Find last purchase date
        const sortedSales = customerSales.sort((a, b) =>
          (b.created_at ? new Date(b.created_at).getTime() : 0)
          - (a.created_at ? new Date(a.created_at).getTime() : 0)
        );
        const lastPurchaseDate = sortedSales[0]?.created_at ?? '';

        // Calculate payment rate based on completed sales
        const completedSales = customerSales.filter(s => s.status === 'completed' || s.status === 'payment_received');
        const paymentRate = totalPurchases > 0 ? (completedSales.length / totalPurchases) * 100 : 0;

        // Ensure status is valid with strict type checking
        let validStatus: 'active' | 'inactive' | 'pending' = 'active';
        const statusValue = customer.status as any;

        if (statusValue === 'active') {
          validStatus = 'active';
        } else if (statusValue === 'inactive') {
          validStatus = 'inactive';
        } else if (statusValue === 'pending') {
          validStatus = 'pending';
        } else {
          // Default to active for any other value (null, undefined, invalid)
          validStatus = 'active';
          console.warn(`Invalid status '${statusValue}' for customer ${customer.name}, defaulting to 'active'`);
        }

        // Ensure all numeric values are valid
        const finalTotalSpent = isNaN(totalSpent) || !isFinite(totalSpent) ? 0 : totalSpent;
        const finalPaymentRate = isNaN(paymentRate) || !isFinite(paymentRate) ? 0 : paymentRate;

        // Debug log for troubleshooting
        console.log(`Customer ${customer.name}:`, {
          rawStatus: customer.status,
          validStatus,
          totalPurchases,
          rawTotalSpent: totalSpent,
          finalTotalSpent,
          paymentRate: finalPaymentRate,
          salesCount: customerSales.length
        });

        if (finalTotalSpent === 0 && customerSales.length > 0) {
          console.log(`⚠️ Customer ${customer.name} has ${customerSales.length} sales but totalSpent is 0`, customerSales);
        }

        const customerResult = {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          country: customer.country,
          phone: customer.phone || 'N/A',
          totalPurchases,
          totalSpent: finalTotalSpent,
          lastPurchaseDate,
          status: validStatus,
          paymentRate: finalPaymentRate,
        } as Customer;

        return customerResult;
      });

      console.log('Customers with metrics:', customersWithMetrics);
      setCustomers(customersWithMetrics);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics from real data
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgOrderValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const activePercentage = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0;

  const metrics = [
    {
      title: 'Total Customers',
      value: totalCustomers.toString(),
      change: '+3 this quarter',
      changeType: 'positive' as const,
      icon: Users,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Active Customers',
      value: activeCustomers.toString(),
      change: `${activePercentage}% of total`,
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Total Revenue (YTD)',
      value: formatCurrency(totalRevenue),
      change: '+24% from last year',
      changeType: 'positive' as const,
      icon: DollarSign,
      iconColor: 'text-primary-500',
    },
    {
      title: 'Avg Order Value',
      value: formatCurrency(avgOrderValue),
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
      render: (customer: Customer) => {
        const rate = customer.paymentRate ?? 0;
        return (
          <span className={rate >= 95 ? 'text-accent-600' : 'text-orange-600'}>
            {rate.toFixed(1)}%
          </span>
        );
      },
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
        const status = statusMap[customer.status] || { label: 'Unknown', variant: 'neutral' as const };
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
              {t('nav.customers')}
            </h1>
            <p className="text-gray-600 mt-1">Customer Relationship Management</p>
          </div>
          <div className="flex gap-3">
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
