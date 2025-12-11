import { Card } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Award, DollarSign, Percent } from 'lucide-react';
import { type PricingMechanism } from '@/services/goldTradeSpaceService';

interface FinancialComparisonProps {
  mechanisms: PricingMechanism[];
  recommendedMechanism: string;
}

export function FinancialComparison({ mechanisms, recommendedMechanism }: FinancialComparisonProps) {
  const spotMechanism = mechanisms.find((m) => m.mechanism === 'spot');
  if (!spotMechanism) return null;

  const comparisonData = mechanisms.map((m) => ({
    name: m.displayName.replace(' Basis', '').replace(' Days', 'd'),
    totalValue: m.totalValue,
    benefit: m.totalValue - spotMechanism.totalValue,
    pricePerOz: m.pricePerOz,
    isRecommended: m.mechanism === recommendedMechanism,
  }));

  const benefitData = mechanisms.map((m) => ({
    name: m.displayName.replace(' Basis', '').replace(' Days', 'd'),
    absoluteBenefit: m.totalValue - spotMechanism.totalValue,
    percentageBenefit: ((m.totalValue - spotMechanism.totalValue) / spotMechanism.totalValue) * 100,
    days: m.settlementDays,
  }));

  const maxBenefit = Math.max(...mechanisms.map((m) => m.totalValue - spotMechanism.totalValue));
  const bestMechanism = mechanisms.find((m) => m.totalValue - spotMechanism.totalValue === maxBenefit);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('$') || entry.name.includes('Value') || entry.name.includes('Benefit')
                ? `$${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : `${entry.value.toFixed(2)}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 transition-all duration-300 hover:scale-125 hover:shadow-xl hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-200 hover:z-10 cursor-pointer">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-semibold">Spot Value (Baseline)</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              ${spotMechanism.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-blue-700">
              ${spotMechanism.pricePerOz.toFixed(2)}/oz • {spotMechanism.settlementDays} days
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 transition-all duration-300 hover:scale-125 hover:shadow-xl hover:bg-gradient-to-br hover:from-emerald-100 hover:to-emerald-200 hover:z-10 cursor-pointer">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700">
              <Award className="w-5 h-5" />
              <span className="text-sm font-semibold">Best Financial Outcome</span>
            </div>
            <div className="text-2xl font-bold text-emerald-900">
              ${bestMechanism?.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-emerald-700">
              {bestMechanism?.displayName} • +${maxBenefit.toFixed(2)} benefit
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 transition-all duration-300 hover:scale-125 hover:shadow-xl hover:bg-gradient-to-br hover:from-amber-100 hover:to-amber-200 hover:z-10 cursor-pointer">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-semibold">Maximum Gain vs Spot</span>
            </div>
            <div className="text-2xl font-bold text-amber-900">
              +${maxBenefit.toFixed(2)}
            </div>
            <div className="text-xs text-amber-700">
              {((maxBenefit / spotMechanism.totalValue) * 100).toFixed(2)}% improvement
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Total Value Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonData}>
              <XAxis dataKey="name" />
              <YAxis
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="totalValue"
                name="Total Value ($)"
                fill="#3b82f6"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Financial Benefit Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={benefitData}>
              <XAxis dataKey="name" />
              <YAxis
                yAxisId="left"
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value.toFixed(1)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="absoluteBenefit"
                name="Absolute Benefit ($)"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="percentageBenefit"
                name="Percentage Benefit (%)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Comparison Table</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Mechanism</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Price/oz</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Value</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Benefit ($)</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Benefit (%)</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Settlement</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {mechanisms.map((m, index) => {
                  const benefit = m.totalValue - spotMechanism.totalValue;
                  const benefitPercentage = (benefit / spotMechanism.totalValue) * 100;
                  const isRecommended = m.mechanism === recommendedMechanism;

                  return (
                    <tr
                      key={m.mechanism}
                      className={`border-b border-gray-100 ${
                        isRecommended ? 'bg-emerald-50' : index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{m.displayName}</div>
                        <div className="text-xs text-gray-500">{m.description}</div>
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-gray-900">
                        ${m.pricePerOz.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-gray-900">
                        ${m.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`text-right py-3 px-4 font-semibold ${
                        benefit > 0 ? 'text-green-600' : benefit < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {benefit > 0 ? '+' : ''}${benefit.toFixed(2)}
                      </td>
                      <td className={`text-right py-3 px-4 font-semibold ${
                        benefitPercentage > 0 ? 'text-green-600' : benefitPercentage < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {benefitPercentage > 0 ? '+' : ''}{benefitPercentage.toFixed(2)}%
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700">
                        {m.settlementDays} days
                      </td>
                      <td className="text-center py-3 px-4">
                        {isRecommended && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <Award className="w-3 h-3 mr-1" />
                            Recommended
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Percent className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-2">Financial Analysis Summary:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Best Value:</strong> {bestMechanism?.displayName} offers ${maxBenefit.toFixed(2)} additional value ({((maxBenefit / spotMechanism.totalValue) * 100).toFixed(2)}% improvement)</li>
                <li>• <strong>Risk-Reward:</strong> Forward contracts provide price protection but require buyer consent and longer settlement</li>
                <li>• <strong>Liquidity:</strong> Spot basis offers fastest settlement (2 days) with current market price</li>
                <li>• <strong>Optimization:</strong> Consider market trend and volatility when selecting mechanism</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
