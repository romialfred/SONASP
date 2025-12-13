import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus, ArrowRight, XCircle, Package, Award } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { formatCurrency, formatWeight } from '@/utils/salesUtils';
import { supabase } from '@/lib/supabase';
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
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const [metrics, setMetrics] = useState({
    availableInventory: 0,
    pendingSales: 0,
    monthlyRevenue: 0,
    completedSales: 0,
    pendingPayment: 0,
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

      console.log('[SalesDashboard] Metrics loaded:', {
        totalInventory,
        pending,
        monthlyRevenue,
        completedThisMonth,
        pendingPayment
      });

      setMetrics({
        availableInventory: totalInventory,
        pendingSales: pending,
        monthlyRevenue,
        completedSales: completedThisMonth,
        pendingPayment,
      });
    } catch (error: any) {
      console.error('[SalesDashboard] Error loading metrics:', error);
      setPageError('Failed to load sales metrics: ' + error.message);
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

    return () => {
      mountedRef.current = false;
    };
  }, [loadSales]);

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
    return matchesSearch && matchesStatus;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Available Inventory Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">STOCK</span>
                </div>
              </div>
              <div>
                <p className="text-amber-100 text-xs font-medium mb-1">Stock Disponible</p>
                <p className="text-white text-3xl font-bold mb-1">
                  {formatWeight(metrics.availableInventory, 'oz')}
                </p>
                <p className="text-amber-100 text-xs">
                  {(metrics.availableInventory * 31.1035).toFixed(2)}g disponible
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>

          {/* Pending Sales Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">EN ATTENTE</span>
                </div>
              </div>
              <div>
                <p className="text-blue-100 text-xs font-medium mb-1">Ventes en Attente</p>
                <p className="text-white text-3xl font-bold mb-1">
                  {metrics.pendingSales}
                </p>
                <p className="text-blue-100 text-xs">
                  Nécessitent une approbation
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>

          {/* Monthly Revenue Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">CE MOIS</span>
                </div>
              </div>
              <div>
                <p className="text-emerald-100 text-xs font-medium mb-1">Revenus Mensuels</p>
                <p className="text-white text-3xl font-bold mb-1">
                  {formatCurrency(metrics.monthlyRevenue)}
                </p>
                <p className="text-emerald-100 text-xs">
                  Total du mois en cours
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>

          {/* Completed Sales Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-violet-600 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">MTD</span>
                </div>
              </div>
              <div>
                <p className="text-violet-100 text-xs font-medium mb-1">Ventes Complétées</p>
                <p className="text-white text-3xl font-bold mb-1">
                  {metrics.completedSales}
                </p>
                <p className="text-violet-100 text-xs">
                  {metrics.pendingPayment} en attente de paiement
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>
        </div>


        <Card className="border-0 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 pb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-2xl font-bold text-gray-900">Ventes Actives</CardTitle>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Rechercher par numéro ou client..."
                  value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                    }}
                  className="min-w-[280px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <select
                  value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as 'all' | SaleStatus);
                    }}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white min-w-[200px] transition-all"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="pending_management_approval">Approbation Management</option>
                  <option value="management_approved">Approuvé Management</option>
                  <option value="pending_for_customer_approval">Approbation Client</option>
                  <option value="customer_approved">Approuvé Client</option>
                  <option value="waiting_for_payment">En attente de paiement</option>
                  <option value="virtual_payment">Paiement virtuel</option>
                  <option value="payment_received">Paiement reçu</option>
                  <option value="completed">Complété</option>
                  <option value="management_rejected">Rejeté Management</option>
                  <option value="customer_rejected">Rejeté Client</option>
                </select>
              </div>
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
                    className="group relative overflow-hidden rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-2xl transition-all duration-300 cursor-pointer bg-white"
                  >
                    {/* Header */}
                    <div className="p-6 pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors mb-1">
                            {sale.saleNumber}
                          </h3>
                          <p className="text-sm text-gray-600 font-medium">{sale.customer}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-1 text-emerald-600 text-sm font-semibold">
                            Voir <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>

                      {/* Total Amount - Large */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Montant Total</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {formatCurrency(sale.amount)}
                        </p>
                      </div>

                      {/* Quantity and Price Grid */}
                      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Quantité</p>
                          <p className="text-lg font-bold text-gray-700">
                            {sale.quantity.toFixed(3)} oz
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Prix/oz</p>
                          <p className="text-lg font-bold text-gray-700">
                            {unitPrice}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer - Status and Date on same line */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-semibold ${status.color}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
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
