import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Calendar, TrendingUp, DollarSign, Users, Package } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { PieChartWidget } from '@/components/charts/PieChartWidget';
import { AreaChartWidget } from '@/components/charts/AreaChartWidget';
import { SiteSelector, Site } from '@/components/ui/SiteSelector';
import { formatCurrency } from '@/utils/salesUtils';

export function AnalyticsDashboard() {
  const { t } = useTranslation();

  const [dateRange, setDateRange] = useState('year');
  const [selectedSite, setSelectedSite] = useState('all');

  const sites: Site[] = [
    { id: 'all', name: 'All Sites', country: 'Company-wide' },
    { id: 'guinea', name: 'Siguiri Mine', country: 'Guinea' },
    { id: 'mali', name: 'Bamako Operations', country: 'Mali' },
    { id: 'ivory', name: 'Abidjan Facility', country: "Côte d'Ivoire" },
  ];

  const metrics = [
    {
      title: 'Total Revenue (YTD)',
      value: formatCurrency(8945230),
      change: '+24% vs last year',
      changeType: 'positive' as const,
      icon: DollarSign,
      iconColor: 'text-primary-500',
    },
    {
      title: 'Total Sales Volume',
      value: '234 sales',
      change: '+18% vs last year',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Active Customers',
      value: '18',
      change: '+3 this year',
      changeType: 'positive' as const,
      icon: Users,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Avg Sale Value',
      value: formatCurrency(38227),
      change: '+5% vs last year',
      changeType: 'positive' as const,
      icon: Package,
      iconColor: 'text-accent-500',
    },
  ];

  const salesTrendData = [
    { month: 'Jan', revenue: 685, sales: 18, profit: 125 },
    { month: 'Feb', revenue: 742, sales: 20, profit: 138 },
    { month: 'Mar', revenue: 698, sales: 19, profit: 128 },
    { month: 'Apr', revenue: 812, sales: 22, profit: 152 },
    { month: 'May', revenue: 756, sales: 21, profit: 142 },
    { month: 'Jun', revenue: 895, sales: 24, profit: 168 },
    { month: 'Jul', revenue: 834, sales: 23, profit: 158 },
    { month: 'Aug', revenue: 923, sales: 25, profit: 175 },
    { month: 'Sep', revenue: 867, sales: 24, profit: 165 },
    { month: 'Oct', revenue: 945, sales: 26, profit: 182 },
    { month: 'Nov', revenue: 878, sales: 24, profit: 168 },
    { month: 'Dec', revenue: 910, sales: 25, profit: 174 },
  ];

  const goldPriceData = [
    { month: 'Jan', price: 2068 },
    { month: 'Feb', price: 2042 },
    { month: 'Mar', price: 2156 },
    { month: 'Apr', price: 2298 },
    { month: 'May', price: 2345 },
    { month: 'Jun', price: 2312 },
    { month: 'Jul', price: 2378 },
    { month: 'Aug', price: 2456 },
    { month: 'Sep', price: 2498 },
    { month: 'Oct', price: 2623 },
    { month: 'Nov', price: 2678 },
    { month: 'Dec', price: 2712 },
  ];

  const customerPerformanceData = [
    { name: 'Premium Gold Ltd.', purchases: 45, amount: 6780 },
    { name: 'Global Metals Inc.', purchases: 38, amount: 5432 },
    { name: 'Swiss Refineries SA', purchases: 52, amount: 8901 },
    { name: 'Asian Gold Trading', purchases: 29, amount: 4124 },
    { name: 'European Buyers Co.', purchases: 34, amount: 5234 },
  ];

  const fxRateData = [
    { month: 'Jan', USD_CFA: 595.2, USD_GNF: 8520 },
    { month: 'Feb', USD_CFA: 598.5, USD_GNF: 8545 },
    { month: 'Mar', USD_CFA: 601.3, USD_GNF: 8580 },
    { month: 'Apr', USD_CFA: 603.8, USD_GNF: 8612 },
    { month: 'May', USD_CFA: 605.1, USD_GNF: 8635 },
    { month: 'Jun', USD_CFA: 602.9, USD_GNF: 8598 },
    { month: 'Jul', USD_CFA: 604.2, USD_GNF: 8625 },
    { month: 'Aug', USD_CFA: 606.5, USD_GNF: 8658 },
    { month: 'Sep', USD_CFA: 603.8, USD_GNF: 8615 },
    { month: 'Oct', USD_CFA: 605.5, USD_GNF: 8650 },
    { month: 'Nov', USD_CFA: 607.2, USD_GNF: 8675 },
    { month: 'Dec', USD_CFA: 608.1, USD_GNF: 8692 },
  ];

  const productionDistributionData = [
    { name: 'Guinea', value: 45, color: '#B8860B' },
    { name: 'Mali', value: 30, color: '#475569' },
    { name: "Côte d'Ivoire", value: 25, color: '#10B981' },
  ];

  const distributionColors = ['#B8860B', '#475569', '#10B981'];

  const handleExport = () => {
    console.log('Exporting analytics data...');
  };

  return (
    <MainLayout userRole="management">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('nav.analytics')}
            </h1>
            <p className="text-gray-600 mt-1">Comprehensive Analytics Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-40"
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </Select>
            <SiteSelector
              sites={sites}
              selectedSite={selectedSite}
              onSiteChange={setSelectedSite}
            />
            <Button
              variant="outline"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sales Performance Trend</CardTitle>
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <AreaChartWidget
                data={salesTrendData}
                areas={[
                  { dataKey: 'revenue', color: '#B8860B', name: 'Revenue ($K)' },
                  { dataKey: 'profit', color: '#10B981', name: 'Profit ($K)' },
                ]}
                height={300}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gold Price Movement (London AM)</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChartWidget
                data={goldPriceData}
                lines={[
                  { dataKey: 'price', color: '#B8860B', name: 'Price (USD/oz)' },
                ]}
                height={300}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Customer Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={customerPerformanceData}
              bars={[
                { dataKey: 'amount', color: '#B8860B', name: 'Purchase Amount ($K)' },
              ]}
              height={300}
              layout="horizontal"
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>FX Rate Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChartWidget
                data={fxRateData}
                lines={[
                  { dataKey: 'USD_CFA', color: '#B8860B', name: 'USD/XOF' },
                  { dataKey: 'USD_GNF', color: '#10B981', name: 'USD/GNF (÷10)' },
                ]}
                height={280}
                yAxisFormatter={(value) => {
                  if (value > 1000) return (value / 10).toFixed(0);
                  return value.toFixed(0);
                }}
              />
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Current Rates:</span> USD/XOF: 608.1 | USD/GNF: 8,692
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production Distribution by Country</CardTitle>
            </CardHeader>
            <CardContent>
              <PieChartWidget
                data={productionDistributionData}
                colors={distributionColors}
                height={280}
              />
              <div className="mt-4 space-y-2">
                {productionDistributionData.map((item) => (
                  <div key={item.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-700">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Key Performance Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Customer Retention Rate</p>
                <p className="text-3xl font-bold text-primary-700 mt-2">94.5%</p>
                <p className="text-sm text-gray-600 mt-1">↑ 2.3% from last year</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-accent-50 to-accent-100 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Average Processing Time</p>
                <p className="text-3xl font-bold text-accent-700 mt-2">4.2 days</p>
                <p className="text-sm text-gray-600 mt-1">↓ 0.8 days improvement</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Payment Success Rate</p>
                <p className="text-3xl font-bold text-blue-700 mt-2">97.8%</p>
                <p className="text-sm text-gray-600 mt-1">↑ 1.2% from last quarter</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
