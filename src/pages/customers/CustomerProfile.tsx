import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Mail, Phone, MapPin, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { formatCurrency } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/ui/Loading';
import { Alert } from '@/components/ui/Alert';

interface Transaction {
  id: string;
  saleNumber: string;
  date: string;
  amount: number;
  quantity: number;
  status: 'completed' | 'pending' | 'payment_pending';
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  contactPerson?: string;
  taxId?: string;
  registeredDate?: string;
  status: string;
  paymentTerms?: string;
  creditLimit?: number;
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
  paymentRate: number;
  lastPurchaseDate?: string;
}

export function CustomerProfile() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'communications'>('overview');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeSales, setActiveSales] = useState<Array<{ id: string; saleNumber: string; status: string; amount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomerDetails();
  }, [id]);

  const fetchCustomerDetails = async () => {
    if (!id) {
      setError('No customer ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch customer data
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        throw customerError;
      }

      if (!customerData) {
        setError('Customer not found');
        setLoading(false);
        return;
      }

      // Fetch sales data for this customer
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('quantity_oz, final_proceeds, created_at, status')
        .eq('customer_id', id)
        .in('status', ['approved', 'customer_approved', 'payment_received', 'completed']);

      if (salesError) {
        console.error('Error fetching sales:', salesError);
      }

      // Calculate metrics
      const sales = salesData || [];
      const totalPurchases = sales.length;
      const totalSpent = sales.reduce((sum, sale) => sum + parseFloat(sale.final_proceeds || '0'), 0);
      const averageOrderValue = totalPurchases > 0 ? totalSpent / totalPurchases : 0;

      // Find last purchase date
      const sortedSales = sales.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastPurchaseDate = sortedSales.length > 0 ? sortedSales[0].created_at : undefined;

      // Payment rate (placeholder - would need payment data to calculate)
      const paymentRate = 0;

      // Fetch active sales for this customer
      const { data: activeSalesData, error: activeSalesError } = await supabase
        .from('sales')
        .select('id, sale_number, status, final_proceeds')
        .eq('customer_id', id)
        .in('status', ['pending', 'customer_pending', 'approved', 'customer_approved'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (activeSalesError) {
        console.error('Error fetching active sales:', activeSalesError);
      }

      // Map active sales data
      const mappedActiveSales = (activeSalesData || []).map(sale => ({
        id: sale.id,
        saleNumber: sale.sale_number,
        status: sale.status,
        amount: parseFloat(sale.final_proceeds || '0')
      }));

      setCustomer({
        id: customerData.id,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone || 'N/A',
        country: customerData.country,
        address: customerData.address || 'N/A',
        contactPerson: customerData.contact_person || 'N/A',
        taxId: customerData.tax_id || 'N/A',
        registeredDate: customerData.created_at,
        status: customerData.status || 'active',
        paymentTerms: customerData.payment_terms || 'Net 30 days',
        creditLimit: customerData.credit_limit || 0,
        totalPurchases,
        totalSpent,
        averageOrderValue,
        paymentRate,
        lastPurchaseDate,
      });

      setActiveSales(mappedActiveSales);
    } catch (err) {
      console.error('Error loading customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customer details');
    } finally {
      setLoading(false);
    }
  };

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

  // Active sales now fetched from database in useEffect

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (error || !customer) {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto py-12 space-y-6">
          <Alert variant="error" title="Unable to load customer">
            {error || 'Customer not found'}
          </Alert>
          <div className="flex justify-center">
            <Button onClick={() => navigate('/customers')}>
              Back to Customers
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

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
                {activeSales.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500">No active sales for this customer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeSales.map((sale) => {
                      const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' }> = {
                        pending: { label: 'Pending', variant: 'warning' },
                        customer_pending: { label: 'Customer Pending', variant: 'info' },
                        approved: { label: 'Approved', variant: 'success' },
                        customer_approved: { label: 'Customer Approved', variant: 'success' },
                      };
                      const statusInfo = statusMap[sale.status] || { label: sale.status, variant: 'neutral' as const };

                      return (
                        <div
                          key={sale.id}
                          className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => navigate(`/sales/${sale.id}`)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-semibold text-gray-900">{sale.saleNumber}</p>
                            <StatusBadge
                              label={statusInfo.label}
                              variant={statusInfo.variant}
                            />
                          </div>
                          <p className="text-sm text-gray-600">{formatCurrency(sale.amount)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
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
