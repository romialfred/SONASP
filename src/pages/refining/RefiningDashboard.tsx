import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flame, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { supabase } from '@/lib/supabase';

export function RefiningDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refiningRecords, setRefiningRecords] = useState<any[]>([]);

  useEffect(() => {
    async function fetchRefiningData() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('refining_records')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setRefiningRecords(data);
        }
      } catch (error) {
        console.error('Error fetching refining data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRefiningData();
  }, []);

  const pendingCount = refiningRecords.filter(r => r.status === 'pending').length;
  const inProgressCount = refiningRecords.filter(r => r.status === 'in_progress').length;
  const awaitingApprovalCount = refiningRecords.filter(r => r.status === 'completed').length;
  const totalOutput = refiningRecords
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + (r.post_melt_weight_grams || 0), 0);

  const metrics = [
    {
      title: 'Ready for Processing',
      value: pendingCount.toString(),
      change: 'Awaiting processing',
      changeType: 'neutral' as const,
      icon: Clock,
      iconColor: 'text-orange-500',
    },
    {
      title: 'Processing Now',
      value: inProgressCount.toString(),
      change: 'In progress',
      changeType: 'positive' as const,
      icon: Flame,
      iconColor: 'text-red-500',
    },
    {
      title: 'Awaiting Approval',
      value: awaitingApprovalCount.toString(),
      change: 'Supervisor review needed',
      changeType: 'neutral' as const,
      icon: CheckCircle,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Total Output',
      value: `${(totalOutput / 31.1035).toFixed(0)} oz`,
      change: 'All approved batches',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-primary-500',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            Refining Management
          </h1>
          <p className="text-gray-600 mt-1">
            Process and track refinery operations
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

            {refiningRecords.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-12">
                    <Flame className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No refining records yet.</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Start by receiving batches at the refinery to see processing data here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Ready for Processing ({pendingCount})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pendingCount > 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {pendingCount} batch{pendingCount !== 1 ? 'es' : ''} ready for processing
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No batches ready for processing
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Processing in Progress ({inProgressCount})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {inProgressCount > 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {inProgressCount} batch{inProgressCount !== 1 ? 'es' : ''} currently processing
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No batches currently processing
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Awaiting Approval ({awaitingApprovalCount})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {awaitingApprovalCount > 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {awaitingApprovalCount} batch{awaitingApprovalCount !== 1 ? 'es' : ''} awaiting approval
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No batches awaiting approval
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
