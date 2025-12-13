import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import {
  TrendingUp,
  Package,
  Factory,
  ChevronDown,
  Sparkles,
  BarChart3,
  Calendar,
  Filter
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Cell
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { dailyProductionService } from '@/services/dailyProductionService';

interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string;
}

interface MonthlyProduction {
  month: string;
  monthDate: Date;
  totalOz: number;
  totalGrams: number;
  avgFineness: number;
  recordCount: number;
  companyName?: string;
}

interface ShippingData {
  status: string;
  count: number;
  weight_oz: number;
}

export function ProductionDashboardModern() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [monthlyProductionByCompany, setMonthlyProductionByCompany] = useState<Map<string, MonthlyProduction[]>>(new Map());
  const [groupMonthlyProduction, setGroupMonthlyProduction] = useState<MonthlyProduction[]>([]);
  const [shippingData, setShippingData] = useState<ShippingData[]>([]);
  const [currentYearProduction, setCurrentYearProduction] = useState(0);
  const [lastMonthProduction, setLastMonthProduction] = useState(0);
  const [activeShipments, setActiveShipments] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const { data: companies } = await supabase
        .from('mining_companies')
        .select('id, name, abbreviation')
        .order('name');

      if (companies) {
        setMiningCompanies(companies);
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11);

      const { data: productions } = await supabase
        .from('daily_production')
        .select(`
          id,
          production_date,
          bullion_grams,
          pure_gold_grams,
          estimated_oz,
          estimated_fineness_pct,
          mining_company_id,
          mining_companies (
            id,
            name,
            abbreviation
          )
        `)
        .gte('production_date', startDate.toISOString().split('T')[0])
        .lte('production_date', endDate.toISOString().split('T')[0]);

      if (productions) {
        const monthsMap = new Map<string, MonthlyProduction>();
        const companyMonthsMap = new Map<string, Map<string, MonthlyProduction>>();

        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });

          monthsMap.set(monthKey, {
            month: monthLabel,
            monthDate: date,
            totalOz: 0,
            totalGrams: 0,
            avgFineness: 0,
            recordCount: 0
          });

          companies?.forEach(company => {
            if (!companyMonthsMap.has(company.id)) {
              companyMonthsMap.set(company.id, new Map());
            }
            companyMonthsMap.get(company.id)!.set(monthKey, {
              month: monthLabel,
              monthDate: date,
              totalOz: 0,
              totalGrams: 0,
              avgFineness: 0,
              recordCount: 0,
              companyName: company.name
            });
          });
        }

        productions.forEach((prod: any) => {
          const prodDate = new Date(prod.production_date);
          const monthKey = `${prodDate.getFullYear()}-${String(prodDate.getMonth() + 1).padStart(2, '0')}`;

          if (monthsMap.has(monthKey)) {
            const monthData = monthsMap.get(monthKey)!;
            monthData.totalOz += prod.estimated_oz || 0;
            monthData.totalGrams += prod.bullion_grams || 0;
            monthData.avgFineness += prod.estimated_fineness_pct || 0;
            monthData.recordCount += 1;
          }

          if (prod.mining_company_id && companyMonthsMap.has(prod.mining_company_id)) {
            const companyMap = companyMonthsMap.get(prod.mining_company_id)!;
            if (companyMap.has(monthKey)) {
              const companyMonthData = companyMap.get(monthKey)!;
              companyMonthData.totalOz += prod.estimated_oz || 0;
              companyMonthData.totalGrams += prod.bullion_grams || 0;
              companyMonthData.avgFineness += prod.estimated_fineness_pct || 0;
              companyMonthData.recordCount += 1;
            }
          }
        });

        monthsMap.forEach((data, key) => {
          if (data.recordCount > 0) {
            data.avgFineness = data.avgFineness / data.recordCount;
          }
        });

        companyMonthsMap.forEach(companyMap => {
          companyMap.forEach((data, key) => {
            if (data.recordCount > 0) {
              data.avgFineness = data.avgFineness / data.recordCount;
            }
          });
        });

        const groupData: MonthlyProduction[] = [];
        monthsMap.forEach(value => groupData.push(value));
        setGroupMonthlyProduction(groupData);

        const companyProductionMap = new Map<string, MonthlyProduction[]>();
        companyMonthsMap.forEach((companyMap, companyId) => {
          const companyData: MonthlyProduction[] = [];
          companyMap.forEach(value => companyData.push(value));
          companyProductionMap.set(companyId, companyData);
        });
        setMonthlyProductionByCompany(companyProductionMap);

        const currentYear = new Date().getFullYear();
        const ytdProductions = productions.filter((p: any) =>
          new Date(p.production_date).getFullYear() === currentYear
        );
        const ytdTotal = ytdProductions.reduce((sum: number, p: any) => sum + (p.estimated_oz || 0), 0);
        setCurrentYearProduction(ytdTotal);

        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
        if (monthsMap.has(lastMonthKey)) {
          setLastMonthProduction(monthsMap.get(lastMonthKey)!.totalOz);
        }
      }

      const { data: shippings } = await supabase
        .from('shipping_preparations')
        .select('id, status, total_weight_oz')
        .in('status', ['prepared', 'ready_for_customs', 'shipped', 'in_transit']);

      if (shippings) {
        const statusCount = new Map<string, { count: number; weight_oz: number }>();

        shippings.forEach((ship: any) => {
          const current = statusCount.get(ship.status) || { count: 0, weight_oz: 0 };
          current.count += 1;
          current.weight_oz += ship.total_weight_oz || 0;
          statusCount.set(ship.status, current);
        });

        const shippingDataArray: ShippingData[] = [];
        statusCount.forEach((value, status) => {
          shippingDataArray.push({
            status,
            count: value.count,
            weight_oz: value.weight_oz
          });
        });

        setShippingData(shippingDataArray);
        setActiveShipments(shippings.length);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  const statusColors: Record<string, string> = {
    prepared: '#3b82f6',
    ready_for_customs: '#f59e0b',
    shipped: '#10b981',
    in_transit: '#8b5cf6'
  };

  const statusLabels: Record<string, string> = {
    prepared: 'Préparé',
    ready_for_customs: 'Prêt Douane',
    shipped: 'Expédié',
    in_transit: 'En Transit'
  };

  const selectedCompanyData = selectedCompany === 'all'
    ? groupMonthlyProduction
    : monthlyProductionByCompany.get(selectedCompany) || [];

  const selectedCompanyName = selectedCompany === 'all'
    ? 'Groupe Mansa Resources'
    : miningCompanies.find(c => c.id === selectedCompany)?.name || '';

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              Tableau de Bord Production
            </h1>
            <p className="text-gray-600 mt-1">Vue d'ensemble de la production et des expéditions</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-amber-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200"
            >
              <option value="all">🌍 Groupe Complet</option>
              {miningCompanies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.abbreviation} - {company.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group relative bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8" />
                <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">YTD</span>
              </div>
              <p className="text-sm opacity-90 mb-1">Production Annuelle</p>
              <div className="text-3xl font-bold">{currentYearProduction.toFixed(2)} oz</div>
              <p className="text-xs opacity-75 mt-2">{(currentYearProduction * 31.1035).toFixed(2)}g</p>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8" />
                <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">MTD</span>
              </div>
              <p className="text-sm opacity-90 mb-1">Mois Précédent</p>
              <div className="text-3xl font-bold">{lastMonthProduction.toFixed(2)} oz</div>
              <p className="text-xs opacity-75 mt-2">{(lastMonthProduction * 31.1035).toFixed(2)}g</p>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8" />
                <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">ACTIF</span>
              </div>
              <p className="text-sm opacity-90 mb-1">Expéditions Actives</p>
              <div className="text-3xl font-bold">{activeShipments}</div>
              <p className="text-xs opacity-75 mt-2">en cours de traitement</p>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <Factory className="w-8 h-8" />
                <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full">MINES</span>
              </div>
              <p className="text-sm opacity-90 mb-1">Sites Actifs</p>
              <div className="text-3xl font-bold">{miningCompanies.length}</div>
              <p className="text-xs opacity-75 mt-2">compagnies minières</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 backdrop-blur-sm bg-white/80 border-2 border-gray-100 shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-amber-600" />
                  Production Mensuelle - {selectedCompanyName}
                </h3>
                <div className="px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-sm font-semibold text-amber-700">12 derniers mois</span>
                </div>
              </div>

              {selectedCompanyData.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={selectedCompanyData}>
                      <defs>
                        <linearGradient id="colorOz" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                        label={{ value: 'Onces (oz)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '2px solid #f59e0b',
                          borderRadius: '12px',
                          padding: '12px'
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="totalOz"
                        fill="url(#colorOz)"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        name="Production (oz)"
                      />
                      <Line
                        type="monotone"
                        dataKey="avgFineness"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Finesse Moy. (%)"
                        dot={{ r: 4, fill: '#10b981' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  Aucune donnée de production disponible
                </div>
              )}
            </div>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 border-2 border-gray-100 shadow-xl">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
                <Package className="w-6 h-6 text-purple-600" />
                État des Expéditions
              </h3>

              {shippingData.length > 0 ? (
                <div className="space-y-4">
                  {shippingData.map((data, index) => {
                    const color = statusColors[data.status] || '#6b7280';
                    const label = statusLabels[data.status] || data.status;
                    const percentage = activeShipments > 0 ? (data.count / activeShipments * 100).toFixed(0) : 0;

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shadow-lg"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-gray-900">{data.count}</span>
                            <span className="text-xs text-gray-500 ml-1">({percentage}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 shadow-inner"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                          {data.weight_oz.toFixed(2)} oz • {(data.weight_oz * 31.1035).toFixed(2)}g
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Aucune expédition active
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {miningCompanies.map((company) => {
            const companyData = monthlyProductionByCompany.get(company.id) || [];
            const totalProduction = companyData.reduce((sum, month) => sum + month.totalOz, 0);
            const avgFineness = companyData.length > 0
              ? companyData.reduce((sum, month) => sum + month.avgFineness, 0) / companyData.length
              : 0;

            return (
              <Card
                key={company.id}
                className="backdrop-blur-sm bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer"
                onClick={() => setSelectedCompany(company.id)}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Factory className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-500 uppercase">{company.abbreviation}</div>
                    </div>
                  </div>

                  <h4 className="text-lg font-bold text-gray-900 mb-4">{company.name}</h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-sm text-emerald-700 font-medium">Production 12M</span>
                      <span className="text-lg font-bold text-emerald-900">{totalProduction.toFixed(2)} oz</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-sm text-blue-700 font-medium">Finesse Moy.</span>
                      <span className="text-lg font-bold text-blue-900">{avgFineness.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="mt-4 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={companyData.slice(-6)}>
                        <defs>
                          <linearGradient id={`miniGradient-${company.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="totalOz"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill={`url(#miniGradient-${company.id})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .group:hover .group-hover\\:scale-150 {
          transform: scale(1.5);
        }
      `}</style>
    </MainLayout>
  );
}
