import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  TrendingUp,
  Users,
  DollarSign,
  AlertCircle,
  Truck,
  Activity,
  Target,
  Crown,
  TrendingDown,
  Factory,
  Building2
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
  availableStock: number;
  ytdQuantitySold: number;
  stakeholders: {
    miningCompanies: number;
    customers: number;
    refineries: number;
    transportCompanies: number;
  };
}

interface MonthlySale {
  month: string;
  revenue: number;
  quantity: number;
  salesCount: number;
}

interface MonthlyProduction {
  month: string;
  production: number;
}

interface MonthlyGoldPrice {
  month: string;
  price: number;
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
  const [monthlyProduction, setMonthlyProduction] = useState<MonthlyProduction[]>([]);
  const [monthlyGoldPrices, setMonthlyGoldPrices] = useState<MonthlyGoldPrice[]>([]);
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

      // Calculate YTD quantity sold
      let ytdQuantitySold = 0;
      salesArray.forEach((sale: any) => {
        const saleDate = new Date(sale.sale_date || sale.created_at);
        if (saleDate >= ytdStart) {
          ytdQuantitySold += sale.quantity_oz || 0;
        }
      });

      // Fetch available stock from inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('gold_inventory')
        .select('quantity_grams, quantity_oz')
        .eq('is_available', true);

      let availableStock = 0;
      if (!inventoryError && inventoryData) {
        inventoryData.forEach((item: any) => {
          availableStock += item.quantity_oz || 0;
        });
      }

      // Fetch production data for last 12 months
      const { data: productionData, error: productionError } = await supabase
        .from('daily_production')
        .select('production_date, pure_gold_grams, estimated_oz')
        .gte('production_date', new Date(currentYear, currentMonth - 11, 1).toISOString())
        .order('production_date', { ascending: true });

      const monthlyProductionData: { [key: string]: MonthlyProduction } = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Initialize last 12 months for production
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyProductionData[monthKey] = {
          month: monthLabel,
          production: 0,
        };
      }

      if (!productionError && productionData) {
        productionData.forEach((prod: any) => {
          const prodDate = new Date(prod.production_date);
          const monthKey = `${prodDate.getFullYear()}-${String(prodDate.getMonth() + 1).padStart(2, '0')}`;

          if (monthlyProductionData[monthKey]) {
            monthlyProductionData[monthKey].production += prod.estimated_oz || 0;
          }
        });
      }

      setMonthlyProduction(Object.values(monthlyProductionData));

      // Fetch gold prices for last 12 months from gold_prices_monthly
      const startYear = currentMonth < 11 ? currentYear - 1 : currentYear;
      const { data: pricesData, error: pricesError } = await supabase
        .from('gold_prices_monthly')
        .select('year, month, average_price')
        .gte('year', startYear)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      const monthlyPricesData: { [key: string]: { month: string; price: number } } = {};

      // Initialize last 12 months for prices
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyPricesData[monthKey] = {
          month: monthLabel,
          price: 0,
        };
      }

      if (!pricesError && pricesData) {
        pricesData.forEach((price: any) => {
          const monthKey = `${price.year}-${String(price.month).padStart(2, '0')}`;
          if (monthlyPricesData[monthKey]) {
            monthlyPricesData[monthKey].price = price.average_price || 0;
          }
        });
      }

      const goldPricesArray = Object.values(monthlyPricesData);

      setMonthlyGoldPrices(goldPricesArray);

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
        availableStock,
        ytdQuantitySold,
        stakeholders,
      });

      // Calculate monthly sales for last 12 months
      const monthlyData: { [key: string]: MonthlySale } = {};

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
                {t('dashboard.globalDashboard')}
              </h1>
              <p className="text-gray-600 mt-1">{t('dashboard.completeOverview')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{t('dashboard.lastUpdated')}</p>
            <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Key Metrics - Professional Compact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue Card - Teal */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">{t('dashboard.revenue')}</span>
                </div>
              </div>
              <div>
                <p className="text-teal-100 text-xs font-medium mb-1">{t('dashboard.revenueThisMonth')}</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {formatCurrency(stats?.thisMonthRevenue || 0)}
                </p>
                <p className="text-teal-200 text-xs">
                  {t('dashboard.ytd')}: {formatCurrency(stats?.ytdRevenue || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Stock Card - Orange */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">{t('dashboard.stock')}</span>
                </div>
              </div>
              <div>
                <p className="text-orange-100 text-xs font-medium mb-1">{t('dashboard.availableStock')}</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {formatNumber(stats?.availableStock || 0)} oz
                </p>
                <p className="text-orange-200 text-xs">
                  {t('dashboard.soldYtd')}: {formatNumber(stats?.ytdQuantitySold || 0)} oz
                </p>
              </div>
            </div>
          </div>

          {/* Royalties Card - Amber */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">3%</span>
                </div>
              </div>
              <div>
                <p className="text-amber-100 text-xs font-medium mb-1">{t('dashboard.royaltiesThisMonth')}</p>
                <p className="text-white text-2xl font-bold mb-0.5">
                  {formatCurrency(stats?.thisMonthRoyalties || 0)}
                </p>
                <p className="text-amber-200 text-xs">
                  {t('dashboard.ytd')}: {formatCurrency(stats?.ytdRoyalties || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Stakeholders Card - Slate */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg">
            <div className="absolute inset-0 bg-grid-white/5"></div>
            <div className="relative p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-white text-xs font-medium">{t('dashboard.parties')}</span>
                </div>
              </div>
              <div>
                <p className="text-slate-100 text-xs font-medium mb-2">{t('dashboard.stakeholdersLabel')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{stats?.stakeholders.miningCompanies || 0}</span>
                    <span className="text-slate-300 text-xs">{t('dashboard.mines')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{stats?.stakeholders.customers || 0}</span>
                    <span className="text-slate-300 text-xs">{t('dashboard.clients')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{stats?.stakeholders.refineries || 0}</span>
                    <span className="text-slate-300 text-xs">{t('dashboard.refinLabel')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-200" />
                    <span className="text-white text-sm font-semibold">{stats?.stakeholders.transportCompanies || 0}</span>
                    <span className="text-slate-300 text-xs">{t('dashboard.transpLabel')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance 12 Months Chart - Production & Revenue */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <CardTitle>{t('dashboard.performance12Months')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {monthlyProduction.length > 0 ? (
                  <LineChartWidget
                    data={monthlyProduction.map((m, idx) => ({
                      name: m.month,
                      production: m.production,
                      revenue: monthlySales[idx]?.revenue || 0,
                    }))}
                    lines={[
                      {
                        dataKey: 'production',
                        color: '#3B82F6',
                        name: t('dashboard.productionOz')
                      },
                      {
                        dataKey: 'revenue',
                        color: '#10B981',
                        name: t('dashboard.revenueUsd')
                      }
                    ]}
                    height={320}
                    showGrid
                    showLegend
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">{t('dashboard.noDataAvailable')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gold Price 12 Months Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                <CardTitle>{t('dashboard.goldPrice12Months')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {monthlyGoldPrices.length > 0 ? (
                  <LineChartWidget
                    data={monthlyGoldPrices.map(m => ({
                      name: m.month,
                      price: m.price,
                    }))}
                    lines={[
                      {
                        dataKey: 'price',
                        color: '#F59E0B',
                        name: t('dashboard.priceUsdOz')
                      }
                    ]}
                    height={320}
                    showGrid
                    showLegend
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">{t('dashboard.noDataAvailable')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Companies Royalties Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.royaltiesSummary')}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">{t('dashboard.miningCompanyPerformance')}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {companyRoyalties.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('dashboard.noDataAvailable')}</p>
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
                          <div className="text-xs text-gray-600 mb-1">{t('dashboard.thisMonth')}</div>
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(company.thisMonth)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">{t('dashboard.totalYtd')}</div>
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
