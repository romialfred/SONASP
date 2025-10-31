import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrafficLightIndicator } from '@/components/analytics/TrafficLightIndicator';
import { KPICard } from '@/components/analytics/KPICard';
import { AreaChartWidget } from '@/components/charts/AreaChartWidget';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { PieChartWidget } from '@/components/charts/PieChartWidget';
import { DollarSign, TrendingUp, Users, Package, Target, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/salesUtils';

export function OverviewAnalytics() {
  const healthScore = 92;
  const revenueAchievement = 87;
  const customerSatisfaction = 94;
  const operationalEfficiency = 78;

  const getTrafficStatus = (value: number, goodThreshold: number, warningThreshold: number) => {
    if (value >= goodThreshold) return 'good';
    if (value >= warningThreshold) return 'warning';
    return 'critical';
  };

  const salesTrendData = [
    { month: 'Jan', revenue: 685, target: 700, profit: 125 },
    { month: 'Feb', revenue: 742, target: 750, profit: 138 },
    { month: 'Mar', revenue: 698, target: 720, profit: 128 },
    { month: 'Apr', revenue: 812, target: 750, profit: 152 },
    { month: 'May', revenue: 756, target: 780, profit: 142 },
    { month: 'Jun', revenue: 895, target: 800, profit: 168 },
    { month: 'Jul', revenue: 834, target: 820, profit: 158 },
    { month: 'Aug', revenue: 923, target: 850, profit: 175 },
    { month: 'Sep', revenue: 867, target: 880, profit: 165 },
    { month: 'Oct', revenue: 945, target: 900, profit: 182 },
    { month: 'Nov', revenue: 878, target: 920, profit: 168 },
    { month: 'Dec', revenue: 910, target: 950, profit: 174 },
  ];

  const revenueByCountryData = [
    { name: 'Guinea', revenue: 4250, percentage: 45 },
    { name: 'Mali', revenue: 2835, percentage: 30 },
    { name: "Côte d'Ivoire", revenue: 2360, percentage: 25 },
  ];

  const customerDistributionData = [
    { name: 'Premium Clients', value: 35, color: '#B8860B' },
    { name: 'Standard Clients', value: 45, color: '#475569' },
    { name: 'New Clients', value: 20, color: '#10B981' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TrafficLightIndicator
          status={getTrafficStatus(healthScore, 90, 70)}
          label="Overall Health Score"
          value={`${healthScore}%`}
          threshold="Target: >90%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(revenueAchievement, 95, 80)}
          label="Revenue Achievement"
          value={`${revenueAchievement}%`}
          threshold="Target: >95%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(customerSatisfaction, 90, 75)}
          label="Customer Satisfaction"
          value={`${customerSatisfaction}%`}
          threshold="Target: >90%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(operationalEfficiency, 85, 70)}
          label="Operational Efficiency"
          value={`${operationalEfficiency}%`}
          threshold="Target: >85%"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue YTD"
          value={formatCurrency(8945230)}
          change={24}
          changeLabel="vs last year"
          icon={DollarSign}
          color="green"
          subtitle="Target: $10.5M"
        />
        <KPICard
          title="Sales Volume"
          value="234 sales"
          change={18}
          changeLabel="vs last year"
          icon={TrendingUp}
          color="blue"
          subtitle="Average: 19.5/month"
        />
        <KPICard
          title="Active Customers"
          value="18"
          change={20}
          changeLabel="new this year"
          icon={Users}
          color="purple"
          subtitle="Retention: 94.5%"
        />
        <KPICard
          title="Avg Deal Size"
          value={formatCurrency(38227)}
          change={5}
          changeLabel="vs last year"
          icon={Package}
          color="yellow"
          subtitle="Target: $42K"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Revenue vs Target Trend</span>
              <Target className="h-5 w-5 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChartWidget
              data={salesTrendData}
              areas={[
                { dataKey: 'revenue', color: '#B8860B', name: 'Actual Revenue ($K)' },
                { dataKey: 'target', color: '#94A3B8', name: 'Target ($K)' },
              ]}
              height={300}
            />
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">
                Analysis: Revenue tracking 87% of target. Q4 push needed to close year strong.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Country</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={revenueByCountryData}
              bars={[
                { dataKey: 'revenue', color: '#B8860B', name: 'Revenue ($K)' },
              ]}
              height={300}
            />
            <div className="mt-4 space-y-2">
              {revenueByCountryData.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(item.revenue * 1000)}
                    </span>
                    <span className="text-xs text-gray-500">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChartWidget
              data={customerDistributionData}
              colors={['#B8860B', '#475569', '#10B981']}
              height={240}
            />
            <div className="mt-4 space-y-2">
              {customerDistributionData.map((item) => (
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Key Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-green-900 mb-1">Positive Trends</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Customer satisfaction at 94%, exceeding target</li>
                  <li>• Sales volume up 18% year-over-year</li>
                  <li>• Guinea operations performing 12% above forecast</li>
                </ul>
              </div>

              <div className="border-l-4 border-yellow-500 pl-4">
                <h4 className="font-semibold text-yellow-900 mb-1">Areas of Concern</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Revenue achievement at 87%, below 95% target</li>
                  <li>• Operational efficiency at 78%, needs improvement</li>
                  <li>• Q4 revenue $3.2M below annual target</li>
                </ul>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-blue-900 mb-1">Recommended Actions</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Accelerate Q4 sales pipeline to close gap</li>
                  <li>• Focus on operational efficiency in Mali operations</li>
                  <li>• Leverage high customer satisfaction for referrals</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
