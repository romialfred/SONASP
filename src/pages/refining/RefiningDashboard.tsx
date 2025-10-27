import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flame, CheckCircle, Clock, TrendingUp, Package } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

interface Site {
  name: string;
  site_type: string;
}

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  weight_ounces: number;
  metal_type: string;
  shipping_date: string;
  comments?: string;
  created_at: string;
  current_site?: Site;
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
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [refiningRecords, setRefiningRecords] = useState<RefiningRecord[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch batches with status "Processing" - these are at refinery
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select(`
          *,
          current_site:current_site_id(name, site_type)
        `)
        .eq('status', 'Processing')
        .order('created_at', { ascending: false });

      if (batchError) {
        console.error('Error fetching batches:', batchError);
      } else {
        setBatches(batchData || []);
        console.log(`Found ${batchData?.length || 0} batches with Processing status`);
      }

      // Fetch refining records
      const { data: refiningData, error: refiningError } = await supabase
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
        .order('processed_at', { ascending: false });

      if (refiningError) {
        console.error('Error fetching refining records:', refiningError);
      } else {
        setRefiningRecords(refiningData || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const processingCount = batches.length;
  const totalProcessed = refiningRecords.length;

  const totalOutput = refiningRecords.reduce(
    (sum, r) => sum + (r.final_fine_ounces || 0),
    0
  );

  const totalWeight = batches.reduce((sum, b) => sum + (b.weight_ounces || 0), 0);

  const metrics = [
    {
      title: 'Currently Processing',
      value: processingCount.toString(),
      change: 'At refinery now',
      changeType: 'positive' as const,
      icon: Flame,
      iconColor: 'text-red-500',
    },
    {
      title: 'Total Weight Processing',
      value: `${totalWeight.toFixed(1)} oz`,
      change: 'Being refined',
      changeType: 'neutral' as const,
      icon: Package,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Batches Processed',
      value: totalProcessed.toString(),
      change: 'All time',
      changeType: 'positive' as const,
      icon: CheckCircle,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Total Refined Output',
      value: `${totalOutput.toFixed(0)} oz`,
      change: 'Final fine ounces',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-primary-500',
    },
  ];

  const handleProcessBatch = (batchId: string) => {
    navigate(`/refining/process/${batchId}`);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} {...metric} />
              ))}
            </div>

            {batches.length === 0 && refiningRecords.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-12">
                    <Flame className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No batches at refinery</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Batches with "Processing" status will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Currently Processing at Refinery */}
                {processingCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                        Processing at Refinery ({processingCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {batches.map((batch) => (
                          <div
                            key={batch.id}
                            className="flex items-center justify-between p-4 border border-orange-200 rounded-lg bg-orange-50"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-gray-900">
                                  {batch.batch_number}
                                </h3>
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  Processing
                                </span>
                              </div>
                              <div className="mt-2 text-sm text-gray-600">
                                <p>
                                  Weight: {batch.weight_grams.toLocaleString()}g (
                                  {batch.weight_ounces.toFixed(2)} oz)
                                </p>
                                <p>Metal: {batch.metal_type}</p>
                                <p>Location: {batch.current_site?.name || 'Refinery'}</p>
                                <p>Started: {new Date(batch.created_at).toLocaleDateString()}</p>
                                {batch.comments && (
                                  <p className="text-xs mt-1 text-gray-500">{batch.comments}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-sm text-orange-600 font-medium">
                                <Flame className="w-5 h-5 inline mr-1 animate-pulse" />
                                In Progress
                              </div>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleProcessBatch(batch.id)}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recently Processed - Refining Records */}
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
                                  <p>
                                    Pre-melt: {record.pre_melting_weight_grams.toLocaleString()}g
                                  </p>
                                  <p>
                                    Post-melt: {record.post_melting_weight_grams.toLocaleString()}g
                                  </p>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-700">Output:</p>
                                  <p>
                                    Final: {record.final_fine_grams.toFixed(2)}g (
                                    {record.final_fine_ounces.toFixed(2)} oz)
                                  </p>
                                  <p>
                                    Fineness: {record.fineness_percentage}% | Retained:{' '}
                                    {record.metal_retained_percentage}%
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 text-right ml-4">
                              <p className="font-medium">Processed</p>
                              <p>{new Date(record.processed_at).toLocaleDateString()}</p>
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

                {/* Summary Statistics */}
                {refiningRecords.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Refining Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">
                            {refiningRecords.reduce(
                              (sum, r) => sum + r.pre_melting_weight_grams,
                              0
                            ).toLocaleString()}g
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Total Input</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">
                            {refiningRecords.reduce(
                              (sum, r) => sum + r.final_fine_grams,
                              0
                            ).toFixed(2)}g
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Total Output</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">
                            {(
                              refiningRecords.reduce((sum, r) => sum + r.fineness_percentage, 0) /
                              refiningRecords.length
                            ).toFixed(2)}%
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Avg Fineness</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <p className="text-2xl font-bold text-orange-600">
                            {(
                              refiningRecords.reduce(
                                (sum, r) => sum + r.metal_retained_percentage,
                                0
                              ) / refiningRecords.length
                            ).toFixed(2)}%
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Avg Retention</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
