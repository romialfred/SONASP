import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrafficLightIndicator } from '@/components/analytics/TrafficLightIndicator';
import { KPICard } from '@/components/analytics/KPICard';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { TrendingUp, Target, Zap, Award, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/salesUtils';

export function PerformanceAnalytics() {
  const productivity = 94;
  const efficiency = 87;
  const quality = 96;

  const getTrafficStatus = (value: number, good: number, warning: number) => {
    if (value >= good) return 'good';
    if (value >= warning) return 'warning';
    return 'critical';
  };

  const productivityData = [
    { month: 'Jan', batchesPerDay: 8.2, revenuePerEmployee: 42 },
    { month: 'Feb', batchesPerDay: 8.8, revenuePerEmployee: 44 },
    { month: 'Mar', batchesPerDay: 8.5, revenuePerEmployee: 43 },
    { month: 'Apr', batchesPerDay: 9.2, revenuePerEmployee: 47 },
    { month: 'May', batchesPerDay: 8.9, revenuePerEmployee: 45 },
    { month: 'Jun', batchesPerDay: 9.6, revenuePerEmployee: 49 },
    { month: 'Jul', batchesPerDay: 9.1, revenuePerEmployee: 46 },
    { month: 'Aug', batchesPerDay: 9.8, revenuePerEmployee: 51 },
    { month: 'Sep', batchesPerDay: 9.4, revenuePerEmployee: 48 },
    { month: 'Oct', batchesPerDay: 10.2, revenuePerEmployee: 52 },
    { month: 'Nov', batchesPerDay: 9.5, revenuePerEmployee: 49 },
    { month: 'Dec', batchesPerDay: 9.9, revenuePerEmployee: 50 },
  ];

  const efficiencyData = [
    { site: 'Guinea', efficiency: 92, costPerBatch: 185 },
    { site: 'Mali', efficiency: 85, costPerBatch: 210 },
    { site: "Côte d'Ivoire", efficiency: 88, costPerBatch: 195 },
    { site: 'Refinery A', efficiency: 84, costPerBatch: 220 },
    { site: 'Refinery B', efficiency: 90, costPerBatch: 190 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrafficLightIndicator
          status={getTrafficStatus(productivity, 90, 80)}
          label="Productivity Index"
          value={`${productivity}%`}
          threshold="Target: >90%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(efficiency, 85, 75)}
          label="Efficiency Ratio"
          value={`${efficiency}%`}
          threshold="Target: >85%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(quality, 95, 90)}
          label="Quality Score"
          value={`${quality}%`}
          threshold="Target: >95%"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Revenue per Employee"
          value={formatCurrency(47200)}
          change={14}
          changeLabel="vs last year"
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title="Cost per Batch"
          value="$198"
          change={-8}
          changeLabel="reduction"
          icon={Target}
          color="blue"
        />
        <KPICard
          title="Error Rate"
          value="0.7%"
          change={-22}
          changeLabel="improvement"
          icon={Award}
          color="green"
        />
        <KPICard
          title="Efficiency Score"
          value="87%"
          change={5}
          changeLabel="improvement"
          icon={Zap}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Productivity Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartWidget
              data={productivityData}
              lines={[
                { dataKey: 'batchesPerDay', color: '#B8860B', name: 'Batches/Day' },
                { dataKey: 'revenuePerEmployee', color: '#10B981', name: 'Revenue/Employee ($K)' },
              ]}
              height={300}
            />
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-900 font-medium">
                Productivity up 18% YoY. Oct peak at 10.2 batches/day.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Site Efficiency Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={efficiencyData}
              bars={[
                { dataKey: 'efficiency', color: '#3B82F6', name: 'Efficiency %' },
              ]}
              height={300}
              layout="horizontal"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-900 mb-2">Excellence</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Productivity at 94% exceeds target</li>
                <li>• Quality score 96% industry-leading</li>
                <li>• Revenue/employee up 14%</li>
              </ul>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Focus</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Efficiency at 87%, target 85%</li>
                <li>• Mali site needs improvement</li>
                <li>• Cost reduction opportunities</li>
              </ul>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-900 mb-2">Actions</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Share Guinea best practices</li>
                <li>• Optimize Mali operations</li>
                <li>• Maintain quality standards</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
