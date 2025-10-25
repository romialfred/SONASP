import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Search, Download, Loader } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { supabase } from '@/lib/supabase';

interface BatchWithTransport {
  id: string;
  batch_number: string;
  weight_grams: number;
  shipping_date: string;
  status: string;
  origin_site: {
    name: string;
    country: string;
  } | null;
  mine_transport: {
    name: string;
  } | null;
  airport_transport: {
    name: string;
  } | null;
  refinery: {
    name: string;
    location: string;
  } | null;
}

export function ShippingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batches, setBatches] = useState<BatchWithTransport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('batches')
        .select(`
          id,
          batch_number,
          weight_grams,
          shipping_date,
          status,
          origin_site:sites!batches_origin_site_id_fkey(name, country),
          mine_transport:transport_companies!batches_mine_to_airport_transport_id_fkey(name),
          airport_transport:transport_companies!batches_airport_to_refinery_transport_id_fkey(name),
          refinery:refineries!batches_destination_refinery_id_fkey(name, location)
        `)
        .order('shipping_date', { ascending: false })
        .limit(100);

      if (fetchError) {
        throw fetchError;
      }

      setBatches(data || []);
    } catch (err: any) {
      console.error('Error loading batches:', err);
      setError(err.message || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const filteredBatches = batches.filter((batch) => {
    const matchesSearch =
      batch.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.mine_transport?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.airport_transport?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.refinery?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'created':
      case 'pending':
        return 'warning';
      case 'shipped':
      case 'in_transit':
        return 'info';
      case 'received':
      case 'delivered':
        return 'success';
      default:
        return 'default';
    }
  };

  const exportData = () => {
    const csv = [
      ['Batch Number', 'Weight (g)', 'Origin', 'Mine Transport', 'Airport Transport', 'Destination Refinery', 'Ship Date', 'Status'],
      ...filteredBatches.map(batch => [
        batch.batch_number,
        batch.weight_grams.toString(),
        batch.origin_site ? `${batch.origin_site.name}, ${batch.origin_site.country}` : 'N/A',
        batch.mine_transport?.name || 'N/A',
        batch.airport_transport?.name || 'N/A',
        batch.refinery ? `${batch.refinery.name}, ${batch.refinery.location}` : 'N/A',
        new Date(batch.shipping_date).toLocaleDateString(),
        batch.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shipping</h1>
            <p className="text-gray-600 mt-1">Track shipments and logistics across the supply chain</p>
          </div>
          <button
            onClick={exportData}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            disabled={filteredBatches.length === 0}
          >
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
                  placeholder="Search by batch number, transport company, or refinery..."
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
                <option value="created">Created</option>
                <option value="shipped">Shipped</option>
                <option value="in_transit">In Transit</option>
                <option value="received">Received</option>
              </select>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin text-amber-500" />
                <span className="ml-3 text-gray-600">Loading shipments...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">Error loading shipments</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <button
                  onClick={loadBatches}
                  className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Batch Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Weight
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Origin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mine Transport
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Airport Transport
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Destination
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ship Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredBatches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {batch.batch_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {batch.weight_grams.toFixed(2)}g
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {batch.origin_site ? `${batch.origin_site.name}, ${batch.origin_site.country}` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {batch.mine_transport?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {batch.airport_transport?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {batch.refinery ? `${batch.refinery.name}` : 'N/A'}
                            {batch.refinery && (
                              <span className="block text-xs text-gray-400">
                                {batch.refinery.location}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(batch.shipping_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={batch.status} variant={getStatusVariant(batch.status)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredBatches.length === 0 && !loading && !error && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No shipments found matching your criteria.</p>
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
