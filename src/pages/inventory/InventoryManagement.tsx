import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Package, AlertCircle, Download } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import {
  getCurrentInventoryStatus,
  getMonthlyInventorySummary,
  calculateInventoryMetrics,
  type MonthlyInventorySummary
} from '@/services/inventoryService';

interface InventoryStatus {
  id: string;
  entry_date: string;
  batch_number: string;
  final_fine_oz: number;
  quantity_available_oz: number;
  quantity_allocated_oz: number;
  quantity_sold_oz: number;
  fineness_percentage: number;
  metal_retained_percentage: number;
  transaction_type: string;
  created_by_name: string;
  created_at: string;
}

export function InventoryManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inventoryEntries, setInventoryEntries] = useState<InventoryStatus[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyInventorySummary[]>([]);
  const [metrics, setMetrics] = useState({
    totalStock: 0,
    availableStock: 0,
    allocatedStock: 0,
    soldStock: 0
  });

  useEffect(() => {
    loadInventoryData();
  }, []);

  async function loadInventoryData() {
    setLoading(true);
    try {
      const [statusResult, summaryResult, metricsResult] = await Promise.all([
        getCurrentInventoryStatus(),
        getMonthlyInventorySummary(),
        calculateInventoryMetrics()
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
    } catch (error) {
      console.error('Error loading inventory data:', error);
    } finally {
      setLoading(false);
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

  const metricCards = [
    {
      title: 'Total Stock',
      value: `${metrics.totalStock.toFixed(2)} oz`,
      valueInGrams: metrics.totalStock * 31.1035,
      subtitle: 'All refined gold',
      changeType: 'neutral' as const,
      icon: Package,
      iconColor: 'text-primary-600',
      iconBgColor: 'bg-primary-100'
    },
    {
      title: 'Available for Sale',
      value: `${metrics.availableStock.toFixed(2)} oz`,
      valueInGrams: metrics.availableStock * 31.1035,
      subtitle: stockStatus.label,
      changeType: stockLevel < 100 ? ('negative' as const) : ('positive' as const),
      icon: TrendingUp,
      iconColor: stockLevel < 100 ? 'text-orange-600' : 'text-emerald-600',
      iconBgColor: stockLevel < 100 ? 'bg-orange-100' : 'bg-emerald-100'
    },
    {
      title: 'Allocated to Sales',
      value: `${metrics.allocatedStock.toFixed(2)} oz`,
      valueInGrams: metrics.allocatedStock * 31.1035,
      subtitle: 'Reserved quantities',
      changeType: 'neutral' as const,
      icon: AlertCircle,
      iconColor: 'text-blue-600',
      iconBgColor: 'bg-blue-100'
    },
    {
      title: 'Total Sold',
      value: `${metrics.soldStock.toFixed(2)} oz`,
      valueInGrams: metrics.soldStock * 31.1035,
      subtitle: 'Completed sales',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      iconBgColor: 'bg-emerald-100'
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Gold Inventory Management
            </h1>
            <p className="text-gray-600 mt-1">
              Track and manage pure gold inventory from refining to sales
            </p>
          </div>
          <Button variant="primary" onClick={handleAddStock} className="gap-2">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metricCards.map((metric) => (
                <MetricCard key={metric.title} {...metric} />
              ))}
            </div>

            {stockLevel < 100 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-orange-900">
                        {stockLevel < 50 ? 'Critical Stock Level' : 'Low Stock Alert'}
                      </p>
                      <p className="text-sm text-orange-800">
                        Available stock is {stockLevel < 50 ? 'critically' : ''} low at {stockLevel.toFixed(2)} oz.
                        Consider increasing refining operations.
                      </p>
                    </div>
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
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Month
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Entries
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Batches
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Added (oz)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Sold (oz)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Available (oz)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Avg Fineness %
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {monthlySummary.map((summary) => (
                          <tr key={summary.month} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {new Date(summary.month).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long'
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                              {summary.total_entries}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                              {summary.total_batches}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-green-600">
                              +{summary.total_entries_oz.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-red-600">
                              -{summary.total_exits_oz.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                              {summary.available_stock_oz.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                              {summary.avg_fineness_percentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
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
                      Start adding refined gold to inventory
                    </p>
                    <Button
                      variant="primary"
                      onClick={handleAddStock}
                      className="mt-4 gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Entry
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Batch Number
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Final Fine (oz)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Available (oz)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Allocated (oz)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Sold (oz)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Fineness %
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {inventoryEntries.slice(0, 10).map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {new Date(entry.entry_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {entry.batch_number}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                              {entry.final_fine_oz.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
                              {entry.quantity_available_oz.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-blue-600">
                              {entry.quantity_allocated_oz.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                              {entry.quantity_sold_oz.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                              {entry.fineness_percentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
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
