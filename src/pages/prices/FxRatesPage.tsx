import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';

interface FxRate {
  id: string;
  date: string;
  currency_code: string;
  rate_to_usd: number;
}

export function FxRatesPage() {
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFxRates() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('fx_rates')
          .select('id, date, currency_code, rate_to_usd')
          .order('date', { ascending: false })
          .limit(100);

        if (!error && data) {
          setFxRates(data);
        }
      } catch (error) {
        console.error('Error fetching FX rates:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFxRates();
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">FX Rates</h1>
          <p className="text-gray-600 mt-1">Currency exchange rates tracking</p>
        </div>

        <Card>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="lg" />
              </div>
            ) : fxRates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate to USD</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fxRates.map((rate) => (
                      <tr key={rate.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(rate.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rate.currency_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {rate.rate_to_usd.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No FX rates data available.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
