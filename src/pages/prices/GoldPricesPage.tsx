import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { TrendingUp, Download } from 'lucide-react';
import { demoGoldPrices } from '@/lib/demoSeed';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function GoldPricesPage() {
  const chartData = demoGoldPrices.map(price => ({
    date: new Date(price.as_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: parseFloat(price.price_per_oz_usd.toFixed(2))
  }));

  const latestPrice = demoGoldPrices[demoGoldPrices.length - 1];
  const previousPrice = demoGoldPrices[demoGoldPrices.length - 2];
  const priceChange = latestPrice.price_per_oz_usd - previousPrice.price_per_oz_usd;
  const priceChangePercent = (priceChange / previousPrice.price_per_oz_usd) * 100;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gold Prices</h1>
            <p className="text-gray-600 mt-1">Track gold price movements and trends</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-gray-600">Current Gold Price</p>
                <div className="flex items-baseline gap-3">
                  <p className="text-4xl font-bold text-gray-900">
                    ${latestPrice.price_per_oz_usd.toFixed(2)}
                  </p>
                  <span className={`flex items-center gap-1 text-sm font-medium ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <TrendingUp className="w-4 h-4" />
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">per troy ounce (USD)</p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price/oz']} />
                  <Line type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Historical Prices (Last 14 Days)</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price (USD/oz)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {demoGoldPrices.slice().reverse().map((price, index, arr) => {
                    const prevPrice = arr[index + 1];
                    const change = prevPrice ? price.price_per_oz_usd - prevPrice.price_per_oz_usd : 0;
                    return (
                      <tr key={price.as_of} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(price.as_of).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          ${price.price_per_oz_usd.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {prevPrice && (
                            <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {change >= 0 ? '+' : ''}{change.toFixed(2)}
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
