import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { DollarSign, TrendingUp, Clock, CheckCircle, XCircle, Users, Building2, Factory, Truck, Calendar } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { formatCurrency } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from '@/lib/recharts';
import {
  saleSummaryListSchema,
  normalizeSaleStatus,
  extractCustomerName,
  SaleStatus,
} from '@/lib/schemas/sales';
import { SALES_STATUSES } from '@/constants/salesStatuses';
import { coherenceStockService, type Coherence } from '@/services/coherenceStockService';
import { stockSonaspService } from '@/services/stockSonaspService';
import { mineStockService } from '@/services/mineStockService';
import { errorMessage } from '@/lib/errorMessage';
import { useAuth } from '@/contexts/AuthContext';

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

type RevenueChartPoint = { month: string } & Record<string, string | number>;

const isNonEmptyString = (value: string | null): value is string =>
  typeof value === 'string' && value.length > 0;

const formatChartCurrency = (value: unknown): string => {
  const amount = typeof value === 'number' ? value : Number(value);
  return formatCurrency(Number.isFinite(amount) ? amount : 0);
};

type StatusDisplay = {
  label: string;
  color: string;
  icon: LucideIcon;
};

export function SalesDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isMine = Boolean(user?.mining_company_id);
  const [coherence, setCoherence] = useState<Coherence | null>(null);

  const STATUS_DISPLAY_MAP: Partial<Record<SaleStatus, StatusDisplay>> & {
    pending: StatusDisplay;
  } = {
    create_sales: {
      label: t('pages.sales.statusCreateSales'),
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: Clock,
    },
    pending: {
      label: t('pages.sales.pendingSales'),
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: Clock,
    },
    pending_management_approval: {
      label: t('pages.sales.statusPendingManagement'),
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: Clock,
    },
    management_approved: {
      label: t('pages.sales.statusManagementApproved'),
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: CheckCircle,
    },
    pending_for_customer_approval: {
      label: t('pages.sales.statusPendingCustomer'),
      color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      icon: Clock,
    },
    approved: {
      label: t('pages.sales.statusManagementApproved'),
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: CheckCircle,
    },
    customer_approved: {
      label: t('pages.sales.statusCustomerApproved'),
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: CheckCircle,
    },
    waiting_for_payment: {
      label: t('pages.sales.statusWaitingPayment'),
      color: 'bg-orange-100 text-orange-800 border-orange-300',
      icon: Clock,
    },
    virtual_payment: {
      label: t('pages.sales.statusVirtualPayment'),
      color: 'bg-purple-100 text-purple-800 border-purple-300',
      icon: DollarSign,
    },
    payment_received: {
      label: t('pages.sales.statusPaymentReceived'),
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: DollarSign,
    },
    completed: {
      label: t('pages.sales.statusCompleted'),
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: CheckCircle,
    },
    management_rejected: {
      label: t('pages.sales.statusManagementRejected'),
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle,
    },
    customer_rejected: {
      label: t('pages.sales.statusCustomerRejected'),
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle,
    },
    rejected: {
      label: t('pages.sales.statusManagementRejected'),
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: XCircle,
    },
  } as const;
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SaleStatus>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const isMounted = () => mountedRef.current;
  const [revenueByCustomer, setRevenueByCustomer] = useState<RevenueChartPoint[]>([]);
  const [revenueByMiningCompany, setRevenueByMiningCompany] = useState<RevenueChartPoint[]>([]);
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

      const [
        salesResult,
        inventoryResult,
        miningCompaniesResult,
        customersResult,
        refineriesResult,
        transportCompaniesResult,
      ] = await Promise.all([
        supabase.from('sales').select('status, final_proceeds, created_at'),
        supabase
          .from('gold_inventory')
          .select('quantity_available_oz')
          .eq('transaction_type', 'entry'),
        supabase.from('mining_companies').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('refineries').select('id', { count: 'exact', head: true }),
        supabase.from('transport_companies').select('id', { count: 'exact', head: true }),
      ]);

      const { data: salesData, error: salesError } = salesResult;

      if (salesError) {
        console.error('[SalesDashboard] Error loading sales:', salesError);
        throw salesError;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const pending = salesData.filter(s => s.status === SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL || s.status === SALES_STATUSES.CREATE_SALES).length;

      // Monthly Revenue: All sales this month except rejected ones
      const monthlyRevenue = salesData.filter(s => {
        if (!s.created_at) return false;
        const saleDate = new Date(s.created_at);
        const isThisMonth = saleDate >= startOfMonth;
        const isNotRejected = s.status !== SALES_STATUSES.MANAGEMENT_REJECTED && s.status !== SALES_STATUSES.CUSTOMER_REJECTED;
        return isThisMonth && isNotRejected;
      }).reduce((sum, s) => sum + s.final_proceeds, 0);

      const completedThisMonth = salesData.filter(s =>
        s.created_at !== null &&
        new Date(s.created_at) >= startOfMonth &&
        (s.status === SALES_STATUSES.COMPLETED || s.status === SALES_STATUSES.PAYMENT_RECEIVED)
      ).length;

      // Pending Payment: All sales awaiting payment including virtual payments
      const pendingPayment = salesData.filter(s =>
        s.status === SALES_STATUSES.CUSTOMER_APPROVED ||
        s.status === SALES_STATUSES.WAITING_FOR_PAYMENT ||
        s.status === SALES_STATUSES.VIRTUAL_PAYMENT
      ).length;

      const pendingPaymentAmount = salesData.filter(s =>
        s.status === SALES_STATUSES.CUSTOMER_APPROVED ||
        s.status === SALES_STATUSES.WAITING_FOR_PAYMENT ||
        s.status === SALES_STATUSES.VIRTUAL_PAYMENT
      ).reduce((sum, s) => sum + s.final_proceeds, 0);

      if (inventoryResult.error) {
        console.warn('[SalesDashboard] Inventaire indisponible :', inventoryResult.error.message);
      }
      const totalInventory = isMine
        ? (await mineStockService.stock()).availableOz
        : (inventoryResult.data ?? []).reduce(
            (sum, item) => sum + item.quantity_available_oz,
            0
          );

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
    } catch (error: unknown) {
      console.error('[SalesDashboard] Error loading metrics:', error);
      setPageError(errorMessage(error, 'Impossible de charger les indicateurs de vente.'));
    }
  }, [isMine]);

  const loadChartData = useCallback(async () => {
    try {
      // Get last 12 months data
      const now = new Date();
      const last12Months = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      // Load all sales (no joins to avoid relation issues)
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('id, created_at, final_proceeds, status, seller_id, seller_type, customer_id')
        .gte('created_at', last12Months.toISOString());

      if (error) {
        console.error('[SalesDashboard] Error loading chart data:', error);
        return;
      }

      if (salesData.length === 0) {
        console.log('[SalesDashboard] No sales data found');
        setRevenueByCustomer([]);
        setRevenueByMiningCompany([]);
        return;
      }

      // Get unique customer IDs and seller IDs
      const customerIds = [...new Set(salesData.map(s => s.customer_id).filter(isNonEmptyString))];
      const sellerIds = [...new Set(salesData.map(s => s.seller_id).filter(isNonEmptyString))];

      // Load customers in parallel
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);

      // Load mining companies in parallel
      const { data: miningCompaniesData } = await supabase
        .from('mining_companies')
        .select('id, name')
        .in('id', sellerIds);

      // Create lookup maps
      const customerMap = new Map((customersData ?? []).map(c => [c.id, c.name]));
      const miningCompanyMap = new Map((miningCompaniesData ?? []).map(m => [m.id, m.name]));

      // Process data for monthly revenue by customer
      const monthlyRevenueByCustomer: { [key: string]: { [month: string]: number } } = {};
      const monthlyRevenueByMiningCompany: { [key: string]: { [month: string]: number } } = {};

      salesData.forEach((sale) => {
        if (!sale.created_at) return;
        const date = new Date(sale.created_at);
        const monthKey = `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const customerName = customerMap.get(sale.customer_id) ?? t('pages.sales.unknownClient');
        const miningCompanyName = sale.seller_type === 'sonasp'
          ? 'SONASP'
          : sale.seller_type === 'mining_company'
            ? (miningCompanyMap.get(sale.seller_id ?? '') ?? t('pages.sales.unknownMine'))
            : t('pages.sales.other');

        // By customer
        if (!(customerName in monthlyRevenueByCustomer)) {
          monthlyRevenueByCustomer[customerName] = {};
        }
        monthlyRevenueByCustomer[customerName][monthKey] =
          (monthlyRevenueByCustomer[customerName][monthKey] ?? 0) + sale.final_proceeds;

        // By mining company
        if (!(miningCompanyName in monthlyRevenueByMiningCompany)) {
          monthlyRevenueByMiningCompany[miningCompanyName] = {};
        }
        monthlyRevenueByMiningCompany[miningCompanyName][monthKey] =
          (monthlyRevenueByMiningCompany[miningCompanyName][monthKey] ?? 0) + sale.final_proceeds;
      });

      // Generate 12 months labels
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      // Format data for charts - By Customer
      const customerChartData = months.map(month => {
        const monthLabel = new Date(month + '-01').toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' });
        const dataPoint: RevenueChartPoint = { month: monthLabel };

        Object.keys(monthlyRevenueByCustomer).forEach(customer => {
          dataPoint[customer] = monthlyRevenueByCustomer[customer][month] ?? 0;
        });

        return dataPoint;
      });

      // Format data for charts - By Mining Company
      const miningCompanyChartData = months.map(month => {
        const monthLabel = new Date(month + '-01').toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' });
        const dataPoint: RevenueChartPoint = { month: monthLabel };

        Object.keys(monthlyRevenueByMiningCompany).forEach(company => {
          dataPoint[company] = monthlyRevenueByMiningCompany[company][month] ?? 0;
        });

        return dataPoint;
      });

      setRevenueByCustomer(customerChartData);
      setRevenueByMiningCompany(miningCompanyChartData);

    } catch (error) {
      console.error('[SalesDashboard] Error processing chart data:', error);
    }
  }, [i18n.language, t]);

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
        if (!isMounted()) {
          return;
        }
        setSales([]);
        setPageError('We received unexpected sales data. Please try again in a moment.');
        return;
      }

      if (!isMounted()) {
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
      if (!isMounted()) {
        return;
      }
      setPageError(
        error instanceof Error ? error.message : 'Failed to load sales. Please try again.'
      );
      setSales([]);
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [loadMetrics]);

  /**
   * Contrôle de cohérence : les onces vendues doivent toutes être rattachées à
   * un lot d'achat. Un écart signale une vente créée hors du formulaire, donc
   * un stock entamé sans origine connue.
   */
  const controlerCoherence = useCallback(async () => {
    // Ce contrôle compare les ventes SONASP aux lots achetés. Il n'est pas
    // applicable aux ventes directes d'une mine, dont le plafond est contrôlé
    // atomiquement par snp_creer_vente_export_mine().
    if (isMine) {
      if (isMounted()) setCoherence(null);
      return;
    }
    try {
      const sonasp = await stockSonaspService.identifiant();
      if (!sonasp) return;
      const resultat = await coherenceStockService.controler(sonasp.id);
      if (isMounted()) setCoherence(resultat);
    } catch (raison) {
      console.warn('Contrôle de cohérence indisponible :', raison);
      if (isMounted()) setCoherence(null);
    }
  }, [isMine]);

  useEffect(() => {
    mountedRef.current = true;
    void loadSales();
    void loadChartData();
    void controlerCoherence();

    return () => {
      mountedRef.current = false;
    };
  }, [loadSales, loadChartData, controlerCoherence]);

  const handleRetry = () => {
      if (!isMounted()) {
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
        <div className="pb-6 border-b border-gray-200">
          <div>
            <h1 className="font-heading text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent mb-2">
              {t('pages.sales.salesManagement')}
            </h1>
            <p className="text-gray-600 text-lg">{t('pages.sales.subtitle')}</p>
          </div>
        </div>

        {coherence && !coherence.coherent && (
          <Alert variant="warning" title="Ventes sans origine tracée">
            <div className="space-y-2">
              <p>
                {coherence.ecartOz.toFixed(3)} oz vendues ne sont rattachées à aucun achat.
                Le stock apparaît entamé sans qu’on sache par quel or : régularisez la
                composition de ces ventes.
              </p>
              <ul className="text-sm space-y-1">
                {coherence.ventesSansOrigine.slice(0, 5).map((vente) => (
                  <li key={vente.id}>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => { void navigate(`/sales/${vente.id}`); }}
                    >
                      {vente.numero}
                    </button>{' '}
                    — {vente.manquantOz.toFixed(3)} oz sans origine sur {vente.quantiteOz.toFixed(3)} oz
                  </li>
                ))}
              </ul>
              {coherence.ventesSansOrigine.length > 5 && (
                <p className="text-sm">
                  et {coherence.ventesSansOrigine.length - 5} autre(s) vente(s).
                </p>
              )}
            </div>
          </Alert>
        )}

        {pageError && (
          <Alert
            variant="error"
            title={t('pages.sales.salesDataUnavailable')}
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
              {t('pages.sales.retry')}
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
                  <span className="text-white text-xs font-medium">{t('pages.sales.pendingLabel')}</span>
                </div>
              </div>
              <div>
                <p className="text-blue-100 text-xs font-medium mb-1">{t('pages.sales.pendingSalesCard')}</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {metrics.pendingSales}
                </p>
                <p className="text-blue-200 text-xs">
                  {t('pages.sales.approvalRequired')}
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
                  <span className="text-white text-xs font-medium">{t('pages.sales.paymentLabel')}</span>
                </div>
              </div>
              <div>
                <p className="text-orange-100 text-xs font-medium mb-1">{t('pages.sales.awaitingPayment')}</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {formatCurrency(metrics.pendingPaymentAmount)}
                </p>
                <p className="text-orange-200 text-xs">
                  {metrics.pendingPayment} {metrics.pendingPayment > 1 ? t('pages.sales.sales') : t('pages.sales.sale')}
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
                  <span className="text-white text-xs font-medium">{t('pages.sales.thisMonthLabel')}</span>
                </div>
              </div>
              <div>
                <p className="text-teal-100 text-xs font-medium mb-1">{t('pages.sales.monthlyRevenue')}</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {formatCurrency(metrics.monthlyRevenue)}
                </p>
                <p className="text-teal-200 text-xs">
                  {t('pages.sales.currentMonthTotal')}
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
                  <span className="text-white text-xs font-medium">{t('pages.sales.partiesLabel')}</span>
                </div>
              </div>
              <div>
                <p className="text-slate-100 text-xs font-medium mb-2">{t('pages.sales.stakeholders')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{metrics.stakeholders.miningCompanies}</span>
                    <span className="text-slate-300 text-xs">{t('pages.sales.mines')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{metrics.stakeholders.customers}</span>
                    <span className="text-slate-300 text-xs">{t('pages.sales.clients')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{metrics.stakeholders.refineries}</span>
                    <span className="text-slate-300 text-xs">{t('pages.sales.refineries')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{metrics.stakeholders.transportCompanies}</span>
                    <span className="text-slate-300 text-xs">{t('pages.sales.transport')}</span>
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
                {t('pages.sales.revenueByCustomer')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {revenueByCustomer.length === 0 || !revenueByCustomer.some(d => Object.keys(d).length > 1) ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">{t('pages.sales.noDataAvailable')}</p>
                  <p className="text-xs mt-1">{t('pages.sales.salesWillAppear')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueByCustomer}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={formatChartCurrency} contentStyle={{ fontSize: 12 }} />
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
              )}
            </CardContent>
          </Card>

          {/* Revenue by Mining Company Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-teal-100 border-b border-teal-200 pb-4">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Factory className="w-5 h-5 text-teal-600" />
                {t('pages.sales.revenueByMine')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {revenueByMiningCompany.length === 0 || !revenueByMiningCompany.some(d => Object.keys(d).length > 1) ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <Factory className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">{t('pages.sales.noDataAvailable')}</p>
                  <p className="text-xs mt-1">{t('pages.sales.salesWillAppear')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueByMiningCompany}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={formatChartCurrency} contentStyle={{ fontSize: 12 }} />
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
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 pb-6">
            <div className="mb-4">
              <CardTitle className="text-2xl font-bold text-gray-900">{t('pages.sales.activeSales')}</CardTitle>
            </div>

            {/* Filters Section */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[250px]">
                <label className="text-xs text-gray-600 font-medium mb-1 block">{t('pages.sales.searchLabel')}</label>
                <input
                  type="text"
                  placeholder={t('pages.sales.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm"
                />
              </div>

              <div className="min-w-[180px]">
                <label className="text-xs text-gray-600 font-medium mb-1 block">{t('pages.sales.statusLabel')}</label>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as 'all' | SaleStatus);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-all text-sm"
                >
                  <option value="all">{t('pages.sales.allStatuses')}</option>
                  <option value="create_sales">{t('pages.sales.statusCreateSales')}</option>
                  <option value="pending_management_approval">{t('pages.sales.statusPendingManagement')}</option>
                  <option value="management_approved">{t('pages.sales.statusManagementApproved')}</option>
                  <option value="pending_for_customer_approval">{t('pages.sales.statusPendingCustomer')}</option>
                  <option value="customer_approved">{t('pages.sales.statusCustomerApproved')}</option>
                  <option value="waiting_for_payment">{t('pages.sales.statusWaitingPayment')}</option>
                  <option value="virtual_payment">{t('pages.sales.statusVirtualPayment')}</option>
                  <option value="payment_received">{t('pages.sales.statusPaymentReceived')}</option>
                  <option value="completed">{t('pages.sales.statusCompleted')}</option>
                  <option value="management_rejected">{t('pages.sales.statusManagementRejected')}</option>
                  <option value="customer_rejected">{t('pages.sales.statusCustomerRejected')}</option>
                </select>
              </div>

              <div className="min-w-[160px]">
                <label className="text-xs text-gray-600 font-medium mb-1 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t('pages.sales.startDate')}
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
                  {t('pages.sales.endDate')}
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
                  {t('pages.sales.resetDates')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-gray-50">

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {activeSales.map((sale) => {
                  const status = STATUS_DISPLAY_MAP[sale.status] ?? STATUS_DISPLAY_MAP.pending;
                const StatusIcon = status.icon;

                // Get background color based on status
                const getStatusBgColor = () => {
                  if (status.color.includes('yellow')) return 'bg-yellow-50 border-yellow-200';
                  if (status.color.includes('green')) return 'bg-green-50 border-green-200';
                  if (status.color.includes('blue')) return 'bg-blue-50 border-blue-200';
                  if (status.color.includes('indigo')) return 'bg-indigo-50 border-indigo-200';
                  if (status.color.includes('orange')) return 'bg-orange-50 border-orange-200';
                  if (status.color.includes('red')) return 'bg-red-50 border-red-200';
                  if (status.color.includes('emerald')) return 'bg-emerald-50 border-emerald-200';
                  if (status.color.includes('purple')) return 'bg-purple-50 border-purple-200';
                  return 'bg-gray-50 border-gray-200';
                };

                const getIconColor = () => {
                  if (status.color.includes('yellow')) return 'text-yellow-600 bg-yellow-100 border-yellow-300';
                  if (status.color.includes('green')) return 'text-green-600 bg-green-100 border-green-300';
                  if (status.color.includes('blue')) return 'text-blue-600 bg-blue-100 border-blue-300';
                  if (status.color.includes('indigo')) return 'text-indigo-600 bg-indigo-100 border-indigo-300';
                  if (status.color.includes('orange')) return 'text-orange-600 bg-orange-100 border-orange-300';
                  if (status.color.includes('red')) return 'text-red-600 bg-red-100 border-red-300';
                  if (status.color.includes('emerald')) return 'text-emerald-600 bg-emerald-100 border-emerald-300';
                  if (status.color.includes('purple')) return 'text-purple-600 bg-purple-100 border-purple-300';
                  return 'text-gray-600 bg-gray-100 border-gray-300';
                };

                return (
                    <div
                      key={sale.id}
                      onClick={() => {
                        void navigate(`/sales/${sale.id}`);
                      }}
                    className={`group relative overflow-hidden rounded-lg border-2 hover:shadow-lg transition-all duration-300 cursor-pointer ${getStatusBgColor()}`}
                  >
                    {/* Status Icon - Large and Prominent */}
                    <div className="absolute top-2 right-2">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${getIconColor()}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Header */}
                    <div className="p-3">
                      <div className="pr-12 mb-2">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-600 transition-colors mb-0.5 truncate">
                          {sale.saleNumber}
                        </h3>
                        <p className="text-xs text-gray-600 truncate">{sale.customer}</p>
                      </div>

                      {/* Total Amount */}
                      <div className="mt-2 mb-2 bg-white/50 rounded p-2">
                        <p className="text-xs text-gray-500 mb-0.5">{t('pages.sales.totalAmount')}</p>
                        <p className="text-base font-bold text-gray-900">
                          {formatCurrency(sale.amount)}
                        </p>
                      </div>

                      {/* Quantity and Royalties */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">{t('pages.sales.quantity')}</p>
                          <p className="text-xs font-semibold text-gray-700">
                            {sale.quantity.toFixed(2)} oz
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">{t('pages.sales.royalties')}</p>
                          <p className="text-xs font-semibold text-emerald-600">
                            {formatCurrency(sale.royalty)}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs font-semibold ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        <span className="truncate">{status.label}</span>
                      </div>

                      {/* Date at bottom */}
                      <div className="mt-2 pt-2 border-t border-gray-200/50 text-xs text-gray-500">
                        {new Date(sale.createdDate).toLocaleDateString(i18n.language, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>

                    {/* Hover indicator */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                  </div>
                );
              })}

              {activeSales.length === 0 && !pageError && (
                <div className="col-span-full text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                      <DollarSign className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">{t('pages.sales.noActiveSales')}</p>
                    <p className="text-gray-400 text-sm">{t('pages.sales.adjustSearchCriteria')}</p>
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
                {t('pages.sales.completedSales')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gray-50">
              <div className="overflow-x-auto bg-white rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('pages.sales.number')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('pages.sales.customer')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('pages.sales.quantity')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('pages.sales.amount')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('pages.sales.status')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('pages.sales.date')}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('pages.sales.actions')}
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
                              {new Date(sale.createdDate).toLocaleDateString(i18n.language, {
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
                              {t('pages.sales.viewDetails')}
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
                  <p className="text-gray-500 text-sm">{t('pages.sales.noCompletedSales')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
