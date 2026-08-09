import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Search, Download, CheckCircle, Clock, AlertCircle,
  FileText, Plus, RefreshCw, Zap, Calendar, CreditCard
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      if (!paymentsData || paymentsData.length === 0) {
        setPayments([]);
        return;
      }

      const saleIds = [...new Set(paymentsData.map(p => p.sale_id).filter(Boolean))];
      let salesData = null;
      if (saleIds.length > 0) {
        const { data } = await supabase
          .from('sales')
          .select('id, sale_number, sale_date, total_amount, net_proceeds, status, london_am_rate, customer_id')
          .in('id', saleIds);
        salesData = data;
      }

      const customerIds = [...new Set(salesData?.map(s => s.customer_id).filter(Boolean) || [])];
      let customersData = null;
      if (customerIds.length > 0) {
        const { data } = await supabase
          .from('customers')
          .select('id, name, email, phone, country, contact_person')
          .in('id', customerIds);
        customersData = data;
      }

      const salesMap = new Map(salesData?.map(s => [s.id, s]) || []);
      const customersMap = new Map(customersData?.map(c => [c.id, c]) || []);

      const processedPayments = paymentsData
        .filter((payment: any) => payment && payment.id)
        .map((payment: any) => {
          const sale = salesMap.get(payment.sale_id) || null;
          const customer = sale ? customersMap.get(sale.customer_id) || null : null;

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
      if (refresh) addToast('Payments refreshed successfully', 'success');
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      addToast(`Failed to load payments: ${error?.message || 'Unknown error'}`, 'error');
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      paid: { variant: 'success' as const, icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
      pending: { variant: 'warning' as const, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
      overdue: { variant: 'error' as const, icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
      rejected: { variant: 'error' as const, icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
      default: { variant: 'default' as const, icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-50' },
    };
    return configs[status as keyof typeof configs] || configs.default;
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));

    // Utiliser le symbole $ au lieu de USD
    const symbol = currency === 'USD' ? '$' : currency;
    return `${symbol}${formatted}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const translateStatus = (status: string) => {
    const translations: Record<string, string> = {
      'pending': 'En attente de paiement',
      'paid': 'Payé',
      'overdue': 'En retard',
      'rejected': 'Rejeté',
      'approved': 'Approuvé',
      'cancelled': 'Annulé',
    };
    return translations[status] || status;
  };

  const calculateDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredPayments = payments
    .filter((payment) => payment && payment.id)
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
          case 'today': return daysDiff === 0;
          case 'week': return daysDiff <= 7;
          case 'month': return daysDiff <= 30;
          case 'quarter': return daysDiff <= 90;
          default: return true;
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">Payments</h1>
            <p className="text-gray-600 mt-1">Track and manage all customer payments</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => fetchPayments(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => navigate('/payments/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Payment
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards with Gradients */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-1">Total Payments</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(totalAmount, 'USD')}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">{filteredPayments.length} transactions</p>
                </div>
                <div className="p-3 bg-blue-500 rounded-xl shadow-sm">
                  <DollarSign className="h-7 w-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-1">Paid</p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatCurrency(paidAmount, 'USD')}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {filteredPayments.filter(p => p.payment_status_category === 'paid').length} completed
                  </p>
                </div>
                <div className="p-3 bg-green-500 rounded-xl shadow-sm">
                  <CheckCircle className="h-7 w-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-1">Pending</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {formatCurrency(pendingAmount, 'USD')}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    {filteredPayments.filter(p => p.payment_status_category === 'pending').length} awaiting
                  </p>
                </div>
                <div className="p-3 bg-amber-500 rounded-xl shadow-sm">
                  <Clock className="h-7 w-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700 mb-1">Overdue</p>
                  <p className="text-3xl font-bold text-red-900">{overdueCount}</p>
                  <p className="text-xs text-red-600 mt-1">Require attention</p>
                </div>
                <div className="p-3 bg-red-500 rounded-xl shadow-sm">
                  <AlertCircle className="h-7 w-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Table Card */}
        <Card className="shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle>Payment Records</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{filteredPayments.length} records</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[250px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by invoice, customer, or sale..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white transition-all"
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
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white transition-all"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
                  <p className="mt-4 text-gray-600 font-medium">Loading payments...</p>
                </div>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-16">
                <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No payments found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
                <Button onClick={() => navigate('/payments/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Payment
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300 bg-gradient-to-r from-blue-600 to-blue-500">
                      <th className="px-3 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wide">
                        Numéro Vente
                      </th>
                      <th className="px-3 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wide">
                        Numéro Facture
                      </th>
                      <th className="px-3 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wide">
                        Montant
                      </th>
                      <th className="px-3 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wide">
                        Date d'échéance
                      </th>
                      <th className="px-3 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wide">
                        Échéance
                      </th>
                      <th className="px-3 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wide">
                        Méthode
                      </th>
                      <th className="px-3 py-3.5 text-center text-xs font-semibold text-white uppercase tracking-wide">
                        Statut
                      </th>
                      <th className="px-3 py-3.5 text-center text-xs font-semibold text-white uppercase tracking-wide">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredPayments.map((payment, index) => {
                      const statusConfig = getStatusConfig(payment.payment_status_category);
                      const daysUntilDue = calculateDaysUntilDue(payment.due_date);

                      // Couleurs alternées pour les lignes
                      const isEven = index % 2 === 0;
                      let rowBgColor = isEven ? 'bg-gray-50/50' : 'bg-white';

                      return (
                        <tr
                          key={payment.id}
                          className={`${rowBgColor} hover:bg-blue-50 transition-all duration-200 cursor-pointer group`}
                          onClick={() => navigate(`/payments/${payment.id}`)}
                        >
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs text-gray-900 font-medium">{payment.sale_number}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <FileText className={`h-3.5 w-3.5 ${statusConfig.color}`} />
                              <span className="text-xs text-gray-900 group-hover:text-blue-600 transition-colors">
                                {payment.invoice_number}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <span className="text-sm text-gray-900 font-semibold">
                              {formatCurrency(payment.amount, payment.currency)}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-700">{formatDate(payment.due_date)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {daysUntilDue !== null && (
                              <span className={`text-xs font-medium ${
                                daysUntilDue < 0
                                  ? 'text-red-600'
                                  : daysUntilDue <= 7
                                    ? 'text-orange-600'
                                    : 'text-gray-700'
                              }`}>
                                {daysUntilDue < 0
                                  ? `${Math.abs(daysUntilDue)} jours de retard`
                                  : `${daysUntilDue} jour${daysUntilDue > 1 ? 's' : ''}`
                                }
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <CreditCard className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-700">
                                {payment.payment_method?.replace(/_/g, ' ') || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              payment.payment_status_category === 'paid'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : payment.payment_status_category === 'pending'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : payment.payment_status_category === 'overdue'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : 'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}>
                              {translateStatus(payment.payment_status_category)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/payments/${payment.id}`);
                              }}
                              className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 group-hover:shadow-md transition-all"
                            >
                              <Zap className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
