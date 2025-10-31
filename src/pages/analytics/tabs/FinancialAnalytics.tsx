import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrafficLightIndicator } from '@/components/analytics/TrafficLightIndicator';
import { KPICard } from '@/components/analytics/KPICard';
import { AreaChartWidget } from '@/components/charts/AreaChartWidget';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { DollarSign, TrendingUp, PieChart as PieChartIcon, AlertTriangle, Percent } from 'lucide-react';
import { formatCurrency } from '@/utils/salesUtils';

export function FinancialAnalytics() {
  const profitMargin = 18.5;
  const cashFlow = 92;
  const fxExposure = 76;

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

  const plStatementData = [
    { month: 'Jan', revenue: 685, cogs: 548, opex: 82, profit: 55 },
    { month: 'Feb', revenue: 742, cogs: 594, opex: 89, profit: 59 },
    { month: 'Mar', revenue: 698, cogs: 558, opex: 84, profit: 56 },
    { month: 'Apr', revenue: 812, cogs: 650, opex: 97, profit: 65 },
    { month: 'May', revenue: 756, cogs: 605, opex: 91, profit: 60 },
    { month: 'Jun', revenue: 895, cogs: 716, opex: 107, profit: 72 },
    { month: 'Jul', revenue: 834, cogs: 667, opex: 100, profit: 67 },
    { month: 'Aug', revenue: 923, cogs: 738, opex: 111, profit: 74 },
    { month: 'Sep', revenue: 867, cogs: 694, opex: 104, profit: 69 },
    { month: 'Oct', revenue: 945, cogs: 756, opex: 113, profit: 76 },
    { month: 'Nov', revenue: 878, cogs: 702, opex: 105, profit: 71 },
    { month: 'Dec', revenue: 910, cogs: 728, opex: 109, profit: 73 },
  ];

  const cashFlowData = [
    { month: 'Jan', operating: 120, investing: -35, financing: -15 },
    { month: 'Feb', operating: 135, investing: -28, financing: -20 },
    { month: 'Mar', operating: 125, investing: -42, financing: -18 },
    { month: 'Apr', operating: 148, investing: -38, financing: -22 },
    { month: 'May', operating: 138, investing: -45, financing: -19 },
    { month: 'Jun', operating: 165, investing: -32, financing: -25 },
    { month: 'Jul', operating: 152, investing: -48, financing: -21 },
    { month: 'Aug', operating: 172, investing: -35, financing: -28 },
    { month: 'Sep', operating: 158, investing: -52, financing: -23 },
    { month: 'Oct', operating: 182, investing: -38, financing: -30 },
    { month: 'Nov', operating: 162, investing: -55, financing: -24 },
    { month: 'Dec', operating: 175, investing: -42, financing: -27 },
  ];

  const costBreakdownData = [
    { category: 'Raw Materials', amount: 4850, percentage: 58 },
    { category: 'Processing', amount: 1450, percentage: 17 },
    { category: 'Transportation', amount: 980, percentage: 12 },
    { category: 'Operations', amount: 720, percentage: 9 },
    { category: 'Other', amount: 350, percentage: 4 },
  ];

  const fxImpactData = [
    { month: 'Jan', gain: 12, loss: -5 },
    { month: 'Feb', gain: 8, loss: -7 },
    { month: 'Mar', gain: 15, loss: -4 },
    { month: 'Apr', gain: 10, loss: -9 },
    { month: 'May', gain: 18, loss: -6 },
    { month: 'Jun', gain: 14, loss: -8 },
    { month: 'Jul', gain: 11, loss: -12 },
    { month: 'Aug', gain: 16, loss: -5 },
    { month: 'Sep', gain: 13, loss: -10 },
    { month: 'Oct', gain: 20, loss: -7 },
    { month: 'Nov', gain: 9, loss: -15 },
    { month: 'Dec', gain: 17, loss: -6 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrafficLightIndicator
          status={getTrafficStatus(profitMargin, 15, 10)}
          label="Profit Margin Health"
          value={`${profitMargin}%`}
          threshold="Target: >15%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(cashFlow, 85, 70)}
          label="Cash Flow Status"
          value={`${cashFlow}%`}
          threshold="Target: >85%"
        />
        <TrafficLightIndicator
          status={getTrafficStatus(fxExposure, 80, 65)}
          label="FX Risk Management"
          value={`${fxExposure}%`}
          threshold="Target: >80%"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Gross Margin"
          value="23.2%"
          change={1.5}
          changeLabel="vs last year"
          icon={Percent}
          color="green"
          subtitle="Industry: 20.5%"
        />
        <KPICard
          title="Operating Profit"
          value={formatCurrency(1654000)}
          change={18}
          changeLabel="vs last year"
          icon={DollarSign}
          color="blue"
          subtitle="EBITDA: $1.89M"
        />
        <KPICard
          title="ROI"
          value="24.8%"
          change={6}
          changeLabel="vs last year"
          icon={TrendingUp}
          color="green"
          subtitle="Target: >20%"
        />
        <KPICard
          title="Operating Margin"
          value="18.5%"
          change={2.3}
          changeLabel="improvement"
          icon={PieChartIcon}
          color="purple"
          subtitle="Best in 3 years"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>P&L Statement Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChartWidget
              data={plStatementData}
              areas={[
                { dataKey: 'revenue', color: '#3B82F6', name: 'Revenue ($K)' },
                { dataKey: 'cogs', color: '#EF4444', name: 'COGS ($K)' },
                { dataKey: 'profit', color: '#10B981', name: 'Net Profit ($K)' },
              ]}
              height={300}
            />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="p-2 bg-blue-50 rounded text-center">
                <p className="text-xs text-blue-700 font-medium">Revenue</p>
                <p className="text-lg font-bold text-blue-900">{formatCurrency(9945000)}</p>
              </div>
              <div className="p-2 bg-red-50 rounded text-center">
                <p className="text-xs text-red-700 font-medium">COGS</p>
                <p className="text-lg font-bold text-red-900">{formatCurrency(7956000)}</p>
              </div>
              <div className="p-2 bg-green-50 rounded text-center">
                <p className="text-xs text-green-700 font-medium">Profit</p>
                <p className="text-lg font-bold text-green-900">{formatCurrency(797000)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={cashFlowData}
              bars={[
                { dataKey: 'operating', color: '#10B981', name: 'Operating' },
                { dataKey: 'investing', color: '#F59E0B', name: 'Investing' },
                { dataKey: 'financing', color: '#EF4444', name: 'Financing' },
              ]}
              height={300}
            />
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-900 font-medium">
                Strong operating cash flow of $1.83M. Investment in growth continues.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost Structure Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartWidget
              data={costBreakdownData}
              bars={[
                { dataKey: 'amount', color: '#B8860B', name: 'Amount ($K)' },
              ]}
              height={280}
              layout="horizontal"
            />
            <div className="mt-4 space-y-2">
              {costBreakdownData.map((item) => (
                <div key={item.category} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{item.category}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(item.amount * 1000)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>FX Impact Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartWidget
              data={fxImpactData}
              lines={[
                { dataKey: 'gain', color: '#10B981', name: 'FX Gains ($K)' },
                { dataKey: 'loss', color: '#EF4444', name: 'FX Losses ($K)' },
              ]}
              height={280}
            />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-700 font-medium">Total Gains</p>
                <p className="text-xl font-bold text-green-900">{formatCurrency(163000)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-700 font-medium">Total Losses</p>
                <p className="text-xl font-bold text-red-900">{formatCurrency(94000)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Financial Insights & Strategic Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-900 mb-2">Financial Health</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 18.5% profit margin exceeds target</li>
                <li>• Strong cash flow at 92% health</li>
                <li>• ROI of 24.8% excellent</li>
                <li>• Net FX gain of $69K for year</li>
              </ul>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Concerns</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• FX exposure at 76% needs improvement</li>
                <li>• Nov FX losses spiked to $15K</li>
                <li>• COGS at 58% could be optimized</li>
                <li>• Investment outflows increasing</li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-900 mb-2">Strategic Actions</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Implement hedging strategy for FX</li>
                <li>• Negotiate better raw material pricing</li>
                <li>• Optimize processing costs</li>
                <li>• Maintain current profit margins</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
