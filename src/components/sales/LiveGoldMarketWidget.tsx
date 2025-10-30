import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, RefreshCw, Clock } from 'lucide-react';
import { getCurrentGoldPrice, type GoldPrice } from '@/services/goldPriceService';

export function LiveGoldMarketWidget() {
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(60);

  const fetchGoldData = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }

    try {
      const priceResult = await getCurrentGoldPrice();
      if (priceResult.success && priceResult.data) {
        setGoldPrice(priceResult.data);
        setLastUpdate(new Date());
        setCountdown(60);
      }
    } catch (error) {
      console.error('Error fetching gold price:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGoldData();

    const interval = setInterval(() => {
      fetchGoldData();
    }, 60000);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 60));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, []);

  if (loading || !goldPrice) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="p-4 animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/2 mb-3"></div>
          <div className="h-12 bg-gray-700 rounded w-2/3"></div>
        </div>
      </Card>
    );
  }

  const variance = (goldPrice.closing_price || goldPrice.london_am_rate) - (goldPrice.opening_price || goldPrice.london_am_rate);
  const variancePercent = ((goldPrice.opening_price || goldPrice.london_am_rate) !== 0)
    ? (variance / (goldPrice.opening_price || goldPrice.london_am_rate)) * 100
    : 0;
  const isPositive = variance >= 0;

  return (
    <Card className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-gray-700 overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">AU</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">XAU/USD</h3>
              <p className="text-gray-400 text-xs">Gold Spot / U.S. Dollar</p>
              <p className="text-gray-500 text-xs">Commodity • Cfd</p>
            </div>
          </div>
          <button
            onClick={() => fetchGoldData(true)}
            disabled={refreshing}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">
              {(goldPrice.london_am_rate || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
            <span className="text-sm text-gray-400">USD</span>
          </div>

          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
            <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{variance.toFixed(2)}
            </span>
            <span className={`text-base font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{variancePercent.toFixed(2)}%
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-fit">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="font-medium">Market open</span>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Performance</div>
          <div className="grid grid-cols-3 gap-2">
            <div className={`p-2 rounded text-center ${variance >= 0 ? 'bg-teal-900/30' : 'bg-red-900/30'}`}>
              <div className={`text-xs font-semibold ${variance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-400 mt-1">1W</div>
            </div>
            <div className="p-2 rounded text-center bg-teal-900/30">
              <div className="text-xs font-semibold text-teal-400">+7.15%</div>
              <div className="text-xs text-gray-400 mt-1">1M</div>
            </div>
            <div className="p-2 rounded text-center bg-teal-900/30">
              <div className="text-xs font-semibold text-teal-400">+22.93%</div>
              <div className="text-xs text-gray-400 mt-1">3M</div>
            </div>
            <div className="p-2 rounded text-center bg-teal-900/30">
              <div className="text-xs font-semibold text-teal-400">+24.39%</div>
              <div className="text-xs text-gray-400 mt-1">6M</div>
            </div>
            <div className="p-2 rounded text-center bg-teal-900/30">
              <div className="text-xs font-semibold text-teal-400">+53.51%</div>
              <div className="text-xs text-gray-400 mt-1">YTD</div>
            </div>
            <div className="p-2 rounded text-center bg-teal-900/30">
              <div className="text-xs font-semibold text-teal-400">+46.91%</div>
              <div className="text-xs text-gray-400 mt-1">1Y</div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-700">
          <div className="text-xs font-semibold text-gray-300">Market Data</div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">London LBMA AM Fix</span>
              <span className="text-sm font-semibold text-white">
                ${(goldPrice.london_am_rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Opening Price</span>
              <span className="text-sm font-semibold text-gray-300">
                ${(goldPrice.opening_price || goldPrice.london_am_rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">High (24h)</span>
              <span className="text-sm font-semibold text-emerald-400">
                ${(goldPrice.high_price || goldPrice.london_am_rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Low (24h)</span>
              <span className="text-sm font-semibold text-red-400">
                ${(goldPrice.low_price || goldPrice.london_am_rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Next: {countdown}s</span>
            {refreshing && (
              <span className="text-xs text-emerald-400">Updating...</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
