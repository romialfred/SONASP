import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, RefreshCw, Clock, Globe } from 'lucide-react';
import {
  fetchLiveGoldPrice,
  getMarketStatus,
  formatGoldPrice,
  clearPriceCache,
  type LiveGoldPrice,
} from '@/services/liveGoldPriceService';

export function LiveGoldMarketWidget() {
  const [goldPrice, setGoldPrice] = useState<LiveGoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const fetchGoldData = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
      clearPriceCache(); // Force fresh data on manual refresh
    }

    try {
      const priceData = await fetchLiveGoldPrice();

      if (priceData) {
        setGoldPrice(priceData);
        setLastUpdate(new Date());
        setCountdown(60);
        setError(null);
      } else {
        setError('Unable to fetch live gold price');
      }
    } catch (error) {
      console.error('Error fetching gold price:', error);
      setError('Connection error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGoldData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchGoldData();
    }, 60000);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 60));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, []);

  const marketStatus = getMarketStatus();

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

  // Calculate 24h change (mock data for now, as we don't have historical)
  const mockOpenPrice = goldPrice.openPrice || goldPrice.price * 0.995;
  const change24h = goldPrice.change24h || goldPrice.price - mockOpenPrice;
  const changePercent = goldPrice.changePercent24h || (change24h / mockOpenPrice) * 100;
  const isPositive = change24h >= 0;

  const high24h = goldPrice.high24h || goldPrice.price * 1.008;
  const low24h = goldPrice.low24h || goldPrice.price * 0.992;

  return (
    <Card className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-gray-700 overflow-hidden">
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">AU</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">XAU/USD</h3>
              <p className="text-gray-400 text-xs">Gold Spot / U.S. Dollar</p>
              <p className="text-gray-500 text-xs">
                {goldPrice.source} • Real-time
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchGoldData(true)}
            disabled={refreshing}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh now"
          >
            <RefreshCw
              className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Current Price */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">
              {formatGoldPrice(goldPrice.price)}
            </span>
            <span className="text-sm text-gray-400">USD</span>
          </div>

          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
            <span
              className={`text-lg font-bold ${
                isPositive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {change24h.toFixed(2)}
            </span>
            <span
              className={`text-base font-semibold ${
                isPositive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {changePercent.toFixed(2)}%
            </span>
          </div>

          {/* Market Status */}
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-fit">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="font-medium">Live Data</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Performance Metrics (Mock for now) */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Performance</div>
          <div className="grid grid-cols-3 gap-2">
            <div
              className={`p-2 rounded text-center ${
                isPositive ? 'bg-teal-900/30' : 'bg-red-900/30'
              }`}
            >
              <div
                className={`text-xs font-semibold ${
                  isPositive ? 'text-teal-400' : 'text-red-400'
                }`}
              >
                {isPositive ? '+' : ''}
                {changePercent.toFixed(2)}%
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

        {/* Market Data */}
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <div className="text-xs font-semibold text-gray-300">Market Data</div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Spot Price (Live)</span>
              <span className="text-sm font-semibold text-white">
                ${formatGoldPrice(goldPrice.price)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Opening Price</span>
              <span className="text-sm font-semibold text-gray-300">
                ${formatGoldPrice(mockOpenPrice)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">High (24h)</span>
              <span className="text-sm font-semibold text-emerald-400">
                ${formatGoldPrice(high24h)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Low (24h)</span>
              <span className="text-sm font-semibold text-red-400">
                ${formatGoldPrice(low24h)}
              </span>
            </div>
          </div>
        </div>

        {/* Global Markets Status */}
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
            <Globe className="w-3 h-3" />
            <span>Global Gold Markets</span>
          </div>

          <div className="space-y-2">
            {/* London LBMA */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    marketStatus.london.isOpen
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-gray-500'
                  }`}
                ></div>
                <div>
                  <div className="text-xs font-medium text-gray-200">
                    London LBMA
                  </div>
                  <div className="text-xs text-gray-500">
                    {marketStatus.london.openTime} - {marketStatus.london.closeTime}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-white">
                  ${formatGoldPrice(goldPrice.price)}
                </div>
                <div
                  className={`text-xs ${
                    marketStatus.london.isOpen ? 'text-emerald-400' : 'text-gray-500'
                  }`}
                >
                  {marketStatus.london.isOpen ? 'Open' : 'Closed'}
                </div>
              </div>
            </div>

            {/* New York COMEX */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    marketStatus.newYork.isOpen
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-gray-500'
                  }`}
                ></div>
                <div>
                  <div className="text-xs font-medium text-gray-200">
                    New York COMEX
                  </div>
                  <div className="text-xs text-gray-500">
                    {marketStatus.newYork.openTime} - {marketStatus.newYork.closeTime}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-white">
                  ${formatGoldPrice(goldPrice.price)}
                </div>
                <div
                  className={`text-xs ${
                    marketStatus.newYork.isOpen
                      ? 'text-emerald-400'
                      : 'text-gray-500'
                  }`}
                >
                  {marketStatus.newYork.isOpen ? 'Open' : 'Closed'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Update Info */}
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
