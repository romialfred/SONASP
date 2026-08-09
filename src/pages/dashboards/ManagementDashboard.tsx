import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Users, AlertCircle, Package } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ActivityFeed, ActivityItem } from '@/components/dashboard/ActivityFeed';
import { AlertBox } from '@/components/dashboard/AlertBox';
import { SiteSelector, Site } from '@/components/ui/SiteSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { PieChartWidget } from '@/components/charts/PieChartWidget';

export function ManagementDashboard() {
  const { t } = useTranslation();

  const sites: Site[] = [
    { id: 'all', name: 'All Sites', country: 'Company-wide' },
    { id: 'guinea', name: 'Siguiri Mine', country: 'Guinea' },
    { id: 'mali', name: 'Bamako Operations', country: 'Mali' },
    { id: 'ivory', name: 'Abidjan Facility', country: 'Côte d\'Ivoire' }
  ];

  const [selectedSite, setSelectedSite] = useState('all');

  const metrics = [
    {
      title: 'Total Revenue (MTD)',
      value: '$2.4M',
      subtitle: '+12% from last month',
      changeType: 'positive' as const,
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      iconBgColor: 'bg-emerald-100'
    },
    {
      title: 'Active Batches',
      value: '24',
      subtitle: '8 pending approval',
      changeType: 'neutral' as const,
      icon: Package,
      iconColor: 'text-primary-600',
      iconBgColor: 'bg-primary-100'
    },
    {
      title: 'Active Customers',
      value: '18',
      subtitle: '+3 this quarter',
      changeType: 'positive' as const,
      icon: Users,
      iconColor: 'text-blue-600',
      iconBgColor: 'bg-blue-100'
    },
    {
      title: 'System Alerts',
      value: '5',
      subtitle: '2 critical',
      changeType: 'negative' as const,
      icon: AlertCircle,
      iconColor: 'text-red-600',
      iconBgColor: 'bg-red-100'
    }
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: '1',
      icon: DollarSign,
      iconColor: 'bg-accent-500',
      title: 'Sale approved - $156,450',
      description: 'Sale #SL-2024-025 to Premium Gold Ltd.',
      time: '15 minutes ago'
    },
    {
      id: '2',
      icon: AlertCircle,
      iconColor: 'bg-red-500',
      title: 'Variance alert requires review',
      description: 'Batch #BT-2024-018 at Conakry Airport - 3.2% variance',
      time: '1 hour ago'
    },
    {
      id: '3',
      icon: Package,
      iconColor: 'bg-primary-500',
      title: 'Refining completed',
      description: 'Batch #BT-2024-016 - 145.2g fine gold ready for sale',
      time: '2 hours ago'
    }
  ];

  const salesData = [
    { name: 'Jan', revenue: 1.8, profit: 0.5 },
    { name: 'Feb', revenue: 2.1, profit: 0.6 },
    { name: 'Mar', revenue: 1.9, profit: 0.5 },
    { name: 'Apr', revenue: 2.3, profit: 0.7 },
    { name: 'May', revenue: 2.0, profit: 0.6 },
    { name: 'Jun', revenue: 2.5, profit: 0.8 },
    { name: 'Jul', revenue: 2.2, profit: 0.7 },
    { name: 'Aug', revenue: 2.4, profit: 0.7 },
    { name: 'Sep', revenue: 2.6, profit: 0.8 },
    { name: 'Oct', revenue: 2.4, profit: 0.7 }
  ];

  const customerData = [
    { name: 'Jan', customers: 12 },
    { name: 'Feb', customers: 13 },
    { name: 'Mar', customers: 14 },
    { name: 'Apr', customers: 15 },
    { name: 'May', customers: 15 },
    { name: 'Jun', customers: 16 },
    { name: 'Jul', customers: 17 },
    { name: 'Aug', customers: 17 },
    { name: 'Sep', customers: 18 },
    { name: 'Oct', customers: 18 }
  ];

  const distributionData = [
    { name: 'Guinea', value: 45 },
    { name: 'Mali', value: 30 },
    { name: 'Côte d\'Ivoire', value: 25 }
  ];

  const distributionColors = ['#B8860B', '#475569', '#10B981'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('nav.dashboard')}
            </h1>
            <p className="text-gray-600 mt-1">Management Overview</p>
          </div>
          <SiteSelector
            sites={sites}
            selectedSite={selectedSite}
            onSiteChange={setSelectedSite}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <AlertBox
          type="error"
          title="Critical Variance Alert"
          message="2 batches have critical variance issues that require immediate management review and approval."
          action={{
            label: 'Review Now →',
            onClick: () => console.log('Navigate to variance alerts')
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Sales Performance (Last 10 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChartWidget
                data={salesData}
                lines={[
                  { dataKey: 'revenue', color: '#B8860B', name: 'Revenue ($M)' },
                  { dataKey: 'profit', color: '#10B981', name: 'Profit ($M)' }
                ]}
                height={300}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production by Country</CardTitle>
            </CardHeader>
            <CardContent>
              <PieChartWidget
                data={distributionData}
                colors={distributionColors}
                height={300}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChartWidget
                data={customerData}
                bars={[
                  { dataKey: 'customers', color: '#475569', name: 'Active Customers' }
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
