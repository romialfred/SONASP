import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs } from '@/components/ui/Tabs';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  PieChart,
  Target
} from 'lucide-react';
import { OverviewAnalytics } from './tabs/OverviewAnalytics';
import { SalesAnalytics } from './tabs/SalesAnalytics';
import { CustomerAnalytics } from './tabs/CustomerAnalytics';
import { FinancialAnalytics } from './tabs/FinancialAnalytics';
import { PerformanceAnalytics } from './tabs/PerformanceAnalytics';
import { TrendsAnalytics } from './tabs/TrendsAnalytics';

export function AnalyticsDashboardEnhanced() {
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: BarChart3
    },
    {
      id: 'sales',
      label: 'Sales',
      icon: DollarSign
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users
    },
    {
      id: 'financial',
      label: 'Financial',
      icon: PieChart
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: Target
    },
    {
      id: 'trends',
      label: 'Trends',
      icon: TrendingUp
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: Activity
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive analytics and insights across all operations
          </p>
        </div>

        <Tabs tabs={tabs} defaultTab="overview">
          {(activeTab) => {
            switch (activeTab) {
              case 'overview':
                return <OverviewAnalytics />;
              case 'sales':
                return <SalesAnalytics />;
              case 'customers':
                return <CustomerAnalytics />;
              case 'financial':
                return <FinancialAnalytics />;
              case 'performance':
                return <PerformanceAnalytics />;
              case 'trends':
                return <TrendsAnalytics />;
              case 'operations':
                return (
                  <div className="text-center py-12">
                    <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Operations analytics coming soon</p>
                  </div>
                );
              default:
                return <OverviewAnalytics />;
            }
          }}
        </Tabs>
      </div>
    </MainLayout>
  );
}
