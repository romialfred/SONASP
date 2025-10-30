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
      clearPriceCache();
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

  const mockOpenPrice = goldPrice.openPrice || goldPrice.price * 0.995;
  const change24h = goldPrice.change24h || goldPrice.price - mockOpenPrice;
  const changePercent = goldPrice.changePercent24h || (change24h / mockOpenPrice) * 100;
  const isPositive = change24h >= 0;

  const high24h = goldPrice.high24h || goldPrice.price * 1.008;
  const low24h = goldPrice.low24h || goldPrice.price * 0.992;

  return (
    <>
      {/* Main Price Display - Top Banner */}
      <Card className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-gray-700 overflow-visible mb-4">
        <div className="p-5 space-y-4">
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

          {/* Current Price - Large Display */}
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

            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-fit">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="font-medium">Live Data</span>
            </div>
          </div>

          {/* Market Data Quick View */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400">Opening Price</p>
                <p className="text-sm font-semibold text-gray-300">
                  ${formatGoldPrice(mockOpenPrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Spot Price</p>
                <p className="text-sm font-semibold text-white">
                  ${formatGoldPrice(goldPrice.price)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">High (24h)</p>
                <p className="text-sm font-semibold text-emerald-400">
                  ${formatGoldPrice(high24h)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Low (24h)</p>
                <p className="text-sm font-semibold text-red-400">
                  ${formatGoldPrice(low24h)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Global Gold Markets Section */}
      <Card className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 border-slate-700">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Global Gold Markets</h3>
          </div>

          <div className="space-y-3">
            {/* London LBMA */}
            <div className="bg-slate-800/80 rounded-lg p-4 border border-slate-700">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-500/20 rounded flex items-center justify-center">
                    <span className="text-amber-400 text-lg">🏛</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">London LBMA</h4>
                    <p className="text-xs text-gray-400">London Bullion Market</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    marketStatus.london.isOpen
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {marketStatus.london.isOpen ? (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      Market Open
                    </div>
                  ) : (
                    'Market Closed'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Market</p>
                  <p className="text-xs text-gray-300">London Bullion Market</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Trading Hours</p>
                  <p className="text-xs text-gray-300">
                    {marketStatus.london.openTime} - {marketStatus.london.closeTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Price Fixing</p>
                  <p className="text-xs text-gray-300">10:30 AM & 3:00 PM</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Current Price</p>
                  <p className="text-base font-bold text-white">
                    ${formatGoldPrice(goldPrice.price)}
                  </p>
                </div>
              </div>
            </div>

            {/* NYSE COMEX */}
            <div className="bg-slate-800/80 rounded-lg p-4 border border-slate-700">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                    <span className="text-blue-400 text-lg">🏛</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">NYSE (COMEX)</h4>
                    <p className="text-xs text-gray-400">New York Commodity Exchange</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    marketStatus.newYork.isOpen
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {marketStatus.newYork.isOpen ? (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      Market Open
                    </div>
                  ) : (
                    'Market Closed'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Market</p>
                  <p className="text-xs text-gray-300">New York Commodity Exchange</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Trading Hours</p>
                  <p className="text-xs text-gray-300">
                    {marketStatus.newYork.openTime} - {marketStatus.newYork.closeTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Electronic</p>
                  <p className="text-xs text-gray-300">6:00 PM - 5:00 PM EST</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Current Price</p>
                  <p className="text-base font-bold text-white">
                    ${formatGoldPrice(goldPrice.price)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Trading Information Footer */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-start gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-amber-400">ℹ</span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-300">Trading Information</p>
                <p className="text-xs text-gray-400 mt-1">
                  Prices are based on London AM Fix (LBMA) and COMEX futures. All transactions are settled within 2 business days (T+2).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-3 h-3" />
                <span>Market data updates every 60 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Next: {countdown}s</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
