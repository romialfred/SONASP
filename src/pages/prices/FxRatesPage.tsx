import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Download } from 'lucide-react';
import { demoFxRates } from '@/lib/demoSeed';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function FxRatesPage() {
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');

  const currencies = Array.from(new Set(demoFxRates.map(r => r.code)));

  const chartData = Array.from(new Set(demoFxRates.map(r => r.as_of))).map(date => {
    const rates: any = { date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    currencies.forEach(currency => {
      const rate = demoFxRates.find(r => r.as_of === date && r.code === currency);
      if (rate) {
        rates[currency] = parseFloat(rate.rate_to_usd.toFixed(4));
      }
    });
    return rates;
  });

  const latestRates = currencies.map(code => {
    const rates = demoFxRates.filter(r => r.code === code).sort((a, b) =>
      new Date(b.as_of).getTime() - new Date(a.as_of).getTime()
    );
    return {
      code,
      rate: rates[0].rate_to_usd,
      prev_rate: rates[1]?.rate_to_usd || rates[0].rate_to_usd,
    };
  });

  const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">FX Rates</h1>
            <p className="text-gray-600 mt-1">Monitor foreign exchange rates</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {latestRates.map((item) => {
            const change = item.rate - item.prev_rate;
            const changePercent = (change / item.prev_rate) * 100;
            return (
              <Card key={item.code}>
                <div className="p-4">
                  <p className="text-sm text-gray-600">{item.code}/USD</p>
                  <p className="text-2xl font-bold text-gray-900">{item.rate.toFixed(4)}</p>
                  <p className={`text-xs mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(4)} ({changePercent.toFixed(2)}%)
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">FX Rate Trends (Last 14 Days)</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {currencies.map((currency, index) => (
                    <Line
                      key={currency}
                      type="monotone"
                      dataKey={currency}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={{ fill: colors[index % colors.length] }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Historical Rates</h2>
            <div className="mb-4">
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {currencies.map(code => (
                  <option key={code} value={code}>{code}/USD</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {demoFxRates
                    .filter(r => r.code === selectedCurrency)
                    .slice().reverse()
                    .map((rate, index, arr) => {
                      const prevRate = arr[index + 1];
                      const change = prevRate ? rate.rate_to_usd - prevRate.rate_to_usd : 0;
                      return (
                        <tr key={`${rate.as_of}-${rate.code}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(rate.as_of).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {rate.rate_to_usd.toFixed(4)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                            {prevRate && (
                              <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {change >= 0 ? '+' : ''}{change.toFixed(4)}
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
      </div>
    </MainLayout>
  );
}
