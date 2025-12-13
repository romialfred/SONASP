import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, TrendingUp, Users, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, Crown, Building2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { formatStatusFr } from '@/utils/statusFormatter';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { BarChartWidget } from '@/components/charts/BarChartWidget';

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
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            {t('nav.dashboard')}
          </h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's an overview of your operations.</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Revenue Card - Fused: Month + YTD */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mt-8 -mr-8"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-gray-600">
                Revenus
              </CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Ce Mois</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats?.thisMonthRevenue || 0)}
                  </div>
                  {stats && stats.monthlyGrowth !== 0 && (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${
                      stats.monthlyGrowth > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stats.monthlyGrowth > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(stats.monthlyGrowth).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="pt-3 border-t">
                  <div className="text-xs text-gray-500 mb-1">Total Année (YTD)</div>
                  <div className="text-lg font-semibold text-emerald-600">
                    {formatCurrency(stats?.ytdRevenue || 0)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Royalties Card - Fused: Month + YTD */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mt-8 -mr-8"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-gray-600">
                Royalties (3%)
              </CardTitle>
              <Crown className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Ce Mois</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats?.thisMonthRoyalties || 0)}
                  </div>
                  {stats && stats.royaltiesGrowth !== 0 && (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${
                      stats.royaltiesGrowth > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stats.royaltiesGrowth > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(stats.royaltiesGrowth).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="pt-3 border-t">
                  <div className="text-xs text-gray-500 mb-1">Total Année (YTD)</div>
                  <div className="text-lg font-semibold text-amber-600">
                    {formatCurrency(stats?.ytdRoyalties || 0)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Batches */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mt-8 -mr-8"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-gray-600">
                Lots Actifs
              </CardTitle>
              <Package className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-gray-900">{stats?.activeBatches || 0}</div>
              <p className="text-xs text-gray-500 mt-2">En traitement</p>
            </CardContent>
          </Card>

          {/* Active Customers */}
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -mt-8 -mr-8"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-gray-600">
                Clients Actifs
              </CardTitle>
              <Users className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-gray-900">{stats?.activeCustomers || 0}</div>
              <p className="text-xs text-gray-500 mt-2">Total clients</p>
            </CardContent>
          </Card>
        </div>

        {/* Last 12 Months Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Last 12 Months Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <LineChartWidget
                data={monthlySales.map(m => ({
                  name: m.month,
                  value: m.revenue,
                }))}
                dataKey="value"
                lineColor="#10B981"
                title=""
                showGrid
              />
            </div>
          </CardContent>
        </Card>

        {/* Royalties by Company Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Royalties par Société</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Évolution mensuelle des royalties (3%) par société minière</p>
            </div>
            <Building2 className="h-6 w-6 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="h-96">
              {monthlyRoyaltiesByCompany.length > 0 ? (
                <BarChartWidget
                  data={monthlyRoyaltiesByCompany.slice(-12)}
                  bars={
                    // Get all company names dynamically from the data
                    Object.keys(monthlyRoyaltiesByCompany[0] || {})
                      .filter(key => key !== 'month')
                      .map((companyName, index) => ({
                        dataKey: companyName,
                        color: index === 0 ? '#B8860B' : index === 1 ? '#D4AF37' : '#F4C430',
                        name: companyName
                      }))
                  }
                  height={384}
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
