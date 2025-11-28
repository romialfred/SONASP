import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import { getCurrentGoldPrice, getGoldPriceStatistics, type GoldPrice, type GoldPriceStats } from '@/services/goldPriceService';
import { formatPercentage } from '@/utils/numberUtils';

interface GoldPriceWidgetProps {
  showDetailed?: boolean;
}

export function GoldPriceWidget({ showDetailed = false }: GoldPriceWidgetProps) {
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  const [stats, setStats] = useState<GoldPriceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchGoldData = async () => {
    setLoading(true);
    try {
      const [priceResult, statsResult] = await Promise.all([
        getCurrentGoldPrice(),
        getGoldPriceStatistics(),
      ]);

      if (priceResult.success && priceResult.data) {
        setGoldPrice(priceResult.data);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching gold price:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoldData();
    const interval = setInterval(fetchGoldData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded w-2/3"></div>
        </div>
      </Card>
    );
  }

  if (!goldPrice || !stats) {
    return (
      <Card className="p-4 border-amber-200 bg-amber-50">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm">Unable to load gold price data</p>
        </div>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (stats.trend === 'up') {
      return <TrendingUp className="w-5 h-5 text-green-600" />;
    } else if (stats.trend === 'down') {
      return <TrendingDown className="w-5 h-5 text-red-600" />;
    } else {
      return <Minus className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    if (stats.trend === 'up') return 'text-green-600';
    if (stats.trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  const getBgColor = () => {
    if (stats.trend === 'up') return 'bg-green-50 border-green-200';
    if (stats.trend === 'down') return 'bg-red-50 border-red-200';
    return 'bg-gray-50 border-gray-200';
  };

  const calculateVariance = () => {
    if (!goldPrice) return { value: 0, percentage: 0 };
    const variance = goldPrice.closing_price - goldPrice.opening_price;
    const percentage = (variance / goldPrice.opening_price) * 100;
    return { value: variance, percentage };
  };

  const variance = calculateVariance();

  return (
    <Card className={`${getBgColor()} transition-colors duration-300`}>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="text-sm font-semibold text-gray-700">Live Gold Price (London Spot)</h3>
          </div>
          <button
            onClick={fetchGoldData}
            className="p-1 hover:bg-white/50 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              ${goldPrice.london_am_rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm text-gray-500">/oz</span>
          </div>

          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-sm font-semibold ${getTrendColor()}`}>
              {stats.change > 0 ? '+' : ''}${stats.change.toFixed(2)} ({stats.change_percentage > 0 ? '+' : ''}{stats.change_percentage.toFixed(2)}%)
            </span>
          </div>

          <div className="text-xs text-gray-500">
            London AM Fix • {new Date(goldPrice.price_date).toLocaleDateString()}
          </div>
        </div>

        {showDetailed && (
          <>
            <div className="border-t border-gray-200 pt-3">
              <div className="text-xs font-semibold text-gray-700 mb-3">Today's Statistics</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/60 p-2 rounded">
                  <div className="text-gray-500 text-xs">Open Price</div>
                  <div className="font-semibold text-gray-900">
                    ${goldPrice.opening_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-white/60 p-2 rounded">
                  <div className="text-gray-500 text-xs">Close Price</div>
                  <div className="font-semibold text-gray-900">
                    ${goldPrice.closing_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-green-50 p-2 rounded border border-green-200">
                  <div className="text-gray-500 text-xs">High (24h)</div>
                  <div className="font-semibold text-green-700">
                    ${goldPrice.high_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-red-50 p-2 rounded border border-red-200">
                  <div className="text-gray-500 text-xs">Low (24h)</div>
                  <div className="font-semibold text-red-700">
                    ${goldPrice.low_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className={`col-span-2 p-2 rounded border ${
                  variance.value >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="text-gray-500 text-xs">Day Variance</div>
                  <div className="flex items-center justify-between">
                    <div className={`font-bold ${variance.value >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {variance.value >= 0 ? '+' : ''}${variance.value.toFixed(2)}
                    </div>
                    <div className={`text-sm font-semibold ${variance.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {variance.percentage >= 0 ? '+' : ''}{variance.percentage.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="text-xs font-semibold text-gray-700">30-Day Statistics</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-gray-500 text-xs">Average</div>
                  <div className="font-semibold text-gray-900">
                    ${stats.avg_30_days.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">High</div>
                  <div className="font-semibold text-green-700">
                    ${stats.high_30_days.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Low</div>
                  <div className="font-semibold text-red-700">
                    ${stats.low_30_days.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>

            <div className={`text-xs p-2 rounded ${
              stats.trend === 'up' ? 'bg-green-100 text-green-800' :
              stats.trend === 'down' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              <span className="font-semibold">Market Trend:</span>{' '}
              {stats.trend === 'up' ? 'Bullish' : stats.trend === 'down' ? 'Bearish' : 'Neutral'}
              {' • '}
              Current price is{' '}
              {formatPercentage((goldPrice.london_am_rate - stats.avg_30_days) / stats.avg_30_days * 100, 1)}
              {' '}{goldPrice.london_am_rate > stats.avg_30_days ? 'above' : 'below'} 30-day average
            </div>
          </>
        )}

        <div className="text-xs text-gray-400 flex items-center justify-between border-t border-gray-200 pt-2">
          <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
          <span className="text-gray-500">Auto-refresh: 1 min</span>
        </div>
      </div>
    </Card>
  );
}
