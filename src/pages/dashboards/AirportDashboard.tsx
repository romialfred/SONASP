import { useTranslation } from 'react-i18next';
import { Inbox, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ActivityFeed, ActivityItem } from '@/components/dashboard/ActivityFeed';
import { AlertBox } from '@/components/dashboard/AlertBox';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export function AirportDashboard() {
  const { t } = useTranslation();

  const metrics = [
    {
      title: 'Incoming Batches',
      value: '5',
      change: 'Expected today',
      changeType: 'neutral' as const,
      icon: Inbox,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Received Today',
      value: '12',
      change: '+3 from yesterday',
      changeType: 'positive' as const,
      icon: CheckCircle,
      iconColor: 'text-accent-500'
    },
    {
      title: 'Variance Alerts',
      value: '2',
      change: 'Requires attention',
      changeType: 'negative' as const,
      icon: AlertTriangle,
      iconColor: 'text-red-500'
    },
    {
      title: 'Pending Confirmation',
      value: '3',
      change: 'Awaiting review',
      changeType: 'neutral' as const,
      icon: Package,
      iconColor: 'text-orange-500'
    }
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: '1',
      icon: CheckCircle,
      iconColor: 'bg-accent-500',
      title: 'Batch #BT-2024-015 confirmed',
      description: 'Weight variance: 0.3% - Within acceptable range',
      time: '10 minutes ago'
    },
    {
      id: '2',
      icon: AlertTriangle,
      iconColor: 'bg-red-500',
      title: 'Batch #BT-2024-014 flagged',
      description: 'Weight variance: 3.2% - Requires reconciliation',
      time: '1 hour ago'
    },
    {
      id: '3',
      icon: Inbox,
      iconColor: 'bg-blue-500',
      title: 'Batch #BT-2024-013 received',
      description: 'Awaiting weight verification',
      time: '2 hours ago'
    }
  ];

  const incomingBatches = [
    { id: 'BT-2024-016', origin: 'Siguiri Mine', weight: '145.2g', eta: '2 hours', status: 'in-transit' },
    { id: 'BT-2024-017', origin: 'Dinguiraye Site', weight: '198.7g', eta: '4 hours', status: 'in-transit' },
    { id: 'BT-2024-018', origin: 'Siguiri Mine', weight: '167.3g', eta: '5 hours', status: 'in-transit' }
  ];

  return (
    <MainLayout userRole="airport">
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            {t('nav.dashboard')}
          </h1>
          <p className="text-gray-600 mt-1">Airport Receiving Operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <AlertBox
          type="warning"
          title="Variance Alerts Require Attention"
          message="2 batches have weight variances exceeding the threshold. Please review and provide reconciliation documentation."
          action={{
            label: 'Review Alerts →',
            onClick: () => console.log('Navigate to alerts')
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Incoming Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {incomingBatches.map((batch) => (
                  <div key={batch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900">{batch.id}</p>
                        <StatusBadge status="shipped" size="sm" />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{batch.origin}</p>
                      <p className="text-xs text-gray-500">Weight: {batch.weight} • ETA: {batch.eta}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      Details
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={recentActivity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
