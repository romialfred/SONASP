import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Package, AlertCircle, Download, Boxes, ArrowUpRight, ArrowDownRight, BarChart3, Building2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import {
  getCurrentInventoryStatus,
  getMonthlyInventorySummary,
  calculateInventoryMetrics,
  type MonthlyInventorySummary
} from '@/services/inventoryService';

interface InventoryStatus {
  id: string;
  entry_date: string;
  reference_number: string;
  final_fine_oz: number;
  quantity_available_oz: number;
  quantity_allocated_oz: number;
  quantity_sold_oz: number;
  fineness_percentage: number;
  metal_retained_percentage: number;
  transaction_type: string;
  created_by_name: string;
  created_at: string;
  mining_company_name?: string;
  mining_company_abbr?: string;
}

interface MiningCompanyInventory {
  company_id: string;
  company_name: string;
  company_abbr: string;
  total_stock: number;
  available_stock: number;
  allocated_stock: number;
  sold_stock: number;
  total_entries: number;
}

export function InventoryManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inventoryEntries, setInventoryEntries] = useState<InventoryStatus[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyInventorySummary[]>([]);
  const [companyInventories, setCompanyInventories] = useState<MiningCompanyInventory[]>([]);
  const [availableShipmentsCount, setAvailableShipmentsCount] = useState(0);
  const [metrics, setMetrics] = useState({
    totalStock: 0,
    availableStock: 0,
    allocatedStock: 0,
    soldStock: 0
  });

  useEffect(() => {
    loadInventoryData();
    checkAvailableShipments();
  }, []);

  async function loadInventoryData() {
    setLoading(true);
    try {
      const [statusResult, summaryResult, metricsResult, companyResult] = await Promise.all([
        getCurrentInventoryStatus(),
        getMonthlyInventorySummary(),
        calculateInventoryMetrics(),
        loadInventoryByCompany()
      ]);

      if (statusResult.success) {
        setInventoryEntries(statusResult.data);
      }

      if (summaryResult.success) {
        setMonthlySummary(summaryResult.data);
      }

      if (metricsResult.success) {
        setMetrics(metricsResult.metrics);
      }

      if (companyResult) {
        setCompanyInventories(companyResult);
      }
    } catch (error) {
      console.error('Error loading inventory data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadInventoryByCompany() {
    try {
      // Get inventory with freight_shipment_id
      const { data: inventoryData, error: invError } = await supabase
        .from('gold_inventory')
        .select(`
          id,
          final_fine_oz,
          quantity_available_oz,
          quantity_allocated_oz,
          quantity_sold_oz,
          freight_shipment_id
        `)
        .not('freight_shipment_id', 'is', null);

      if (invError) throw invError;

      if (!inventoryData || inventoryData.length === 0) {
        return [];
      }

      // Get freight_shipment_productions to link shipments to productions
      const shipmentIds = inventoryData.map(inv => inv.freight_shipment_id);
      const { data: shipmentProductions, error: spError } = await supabase
        .from('freight_shipment_productions')
        .select(`
          freight_shipment_id,
          production:daily_production (
            mining_company_id,
            mining_company:mining_companies (
              id,
              name,
              abbreviation
            )
          )
        `)
        .in('freight_shipment_id', shipmentIds);

      if (spError) throw spError;

      // Map shipment_id to mining_company (take first production's company for simplicity)
      const shipmentToCompany = new Map<string, any>();
      shipmentProductions?.forEach((sp: any) => {
        if (sp.freight_shipment_id && sp.production?.mining_company && !shipmentToCompany.has(sp.freight_shipment_id)) {
          shipmentToCompany.set(sp.freight_shipment_id, sp.production.mining_company);
        }
      });

      // Group by mining company
      const companyMap = new Map<string, MiningCompanyInventory>();

      inventoryData.forEach((item: any) => {
        const company = shipmentToCompany.get(item.freight_shipment_id);
        if (!company) return;

        const companyId = company.id;
        if (!companyMap.has(companyId)) {
          companyMap.set(companyId, {
            company_id: companyId,
            company_name: company.name,
            company_abbr: company.abbreviation,
            total_stock: 0,
            available_stock: 0,
            allocated_stock: 0,
            sold_stock: 0,
            total_entries: 0
          });
        }

        const companyData = companyMap.get(companyId)!;
        companyData.total_stock += item.final_fine_oz || 0;
        companyData.available_stock += item.quantity_available_oz || 0;
        companyData.allocated_stock += item.quantity_allocated_oz || 0;
        companyData.sold_stock += item.quantity_sold_oz || 0;
        companyData.total_entries += 1;
      });

      return Array.from(companyMap.values()).sort((a, b) =>
        b.total_stock - a.total_stock
      );
    } catch (error) {
      console.error('Error loading inventory by company:', error);
      return [];
    }
  }

  async function checkAvailableShipments() {
    try {
      const { count, error } = await supabase
        .from('freight_shipments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_stock');

      if (!error && count !== null) {
        setAvailableShipmentsCount(count);
      }
    } catch (error) {
      console.error('Error checking available shipments:', error);
    }
  }

  function handleAddStock() {
    navigate('/inventory/add');
  }

  function handleViewMonthlyDetails(month: string) {
    navigate(`/inventory/monthly/${month}`);
  }

  const stockLevel = metrics.availableStock;
  const stockStatus =
    stockLevel < 50
      ? { label: 'Critical', color: 'text-red-600' }
      : stockLevel < 100
      ? { label: 'Low', color: 'text-orange-600' }
      : { label: 'Healthy', color: 'text-green-600' };

  // Prepare chart data for monthly summary
  const monthlyChartData = monthlySummary.slice(0, 6).reverse().map(summary => ({
    month: new Date(summary.month).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    Ajouté: parseFloat(summary.total_entries_oz.toFixed(2)),
    Vendu: parseFloat(summary.total_exits_oz.toFixed(2)),
    Disponible: parseFloat(summary.available_stock_oz.toFixed(2))
  }));

  // Prepare chart data for companies
  const companyChartData = companyInventories.map(company => ({
    name: company.company_abbr,
    fullName: company.company_name,
    'En Stock': parseFloat(company.available_stock.toFixed(2)),
    'Réservé': parseFloat(company.allocated_stock.toFixed(2)),
    'Vendu': parseFloat(company.sold_stock.toFixed(2))
  }));

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];

  const metricCards = [
    {
      title: 'Total Stock',
      value: `${metrics.totalStock.toFixed(2)} oz`,
      valueInGrams: metrics.totalStock * 31.1035,
      subtitle: 'All refined gold',
      changeType: 'neutral' as const,
      icon: Package,
      iconColor: 'text-primary-600',
      iconBgColor: 'bg-primary-100',
      cardBgColor: 'bg-primary-50/60'
    },
    {
      title: 'Available for Sale',
      value: `${metrics.availableStock.toFixed(2)} oz`,
      valueInGrams: metrics.availableStock * 31.1035,
      subtitle: stockStatus.label,
      changeType: stockLevel < 100 ? ('negative' as const) : ('positive' as const),
      icon: TrendingUp,
      iconColor: stockLevel < 100 ? 'text-orange-600' : 'text-emerald-600',
      iconBgColor: stockLevel < 100 ? 'bg-orange-100' : 'bg-emerald-100',
      cardBgColor: stockLevel < 100 ? 'bg-orange-50/60' : 'bg-emerald-50/60'
    },
    {
      title: 'Allocated to Sales',
      value: `${metrics.allocatedStock.toFixed(2)} oz`,
      valueInGrams: metrics.allocatedStock * 31.1035,
      subtitle: 'Reserved quantities',
      changeType: 'neutral' as const,
      icon: AlertCircle,
      iconColor: 'text-blue-600',
      iconBgColor: 'bg-blue-100',
      cardBgColor: 'bg-blue-50/60'
    },
    {
      title: 'Total Sold',
      value: `${metrics.soldStock.toFixed(2)} oz`,
      valueInGrams: metrics.soldStock * 31.1035,
      subtitle: 'Completed sales',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      iconBgColor: 'bg-emerald-100',
      cardBgColor: 'bg-emerald-50/60'
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Gold Inventory Management
            </h1>
            <p className="text-gray-600 mt-1">
              Track and manage pure gold inventory from refined shipments to sales
            </p>
            {availableShipmentsCount > 0 && (
              <p className="text-sm text-emerald-600 font-medium mt-2">
                {availableShipmentsCount} shipment{availableShipmentsCount > 1 ? 's' : ''} ready for stock entry
              </p>
            )}
          </div>
          <Button
            variant="primary"
            onClick={handleAddStock}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Stock Entry
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metricCards.map((metric, index) => (
                <div
                  key={metric.title}
                  className={`relative overflow-hidden rounded-lg border ${
                    index === 0 ? 'border-primary-200 bg-gradient-to-br from-primary-50 to-amber-50' :
                    index === 1 ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50' :
                    index === 2 ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50' :
                    'border-green-200 bg-gradient-to-br from-green-50 to-lime-50'
                  } p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg ${metric.iconBgColor}`}>
                      <metric.icon className={`h-5 w-5 ${metric.iconColor}`} />
                    </div>
                    {metric.changeType !== 'neutral' && (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        metric.changeType === 'positive' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {metric.changeType === 'positive' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                      {metric.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mb-1">
                      {metric.value}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(metric.valueInGrams / 1000).toFixed(3)} kg • {metric.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {stockLevel < 100 && (
              <div className="relative overflow-hidden rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-orange-900 mb-1">
                      {stockLevel < 50 ? 'Critical Stock Level' : 'Low Stock Alert'}
                    </h3>
                    <p className="text-xs text-orange-800 mb-2">
                      Available stock is {stockLevel < 50 ? 'critically' : ''} low at <span className="font-bold">{stockLevel.toFixed(2)} oz</span>.
                      Consider increasing refining operations.
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-orange-600" />
                        <span className="text-gray-600">Current: {stockLevel.toFixed(2)} oz</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
                        <span className="text-gray-600">Target: 100+ oz</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Section */}
            {(companyChartData.length > 0 || monthlyChartData.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Inventory by Mining Company */}
                {companyChartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary-600" />
                        <CardTitle>Inventory by Mining Company</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={companyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            stroke="#6b7280"
                          />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            stroke="#6b7280"
                            label={{ value: 'Ounces (oz)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                            formatter={(value: any) => `${value.toFixed(2)} oz`}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '12px' }}
                            iconType="rect"
                          />
                          <Bar dataKey="En Stock" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Réservé" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Vendu" fill="#6B7280" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Monthly Trend */}
                {monthlyChartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary-600" />
                        <CardTitle>Monthly Inventory Trend (Last 6 Months)</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 12 }}
                            stroke="#6b7280"
                          />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            stroke="#6b7280"
                            label={{ value: 'Ounces (oz)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                            formatter={(value: any) => `${value.toFixed(2)} oz`}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '12px' }}
                            iconType="rect"
                          />
                          <Bar dataKey="Ajouté" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Vendu" fill="#EF4444" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Disponible" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Inventory by Company Table */}
            {companyInventories.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary-600" />
                      <CardTitle>Inventory Details by Mining Company</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Mining Company
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Entries
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Total Stock (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Available (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Allocated (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Sold (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            % of Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {companyInventories.map((company) => {
                          const percentOfTotal = metrics.totalStock > 0
                            ? (company.total_stock / metrics.totalStock * 100)
                            : 0;

                          return (
                            <tr key={company.company_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">{company.company_name}</div>
                                  <div className="text-xs text-gray-500">{company.company_abbr}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                                {company.total_entries}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                {company.total_stock.toFixed(4)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-emerald-600">
                                {company.available_stock.toFixed(4)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                                {company.allocated_stock.toFixed(4)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                                {company.sold_stock.toFixed(4)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary-100 text-primary-800">
                                  {percentOfTotal.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            TOTAL
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                            {companyInventories.reduce((sum, c) => sum + c.total_entries, 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                            {metrics.totalStock.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600">
                            {metrics.availableStock.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                            {metrics.allocatedStock.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                            {metrics.soldStock.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-primary-700">
                            100%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Monthly Inventory Summary</CardTitle>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {monthlySummary.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No monthly data available yet
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Month
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Entries
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Shipments
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Added (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Sold (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Available (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Avg Fineness %
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {monthlySummary.map((summary) => (
                          <tr key={summary.month} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                              {new Date(summary.month).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long'
                              })}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right text-gray-600">
                              {summary.total_entries}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right text-gray-600">
                              {summary.total_shipments || 0}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right font-medium text-green-600">
                              +{summary.total_entries_oz.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right font-medium text-red-600">
                              -{summary.total_exits_oz.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                              {summary.available_stock_oz.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right text-gray-600">
                              {summary.avg_fineness_percentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewMonthlyDetails(summary.month)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Inventory Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {inventoryEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No inventory entries yet</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Start adding refined gold shipments to inventory
                    </p>
                    {availableShipmentsCount > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm text-emerald-600 font-medium mb-2">
                          {availableShipmentsCount} refined shipment{availableShipmentsCount > 1 ? 's' : ''} ready for inventory
                        </p>
                        <Button
                          variant="primary"
                          onClick={handleAddStock}
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Stock Entry
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 mt-4">
                        No refined shipments available. Complete refining process first.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Reference Number
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Final Fine (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Available (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Allocated (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Sold (oz)
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Fineness %
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {inventoryEntries.slice(0, 10).map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                              {new Date(entry.entry_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm font-medium text-gray-900">
                              {entry.reference_number}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                              {entry.final_fine_oz.toFixed(4)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right text-green-600">
                              {entry.quantity_available_oz.toFixed(4)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right text-blue-600">
                              {entry.quantity_allocated_oz.toFixed(4)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right text-gray-600">
                              {entry.quantity_sold_oz.toFixed(4)}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-right text-gray-600">
                              {entry.fineness_percentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  entry.transaction_type === 'entry'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {entry.transaction_type === 'entry' ? 'Entry' : 'Exit'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
