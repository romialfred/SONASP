import { useTranslation } from 'react-i18next';
import { Package, Truck, TrendingUp, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { QuickActionButton } from '@/components/dashboard/QuickActionButton';
import { ActivityFeed, ActivityItem } from '@/components/dashboard/ActivityFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LineChartWidget } from '@/components/charts/LineChartWidget';

export function FactoryDashboard() {
  const { t } = useTranslation();

  const metrics = [
    {
      title: 'Pending Shipments',
      value: '8',
      change: '+2 from yesterday',
      changeType: 'positive' as const,
      icon: Package,
      iconColor: 'text-primary-500'
    },
    {
      title: 'Total Weight (This Week)',
      value: '1,245 oz',
      change: '+12% from last week',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-accent-500'
    },
    {
      title: 'Active Transporters',
      value: '3',
      change: 'All on schedule',
      changeType: 'neutral' as const,
      icon: Truck,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Avg Processing Time',
      value: '2.5 hrs',
      change: '-15% improvement',
      changeType: 'positive' as const,
      icon: Clock,
      iconColor: 'text-purple-500'
    }
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: '1',
      icon: Package,
      iconColor: 'bg-primary-500',
      title: 'Batch #BT-2024-012 created',
      description: 'Weight: 156.5g (5.03 oz) - Ready for shipment',
      time: '15 minutes ago'
    },
    {
      id: '2',
      icon: Truck,
      iconColor: 'bg-blue-500',
      title: 'Batch #BT-2024-011 shipped',
      description: 'En route to Conakry Airport via TransGold',
      time: '2 hours ago'
    },
    {
      id: '3',
      icon: Package,
      iconColor: 'bg-accent-500',
      title: 'Batch #BT-2024-010 received',
      description: 'Confirmed at refinery - No variance detected',
      time: '5 hours ago'
    }
  ];

  const shippingData = [
    { name: 'Mon', weight: 180 },
    { name: 'Tue', weight: 220 },
    { name: 'Wed', weight: 195 },
    { name: 'Thu', weight: 240 },
    { name: 'Fri', weight: 210 },
    { name: 'Sat', weight: 165 },
    { name: 'Sun', weight: 185 }
  ];

  return (
    <MainLayout userRole="factory">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('nav.dashboard')}
            </h1>
            <p className="text-gray-600 mt-1">Factory Operations Overview</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <div>
          <QuickActionButton
            label="Create New Batch"
            icon={Package}
            href="/batches/new"
            variant="primary"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Shipping Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChartWidget
                data={shippingData}
                lines={[
                  { dataKey: 'weight', color: '#B8860B', name: 'Weight (oz)' }
                ]}
                height={250}
              />
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
