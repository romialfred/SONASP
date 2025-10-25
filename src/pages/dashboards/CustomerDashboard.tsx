import { useTranslation } from 'react-i18next';
import { DollarSign, Clock, FileText, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ActivityFeed, ActivityItem } from '@/components/dashboard/ActivityFeed';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { LineChartWidget } from '@/components/charts/LineChartWidget';

export function CustomerDashboard() {
  const { t } = useTranslation();

  const metrics = [
    {
      title: 'Assigned Sales',
      value: '3',
      change: 'Total: $245,680',
      changeType: 'neutral' as const,
      icon: DollarSign,
      iconColor: 'text-accent-500'
    },
    {
      title: 'Pending Approval',
      value: '2',
      change: 'Action required',
      changeType: 'neutral' as const,
      icon: Clock,
      iconColor: 'text-orange-500'
    },
    {
      title: 'Active Orders',
      value: '1',
      change: 'In processing',
      changeType: 'positive' as const,
      icon: FileText,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Total Purchased (YTD)',
      value: '$1.2M',
      change: '+18% from last year',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-primary-500'
    }
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: '1',
      icon: DollarSign,
      iconColor: 'bg-accent-500',
      title: 'Sale #SL-2024-023 created',
      description: 'Quantity: 45.2 oz • Price: $2,145/oz • Total: $96,954',
      time: '1 hour ago'
    },
    {
      id: '2',
      icon: Clock,
      iconColor: 'bg-orange-500',
      title: 'Payment confirmation pending',
      description: 'Sale #SL-2024-022 awaiting payment details',
      time: '3 hours ago'
    },
    {
      id: '3',
      icon: FileText,
      iconColor: 'bg-blue-500',
      title: 'Documents available',
      description: 'Certificate of Origin for Sale #SL-2024-021',
      time: '1 day ago'
    }
  ];

  const assignedSales = [
    {
      id: 'SL-2024-023',
      quantity: '45.2 oz',
      price: '$2,145',
      total: '$96,954',
      status: 'pending' as const,
      date: '2024-10-24'
    },
    {
      id: 'SL-2024-022',
      quantity: '67.8 oz',
      price: '$2,138',
      total: '$144,956',
      status: 'approved' as const,
      date: '2024-10-23'
    },
    {
      id: 'SL-2024-021',
      quantity: '32.5 oz',
      price: '$2,142',
      total: '$69,615',
      status: 'completed' as const,
      date: '2024-10-20'
    }
  ];

  const priceHistory = [
    { name: 'Oct 18', price: 2135 },
    { name: 'Oct 19', price: 2142 },
    { name: 'Oct 20', price: 2138 },
    { name: 'Oct 21', price: 2145 },
    { name: 'Oct 22', price: 2140 },
    { name: 'Oct 23', price: 2148 },
    { name: 'Oct 24', price: 2145 }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            {t('nav.dashboard')}
          </h1>
          <p className="text-gray-600 mt-1">Customer Portal Overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assignedSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900">{sale.id}</p>
                        <StatusBadge status={sale.status} size="sm" />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {sale.quantity} × {sale.price} = {sale.total}
                      </p>
                      <p className="text-xs text-gray-500">{sale.date}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      View
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

        <Card>
          <CardHeader>
            <CardTitle>Gold Price Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartWidget
              data={priceHistory}
              lines={[
                { dataKey: 'price', color: '#B8860B', name: 'Price ($/oz)' }
              ]}
              height={300}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
