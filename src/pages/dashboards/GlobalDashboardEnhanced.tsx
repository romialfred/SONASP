import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  TrendingUp,
  Users,
  DollarSign,
  AlertCircle,
  FileText,
  Truck,
  Box,
  Activity,
  Target
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { formatStatusFr } from '@/utils/statusFormatter';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { PieChartWidget } from '@/components/charts/PieChartWidget';

interface DashboardStats {
  ytdRevenue: number;
  thisMonthRevenue: number;
  previousMonthRevenue: number;
  activeBatches: number;
  activeCustomers: number;
  monthlyGrowth: number;
  thisMonthRoyalties: number;
  ytdRoyalties: number;
  royaltiesGrowth: number;
}

interface MonthlySale {
  month: string;
  revenue: number;
  quantity: number;
  salesCount: number;
}

interface MonthlyRoyaltyByCompany {
  month: string;
  [key: string]: number | string;
}

interface CompanyRoyalty {
  companyName: string;
  thisMonth: number;
  ytd: number;
}

export function GlobalDashboardEnhanced() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
  const [monthlyRoyaltiesByCompany, setMonthlyRoyaltiesByCompany] = useState<MonthlyRoyaltyByCompany[]>([]);
  const [companyRoyalties, setCompanyRoyalties] = useState<CompanyRoyalty[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch sales data with customers and mining companies
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          total_amount,
          quantity_oz,
          sale_date,
          status,
          created_at,
          customer_id,
          mining_company_id,
          customers (
            name
          ),
          mining_companies (
            name,
            abbreviation
          )
        `)
        .order('sale_date', { ascending: false });

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        // Continue with empty data instead of throwing
      }

      // Fetch active batches count
      const { count: batchesCount, error: batchesError } = await supabase
        .from('batches')
        .select('*', { count: 'exact', head: true })
        .in('status', [
        ]);

      if (batchesError) {
        console.error('Error fetching batches:', batchesError);
      }

      // Fetch active customers count
      const { count: customersCount, error: customersError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (customersError) {
        console.error('Error fetching customers:', customersError);
      }

      // Calculate stats
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const ytdStart = new Date(currentYear, 0, 1);
      const thisMonthStart = new Date(currentYear, currentMonth, 1);
      const previousMonthStart = new Date(currentYear, currentMonth - 1, 1);
      const previousMonthEnd = new Date(currentYear, currentMonth, 0);

      let ytdRevenue = 0;
      let thisMonthRevenue = 0;
      let previousMonthRevenue = 0;
      let thisMonthRoyalties = 0;
      let ytdRoyalties = 0;
      let previousMonthRoyalties = 0;

      const ROYALTY_RATE = 0.03;

      // Ensure salesData is an array
      const salesArray = Array.isArray(salesData) ? salesData : [];

      salesArray.forEach((sale: any) => {
        const saleDate = new Date(sale.sale_date || sale.created_at);
        const amount = sale.total_amount || 0;
        const royalty = amount * ROYALTY_RATE;

        if (saleDate >= ytdStart) {
          ytdRevenue += amount;
          ytdRoyalties += royalty;
        }
        if (saleDate >= thisMonthStart) {
          thisMonthRevenue += amount;
          thisMonthRoyalties += royalty;
        }
        if (saleDate >= previousMonthStart && saleDate <= previousMonthEnd) {
          previousMonthRevenue += amount;
          previousMonthRoyalties += royalty;
        }
      });

      const monthlyGrowth = previousMonthRevenue > 0
        ? ((thisMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : 0;

      const royaltiesGrowth = previousMonthRoyalties > 0
        ? ((thisMonthRoyalties - previousMonthRoyalties) / previousMonthRoyalties) * 100
        : 0;

      setStats({
        ytdRevenue,
        thisMonthRevenue,
        previousMonthRevenue,
        activeBatches: batchesCount || 0,
        activeCustomers: customersCount || 0,
        monthlyGrowth,
        thisMonthRoyalties,
        ytdRoyalties,
        royaltiesGrowth,
      });

      // Calculate monthly sales for last 12 months
      const monthlyData: { [key: string]: MonthlySale } = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Initialize last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyData[monthKey] = {
          month: monthLabel,
          revenue: 0,
          quantity: 0,
          salesCount: 0,
        };
      }

      // Aggregate sales by month
      salesArray.forEach((sale: any) => {
        const saleDate = new Date(sale.sale_date || sale.created_at);
        const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

        if (monthlyData[monthKey]) {
          monthlyData[monthKey].revenue += sale.total_amount || 0;
          monthlyData[monthKey].quantity += sale.quantity_oz || 0;
          monthlyData[monthKey].salesCount += 1;
        }
      });

      setMonthlySales(Object.values(monthlyData));

      // Calculate royalties by company and month
      const royaltiesByCompanyMonth: { [key: string]: any } = {};
      const companyRoyaltiesMap: { [key: string]: CompanyRoyalty } = {};

      // Initialize last 12 months for royalties
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        royaltiesByCompanyMonth[monthKey] = { month: monthLabel };
      }

      // Aggregate royalties by company and month
      salesArray.forEach((sale: any) => {
        const saleDate = new Date(sale.sale_date || sale.created_at);
        const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        const companyName = sale.mining_companies?.abbreviation || 'Autre';
        const royalty = (sale.total_amount || 0) * ROYALTY_RATE;

        if (royaltiesByCompanyMonth[monthKey]) {
          if (!royaltiesByCompanyMonth[monthKey][companyName]) {
            royaltiesByCompanyMonth[monthKey][companyName] = 0;
          }
          royaltiesByCompanyMonth[monthKey][companyName] += royalty;
        }

        if (!companyRoyaltiesMap[companyName]) {
          companyRoyaltiesMap[companyName] = {
            companyName,
            thisMonth: 0,
            ytd: 0,
          };
        }

        if (saleDate >= thisMonthStart) {
          companyRoyaltiesMap[companyName].thisMonth += royalty;
        }
        if (saleDate >= ytdStart) {
          companyRoyaltiesMap[companyName].ytd += royalty;
        }
      });

      setMonthlyRoyaltiesByCompany(Object.values(royaltiesByCompanyMonth));
      setCompanyRoyalties(Object.values(companyRoyaltiesMap).sort((a, b) => b.ytd - a.ytd));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                Tableau de Bord Global
              </h1>
              <p className="text-gray-600 mt-1">Vue d'ensemble complète - Groupe Mansa Resources</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Dernière mise à jour</p>
            <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        {/* Key Metrics - Beautiful Colored Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Revenue Fused Card - Emerald Green */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <DollarSign className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">Revenus Totaux</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">INFINITY%</span>
                </div>
              </div>

              {/* This Month Revenue */}
              <div className="mb-4 pb-4 border-b border-white/20">
                <p className="text-emerald-100 text-xs mb-1">Ce Mois</p>
                <p className="text-white text-3xl font-bold">
                  {formatCurrency(stats?.thisMonthRevenue || 0)}
                </p>
              </div>

              {/* YTD Revenue */}
              <div>
                <p className="text-emerald-100 text-xs mb-1">Total Année (YTD)</p>
                <p className="text-white text-2xl font-bold">
                  {formatCurrency(stats?.ytdRevenue || 0)}
                </p>
                <p className="text-emerald-100 text-xs mt-1">2 ventes complétées</p>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>

          {/* Active Shipments Card - Blue */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Truck className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Expéditions Actives</p>
                    <p className="text-white text-3xl font-bold mt-1">{stats?.activeBatches || 0}</p>
                    <p className="text-blue-100 text-xs mt-1">en traitement</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">EN COURS</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>

          {/* Available Stock Card - Orange */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Target className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Stock Disponible</p>
                    <p className="text-white text-3xl font-bold mt-1">1244.23 oz</p>
                    <p className="text-orange-100 text-xs mt-1">38699.82g disponible</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">STOCK</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>

          {/* Active Clients Card - Purple */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 via-violet-500 to-purple-600 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Clients Actifs</p>
                    <p className="text-white text-3xl font-bold mt-1">{stats?.activeCustomers || 0}</p>
                    <p className="text-purple-100 text-xs mt-1">partenaires actifs</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">CLIENTS</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>

          {/* Pending Approvals Card - Red/Pink */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-red-500 shadow-xl">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-rose-100 text-sm font-medium">Approbations Requises</p>
                    <p className="text-white text-3xl font-bold mt-1">5</p>
                    <p className="text-rose-100 text-xs mt-1">en attente</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-white text-xs font-semibold">URGENT</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mb-16 -mr-16"></div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance 12 Months Chart - Larger */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <CardTitle>Performance 12 Mois</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {monthlySales.length > 0 ? (
                  <LineChartWidget
                    data={monthlySales.map(m => ({
                      name: m.month,
                      revenue: m.revenue,
                      production: m.quantity,
                    }))}
                    lines={[
                      {
                        dataKey: 'revenue',
                        color: '#10B981',
                        name: 'Revenue'
                      },
                      {
                        dataKey: 'production',
                        color: '#3B82F6',
                        name: 'Production'
                      }
                    ]}
                    height={320}
                    showGrid
                    showLegend
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Aucune donnée disponible</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Production by Country - Pie Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                <CardTitle>Production par Pays</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex flex-col items-center justify-center">
                <PieChartWidget
                  data={[
                    { name: 'Guinée', value: 45 },
                    { name: 'Mali', value: 30 },
                    { name: "Côte d'Ivoire", value: 25 }
                  ]}
                  colors={['#F59E0B', '#10B981', '#3B82F6']}
                  height={280}
                  innerRadius={60}
                  showLegend={false}
                />
                <div className="mt-4 space-y-2 w-full">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="text-gray-700">Guinée</span>
                    </div>
                    <span className="font-semibold text-gray-900">45%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-gray-700">Mali</span>
                    </div>
                    <span className="font-semibold text-gray-900">30%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-gray-700">Côte d'Ivoire</span>
                    </div>
                    <span className="font-semibold text-gray-900">25%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <CardTitle>Activité Récente</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Nouvelle vente approuvée</p>
                  <p className="text-xs text-gray-500">Il y a 5 min</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies Royalties Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé des Royalties par Société</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Performance des sociétés minières</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {companyRoyalties.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune donnée disponible</p>
              ) : (
                companyRoyalties.map((company, index) => (
                  <div key={company.companyName} className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {company.companyName}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">{company.companyName}</span>
                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-medium">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Ce Mois</div>
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(company.thisMonth)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Total YTD</div>
                          <div className="text-lg font-bold text-amber-600">
                            {formatCurrency(company.ytd)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
