import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { Search, Download } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { supabase } from '@/lib/supabase';

interface RefiningRecord {
  id: string;
  batch_id: string;
  refinery_name?: string;
  pre_melt_weight_grams?: number;
  post_melt_weight_grams?: number;
  fineness_percentage?: number;
  metal_retained_percentage?: number;
  status: string;
  created_at: string;
}

interface Batch {
  id: string;
  batch_number: string;
  weight_grams: number;
}

export function RefiningPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refiningRecords, setRefiningRecords] = useState<RefiningRecord[]>([]);
  const [batches, setBatches] = useState<Record<string, Batch>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRefiningData() {
      setLoading(true);
      try {
        const { data: refiningData, error: refiningError } = await supabase
          .from('refining_records')
          .select('id, batch_id, refinery_name, pre_melt_weight_grams, post_melt_weight_grams, fineness_percentage, metal_retained_percentage, status, created_at')
          .order('created_at', { ascending: false });

        if (!refiningError && refiningData) {
          setRefiningRecords(refiningData);

          const batchIds = [...new Set(refiningData.map(r => r.batch_id))];

          if (batchIds.length > 0) {
            const { data: batchData, error: batchError } = await supabase
              .from('batches')
              .select('id, batch_number, weight_grams')
              .in('id', batchIds);

            if (!batchError && batchData) {
              const batchMap = batchData.reduce((acc, batch) => {
                acc[batch.id] = batch;
                return acc;
              }, {} as Record<string, Batch>);
              setBatches(batchMap);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching refining data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRefiningData();
  }, []);

  const filteredRefining = refiningRecords.filter((refining) => {
    const batch = batches[refining.batch_id];
    const matchesSearch =
      (batch?.batch_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (refining.refinery_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || refining.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'in_progress':
        return 'info';
      case 'completed':
        return 'success';
      case 'approved':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'approved':
        return 'Approved';
      default:
        return status;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Refining</h1>
            <p className="text-gray-600 mt-1">Monitor refining processes and assay results</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <Card>
          <div className="p-6 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by batch number or refinery..."
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
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="approved">Approved</option>
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="lg" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Batch Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Refinery
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pre-Melt (g)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Post-Melt (g)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fineness %
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Yield %
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRefining.map((refining) => {
                        const batch = batches[refining.batch_id];
                        const yieldPct = refining.pre_melt_weight_grams && refining.post_melt_weight_grams
                          ? (refining.post_melt_weight_grams / refining.pre_melt_weight_grams) * 100
                          : null;

                        return (
                          <tr key={refining.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {batch?.batch_number || 'Unknown'}
                              {batch && (
                                <span className="block text-xs text-gray-400">
                                  Original: {batch.weight_grams.toFixed(2)}g
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {refining.refinery_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {refining.pre_melt_weight_grams ? refining.pre_melt_weight_grams.toFixed(2) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {refining.post_melt_weight_grams ? refining.post_melt_weight_grams.toFixed(2) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {refining.fineness_percentage ? refining.fineness_percentage.toFixed(2) + '%' : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {yieldPct ? yieldPct.toFixed(2) + '%' : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <StatusBadge status={getStatusLabel(refining.status)} variant={getStatusVariant(refining.status)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredRefining.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {refiningRecords.length === 0 ? 'No refining records yet.' : 'No refining records found matching your criteria.'}
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
