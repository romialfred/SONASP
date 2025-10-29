import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { Search, Download, Grid3x3, TableProperties, Package, Calendar, Scale } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { supabase } from '@/lib/supabase';
import { getBatchStatusLabel, getBatchStatusVariant, getBatchStatusOptions } from '@/constants/batchStatuses';
import { cn } from '@/utils/cn';

interface Batch {
  id: string;
  batch_number: string;
  created_at: string;
  weight_grams: number;
  weight_ounces?: number;
  fineness_percentage?: number;
  status: string;
  created_by?: string;
}

type ViewMode = 'table' | 'grid';

export function BatchesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    async function fetchBatches() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('batches')
          .select('id, batch_number, created_at, weight_grams, weight_ounces, fineness_percentage, status, created_by')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setBatches(data);
        } else if (error) {
          console.error('Error fetching batches:', error);
        }
      } catch (error) {
        console.error('Error fetching batches:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBatches();
  }, []);

  const filteredBatches = batches.filter((batch) => {
    const matchesSearch =
      batch.batch_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const variant = getBatchStatusVariant(status);
    const colorMap = {
      success: 'bg-emerald-50/60 border-emerald-200',
      warning: 'bg-amber-50/60 border-amber-200',
      danger: 'bg-red-50/60 border-red-200',
      info: 'bg-blue-50/60 border-blue-200',
      default: 'bg-gray-50/60 border-gray-200'
    };
    return colorMap[variant] || colorMap.default;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Batches</h1>
            <p className="text-gray-600 mt-1">Manage gold batch inventory and tracking</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <Card>
          <div className="p-6 space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[250px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by batch number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                {getBatchStatusOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* View Toggle */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "px-3 py-2 rounded-md transition-colors flex items-center gap-2",
                    viewMode === 'table'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <TableProperties className="w-4 h-4" />
                  <span className="text-sm font-medium">Table</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "px-3 py-2 rounded-md transition-colors flex items-center gap-2",
                    viewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Grid3x3 className="w-4 h-4" />
                  <span className="text-sm font-medium">Tuiles</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="lg" />
              </div>
            ) : viewMode === 'table' ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Batch Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Created
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Weight
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fineness (%)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredBatches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {batch.batch_number}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                            {new Date(batch.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                            {batch.weight_ounces ? `${batch.weight_ounces.toFixed(2)} oz` : `${batch.weight_grams.toFixed(2)}g`}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                            {batch.fineness_percentage ? `${batch.fineness_percentage.toFixed(1)}%` : 'N/A'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge label={getBatchStatusLabel(batch.status)} variant={getBatchStatusVariant(batch.status)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredBatches.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-sm">
                      {batches.length === 0 ? 'No batches created yet.' : 'No batches found matching your criteria.'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Grid View - 3 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className={cn(
                        "relative backdrop-blur-sm rounded-xl border p-4 hover:shadow-lg transition-all duration-200",
                        getStatusColor(batch.status)
                      )}
                    >
                      {/* Icon in top-left corner */}
                      <div className="absolute top-3 left-3 w-10 h-10 bg-white/80 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-amber-600" />
                      </div>

                      {/* Content */}
                      <div className="pl-14">
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          Batch Number
                        </p>
                        <h3 className="text-base font-bold text-gray-900 mb-2">
                          {batch.batch_number}
                        </h3>

                        <div className="space-y-2">
                          {/* Date */}
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(batch.created_at).toLocaleDateString()}</span>
                          </div>

                          {/* Weight */}
                          <div className="flex items-center gap-2 text-xs text-gray-900 font-medium">
                            <Scale className="w-3.5 h-3.5" />
                            {batch.weight_ounces ? (
                              <span>
                                {batch.weight_ounces.toFixed(2)} oz
                                <span className="text-gray-500 font-normal ml-1">
                                  ({batch.weight_grams.toFixed(2)}g)
                                </span>
                              </span>
                            ) : (
                              <span>{batch.weight_grams.toFixed(2)}g</span>
                            )}
                          </div>

                          {/* Fineness */}
                          {batch.fineness_percentage && (
                            <div className="text-xs text-gray-600">
                              Fineness: <span className="font-medium text-gray-900">{batch.fineness_percentage.toFixed(1)}%</span>
                            </div>
                          )}

                          {/* Status Badge */}
                          <div className="pt-2">
                            <StatusBadge
                              label={getBatchStatusLabel(batch.status)}
                              variant={getBatchStatusVariant(batch.status)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredBatches.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-sm">
                      {batches.length === 0 ? 'No batches created yet.' : 'No batches found matching your criteria.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
