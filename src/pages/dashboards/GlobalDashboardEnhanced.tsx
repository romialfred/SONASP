import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import {
  Globe,
  TrendingUp,
  Package,
  ShoppingCart,
  Wallet,
  Users,
  AlertCircle,
  MapPin,
  Sparkles,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react';
import {
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { calculateInventoryMetrics } from '@/services/inventoryService';

interface DashboardMetrics {
  totalRevenue: number;
  totalSales: number;
  availableStock: number;
  activeShipments: number;
  pendingApprovals: number;
  activeCustomers: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  sales: number;
  production: number;
}

interface LocationData {
  name: string;
  value: number;
  color: string;
}

export function GlobalDashboardEnhanced() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    totalSales: 0,
    availableStock: 0,
    activeShipments: 0,
    pendingApprovals: 0,
    activeCustomers: 0
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', twelveMonthsAgo.toISOString())
        .order('created_at', { ascending: false });

      const { data: shippingsData } = await supabase
        .from('shipping_preparations')
        .select('*')
        .in('status', ['prepared', 'ready_for_customs', 'shipped', 'in_transit']);

      const { data: customersData } = await supabase
        .from('customers')
        .select('id');

      const inventoryMetrics = await calculateInventoryMetrics();

      const totalRevenue = salesData?.reduce((sum, sale) => sum + (sale.final_proceeds || 0), 0) || 0;

      setMetrics({
        totalRevenue,
        totalSales: salesData?.length || 0,
        availableStock: inventoryMetrics.success ? inventoryMetrics.metrics.availableStock : 0,
        activeShipments: shippingsData?.length || 0,
        pendingApprovals: 5,
        activeCustomers: customersData?.length || 0
      });

      const monthsMap = new Map<string, MonthlyData>();

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' });

        monthsMap.set(monthKey, {
          month: monthLabel,
          revenue: 0,
          sales: 0,
          production: 0
        });
      }

      salesData?.forEach(sale => {
        const saleDate = new Date(sale.created_at);
        const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

        if (monthsMap.has(monthKey)) {
          const monthData = monthsMap.get(monthKey)!;
          monthData.revenue += sale.final_proceeds || 0;
          monthData.sales += 1;
        }
      });

      const { data: productionData } = await supabase
        .from('daily_production')
        .select('*')
        .gte('production_date', twelveMonthsAgo.toISOString().split('T')[0]);

      productionData?.forEach(prod => {
        const prodDate = new Date(prod.production_date);
        const monthKey = `${prodDate.getFullYear()}-${String(prodDate.getMonth() + 1).padStart(2, '0')}`;

        if (monthsMap.has(monthKey)) {
          const monthData = monthsMap.get(monthKey)!;
          monthData.production += prod.estimated_oz || 0;
        }
      });

      const monthlyDataArray: MonthlyData[] = [];
      monthsMap.forEach(value => monthlyDataArray.push(value));
      setMonthlyData(monthlyDataArray);

      setLocationData([
        { name: 'Guinée', value: 45, color: '#f59e0b' },
        { name: 'Mali', value: 30, color: '#10b981' },
        { name: 'Côte d\'Ivoire', value: 25, color: '#3b82f6' }
      ]);

      const recentActivities = [
        {
          id: 1,
          type: 'sale',
          title: 'Nouvelle vente approuvée',
          description: 'Vente #VS-2024-156 - $234,500',
          time: '5 min',
          icon: ShoppingCart,
          color: 'emerald'
        },
        {
          id: 2,
          type: 'shipping',
          title: 'Expédition préparée',
          description: 'EXP-2024-089 - 45.2 oz prêt',
          time: '15 min',
          icon: Package,
          color: 'blue'
        },
        {
          id: 3,
          type: 'approval',
          title: 'En attente d\'approbation',
          description: '3 nouvelles demandes',
          time: '1h',
          icon: AlertCircle,
          color: 'amber'
        }
      ];
      setRecentActivity(recentActivities);

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

  const revenueChange = monthlyData.length >= 2
    ? ((monthlyData[monthlyData.length - 1].revenue - monthlyData[monthlyData.length - 2].revenue) / monthlyData[monthlyData.length - 2].revenue * 100)
    : 0;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <Globe className="w-7 h-7 text-white" />
              </div>
              Tableau de Bord Global
            </h1>
            <p className="text-gray-600 mt-2">Vue d'ensemble complète • Groupe Mansa Resources</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="group relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div className="flex items-center gap-1 text-xs bg-white/20 px-3 py-1 rounded-full">
                  {revenueChange >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span className="font-bold">{Math.abs(revenueChange).toFixed(1)}%</span>
                </div>
              </div>
              <p className="text-sm opacity-90 mb-2">Revenus Totaux</p>
              <div className="text-4xl font-bold mb-1">
                ${(metrics.totalRevenue / 1000000).toFixed(2)}M
              </div>
              <p className="text-xs opacity-75">{metrics.totalSales} ventes complétées</p>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Package className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">EN COURS</span>
              </div>
              <p className="text-sm opacity-90 mb-2">Expéditions Actives</p>
              <div className="text-4xl font-bold mb-1">{metrics.activeShipments}</div>
              <p className="text-xs opacity-75">en traitement</p>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-2xl p-6 text-white shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">STOCK</span>
              </div>
              <p className="text-sm opacity-90 mb-2">Stock Disponible</p>
              <div className="text-4xl font-bold mb-1">{metrics.availableStock.toFixed(2)} oz</div>
              <p className="text-xs opacity-75">{(metrics.availableStock * 31.1035).toFixed(2)}g disponible</p>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 rounded-2xl p-6 text-white shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Users className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">CLIENTS</span>
              </div>
              <p className="text-sm opacity-90 mb-2">Clients Actifs</p>
              <div className="text-4xl font-bold mb-1">{metrics.activeCustomers}</div>
              <p className="text-xs opacity-75">partenaires actifs</p>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 rounded-2xl p-6 text-white shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">URGENT</span>
              </div>
              <p className="text-sm opacity-90 mb-2">Approbations Requises</p>
              <div className="text-4xl font-bold mb-1">{metrics.pendingApprovals}</div>
              <p className="text-xs opacity-75">en attente</p>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-cyan-500 via-cyan-600 to-cyan-700 rounded-2xl p-6 text-white shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Wallet className="w-8 h-8" />
                </div>
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">MTD</span>
              </div>
              <p className="text-sm opacity-90 mb-2">Revenus ce Mois</p>
              <div className="text-4xl font-bold mb-1">
                ${monthlyData.length > 0 ? (monthlyData[monthlyData.length - 1].revenue / 1000).toFixed(1) : 0}K
              </div>
              <p className="text-xs opacity-75">mois en cours</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 backdrop-blur-xl bg-white/90 border-2 border-gray-100 shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-600" />
                  Performance 12 Mois
                </h3>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-gray-600">Revenus</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600">Production</span>
                  </div>
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis yAxisId="left" stroke="#6b7280" />
                    <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '2px solid #10b981',
                        borderRadius: '12px'
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      fill="url(#colorRevenue)"
                      stroke="#10b981"
                      strokeWidth={3}
                      name="Revenus ($)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="production"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      name="Production (oz)"
                      dot={{ r: 5, fill: '#3b82f6' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="backdrop-blur-xl bg-white/90 border-2 border-gray-100 shadow-2xl">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
                  <MapPin className="w-6 h-6 text-amber-600" />
                  Production par Pays
                </h3>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={locationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {locationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 mt-4">
                  {locationData.map((location, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: location.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{location.name}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{location.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="backdrop-blur-xl bg-white/90 border-2 border-gray-100 shadow-2xl">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                  Activité Récente
                </h3>

                <div className="space-y-4">
                  {recentActivity.map((activity) => {
                    const Icon = activity.icon;
                    const colorClasses = {
                      emerald: 'bg-emerald-100 text-emerald-600',
                      blue: 'bg-blue-100 text-blue-600',
                      amber: 'bg-amber-100 text-amber-600'
                    };

                    return (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[activity.color as keyof typeof colorClasses]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                          <p className="text-xs text-gray-500">{activity.description}</p>
                        </div>
                        <span className="text-xs text-gray-400">{activity.time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
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

        .shadow-3xl {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </MainLayout>
  );
}
