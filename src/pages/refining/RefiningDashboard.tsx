import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flame, CheckCircle, Package, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { convertGramsToOunces, formatWeight } from '@/utils/salesUtils';
import { formatDateStandard } from '@/utils/dateUtils';

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  metal_type: string;
  shipping_date: string;
  created_at: string;
  mining_company?: {
    id: string;
    name: string;
    country?: string;
  };
}

interface RefiningRecord {
  id: string;
  batch_id: string;
  pre_melting_weight_grams: number;
  post_melting_weight_grams: number;
  fineness_percentage: number;
  metal_retained_percentage: number;
  final_fine_grams: number;
  final_fine_ounces: number;
  processed_at: string;
  batches?: Batch;
}

export function RefiningDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [refiningRecords, setRefiningRecords] = useState<RefiningRecord[]>([]);
  const [freightShipmentsCount, setFreightShipmentsCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useAutoRefresh({
    enabled: true,
    onRefresh: () => {
      fetchData();
    },
  });

  async function fetchData() {
    setLoading(true);
    try {
      const [batchResult, refiningResult, freightResult] = await Promise.all([
        supabase
          .from('batches')
          .select(`
            *,
            mining_company:mining_companies(id, name, country)
          `)
          .in('status', [
            'validated_at_airport',
            'in_transit_to_refinery',
            'received_at_refinery',
            'refinery_receipt_validated',
            'processing',
            'processed'
          ])
          .order('created_at', { ascending: false }),
        supabase
          .from('refining_records')
          .select(`
            *,
            batches:batch_id (
              id,
              batch_number,
              status,
              weight_grams,
              weight_ounces,
              metal_type
            )
          `)
          .order('processed_at', { ascending: false }),
        supabase
          .from('freight_shipments')
          .select('id', { count: 'exact', head: true })
          .in('status', ['shipped_to_refinery', 'received_at_refinery'])
      ]);

      if (batchResult.error) {
        console.error('Error fetching batches:', batchResult.error);
      } else {
        const enrichedBatches = (batchResult.data || []).map((batch: any) => ({
          ...batch,
          weight_ounces: batch.weight_ounces || convertGramsToOunces(batch.weight_grams),
        }));
        setBatches(enrichedBatches);
      }

      if (refiningResult.error) {
        console.error('Error fetching refining records:', refiningResult.error);
      } else {
        setRefiningRecords(refiningResult.data || []);
      }

      if (freightResult.error) {
        console.error('Error fetching freight shipments:', freightResult.error);
      } else {
        setFreightShipmentsCount(freightResult.count || 0);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const validatedCount = batches.filter(b => b.status === 'refinery_receipt_validated').length;
  const processingCount = batches.filter(b => b.status === 'processing').length;
  const processedCount = batches.filter(b => b.status === 'processed').length;
  const totalOutput = refiningRecords.reduce((sum, r) => sum + (r.final_fine_ounces || 0), 0);

  const metrics = [
    {
      title: 'Ready for Processing',
      value: validatedCount.toString(),
      change: 'Validated, ready to process',
      changeType: 'neutral' as const,
      icon: Package,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Processing',
      value: processingCount.toString(),
      change: 'Currently refining',
      changeType: 'warning' as const,
      icon: Flame,
      iconColor: 'text-orange-500',
    },
    {
      title: 'Processed',
      value: processedCount.toString(),
      change: 'Ready for inventory',
      changeType: 'positive' as const,
      icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    {
      title: 'Total Output',
      value: `${totalOutput.toFixed(0)} oz`,
      change: 'Refined to date',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-accent-500',
    },
  ];

  const handleViewDetails = (batchId: string) => {
    navigate(`/batches/${batchId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            Refining Management
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage refinery operations
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            {/* Freight Shipments Alert */}
            {freightShipmentsCount > 0 && (
              <Card
                className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('/refining/freight-shipments')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {freightShipmentsCount} Expédition{freightShipmentsCount > 1 ? 's' : ''} en Attente d'Approbation
                      </h3>
                      <p className="text-sm text-gray-600">
                        Des expéditions depuis le module Invoice & Consignment attendent votre validation
                      </p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors">
                    Voir les Expéditions →
                  </button>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} {...metric} />
              ))}
            </div>

            {batches.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-12">
                    <Flame className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium text-lg">No Batches to Manage</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Validated batches from airport will appear here for processing
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Active Batches ({batches.length})</CardTitle>
                </CardHeader>
                <CardContent>
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
                            className="border-b border-gray-100 hover:bg-gray-50"
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
                              <button
                                onClick={() => handleViewDetails(batch.id)}
                                className="text-primary-600 hover:text-primary-800 font-medium"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {refiningRecords.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Recent Refining Activity ({refiningRecords.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {refiningRecords.slice(0, 10).map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">
                              {record.batches?.batch_number || 'Unknown Batch'}
                            </h4>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Completed
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-600 grid grid-cols-2 gap-2">
                            <div>
                              <p className="font-medium text-gray-700">Input:</p>
                              <p>Pre-melt: {record.pre_melting_weight_grams.toLocaleString()}g</p>
                              <p>Post-melt: {record.post_melting_weight_grams.toLocaleString()}g</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Output:</p>
                              <p>
                                Final: {record.final_fine_grams.toFixed(2)}g ({record.final_fine_ounces.toFixed(2)} oz)
                              </p>
                              <p>
                                Fineness: {record.fineness_percentage}% | Retained: {record.metal_retained_percentage}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 text-right ml-4">
                          <p className="font-medium">Processed</p>
                          <p>{formatDateStandard(record.processed_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {refiningRecords.length > 10 && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-500">
                        Showing 10 of {refiningRecords.length} records
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
