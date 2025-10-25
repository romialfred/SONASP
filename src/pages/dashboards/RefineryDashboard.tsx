import { useTranslation } from 'react-i18next';
import { Beaker, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ActivityFeed, ActivityItem } from '@/components/dashboard/ActivityFeed';
import { ProgressBar } from '@/components/dashboard/ProgressBar';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { BarChartWidget } from '@/components/charts/BarChartWidget';

export function RefineryDashboard() {
  const { t } = useTranslation();

  const metrics = [
    {
      title: 'Ready for Processing',
      value: '6',
      change: 'Total: 1,234g',
      changeType: 'neutral' as const,
      icon: Beaker,
      iconColor: 'text-purple-500'
    },
    {
      title: 'Processing in Progress',
      value: '4',
      change: '67% completion',
      changeType: 'positive' as const,
      icon: Clock,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Awaiting Approval',
      value: '8',
      change: 'Total: 2,145g fine',
      changeType: 'neutral' as const,
      icon: CheckCircle,
      iconColor: 'text-orange-500'
    },
    {
      title: 'Monthly Processed',
      value: '15.2 kg',
      change: '+8% from last month',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-accent-500'
    }
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: '1',
      icon: Beaker,
      iconColor: 'bg-accent-500',
      title: 'Batch #BT-2024-010 processed',
      description: 'Fineness: 95.2% • Metal retained: 98.5% • Final: 142.3g fine',
      time: '30 minutes ago'
    },
    {
      id: '2',
      icon: CheckCircle,
      iconColor: 'bg-blue-500',
      title: 'Batch #BT-2024-009 approved',
      description: 'Approved by supervisor - Ready for sale',
      time: '2 hours ago'
    },
    {
      id: '3',
      icon: Clock,
      iconColor: 'bg-purple-500',
      title: 'Batch #BT-2024-011 started',
      description: 'Pre-melting weight recorded: 156.8g',
      time: '3 hours ago'
    }
  ];

  const processingQueue = [
    { id: 'BT-2024-020', weight: '156.8g', status: 'Pre-melting', progress: 25 },
    { id: 'BT-2024-019', weight: '142.3g', status: 'Melting', progress: 60 },
    { id: 'BT-2024-018', weight: '198.5g', status: 'Post-melting', progress: 90 }
  ];

  const monthlyData = [
    { name: 'Week 1', processed: 3.2, fine: 3.0 },
    { name: 'Week 2', processed: 4.1, fine: 3.8 },
    { name: 'Week 3', processed: 3.8, fine: 3.5 },
    { name: 'Week 4', processed: 4.1, fine: 3.9 }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            {t('nav.dashboard')}
          </h1>
          <p className="text-gray-600 mt-1">Refinery Processing Operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Processing Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {processingQueue.map((batch) => (
                  <div key={batch.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{batch.id}</p>
                        <p className="text-xs text-gray-600">Weight: {batch.weight}</p>
                      </div>
                      <StatusBadge status="processing" label={batch.status} size="sm" />
                    </div>
                    <ProgressBar value={batch.progress} variant="accent" size="sm" />
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4" variant="outline">
                View All Processing
              </Button>
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

        <Card>
          <CardHeader>
            <CardTitle>Monthly Processing Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={monthlyData}
              bars={[
                { dataKey: 'processed', color: '#B8860B', name: 'Processed (kg)' },
                { dataKey: 'fine', color: '#10B981', name: 'Fine Gold (kg)' }
              ]}
              height={300}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
