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
  customer_id: string;
  invoice_number: string;
  expected_date: string;
  actual_date: string | null;
  due_date: string | null;
  amount: number;
  currency: string;
  fx_rate: number;
  payment_method: string;
  status: string;
  sale_number: string;
  customer_name: string;
  customer_email: string;
  company_name: string;
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

      const { data, error } = await supabase
        .from('payments_with_details')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPayments(data || []);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      addToast('Failed to load payments', 'error');
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

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.sale_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || payment.payment_status_category === statusFilter;

    const matchesDate = (() => {
      if (dateFilter === 'all') return true;
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
      render: (payment: Payment) => (
        <div>
          <div className="font-medium text-gray-900">{payment.invoice_number || 'N/A'}</div>
          <div className="text-sm text-gray-500">{payment.sale_number}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (payment: Payment) => (
        <div>
          <div className="font-medium text-gray-900">{payment.customer_name || 'N/A'}</div>
          <div className="text-sm text-gray-500">{payment.company_name || payment.customer_email}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (payment: Payment) => (
        <div>
          <div className="font-semibold text-gray-900">
            {formatCurrency(payment.amount, payment.currency)}
          </div>
          <div className="text-xs text-gray-500">{payment.currency}</div>
        </div>
      ),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (payment: Payment) => (
        <div>
          <div className="text-sm text-gray-900">{formatDate(payment.due_date)}</div>
          {payment.days_overdue && payment.days_overdue > 0 && (
            <div className="text-xs text-red-600 font-medium">
              {payment.days_overdue} days overdue
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'payment_method',
      label: 'Method',
      render: (payment: Payment) => (
        <div className="text-sm text-gray-700">
          {payment.payment_method ? payment.payment_method.replace(/_/g, ' ').toUpperCase() : 'N/A'}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (payment: Payment) => (
        <StatusBadge
          label={payment.payment_status_category}
          variant={getStatusVariant(payment.payment_status_category)}
        />
      ),
    },
    {
      key: 'documents',
      label: 'Docs',
      render: (payment: Payment) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{payment.document_count || 0}</span>
          {payment.proof_count > 0 && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (payment: Payment) => (
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
      ),
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
