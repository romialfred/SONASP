import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrafficLightIndicator } from '@/components/analytics/TrafficLightIndicator';
import { KPICard } from '@/components/analytics/KPICard';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { PieChartWidget } from '@/components/charts/PieChartWidget';
import { Users, DollarSign, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/salesUtils';

export function CustomerAnalytics() {
  const retention = 94;
  const paymentTimeliness = 92;
  const creditExposure = 78;

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

  const customerSegmentationData = [
    { segment: 'Premium', count: 6, revenue: 4200, color: '#B8860B' },
    { segment: 'Standard', count: 8, revenue: 3100, color: '#475569' },
    { segment: 'Growing', count: 4, revenue: 1650, color: '#10B981' },
  ];

  const lifetimeValueData = [
    { name: 'Auramet', ltv: 2450, transactions: 24 },
    { name: 'Stonex', ltv: 2180, transactions: 21 },
    { name: 'Swiss PM', ltv: 1920, transactions: 19 },
    { name: 'Dubai Gold', ltv: 1650, transactions: 16 },
    { name: 'Singapore', ltv: 1420, transactions: 14 },
  ];

  const paymentBehaviorData = [
    { month: 'Jan', onTime: 15, late: 2 },
    { month: 'Feb', onTime: 17, late: 1 },
    { month: 'Mar', onTime: 16, late: 2 },
    { month: 'Apr', onTime: 19, late: 1 },
    { month: 'May', onTime: 18, late: 2 },
    { month: 'Jun', onTime: 21, late: 1 },
    { month: 'Jul', onTime: 19, late: 2 },
    { month: 'Aug', onTime: 22, late: 1 },
    { month: 'Sep', onTime: 20, late: 2 },
    { month: 'Oct', onTime: 24, late: 1 },
    { month: 'Nov', onTime: 21, late: 3 },
    { month: 'Dec', onTime: 23, late: 1 },
  ];

  const geographicData = [
    { region: 'Middle East', customers: 7, revenue: 3200 },
    { region: 'Europe', customers: 5, revenue: 2800 },
    { region: 'Asia', customers: 4, revenue: 2400 },
    { region: 'Americas', customers: 2, revenue: 1550 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrafficLightIndicator
          status={getTrafficStatus(retention, 90, 80)}
          label="Customer Retention"
          value={`${retention}%`}
          threshold="Target: >90%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(paymentTimeliness, 90, 80)}
          label="Payment Timeliness"
          value={`${paymentTimeliness}%`}
          threshold="Target: >90%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(creditExposure, 85, 70)}
          label="Credit Exposure Index"
          value={`${creditExposure}%`}
          threshold="Target: >85%"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Customer Lifetime Value"
          value={formatCurrency(1842000)}
          change={12}
          changeLabel="vs last year"
          icon={DollarSign}
          color="green"
          subtitle="Avg per customer"
        />
        <KPICard
          title="Churn Rate"
          value="6%"
          change={-15}
          changeLabel="improvement"
          icon={TrendingUp}
          color="green"
          subtitle="Industry avg: 12%"
        />
        <KPICard
          title="Avg Payment Days"
          value="8.4 days"
          change={-10}
          changeLabel="improvement"
          icon={Clock}
          color="blue"
          subtitle="Target: <10 days"
        />
        <KPICard
          title="Active Customers"
          value="18"
          change={20}
          changeLabel="vs last year"
          icon={Users}
          color="purple"
          subtitle="3 new this year"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Segmentation Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChartWidget
              data={customerSegmentationData}
              colors={['#B8860B', '#475569', '#10B981']}
              height={280}
            />
            <div className="mt-4 space-y-2">
              {customerSegmentationData.map((seg) => (
                <div key={seg.segment} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="text-sm text-gray-700">{seg.segment}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(seg.revenue * 1000)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">({seg.count} customers)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 by Lifetime Value</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={lifetimeValueData}
              bars={[
                { dataKey: 'ltv', color: '#B8860B', name: 'LTV ($K)' },
              ]}
              height={280}
              layout="horizontal"
            />
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-900 font-medium">
                Top 5 customers account for 57% of total LTV. Strong relationships maintained.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Behavior Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={paymentBehaviorData}
              bars={[
                { dataKey: 'onTime', color: '#10B981', name: 'On-Time' },
                { dataKey: 'late', color: '#EF4444', name: 'Late' },
              ]}
              height={280}
            />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-700 font-medium">On-Time Payments</p>
                <p className="text-2xl font-bold text-green-900">235</p>
                <p className="text-xs text-green-600 mt-1">92% success rate</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-700 font-medium">Late Payments</p>
                <p className="text-2xl font-bold text-red-900">19</p>
                <p className="text-xs text-red-600 mt-1">8% of total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={geographicData}
              bars={[
                { dataKey: 'revenue', color: '#B8860B', name: 'Revenue ($K)' },
              ]}
              height={280}
            />
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">
                Middle East dominates with 39% of customers. Opportunity to expand in Americas.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Customer Insights & Strategic Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-900 mb-2">Strengths</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 94% retention rate exceptional</li>
                <li>• 6% churn vs 12% industry average</li>
                <li>• Payment timeliness at 92%</li>
                <li>• Strong LTV across top customers</li>
              </ul>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Risk Areas</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Credit exposure at 78% needs monitoring</li>
                <li>• Geographic concentration in Middle East</li>
                <li>• Nov showed 3 late payments (spike)</li>
                <li>• Only 2 customers in Americas</li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-900 mb-2">Action Plan</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Develop Americas market entry strategy</li>
                <li>• Implement credit limit reviews quarterly</li>
                <li>• Investigate Nov late payment pattern</li>
                <li>• Launch loyalty program for premium tier</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
