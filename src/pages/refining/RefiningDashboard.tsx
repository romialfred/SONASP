import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flame, CheckCircle, Clock, TrendingUp, Package, AlertCircle, Eye, BarChart3 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Button } from '@/components/ui/Button';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { validateRefineryReceipt, startBatchProcessing } from '@/services/refineryValidationService';

interface Site {
  name: string;
  site_type: string;
}

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
  metal_type: string;
  shipping_date: string;
  comments?: string;
  created_at: string;
  current_site?: Site;
  mining_company_id?: string;
  mining_company?: MiningCompany;
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
  const alert = useAlert();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [refiningRecords, setRefiningRecords] = useState<RefiningRecord[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [monthlyProcessedData, setMonthlyProcessedData] = useState<any[]>([]);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [miningCompanyFilter, setMiningCompanyFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('');

  useEffect(() => {
    fetchData();
    fetchMonthlyProcessedData();
  }, []);

  // Auto-refresh when returning from batch receiving/processing
  useAutoRefresh({
    enabled: true,
    onRefresh: () => {
      fetchData();
      fetchMonthlyProcessedData();
    },
  });

  async function fetchMonthlyProcessedData() {
    try {
      // Get processed batches grouped by month for the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data, error } = await supabase
        .from('batch_status_history')
        .select('batch_id, status, changed_at')
        .eq('status', 'processed')
        .gte('changed_at', sixMonthsAgo.toISOString())
        .order('changed_at', { ascending: true });

      if (error) {
        console.error('Error fetching monthly data:', error);
        return;
      }

      // Group by month
      const monthlyData: { [key: string]: number } = {};
      data?.forEach((record) => {
        const date = new Date(record.changed_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      });

      // Convert to chart format
      const chartData = Object.entries(monthlyData).map(([month, count]) => {
        const [year, monthNum] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthNum) - 1);
        const monthName = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
        return {
          name: monthName,
          value: count,
        };
      });

      setMonthlyProcessedData(chartData);
    } catch (error) {
      console.error('Error fetching monthly processed data:', error);
    }
  }

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch batches and mining companies
      const [batchResult, companiesResult] = await Promise.all([
        supabase
          .from('batches')
          .select(`
            *,
            mining_company:mining_companies(id, name, country)
          `)
          .in('status', [
          ])
          .order('created_at', { ascending: false }),
        supabase
          .from('mining_companies')
          .select('id, name, country')
          .order('name')
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

      if (companiesResult.data) {
        setMiningCompanies(companiesResult.data);
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

  // Filter batches
  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const matchesSearch = batch.batch_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
      const matchesCompany =
        miningCompanyFilter === 'all' || batch.mining_company_id === miningCompanyFilter;

      let matchesDate = true;
      if (yearFilter !== 'all') {
        const batchDate = new Date(batch.shipping_date || batch.created_at);
        const batchYear = batchDate.getFullYear().toString();
        matchesDate = batchYear === yearFilter;

        if (matchesDate && monthFilter) {
          const batchMonth = String(batchDate.getMonth() + 1).padStart(2, '0');
          matchesDate = batchMonth === monthFilter;
        }
      }

      return matchesSearch && matchesStatus && matchesCompany && matchesDate;
    });
  }, [batches, searchQuery, statusFilter, miningCompanyFilter, yearFilter, monthFilter]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    batches.forEach((batch) => {
      const date = new Date(batch.shipping_date || batch.created_at);
      years.add(date.getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [batches]);

  // Count batches by status (using filtered batches)
  const waitingReceiptCount = filteredBatches.filter(
  ).length;

  const receivedCount = filteredBatches.filter(
  ).length;

  const validatedCount = filteredBatches.filter(
  ).length;

  const processingCount = filteredBatches.filter(
  ).length;

  const processedCount = filteredBatches.filter(
  ).length;

  const totalProcessed = refiningRecords.length;

  const totalOutput = refiningRecords.reduce(
    (sum, r) => sum + (r.final_fine_ounces || 0),
    0
  );

  const totalWeight = batches.reduce((sum, b) => sum + (b.weight_ounces || 0), 0);

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

  const getUserRole = () => {
    return user?.user_metadata?.role || 'refinery';
  };

  const handleReceiveBatch = (batchId: string) => {
    navigate(`/refining/${batchId}/receive`);
  };

  const handleValidateAndProcess = async (batchId: string) => {
    if (!user?.id) return;

    setActionLoading(batchId);
    try {
      const result = await validateRefineryReceipt(batchId, user.id);
      if (result.success) {
        alert.success('Receipt validated. Batch moved to processing.');
        fetchData(); // Reload data
      } else {
        alert.error(result.error || 'Error validating receipt');
      }
    } catch (error) {
      alert.error('Error validating receipt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartProcessing = async (batchId: string) => {
    if (!user?.id) return;

    setActionLoading(batchId);
    try {
      const result = await startBatchProcessing(batchId, user.id);
      if (result.success) {
        alert.success('Processing started successfully');
        fetchData(); // Reload data
      } else {
        alert.error(result.error || 'Error starting processing');
      }
    } catch (error) {
      alert.error('Error starting processing');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteProcessing = async (batchId: string) => {
    if (!user?.id) return;

    setActionLoading(batchId);
    try {
      const result = await completeProcessing(batchId, user.id, 'Processing completed by refinery staff');
      if (result.success) {
        alert.success('Processing completed! Batch ready for inventory entry.');
        fetchData(); // Reload data
      } else {
        alert.error(result.error || 'Error completing processing');
      }
    } catch (error) {
      alert.error('Error completing processing');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProcessBatch = (batchId: string) => {
    navigate(`/refining/process/${batchId}`);
  };

  const handleViewDetails = (batchId: string) => {
    navigate(`/batches/${batchId}`);
  };

  const handleActionClick = (actionId: string, batchId: string) => {
    if (actionId === 'confirm_refinery_receipt' || actionId === 'receive_refinery') {
      handleReceiveBatch(batchId);
    } else if (actionId === 'validate_refinery_receipt') {
      handleValidateAndProcess(batchId);
    } else if (actionId === 'start_processing') {
      handleStartProcessing(batchId);
    } else if (actionId === 'complete_processing') {
      handleCompleteProcessing(batchId);
    } else if (actionId === 'view_details') {
      handleViewDetails(batchId);
    }
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

        {/* Filters */}
        <BatchFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          miningCompanyFilter={miningCompanyFilter}
          onMiningCompanyChange={setMiningCompanyFilter}
          yearFilter={yearFilter}
          onYearChange={(year) => {
            setYearFilter(year);
            if (year === 'all') {
              setMonthFilter('');
            }
          }}
          monthFilter={monthFilter}
          onMonthChange={setMonthFilter}
          miningCompanies={miningCompanies}
          availableYears={availableYears}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} {...metric} />
              ))}
            </div>

            {filteredBatches.length === 0 ? (
              <div className="space-y-6">
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

                {monthlyProcessedData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-accent-500" />
                        Batches Processed by Month
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarChartWidget
                        data={monthlyProcessedData}
                        xAxisKey="name"
                        barKey="value"
                        title=""
                        height={300}
                        barColor="#10B981"
                      />
                      <p className="text-sm text-gray-500 mt-4 text-center">
                        Historical processing activity over the last 6 months
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <>
                {/* BATCHES ACTIFS HEADER */}
                {(processingCount > 0 || validatedCount > 0) && (
                  <div className="mt-8 mb-4">
                    <div className="bg-gradient-to-r from-blue-500/80 to-blue-600/80 backdrop-blur-sm rounded-lg px-6 py-4">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-6 h-6" />
                        Batches Actifs
                      </h2>
                      <p className="text-white/90 text-sm mt-1">
                        Batches en cours de traitement dans la raffinerie
                      </p>
                    </div>
                  </div>
                )}

                {/* Currently Processing */}
                {processingCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-red-500" />
                        Currently Processing ({processingCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredBatches
                          .map((batch) => {
                            const actions = [
                              {
                                id: 'complete_processing',
                                label: 'Process Completed',
                                icon: CheckCircle,
                                variant: 'success' as const,
                                handler: () => handleCompleteProcessing(batch.id),
                                requiresConfirmation: true,
                                confirmationMessage: 'Mark this batch as processed and move to inventory?',
                                visible: true,
                                disabled: actionLoading === batch.id,
                              },
                              {
                                id: 'view_details',
                                label: 'View Details',
                                icon: Eye,
                                variant: 'ghost' as const,
                                handler: () => handleViewDetails(batch.id),
                                requiresConfirmation: false,
                                visible: true,
                              }
                            ];
                            const statusInfo = { message: 'Batch is being processed - click Process Completed when done', type: 'warning' as const };
                            return (
                              <BatchCard
                                key={batch.id}
                                batch={batch}
                                actions={actions}
                                statusInfo={statusInfo}
                                onActionClick={handleActionClick}
                              />
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Ready for Processing */}
                {validatedCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Ready for Processing ({validatedCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredBatches
                          .map((batch) => {
                            const actions = getAvailableBatchActions(
                              batch,
                              { role: getUserRole() },
                              'refining',
                              {
                                onViewDetails: handleViewDetails,
                                onStartProcessing: handleStartProcessing,
                              }
                            );
                            const statusInfo = getBatchStatusInfo(batch.status, 'refining');
                            return (
                              <BatchCard
                                key={batch.id}
                                batch={batch}
                                actions={actions}
                                statusInfo={statusInfo}
                                onActionClick={handleActionClick}
                              />
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* BATCHES EN PIPELINE HEADER */}
                {(waitingReceiptCount > 0 || receivedCount > 0) && (
                  <div className="mt-8 mb-4">
                    <div className="bg-gradient-to-r from-amber-500/80 to-amber-600/80 backdrop-blur-sm rounded-lg px-6 py-4">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-6 h-6" />
                        Batches en Pipeline
                      </h2>
                      <p className="text-white/90 text-sm mt-1">
                        Batches en attente de réception ou validation
                      </p>
                    </div>
                  </div>
                )}

                {/* Awaiting Receipt at Refinery */}
                {waitingReceiptCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-500" />
                        Awaiting Receipt ({waitingReceiptCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredBatches
                          .map((batch) => {
                            const actions = getAvailableBatchActions(
                              batch,
                              { role: getUserRole() },
                              'refining',
                              {
                                onViewDetails: handleViewDetails,
                                onConfirmReceipt: handleReceiveBatch,
                              }
                            );
                            // Add custom Receive action
                            actions.unshift({
                              id: 'receive_refinery',
                              label: 'Receive Batch',
                              icon: Package,
                              variant: 'primary',
                              handler: () => handleReceiveBatch(batch.id),
                              requiresConfirmation: false,
                              visible: true,
                            });
                            const statusInfo = getBatchStatusInfo(batch.status, 'refining');
                            return (
                              <BatchCard
                                key={batch.id}
                                batch={batch}
                                actions={actions}
                                statusInfo={statusInfo}
                                onActionClick={handleActionClick}
                              />
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Received - Need Validation */}
                {receivedCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        Received - Need Validation ({receivedCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredBatches
                          .map((batch) => {
                            const actions = getAvailableBatchActions(
                              batch,
                              { role: getUserRole() },
                              'refining',
                              {
                                onViewDetails: handleViewDetails,
                                onConfirmReceipt: handleReceiveBatch,
                                onStartProcessing: handleValidateAndProcess,
                              }
                            );
                            const statusInfo = getBatchStatusInfo(batch.status, 'refining');
                            return (
                              <BatchCard
                                key={batch.id}
                                batch={batch}
                                actions={actions}
                                statusInfo={statusInfo}
                                onActionClick={handleActionClick}
                              />
                            );
                          })}
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
