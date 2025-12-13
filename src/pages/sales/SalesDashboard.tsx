import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus, ArrowRight, XCircle, Package, Award, Users, Building2, Factory, Truck, Calendar } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { formatCurrency, formatWeight } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  saleSummaryListSchema,
  normalizeSaleStatus,
  extractCustomerName,
  SaleStatus,
} from '@/lib/schemas/sales';
import { SALES_STATUSES } from '@/constants/salesStatuses';

interface Sale {
  id: string;
  saleNumber: string;
  customer: string;
  quantity: number;
  amount: number;
  royalty: number;
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
  create_sales: {
    label: 'Creating Sale',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: Clock,
  },
  pending: {
    label: 'Pending Approval',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: Clock,
  },
  pending_management_approval: {
    label: 'Pending Management Approval',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: Clock,
  },
  management_approved: {
    label: 'Management Approved',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: CheckCircle,
  },
  pending_for_customer_approval: {
    label: 'Pending Customer Approval',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
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
  waiting_for_payment: {
    label: 'Waiting for Payment',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: Clock,
  },
  virtual_payment: {
    label: 'Virtual Payment',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: DollarSign,
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
  management_rejected: {
    label: 'Management Rejected',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: XCircle,
  },
  customer_rejected: {
    label: 'Customer Rejected',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: XCircle,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: XCircle,
  },
} as const;

export function SalesDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SaleStatus>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const [revenueByCustomer, setRevenueByCustomer] = useState<any[]>([]);
  const [revenueByMiningCompany, setRevenueByMiningCompany] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    availableInventory: 0,
    pendingSales: 0,
    monthlyRevenue: 0,
    completedSales: 0,
    pendingPayment: 0,
    pendingPaymentAmount: 0,
    stakeholders: {
      miningCompanies: 0,
      customers: 0,
      refineries: 0,
      transportCompanies: 0,
    },
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

      const pending = salesData?.filter(s => s.status === SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL || s.status === SALES_STATUSES.CREATE_SALES)?.length || 0;
      const monthlyRevenue = salesData?.filter(s => new Date(s.created_at) >= startOfMonth && (s.status === SALES_STATUSES.COMPLETED || s.status === SALES_STATUSES.PAYMENT_RECEIVED))?.reduce((sum, s) => sum + (s.final_proceeds || 0), 0) || 0;
      const completedThisMonth = salesData?.filter(s => new Date(s.created_at) >= startOfMonth && (s.status === SALES_STATUSES.COMPLETED || s.status === SALES_STATUSES.PAYMENT_RECEIVED))?.length || 0;
      const pendingPayment = salesData?.filter(s => s.status === SALES_STATUSES.CUSTOMER_APPROVED || s.status === SALES_STATUSES.WAITING_FOR_PAYMENT)?.length || 0;
      const pendingPaymentAmount = salesData?.filter(s => s.status === SALES_STATUSES.CUSTOMER_APPROVED || s.status === SALES_STATUSES.WAITING_FOR_PAYMENT)?.reduce((sum, s) => sum + (s.final_proceeds || 0), 0) || 0;

      // Try to load inventory (optional - won't break if table doesn't exist)
      let totalInventory = 0;
      try {
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('gold_inventory')
          .select('quantity_available_oz')
          .eq('transaction_type', 'entry');

        if (inventoryError) {
          console.warn('[SalesDashboard] gold_inventory table not available or column missing:', inventoryError.message);
          // Fallback: calculate from batches
          const { data: batchesData } = await supabase
            .from('batches')
            .select('weight_ounces')
            .eq('status', 'processed');

          totalInventory = batchesData?.reduce((sum, b) => sum + (b.weight_ounces || 0), 0) || 0;
        } else {
          totalInventory = inventoryData?.reduce((sum, item) => sum + (item.quantity_available_oz || 0), 0) || 0;
        }
      } catch (invError) {
        console.warn('[SalesDashboard] Inventory check failed, using 0:', invError);
        totalInventory = 0;
      }

      // Load stakeholders data
      const [miningCompaniesResult, customersResult, refineriesResult, transportCompaniesResult] = await Promise.all([
        supabase.from('mining_companies').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('refineries').select('id', { count: 'exact', head: true }),
        supabase.from('transport_companies').select('id', { count: 'exact', head: true }),
      ]);

      const stakeholders = {
        miningCompanies: miningCompaniesResult.count || 0,
        customers: customersResult.count || 0,
        refineries: refineriesResult.count || 0,
        transportCompanies: transportCompaniesResult.count || 0,
      };

      console.log('[SalesDashboard] Metrics loaded:', {
        totalInventory,
        pending,
        monthlyRevenue,
        completedThisMonth,
        pendingPayment,
        stakeholders
      });

      setMetrics({
        availableInventory: totalInventory,
        pendingSales: pending,
        monthlyRevenue,
        completedSales: completedThisMonth,
        pendingPayment,
        pendingPaymentAmount,
        stakeholders,
      });
    } catch (error: any) {
      console.error('[SalesDashboard] Error loading metrics:', error);
      setPageError('Failed to load sales metrics: ' + error.message);
    }
  }, []);

  const loadChartData = useCallback(async () => {
    try {
      // Get last 12 months data
      const now = new Date();
      const last12Months = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      // Load sales with customer and mining company info for completed sales
      const { data: salesData, error } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          final_proceeds,
          status,
          customer:customers(id, name),
          mining_company:mining_companies(id, name)
        `)
        .gte('created_at', last12Months.toISOString())
        .in('status', [SALES_STATUSES.COMPLETED, SALES_STATUSES.PAYMENT_RECEIVED]);

      if (error) {
        console.error('[SalesDashboard] Error loading chart data:', error);
        return;
      }

      // Process data for monthly revenue by customer
      const monthlyRevenueByCustomer: { [key: string]: { [month: string]: number } } = {};
      const monthlyRevenueByMiningCompany: { [key: string]: { [month: string]: number } } = {};

      salesData?.forEach((sale: any) => {
        const date = new Date(sale.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const customerName = sale.customer?.name || 'Inconnu';
        const miningCompanyName = sale.mining_company?.name || 'Inconnu';

        // By customer
        if (!monthlyRevenueByCustomer[customerName]) {
          monthlyRevenueByCustomer[customerName] = {};
        }
        monthlyRevenueByCustomer[customerName][monthKey] =
          (monthlyRevenueByCustomer[customerName][monthKey] || 0) + (sale.final_proceeds || 0);

        // By mining company
        if (!monthlyRevenueByMiningCompany[miningCompanyName]) {
          monthlyRevenueByMiningCompany[miningCompanyName] = {};
        }
        monthlyRevenueByMiningCompany[miningCompanyName][monthKey] =
          (monthlyRevenueByMiningCompany[miningCompanyName][monthKey] || 0) + (sale.final_proceeds || 0);
      });

      // Generate 12 months labels
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      // Format data for charts - By Customer
      const customerChartData = months.map(month => {
        const monthLabel = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        const dataPoint: any = { month: monthLabel };

        Object.keys(monthlyRevenueByCustomer).forEach(customer => {
          dataPoint[customer] = monthlyRevenueByCustomer[customer][month] || 0;
        });

        return dataPoint;
      });

      // Format data for charts - By Mining Company
      const miningCompanyChartData = months.map(month => {
        const monthLabel = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        const dataPoint: any = { month: monthLabel };

        Object.keys(monthlyRevenueByMiningCompany).forEach(company => {
          dataPoint[company] = monthlyRevenueByMiningCompany[company][month] || 0;
        });

        return dataPoint;
      });

      setRevenueByCustomer(customerChartData);
      setRevenueByMiningCompany(miningCompanyChartData);

    } catch (error) {
      console.error('[SalesDashboard] Error processing chart data:', error);
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
        royalty: sale.royalty_amount,
        status: normalizeSaleStatus(sale.status ?? undefined),
        createdDate: sale.created_at,
      }));

      setSales(salesData);

      await loadMetrics();
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
  }, [loadMetrics]);

  useEffect(() => {
    mountedRef.current = true;
    void loadSales();
    void loadChartData();

    return () => {
      mountedRef.current = false;
    };
  }, [loadSales, loadChartData]);

  const handleRetry = () => {
      if (!mountedRef.current) {
        return;
      }
      void loadSales();
  };

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.saleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.customer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;

    // Date filters
    let matchesDateFrom = true;
    let matchesDateTo = true;

    if (dateFrom) {
      const saleDate = new Date(sale.createdDate);
      const fromDate = new Date(dateFrom);
      matchesDateFrom = saleDate >= fromDate;
    }

    if (dateTo) {
      const saleDate = new Date(sale.createdDate);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include full day
      matchesDateTo = saleDate <= toDate;
    }

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  // Separate active and completed sales
  const activeSales = filteredSales.filter(sale =>
    !['completed', 'payment_received'].includes(sale.status)
  );

  const completedSales = filteredSales.filter(sale =>
    ['completed', 'payment_received'].includes(sale.status)
  );

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
        {/* Modern Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-gray-200">
          <div>
            <h1 className="font-heading text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent mb-2">
              Gestion des Ventes
            </h1>
            <p className="text-gray-600 text-lg">Tableau de bord des ventes d'or</p>
          </div>
          <div className="relative group">
            <Button
              onClick={() => {
                void navigate('/sales/gold-trade-space');
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="h-5 w-5" />
              Nouvelle Vente
            </Button>
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <p className="text-xs text-blue-900">
                <strong>Note:</strong> Les ventes doivent être créées via le module Gold Trade Space pour sélectionner le mécanisme de tarification approprié.
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

        {/* Modern Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pending Sales Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">EN ATTENTE</span>
                </div>
              </div>
              <div>
                <p className="text-blue-100 text-xs font-medium mb-1">Ventes en Attente</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {metrics.pendingSales}
                </p>
                <p className="text-blue-200 text-xs">
                  Approbation requise
                </p>
              </div>
            </div>
          </div>

          {/* Pending Payment Amount Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">PAIEMENT</span>
                </div>
              </div>
              <div>
                <p className="text-orange-100 text-xs font-medium mb-1">En Attente de Paiement</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {formatCurrency(metrics.pendingPaymentAmount)}
                </p>
                <p className="text-orange-200 text-xs">
                  {metrics.pendingPayment} vente{metrics.pendingPayment > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Revenue Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">CE MOIS</span>
                </div>
              </div>
              <div>
                <p className="text-teal-100 text-xs font-medium mb-1">Revenus Mensuels</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {formatCurrency(metrics.monthlyRevenue)}
                </p>
                <p className="text-teal-200 text-xs">
                  Total mois en cours
                </p>
              </div>
            </div>
          </div>

          {/* Stakeholders Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">PARTIES</span>
                </div>
              </div>
              <div>
                <p className="text-slate-100 text-xs font-medium mb-2">Stakeholders</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{metrics.stakeholders.miningCompanies}</span>
                    <span className="text-slate-300 text-xs">Mines</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{metrics.stakeholders.customers}</span>
                    <span className="text-slate-300 text-xs">Clients</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{metrics.stakeholders.refineries}</span>
                    <span className="text-slate-300 text-xs">Raffin.</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{metrics.stakeholders.transportCompanies}</span>
                    <span className="text-slate-300 text-xs">Transp.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Customer Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 pb-4">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Évolution des Revenus par Client (12 mois)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueByCustomer}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {revenueByCustomer.length > 0 && Object.keys(revenueByCustomer[0])
                    .filter(key => key !== 'month')
                    .map((customer, index) => {
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                      return (
                        <Line
                          key={customer}
                          type="monotone"
                          dataKey={customer}
                          stroke={colors[index % colors.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      );
                    })}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue by Mining Company Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-teal-100 border-b border-teal-200 pb-4">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Factory className="w-5 h-5 text-teal-600" />
                Évolution des Revenus par Mine (12 mois)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByMiningCompany}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {revenueByMiningCompany.length > 0 && Object.keys(revenueByMiningCompany[0])
                    .filter(key => key !== 'month')
                    .map((company, index) => {
                      const colors = ['#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1', '#a855f7', '#d946ef'];
                      return (
                        <Bar
                          key={company}
                          dataKey={company}
                          fill={colors[index % colors.length]}
                        />
                      );
                    })}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 pb-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <CardTitle className="text-2xl font-bold text-gray-900">Ventes Actives</CardTitle>
              <Button
                onClick={() => {
                  void navigate('/sales/create');
                }}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Vente
              </Button>
            </div>

            {/* Filters Section */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[250px]">
                <label className="text-xs text-gray-600 font-medium mb-1 block">Recherche</label>
                <input
                  type="text"
                  placeholder="Rechercher par numéro ou client..."
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm"
                />
              </div>

              <div className="min-w-[180px]">
                <label className="text-xs text-gray-600 font-medium mb-1 block">Statut</label>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as 'all' | SaleStatus);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-all text-sm"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="create_sales">Création vente</option>
                  <option value="pending_management_approval">En attente Management</option>
                  <option value="management_approved">Approuvé Management</option>
                  <option value="pending_for_customer_approval">En attente Client</option>
                  <option value="customer_approved">Approuvé Client</option>
                  <option value="waiting_for_payment">Attente paiement</option>
                  <option value="virtual_payment">Paiement virtuel</option>
                  <option value="payment_received">Paiement reçu</option>
                  <option value="completed">Complété</option>
                  <option value="management_rejected">Rejeté Management</option>
                  <option value="customer_rejected">Rejeté Client</option>
                </select>
              </div>

              <div className="min-w-[160px]">
                <label className="text-xs text-gray-600 font-medium mb-1 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Date début
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-all text-sm"
                />
              </div>

              <div className="min-w-[160px]">
                <label className="text-xs text-gray-600 font-medium mb-1 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Date fin
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-all text-sm"
                />
              </div>

              {(dateFrom || dateTo) && (
                <Button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  variant="secondary"
                  className="text-sm py-2"
                >
                  Réinitialiser dates
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-gray-50">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeSales.map((sale) => {
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
                    className="group relative overflow-hidden rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-xl transition-all duration-300 cursor-pointer bg-white"
                  >
                    {/* Header */}
                    <div className="p-5 pb-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-600 transition-colors mb-0.5">
                            {sale.saleNumber}
                          </h3>
                          <p className="text-xs text-gray-600">{sale.customer}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-0.5 text-emerald-600 text-xs font-semibold">
                            Voir <ArrowRight className="h-3 w-3" />
                          </div>
                        </div>
                      </div>

                      {/* Total Amount */}
                      <div className="mt-3 mb-3">
                        <p className="text-xs text-gray-500 mb-0.5">Montant Total</p>
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(sale.amount)}
                        </p>
                      </div>

                      {/* Quantity, Price and Royalties Grid */}
                      <div className="grid grid-cols-3 gap-3 pb-3 border-b border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Quantité</p>
                          <p className="text-sm font-semibold text-gray-700">
                            {sale.quantity.toFixed(3)} oz
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Prix/oz</p>
                          <p className="text-sm font-semibold text-gray-700">
                            {unitPrice}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Royalties</p>
                          <p className="text-sm font-semibold text-emerald-600">
                            {formatCurrency(sale.royalty)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer - Status and Date on same line */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 border rounded-full text-xs font-semibold ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        <span>{status.label}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(sale.createdDate).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {activeSales.length === 0 && !pageError && (
                <div className="col-span-full text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                      <DollarSign className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">Aucune vente active trouvée</p>
                    <p className="text-gray-400 text-sm">Essayez de modifier vos critères de recherche ou créez une nouvelle vente</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {completedSales.length > 0 && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-200 pb-6">
              <CardTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                Ventes Complétées
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gray-50">
              <div className="overflow-x-auto bg-white rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Quantité
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {completedSales.map((sale) => {
                      const status = STATUS_DISPLAY_MAP[sale.status] ?? STATUS_DISPLAY_MAP.pending;
                      const StatusIcon = status.icon;

                      return (
                        <tr key={sale.id} className="hover:bg-emerald-50/50 transition-all duration-150 cursor-pointer" onClick={() => { void navigate(`/sales/${sale.id}`); }}>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="text-sm font-bold text-gray-900">{sale.saleNumber}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="text-sm text-gray-700 font-medium">{sale.customer}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900">{sale.quantity.toFixed(3)} oz</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="text-sm font-bold text-emerald-700">{formatCurrency(sale.amount)}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-semibold ${status.color}`}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {status.label}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {new Date(sale.createdDate).toLocaleDateString('fr-FR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                void navigate(`/sales/${sale.id}`);
                              }}
                              className="text-xs font-semibold hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all"
                            >
                              Voir Détails
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {completedSales.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg">
                  <p className="text-gray-500 text-sm">Aucune vente complétée à afficher</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
