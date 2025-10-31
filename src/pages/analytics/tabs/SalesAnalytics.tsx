import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrafficLightIndicator } from '@/components/analytics/TrafficLightIndicator';
import { KPICard } from '@/components/analytics/KPICard';
import { AreaChartWidget } from '@/components/charts/AreaChartWidget';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { DollarSign, TrendingUp, Target, Users, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/salesUtils';

export function SalesAnalytics() {
  const pipelineHealth = 78;
  const conversionRate = 64;
  const dealVelocity = 18;

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

  const salesPipelineData = [
    { stage: 'Prospects', count: 45, value: 3200 },
    { stage: 'Qualified', count: 32, value: 2400 },
    { stage: 'Proposal', count: 18, value: 1680 },
    { stage: 'Negotiation', count: 12, value: 1120 },
    { stage: 'Closed Won', count: 8, value: 780 },
  ];

  const salesTrendData = [
    { month: 'Jan', won: 6, lost: 2, pipeline: 24 },
    { month: 'Feb', won: 7, lost: 3, pipeline: 26 },
    { month: 'Mar', won: 5, lost: 2, pipeline: 28 },
    { month: 'Apr', won: 9, lost: 1, pipeline: 30 },
    { month: 'May', won: 6, lost: 3, pipeline: 27 },
    { month: 'Jun', won: 10, lost: 2, pipeline: 32 },
    { month: 'Jul', won: 8, lost: 2, pipeline: 29 },
    { month: 'Aug', won: 11, lost: 1, pipeline: 34 },
    { month: 'Sep', won: 9, lost: 3, pipeline: 31 },
    { month: 'Oct', won: 12, lost: 2, pipeline: 35 },
    { month: 'Nov', won: 8, lost: 4, pipeline: 28 },
    { month: 'Dec', won: 10, lost: 2, pipeline: 33 },
  ];

  const revenueByProductData = [
    { month: 'Jan', gold: 580, silver: 105 },
    { month: 'Feb', gold: 640, silver: 102 },
    { month: 'Mar', gold: 590, silver: 108 },
    { month: 'Apr', gold: 720, silver: 92 },
    { month: 'May', gold: 650, silver: 106 },
    { month: 'Jun', gold: 780, silver: 115 },
    { month: 'Jul', gold: 720, silver: 114 },
    { month: 'Aug', gold: 820, silver: 103 },
    { month: 'Sep', gold: 760, silver: 107 },
    { month: 'Oct', gold: 840, silver: 105 },
    { month: 'Nov', gold: 770, silver: 108 },
    { month: 'Dec', gold: 810, silver: 100 },
  ];

  const topCustomersData = [
    { name: 'Auramet Capital', revenue: 1245, deals: 18 },
    { name: 'Stonex Financial', revenue: 1089, deals: 15 },
    { name: 'Swiss Precious Metals', revenue: 987, deals: 14 },
    { name: 'Dubai Gold Exchange', revenue: 856, deals: 12 },
    { name: 'Singapore Bullion', revenue: 734, deals: 10 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrafficLightIndicator
          status={getTrafficStatus(pipelineHealth, 85, 70)}
          label="Sales Pipeline Health"
          value={`${pipelineHealth}%`}
          threshold="Target: >85%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(conversionRate, 60, 45)}
          label="Conversion Rate"
          value={`${conversionRate}%`}
          threshold="Target: >60%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(dealVelocity, 21, 30, true)}
          label="Avg Deal Velocity"
          value={`${dealVelocity} days`}
          threshold="Target: <21 days"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Pipeline Value"
          value={formatCurrency(2400000)}
          change={15}
          changeLabel="vs last quarter"
          icon={DollarSign}
          color="green"
          subtitle="32 active deals"
        />
        <KPICard
          title="Win Rate"
          value="64%"
          change={8}
          changeLabel="vs last quarter"
          icon={Target}
          color="blue"
          subtitle="91 won / 142 total"
        />
        <KPICard
          title="Average Deal Size"
          value={formatCurrency(42000)}
          change={5}
          changeLabel="vs last quarter"
          icon={TrendingUp}
          color="purple"
          subtitle="Trending upward"
        />
        <KPICard
          title="Sales Cycle"
          value="18 days"
          change={-15}
          changeLabel="improvement"
          icon={Clock}
          color="green"
          subtitle="Target: <21 days"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Funnel Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={salesPipelineData}
              bars={[
                { dataKey: 'value', color: '#B8860B', name: 'Value ($K)' },
              ]}
              height={300}
            />
            <div className="mt-4 space-y-2">
              {salesPipelineData.map((stage, index) => (
                <div key={stage.stage} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${index === 4 ? 'bg-green-500' : 'bg-blue-500'}`} />
                    <span className="text-sm text-gray-700">{stage.stage}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{stage.count} deals</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(stage.value * 1000)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">
                Conversion Rate: 17.8% (8/45 prospects closed). Focus on qualification stage to improve.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Win/Loss Trend Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChartWidget
              data={salesTrendData}
              areas={[
                { dataKey: 'won', color: '#10B981', name: 'Deals Won' },
                { dataKey: 'lost', color: '#EF4444', name: 'Deals Lost' },
              ]}
              height={300}
            />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-700 font-medium">Total Won</p>
                <p className="text-2xl font-bold text-green-900">91 deals</p>
                <p className="text-xs text-green-600 mt-1">Avg: 7.6/month</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-700 font-medium">Total Lost</p>
                <p className="text-2xl font-bold text-red-900">27 deals</p>
                <p className="text-xs text-red-600 mt-1">Avg: 2.3/month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Product Category</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartWidget
              data={revenueByProductData}
              lines={[
                { dataKey: 'gold', color: '#B8860B', name: 'Gold ($K)' },
                { dataKey: 'silver', color: '#94A3B8', name: 'Silver ($K)' },
              ]}
              height={300}
            />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Gold Revenue</p>
                <p className="text-xl font-bold text-primary-700">{formatCurrency(8680000)}</p>
                <p className="text-xs text-gray-600 mt-1">87% of total</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Silver Revenue</p>
                <p className="text-xl font-bold text-gray-700">{formatCurrency(1265000)}</p>
                <p className="text-xs text-gray-600 mt-1">13% of total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={topCustomersData}
              bars={[
                { dataKey: 'revenue', color: '#B8860B', name: 'Revenue ($K)' },
              ]}
              height={300}
              layout="horizontal"
            />
            <div className="mt-4 p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-900 font-medium">
                Top 5 customers represent 49% of total revenue. Diversification opportunity identified.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Sales Performance Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-900 mb-2">Strengths</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Win rate of 64% exceeds industry avg (55%)</li>
                <li>• Deal velocity improved 15% to 18 days</li>
                <li>• Q4 pipeline strongest at $2.4M</li>
                <li>• Customer concentration manageable</li>
              </ul>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Watch Areas</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Pipeline health at 78% below 85% target</li>
                <li>• Qualification-to-proposal drop-off high (44%)</li>
                <li>• Silver product line underperforming</li>
                <li>• Nov showed uptick in losses (4 deals)</li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-900 mb-2">Action Items</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Improve lead qualification process</li>
                <li>• Develop silver market expansion plan</li>
                <li>• Add 3-5 mid-tier customers to reduce risk</li>
                <li>• Analyze Nov losses for pattern insights</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
