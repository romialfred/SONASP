import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrafficLightIndicator } from '@/components/analytics/TrafficLightIndicator';
import { KPICard } from '@/components/analytics/KPICard';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { PieChartWidget } from '@/components/charts/PieChartWidget';
import { Package, Clock, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react';

export function BatchAnalytics() {
  const onTimeDelivery = 89;
  const processingVariance = 2.3;
  const qualityScore = 96;

  const getTrafficStatus = (value: number, goodThreshold: number, warningThreshold: number, reverse = false) => {
    if (reverse) {
      if (value <= goodThreshold) return 'good';
      if (value <= warningThreshold) return 'warning';
      return 'critical';
    }
    if (value >= goodThreshold) return 'good';
    if (value >= warningThreshold) return 'warning';
    return 'critical';
  };

  const batchLifecycleData = [
    { month: 'Jan', created: 24, processed: 22, delivered: 21 },
    { month: 'Feb', created: 26, processed: 24, delivered: 23 },
    { month: 'Mar', created: 23, processed: 22, delivered: 22 },
    { month: 'Apr', created: 28, processed: 26, delivered: 25 },
    { month: 'May', created: 25, processed: 24, delivered: 23 },
    { month: 'Jun', created: 30, processed: 28, delivered: 27 },
    { month: 'Jul', created: 27, processed: 26, delivered: 25 },
    { month: 'Aug', created: 32, processed: 30, delivered: 29 },
    { month: 'Sep', created: 29, processed: 28, delivered: 27 },
    { month: 'Oct', created: 34, processed: 32, delivered: 31 },
    { month: 'Nov', created: 28, processed: 27, delivered: 26 },
    { month: 'Dec', created: 31, processed: 29, delivered: 28 },
  ];

  const processingTimeData = [
    { site: 'Guinea', avgDays: 3.8 },
    { site: 'Mali', avgDays: 4.5 },
    { site: "Côte d'Ivoire", avgDays: 4.2 },
    { site: 'Refinery A', avgDays: 5.1 },
    { site: 'Refinery B', avgDays: 4.8 },
  ];

  const varianceDistributionData = [
    { range: '<1%', count: 145, color: '#10B981' },
    { range: '1-2%', count: 68, color: '#3B82F6' },
    { range: '2-3%', count: 34, color: '#F59E0B' },
    { range: '3-5%', count: 18, color: '#EF4444' },
    { range: '>5%', count: 6, color: '#7C2D12' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrafficLightIndicator
          status={getTrafficStatus(onTimeDelivery, 90, 80)}
          label="On-Time Delivery Rate"
          value={`${onTimeDelivery}%`}
          threshold="Target: >90%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(processingVariance, 3, 5, true)}
          label="Processing Variance"
          value={`${processingVariance}%`}
          threshold="Target: <3%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(qualityScore, 95, 90)}
          label="Quality Score"
          value={`${qualityScore}%`}
          threshold="Target: >95%"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Avg Processing Time"
          value="4.3 days"
          change={-12}
          changeLabel="improvement"
          icon={Clock}
          color="green"
          subtitle="Target: <5 days"
        />
        <KPICard
          title="Batches per Day"
          value="9.2"
          change={8}
          changeLabel="vs last quarter"
          icon={Package}
          color="blue"
          subtitle="112 total this month"
        />
        <KPICard
          title="Variance Rate"
          value="2.3%"
          change={-18}
          changeLabel="improvement"
          icon={TrendingDown}
          color="green"
          subtitle="Within target"
        />
        <KPICard
          title="Error Rate"
          value="0.8%"
          change={-25}
          changeLabel="improvement"
          icon={CheckCircle}
          color="green"
          subtitle="Industry best"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Batch Lifecycle Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartWidget
              data={batchLifecycleData}
              lines={[
                { dataKey: 'created', color: '#3B82F6', name: 'Created' },
                { dataKey: 'processed', color: '#B8860B', name: 'Processed' },
                { dataKey: 'delivered', color: '#10B981', name: 'Delivered' },
              ]}
              height={300}
            />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="p-2 bg-blue-50 rounded text-center">
                <p className="text-xs text-blue-700 font-medium">Created</p>
                <p className="text-xl font-bold text-blue-900">337</p>
              </div>
              <div className="p-2 bg-amber-50 rounded text-center">
                <p className="text-xs text-amber-700 font-medium">Processed</p>
                <p className="text-xl font-bold text-amber-900">318</p>
              </div>
              <div className="p-2 bg-green-50 rounded text-center">
                <p className="text-xs text-green-700 font-medium">Delivered</p>
                <p className="text-xl font-bold text-green-900">307</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing Time by Site</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={processingTimeData}
              bars={[
                { dataKey: 'avgDays', color: '#B8860B', name: 'Avg Days' },
              ]}
              height={300}
              layout="horizontal"
            />
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">
                All sites meet target. Refinery A slightly higher due to quality checks.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weight Variance Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <PieChartWidget
            data={varianceDistributionData}
            colors={['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#7C2D12']}
            height={300}
          />
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-900 font-medium">
              78% of batches within 2% variance. Excellent quality control.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Batch Operations Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-900 mb-2">Excellence</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 96% quality score exceeds target</li>
                <li>• Processing variance at 2.3%</li>
                <li>• Error rate 0.8% industry-leading</li>
              </ul>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Focus Areas</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• On-time delivery 89% vs 90% target</li>
                <li>• 24 batches with {'>'}3% variance</li>
                <li>• Refinery A processing time 5.1 days</li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-900 mb-2">Actions</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Streamline approval process</li>
                <li>• Investigate high-variance batches</li>
                <li>• Optimize Refinery A workflow</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
