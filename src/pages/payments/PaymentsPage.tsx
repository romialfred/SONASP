import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Search, Filter, Download, Calendar,
  CheckCircle, Clock, XCircle, AlertCircle, FileText,
  TrendingUp, Users, Building2, ArrowUpRight
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

interface Payment {
  id: string;
  sale_id: string;
  customer_id: string; // Derived from sale
  invoice_number: string; // Derived/generated
  expected_date: string;
  actual_date: string | null;
  due_date: string | null; // Calculated from expected_date
  amount: number;
  currency: string;
  fx_rate: number;
  payment_method: string; // Derived from bank_name or reference
  status: string;
  sale_number: string; // From sale
  customer_name: string; // From customer
  customer_email: string; // From customer
  company_name: string; // From customer
  payment_status_category: string;
  days_overdue: number | null;
  document_count: number;
  proof_count: number;
  created_at: string;
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);

      // First fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      if (!paymentsData || paymentsData.length === 0) {
        setPayments([]);
        return;
      }

      // Then fetch related sales data
      const saleIds = [...new Set(paymentsData.map(p => p.sale_id).filter(Boolean))];
      let salesData = null;
      if (saleIds.length > 0) {
        const { data } = await supabase
          .from('sales')
          .select('id, sale_number, sale_date, total_amount, net_proceeds, status, london_am_rate, customer_id')
          .in('id', saleIds);
        salesData = data;
      }

      // Then fetch related customers data from sales
      const customerIds = [...new Set(salesData?.map(s => s.customer_id).filter(Boolean) || [])];
      let customersData = null;
      if (customerIds.length > 0) {
        const { data } = await supabase
          .from('customers')
          .select('id, name, email, phone, country, contact_person')
          .in('id', customerIds);
        customersData = data;
      }

      // Create lookup maps
      const salesMap = new Map(salesData?.map(s => [s.id, s]) || []);
      const customersMap = new Map(customersData?.map(c => [c.id, c]) || []);

      const processedPayments = paymentsData
        .filter((payment: any) => payment && payment.id) // Filter out invalid payments
        .map((payment: any) => {
        const sale = salesMap.get(payment.sale_id) || null;
        const customer = sale ? customersMap.get(sale.customer_id) || null : null;

        // Calculate due date (expected date + 30 days grace period)
        const dueDate = payment.expected_date
          ? new Date(new Date(payment.expected_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null;

        const daysOverdue = dueDate
          ? Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let paymentStatusCategory = 'unknown';
        if (payment.status === 'approved') {
          paymentStatusCategory = 'paid';
        } else if (payment.status === 'pending' && daysOverdue && daysOverdue > 0) {
          paymentStatusCategory = 'overdue';
        } else if (payment.status === 'pending') {
          paymentStatusCategory = 'pending';
        } else if (payment.status === 'rejected') {
          paymentStatusCategory = 'rejected';
        }

        // Use payment.customer_id if available, otherwise fall back to sale.customer_id
        const effectiveCustomerId = payment.customer_id || sale?.customer_id;
        const effectiveCustomer = effectiveCustomerId ? customersMap.get(effectiveCustomerId) : null;

        return {
          id: payment.id,
          sale_id: payment.sale_id,
          customer_id: effectiveCustomerId || '',
          invoice_number: payment.invoice_number || `INV-${payment.id.slice(0, 8).toUpperCase()}`,
          expected_date: payment.expected_date,
          actual_date: payment.actual_date,
          due_date: dueDate,
          amount: payment.amount || 0,
          currency: payment.currency || 'USD',
          fx_rate: payment.fx_rate || 1,
          payment_method: payment.bank_name || 'Bank Transfer',
          status: payment.status || 'pending',
          sale_number: sale?.sale_number || 'N/A',
          customer_name: effectiveCustomer?.name || 'Unknown Customer',
          customer_email: effectiveCustomer?.email || 'N/A',
          company_name: effectiveCustomer?.contact_person || effectiveCustomer?.name || 'N/A',
          payment_status_category: paymentStatusCategory,
          days_overdue: daysOverdue && daysOverdue > 0 ? daysOverdue : null,
          document_count: 0,
          proof_count: payment.proof_url ? 1 : 0,
          created_at: payment.created_at,
        };
      });

      setPayments(processedPayments);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      addToast(`Failed to load payments: ${errorMessage}`, 'error');
      setPayments([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'overdue':
        return 'error';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredPayments = payments
    .filter((payment) => payment && payment.id) // Ensure payment is valid
    .filter((payment) => {
      const matchesSearch =
        payment.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.sale_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || payment.payment_status_category === statusFilter;

      const matchesDate = (() => {
        if (dateFilter === 'all') return true;
        if (!payment.created_at) return false;
        const today = new Date();
        const paymentDate = new Date(payment.created_at);
        const daysDiff = Math.floor((today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));

        switch (dateFilter) {
          case 'today':
            return daysDiff === 0;
          case 'week':
            return daysDiff <= 7;
          case 'month':
            return daysDiff <= 30;
          case 'quarter':
            return daysDiff <= 90;
          default:
            return true;
        }
      })();

      return matchesSearch && matchesStatus && matchesDate;
    });

  const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const paidAmount = filteredPayments
    .filter((p) => p.payment_status_category === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = filteredPayments
    .filter((p) => p.payment_status_category === 'pending')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const overdueCount = filteredPayments.filter((p) => p.payment_status_category === 'overdue').length;

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice',
      render: (_value: any, payment: Payment) => {
        if (!payment) return <div>N/A</div>;
        return (
          <div>
            <div className="font-medium text-gray-900">{payment.invoice_number || 'N/A'}</div>
            <div className="text-sm text-gray-500">{payment.sale_number || 'N/A'}</div>
          </div>
        );
      },
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_value: any, payment: Payment) => {
        if (!payment) return <div>N/A</div>;
        return (
          <div>
            <div className="font-medium text-gray-900">{payment.customer_name || 'N/A'}</div>
            <div className="text-sm text-gray-500">{payment.company_name || payment.customer_email || 'N/A'}</div>
          </div>
        );
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (_value: any, payment: Payment) => {
        if (!payment) return <div>N/A</div>;
        return (
          <div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(payment.amount || 0, payment.currency || 'USD')}
            </div>
            <div className="text-xs text-gray-500">{payment.currency || 'USD'}</div>
          </div>
        );
      },
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (_value: any, payment: Payment) => {
        if (!payment) return <div>N/A</div>;
        return (
          <div>
            <div className="text-sm text-gray-900">{formatDate(payment.due_date)}</div>
            {payment.days_overdue && payment.days_overdue > 0 && (
              <div className="text-xs text-red-600 font-medium">
                {payment.days_overdue} days overdue
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'payment_method',
      label: 'Method',
      render: (_value: any, payment: Payment) => {
        if (!payment) return <div>N/A</div>;
        return (
          <div className="text-sm text-gray-700">
            {payment.payment_method ? payment.payment_method.replace(/_/g, ' ').toUpperCase() : 'N/A'}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_value: any, payment: Payment) => {
        if (!payment) return <div>N/A</div>;
        return (
          <StatusBadge
            label={payment.payment_status_category || 'unknown'}
            variant={getStatusVariant(payment.payment_status_category || 'unknown')}
          />
        );
      },
    },
    {
      key: 'documents',
      label: 'Docs',
      render: (_value: any, payment: Payment) => {
        if (!payment) return <div>0</div>;
        return (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{payment.document_count || 0}</span>
            {payment.proof_count > 0 && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_value: any, payment: Payment) => {
        if (!payment) return <div>-</div>;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/payments/${payment.id}`);
            }}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">Payments</h1>
            <p className="text-gray-600 mt-1">Track and manage all customer payments</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/payments/create')}>
              <DollarSign className="h-4 w-4 mr-2" />
              Create Payment
            </Button>
            <Button variant="outline" onClick={() => {}}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Payments</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(totalAmount, 'USD')}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Paid</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {formatCurrency(paidAmount, 'USD')}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">
                    {formatCurrency(pendingAmount, 'USD')}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{overdueCount}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by invoice, customer, or sale..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <p className="mt-2 text-gray-600">Loading payments...</p>
                </div>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No payments found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <Table
                columns={columns}
                data={filteredPayments}
                onRowClick={(payment) => navigate(`/payments/${payment.id}`)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
