import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Download, Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { convertGramsToOunces, formatWeight } from '@/utils/salesUtils';
import { formatDateStandard } from '@/utils/dateUtils';

interface MiningCompany {
  id: string;
  name: string;
  country?: string;
}

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  metal_type?: string;
  shipping_date?: string;
  created_at: string;
  mining_company_id?: string;
  mining_company?: MiningCompany;
}

const REFINERY_STATUSES = [
  'validated_at_airport',
  'in_transit_to_refinery',
  'received_at_refinery',
  'refinery_receipt_validated',
  'processing',
  'processed'
];

export function RefiningPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          mining_company:mining_companies(id, name, country)
        `)
        .in('status', REFINERY_STATUSES)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const enrichedBatches = data.map((batch: any) => ({
          ...batch,
          weight_ounces: batch.weight_ounces || convertGramsToOunces(batch.weight_grams),
        }));
        setBatches(enrichedBatches);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleExport = () => {
    console.log('Export functionality to be implemented');
  };

  const handleBatchClick = (batchId: string) => {
    navigate(`/batches/${batchId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion du Raffinage</h1>
            <p className="text-gray-600 mt-1">
              Suivez et gérez les batches en cours de raffinage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exporter
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/refining/process')}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="w-4 h-4" />
              Traiter un Batch
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <Loading size="lg" />
            </div>
          </Card>
        ) : (
          <Card>
            <div className="p-6">
              {batches.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Batch Number
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Weight
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Mining Company
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch) => (
                        <tr
                          key={batch.id}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleBatchClick(batch.id)}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {batch.batch_number}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {batch.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {formatWeight(batch.weight_grams)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {batch.mining_company?.name || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {formatDateStandard(batch.shipping_date || batch.created_at)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBatchClick(batch.id);
                              }}
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">
                    Aucun batch en raffinerie. Les batches validés apparaîtront ici.
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
