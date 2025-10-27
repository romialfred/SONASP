import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertBox } from '@/components/dashboard/AlertBox';
import Select from '@/components/ui/Select';
import { supabase } from '@/lib/supabase';

export function ReceivingDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [siteFilter, setSiteFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [receivingRecords, setReceivingRecords] = useState<any[]>([]);

  useEffect(() => {
    async function fetchReceivingData() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('receiving_records')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setReceivingRecords(data);
        }
      } catch (error) {
        console.error('Error fetching receiving data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchReceivingData();
  }, []);

  const pendingCount = receivingRecords.filter(r => r.status === 'pending').length;
  const receivedTodayCount = receivingRecords.filter(r => {
    const today = new Date().toDateString();
    return new Date(r.created_at).toDateString() === today && r.status === 'confirmed';
  }).length;

  const metrics = [
    {
      title: 'Pending Receipts',
      value: pendingCount.toString(),
      change: 'Awaiting confirmation',
      changeType: 'neutral' as const,
      icon: Clock,
      iconColor: 'text-orange-500',
    },
    {
      title: 'Received Today',
      value: receivedTodayCount.toString(),
      change: 'Confirmed receipts',
      changeType: 'positive' as const,
      icon: CheckCircle,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Variance Alerts',
      value: '0',
      change: 'All within tolerance',
      changeType: 'positive' as const,
      icon: AlertCircle,
      iconColor: 'text-green-500',
    },
    {
      title: 'Total Records',
      value: receivingRecords.length.toString(),
      change: 'All time',
      changeType: 'neutral' as const,
      icon: Package,
      iconColor: 'text-primary-500',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Receiving Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Manage incoming batch receipts and confirmations
            </p>
          </div>

          <Select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="all">All Sites</option>
            <option value="conakry">Conakry Airport</option>
            <option value="abidjan">Abidjan Airport</option>
            <option value="bamako">Bamako Airport</option>
          </Select>
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

            {receivingRecords.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No receiving records yet.</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Start by shipping batches from factory locations to see receiving data here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Receipts ({pendingCount})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pendingCount > 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {pendingCount} batch{pendingCount !== 1 ? 'es' : ''} awaiting confirmation
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No pending receipts
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recently Received ({receivedTodayCount})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {receivedTodayCount > 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {receivedTodayCount} batch{receivedTodayCount !== 1 ? 'es' : ''} received today
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No batches received today
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
