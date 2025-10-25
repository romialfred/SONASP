import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Search, Download } from 'lucide-react';
import { demoRefining, demoBatches, type Refining } from '@/lib/demoSeed';
import { StatusBadge } from '@/components/dashboard/StatusBadge';

export function RefiningPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRefining = demoRefining.filter((refining) => {
    const matchesSearch =
      refining.refining_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      refining.refinery.toLowerCase().includes(searchQuery.toLowerCase()) ||
      refining.batch_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || refining.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusVariant = (status: Refining['status']) => {
    switch (status) {
      case 'Queued':
        return 'warning';
      case 'Processing':
        return 'info';
      case 'Completed':
        return 'success';
      default:
        return 'default';
    }
  };

  const getBatchInfo = (batchId: string) => {
    return demoBatches.find(b => b.batch_id === batchId);
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
                  placeholder="Search by refining ID, batch ID, or refinery..."
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
                <option value="Queued">Queued</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Refining ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Refinery
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fine Weight (g)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assay %
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
                    const batch = getBatchInfo(refining.batch_id);
                    return (
                      <tr key={refining.refining_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {refining.refining_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {refining.batch_id}
                          {batch && (
                            <span className="block text-xs text-gray-400">
                              Gross: {batch.gross_weight_g.toFixed(2)}g
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {refining.refinery}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(refining.start_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {refining.fine_weight_g > 0 ? refining.fine_weight_g.toFixed(2) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {refining.assay_pct > 0 ? refining.assay_pct.toFixed(2) + '%' : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {refining.yield_pct > 0 ? refining.yield_pct.toFixed(2) + '%' : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={refining.status} variant={getStatusVariant(refining.status)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRefining.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No refining records found matching your criteria.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
