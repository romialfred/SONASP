import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KPICard } from '@/components/analytics/KPICard';
import { LineChartWidget } from '@/components/charts/LineChartWidget';
import { AreaChartWidget } from '@/components/charts/AreaChartWidget';
import { TrendingUp, Calendar, BarChart3, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/salesUtils';

export function TrendsAnalytics() {
  const multiYearRevenueData = [
    { month: 'Jan', y2023: 520, y2024: 620, y2025: 685 },
    { month: 'Feb', y2023: 545, y2024: 650, y2025: 742 },
    { month: 'Mar', y2023: 530, y2024: 635, y2025: 698 },
    { month: 'Apr', y2023: 590, y2024: 710, y2025: 812 },
    { month: 'May', y2023: 565, y2024: 685, y2025: 756 },
    { month: 'Jun', y2023: 620, y2024: 750, y2025: 895 },
    { month: 'Jul', y2023: 595, y2024: 720, y2025: 834 },
    { month: 'Aug', y2023: 650, y2024: 790, y2025: 923 },
    { month: 'Sep', y2023: 610, y2024: 745, y2025: 867 },
    { month: 'Oct', y2023: 680, y2024: 820, y2025: 945 },
    { month: 'Nov', y2023: 625, y2024: 765, y2025: 878 },
    { month: 'Dec', y2023: 670, y2024: 810, y2025: 910 },
  ];

  const goldPriceCorrelationData = [
    { month: 'Jan', revenue: 685, goldPrice: 2068 },
    { month: 'Feb', revenue: 742, goldPrice: 2042 },
    { month: 'Mar', revenue: 698, goldPrice: 2156 },
    { month: 'Apr', revenue: 812, goldPrice: 2298 },
    { month: 'May', revenue: 756, goldPrice: 2345 },
    { month: 'Jun', revenue: 895, goldPrice: 2312 },
    { month: 'Jul', revenue: 834, goldPrice: 2378 },
    { month: 'Aug', revenue: 923, goldPrice: 2456 },
    { month: 'Sep', revenue: 867, goldPrice: 2498 },
    { month: 'Oct', revenue: 945, goldPrice: 2623 },
    { month: 'Nov', revenue: 878, goldPrice: 2678 },
    { month: 'Dec', revenue: 910, goldPrice: 2712 },
  ];

  const seasonalPatternsData = [
    { month: 'Jan', q1: 665, q2: 756, q3: 834, q4: 898 },
    { month: 'Feb', q1: 720, q2: 812, q3: 890, q4: 942 },
    { month: 'Mar', q1: 698, q2: 785, q3: 867, q4: 925 },
    { month: 'Apr', q1: 785, q2: 845, q3: 920, q4: 985 },
    { month: 'May', q1: 745, q2: 820, q3: 895, q4: 958 },
    { month: 'Jun', q1: 832, q2: 898, q3: 965, q4: 1020 },
    { month: 'Jul', q1: 798, q2: 870, q3: 945, q4: 998 },
    { month: 'Aug', q1: 865, q2: 935, q3: 1015, q4: 1065 },
    { month: 'Sep', q1: 825, q2: 890, q3: 970, q4: 1025 },
    { month: 'Oct', q1: 892, q2: 965, q3: 1045, q4: 1095 },
    { month: 'Nov', q1: 842, q2: 910, q3: 985, q4: 1040 },
    { month: 'Dec', q1: 878, q2: 945, q3: 1020, q4: 1075 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="3-Year Growth Rate"
          value="32%"
          change={32}
          changeLabel="CAGR"
          icon={TrendingUp}
          color="green"
          subtitle="2023-2025"
        />
        <KPICard
          title="YoY Revenue Growth"
          value="24%"
          change={24}
          changeLabel="vs 2024"
          icon={BarChart3}
          color="blue"
          subtitle="$2.2M increase"
        />
        <KPICard
          title="Seasonal Peak"
          value="Q4"
          icon={Calendar}
          color="purple"
          subtitle="Avg +15% vs Q1"
        />
        <KPICard
          title="Gold Price Correlation"
          value="0.87"
          icon={TrendingUp}
          color="green"
          subtitle="Strong positive"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Multi-Year Revenue Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChartWidget
            data={multiYearRevenueData}
            lines={[
              { dataKey: 'y2023', color: '#94A3B8', name: '2023 ($K)' },
              { dataKey: 'y2024', color: '#3B82F6', name: '2024 ($K)' },
              { dataKey: 'y2025', color: '#B8860B', name: '2025 ($K)' },
            ]}
            height={350}
          />
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-600 font-medium">2023 Total</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(7200000)}</p>
              <p className="text-xs text-gray-500 mt-1">Base year</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <p className="text-xs text-blue-600 font-medium">2024 Total</p>
              <p className="text-xl font-bold text-blue-900">{formatCurrency(8700000)}</p>
              <p className="text-xs text-blue-600 mt-1">+21% growth</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg text-center">
              <p className="text-xs text-amber-600 font-medium">2025 Total</p>
              <p className="text-xl font-bold text-amber-900">{formatCurrency(9945000)}</p>
              <p className="text-xs text-amber-600 mt-1">+14% growth</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Gold Price Correlation</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChartWidget
              data={goldPriceCorrelationData}
              areas={[
                { dataKey: 'revenue', color: '#B8860B', name: 'Revenue ($K)' },
                { dataKey: 'goldPrice', color: '#3B82F6', name: 'Gold Price ($/oz ÷ 4)' },
              ]}
              height={300}
              yAxisFormatter={(value) => {
                if (value > 1500) return (value / 4).toFixed(0);
                return value.toFixed(0);
              }}
            />
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-900 font-medium">
                0.87 correlation coefficient. Revenue strongly tracks gold price movements.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seasonal Pattern Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartWidget
              data={seasonalPatternsData}
              lines={[
                { dataKey: 'q1', color: '#94A3B8', name: 'Q1 Pattern' },
                { dataKey: 'q2', color: '#3B82F6', name: 'Q2 Pattern' },
                { dataKey: 'q3', color: '#F59E0B', name: 'Q3 Pattern' },
                { dataKey: 'q4', color: '#10B981', name: 'Q4 Pattern' },
              ]}
              height={300}
            />
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 font-medium">
                Clear seasonal trend: Q4 peaks 15% above Q1 average. Plan inventory accordingly.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Trend Analysis & Forecasting Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-900 mb-2">Positive Indicators</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Consistent 3-year growth trajectory</li>
                <li>• Strong correlation with gold prices</li>
                <li>• Predictable seasonal patterns</li>
                <li>• Year-end momentum building</li>
              </ul>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Watch Factors</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Growth rate slowing (21% to 14%)</li>
                <li>• Gold price volatility increasing</li>
                <li>• Q1 historically weaker period</li>
                <li>• Market saturation risk in 2026</li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-900 mb-2">2026 Forecast Strategy</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Target $11.2M (+13% conservative)</li>
                <li>• Build Q1 inventory in Q4 2025</li>
                <li>• Hedge gold price exposure</li>
                <li>• Diversify customer base</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
            <h5 className="font-semibold text-gray-900 mb-2">Predictive Insight</h5>
            <p className="text-sm text-gray-700">
              Based on historical trends and current trajectory, 2026 revenue forecast: 
              <span className="font-bold text-primary-700"> {formatCurrency(11200000)} </span>
              (Conservative: {formatCurrency(10500000)} | Optimistic: {formatCurrency(12000000)}).
              Key driver: Gold price stability and customer retention.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
