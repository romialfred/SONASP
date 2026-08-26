import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FxRateComparison {
  id: string | null;
  rate_date: string | null;
  currency_pair: string;
  source_id: string;
  source_name: string;
  source_code: string;
  source_country: string;
  rate: number;
  bid_rate: number | null;
  ask_rate: number | null;
  bid_ask_spread: number | null;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
  market_spread: number;
  source_count: number;
  deviation_from_avg_pct: number;
  rate_position: 'LOWEST' | 'HIGHEST' | 'MIDDLE';
  notes: string | null;
}

// Le franc guinéen n'a pas cours au Burkina.
const CURRENCY_PAIRS = [
  { value: 'USD/XOF', label: 'USD/XOF : dollar américain vers franc CFA' },
  { value: 'EUR/XOF', label: 'EUR/XOF : euro vers franc CFA' },
  { value: 'EUR/USD', label: 'EUR/USD : euro vers dollar américain' },
];

export function FxRateComparison() {
  const [comparisons, setComparisons] = useState<FxRateComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [currencyPair, setCurrencyPair] = useState('USD/XOF');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadComparisons();
  }, [currencyPair, selectedDate]);

  const loadComparisons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fx_rate_comparison')
        .select('*')
        .eq('currency_pair', currencyPair)
        .eq('rate_date', selectedDate)
        .order('rate', { ascending: false });

      if (error) throw error;
      setComparisons(data || []);
    } catch (error) {
      console.error('Error loading comparisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRate = (rate: number, pair: string) => {
    if (pair === 'EUR/USD') return rate.toFixed(4);
    if (pair === 'EUR/USD') return rate.toFixed(5);
    return rate.toFixed(2);
  };

  const getBestRateBadge = (position: string) => {
    if (position === 'HIGHEST') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <TrendingUp className="w-3 h-3 mr-1" />
          Best Rate
        </span>
      );
    }
    if (position === 'LOWEST') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <TrendingDown className="w-3 h-3 mr-1" />
          Lowest Rate
        </span>
      );
    }
    return null;
  };

  const getDeviationColor = (deviation: number) => {
    if (Math.abs(deviation) < 0.5) return 'text-gray-600';
    if (deviation > 0) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            FX Rate Comparison by Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <FormField label="Currency Pair">
              <Select
                value={currencyPair}
                onChange={(e) => setCurrencyPair(e.target.value)}
              >
                {CURRENCY_PAIRS.map(pair => (
                  <option key={pair.value} value={pair.value}>{pair.label}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Date">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </FormField>

            <FormField label="Actions">
              <Button
                variant="outline"
                onClick={loadComparisons}
                disabled={loading}
                className="w-full"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </FormField>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading comparison data...</p>
            </div>
          ) : comparisons.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No rates available for this date and currency pair</p>
              <p className="text-sm text-gray-500 mt-2">Try selecting a different date or currency pair</p>
            </div>
          ) : (
            <>
              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="text-sm text-blue-600 font-medium mb-1">Average Rate</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {formatRate(comparisons[0]?.avg_rate || 0, currencyPair)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="pt-6">
                    <div className="text-sm text-green-600 font-medium mb-1">Highest Rate</div>
                    <div className="text-2xl font-bold text-green-900">
                      {formatRate(comparisons[0]?.max_rate || 0, currencyPair)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <CardContent className="pt-6">
                    <div className="text-sm text-red-600 font-medium mb-1">Lowest Rate</div>
                    <div className="text-2xl font-bold text-red-900">
                      {formatRate(comparisons[0]?.min_rate || 0, currencyPair)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="pt-6">
                    <div className="text-sm text-purple-600 font-medium mb-1">Market Spread</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {formatRate(comparisons[0]?.market_spread || 0, currencyPair)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank / Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deviation</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bid</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ask</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spread</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {comparisons.map((comparison) => (
                      <tr
                        key={comparison.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          comparison.rate_position === 'HIGHEST'
                            ? 'bg-green-50/50'
                            : comparison.rate_position === 'LOWEST'
                            ? 'bg-red-50/50'
                            : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {comparison.source_name}
                          </div>
                          <div className="text-xs text-gray-500">{comparison.source_code}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {comparison.source_country}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-base font-bold text-gray-900">
                            {formatRate(comparison.rate, currencyPair)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-medium ${getDeviationColor(comparison.deviation_from_avg_pct)}`}>
                            {comparison.deviation_from_avg_pct > 0 ? '+' : ''}
                            {comparison.deviation_from_avg_pct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {comparison.bid_rate ? formatRate(comparison.bid_rate, currencyPair) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {comparison.ask_rate ? formatRate(comparison.ask_rate, currencyPair) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {comparison.bid_ask_spread ? formatRate(comparison.bid_ask_spread, currencyPair) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getBestRateBadge(comparison.rate_position)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {comparisons[0]?.source_count && (
                <div className="mt-4 text-sm text-gray-600 text-center">
                  Comparing {comparisons[0].source_count} sources for {currencyPair} on {new Date(selectedDate).toLocaleDateString()}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
