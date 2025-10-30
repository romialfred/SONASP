import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, AlertCircle, CheckCircle, Plane, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { BATCH_STATUSES } from '@/constants/batchStatuses';
import { useBatchRealtime } from '@/hooks/useBatchRealtime';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { BatchCard } from '@/components/batch/BatchCard';
import { getAvailableBatchActions, getBatchStatusInfo } from '@/services/batchActionsService';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';

export function ReceivingDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const alert = useAlert();

  // Use Realtime hook to fetch batches with relevant statuses for airport
  const { batches, loading, refetch } = useBatchRealtime({
    statuses: [
      BATCH_STATUSES.APPROVED_FOR_TRANSPORT,
      BATCH_STATUSES.WAITING_AIRPORT_RECEIPT,
      BATCH_STATUSES.RECEIVED_AT_AIRPORT,
      BATCH_STATUSES.VALIDATED_FOR_REFINERY,
    ],
  });

  // Auto-refresh when returning from batch validation
  useAutoRefresh({
    enabled: true,
    onRefresh: () => {
      if (refetch) {
        refetch();
      }
    },
  });

  // Count batches by status using correct constants
  const readyToShipCount = batches.filter(
    b => b.status === BATCH_STATUSES.APPROVED_FOR_TRANSPORT
  ).length;

  const inTransitCount = batches.filter(
    b => b.status === BATCH_STATUSES.WAITING_AIRPORT_RECEIPT
  ).length;

  const atAirportCount = batches.filter(
    b => b.status === BATCH_STATUSES.RECEIVED_AT_AIRPORT
  ).length;

  const validatedCount = batches.filter(
    b => b.status === BATCH_STATUSES.VALIDATED_FOR_REFINERY
  ).length;

  const totalWeight = batches.reduce((sum, b) => sum + (b.weight_ounces || 0), 0);

  const metrics = [
    {
      title: 'Ready to Ship',
      value: readyToShipCount.toString(),
      change: 'Approved by factory',
      changeType: 'positive' as const,
      icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    {
      title: 'In Transit',
      value: inTransitCount.toString(),
      change: 'En route to airport',
      changeType: 'neutral' as const,
      icon: Plane,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Need Validation',
      value: atAirportCount.toString(),
      change: 'Awaiting confirmation',
      changeType: 'neutral' as const,
      icon: AlertCircle,
      iconColor: 'text-orange-500',
    },
    {
      title: 'Validated',
      value: validatedCount.toString(),
      change: 'Ready for refinery',
      changeType: 'positive' as const,
      icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    {
      title: 'Total Weight',
      value: `${totalWeight.toFixed(1)} oz`,
      change: 'All batches',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-primary-500',
    },
  ];

  // Get user role for actions
  const getUserRole = () => {
    return user?.user_metadata?.role || 'airport';
  };

  const handleConfirmReceipt = (batchId: string) => {
    navigate(`/receiving/${batchId}/confirm`);
  };

  const handleValidateForRefinery = async (batchId: string) => {
    // This will be called after confirmation modal
    try {
      const { validateForRefinery } = await import('@/services/batchTransitionService');
      const result = await validateForRefinery(batchId, 'Validated by airport staff');

      if (result.success) {
        // Batch will refresh automatically via realtime
        alert.success('Batch validated successfully! Ready for refinery transport.');
      } else {
        alert.error(result.error || 'Failed to validate batch');
      }
    } catch (error) {
      console.error('Error validating batch:', error);
      alert.error('Error validating batch. Please try again.');
    }
  };

  const handleViewDetails = (batchId: string) => {
    navigate(`/batches/${batchId}`);
  };

  const handleActionClick = (actionId: string, batchId: string) => {
    if (actionId === 'confirm_receipt' || actionId === 'receive_batch') {
      handleConfirmReceipt(batchId);
    } else if (actionId === 'validate_for_refinery') {
      handleValidateForRefinery(batchId);
    } else if (actionId === 'view_details') {
      handleViewDetails(batchId);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Airport Receiving Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Track and validate shipments at airport locations
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} {...metric} />
              ))}
            </div>

            {batches.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No shipments at airport</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Batches at airport locations will appear here for validation
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Ready to Ship - Approved for Transport */}
                {readyToShipCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Ready to Ship ({readyToShipCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {batches
                          .filter(b => b.status === BATCH_STATUSES.APPROVED_FOR_TRANSPORT)
                          .map((batch) => {
                            const actions = getAvailableBatchActions(
                              batch,
                              { role: getUserRole() },
                              'shipping',
                              {
                                onViewDetails: handleViewDetails,
                                onConfirmReceipt: handleConfirmReceipt,
                                onValidateForRefinery: handleValidateForRefinery,
                              }
                            );
                            const statusInfo = getBatchStatusInfo(batch.status, 'shipping');
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

                {/* In Transit - Waiting Airport Receipt */}
                {inTransitCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plane className="w-5 h-5 text-blue-500" />
                        In Transit ({inTransitCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {batches
                          .filter(b => b.status === BATCH_STATUSES.WAITING_AIRPORT_RECEIPT)
                          .map((batch) => {
                            const actions = getAvailableBatchActions(
                              batch,
                              { role: getUserRole() },
                              'shipping',
                              {
                                onConfirmReceipt: handleConfirmReceipt,
                                onViewDetails: handleViewDetails,
                                onValidateForRefinery: handleValidateForRefinery,
                              }
                            );
                            const statusInfo = getBatchStatusInfo(batch.status, 'shipping');
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

                {/* At Airport - Need Validation */}
                {atAirportCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        Need Validation ({atAirportCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {batches
                          .filter(b => b.status === BATCH_STATUSES.RECEIVED_AT_AIRPORT)
                          .map((batch) => {
                            const actions = getAvailableBatchActions(
                              batch,
                              { role: getUserRole() },
                              'shipping',
                              {
                                onConfirmReceipt: handleConfirmReceipt,
                                onViewDetails: handleViewDetails,
                                onValidateForRefinery: handleValidateForRefinery,
                              }
                            );
                            const statusInfo = getBatchStatusInfo(batch.status, 'shipping');
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

                {/* Validated - Ready for Refinery */}
                {validatedCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Validated ({validatedCount})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {batches
                          .filter(b => b.status === BATCH_STATUSES.VALIDATED_FOR_REFINERY)
                          .map((batch) => {
                            const actions = getAvailableBatchActions(
                              batch,
                              { role: getUserRole() },
                              'shipping',
                              {
                                onViewDetails: handleViewDetails,
                                onValidateForRefinery: handleValidateForRefinery,
                              }
                            );
                            const statusInfo = getBatchStatusInfo(batch.status, 'shipping');
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
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
