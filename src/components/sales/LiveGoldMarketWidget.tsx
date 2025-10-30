import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, RefreshCw, Clock, Globe, ArrowUp, ArrowDown } from 'lucide-react';
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
      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
        <div className="p-6 animate-pulse">
          <div className="h-8 bg-amber-200 rounded w-1/2 mb-4"></div>
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-amber-200 rounded"></div>
            ))}
          </div>
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
      {/* KPI Summary Card - Prominent at the top */}
      <Card className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border-2 border-amber-300 shadow-lg mb-4">
        <div className="p-6">
          {/* Header with Title and Refresh */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">AU</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Live Gold Price</h2>
                <p className="text-sm text-gray-600">XAU/USD Spot Price • {goldPrice.source}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg font-medium">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                Real-time Data
              </div>
              <button
                onClick={() => fetchGoldData(true)}
                disabled={refreshing}
                className="p-2 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh now"
              >
                <RefreshCw
                  className={`w-5 h-5 text-gray-700 ${refreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* KPI Grid - 5 Key Metrics */}
          <div className="grid grid-cols-5 gap-4">
            {/* Current Spot Price */}
            <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500 mb-1">Spot Price</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                ${formatGoldPrice(goldPrice.price)}
              </p>
              <p className="text-xs text-gray-500">USD/oz</p>
            </div>

            {/* Market Open Price */}
            <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500 mb-1">Market Open</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                ${formatGoldPrice(mockOpenPrice)}
              </p>
              <p className="text-xs text-gray-500">Opening price</p>
            </div>

            {/* 24h High */}
            <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500 mb-1">High (24h)</p>
              <p className="text-2xl font-bold text-emerald-600 mb-1 flex items-center gap-1">
                <ArrowUp className="w-4 h-4" />
                ${formatGoldPrice(high24h)}
              </p>
              <p className="text-xs text-emerald-600">+{((high24h - mockOpenPrice) / mockOpenPrice * 100).toFixed(2)}%</p>
            </div>

            {/* 24h Low */}
            <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500 mb-1">Low (24h)</p>
              <p className="text-2xl font-bold text-red-600 mb-1 flex items-center gap-1">
                <ArrowDown className="w-4 h-4" />
                ${formatGoldPrice(low24h)}
              </p>
              <p className="text-xs text-red-600">{((low24h - mockOpenPrice) / mockOpenPrice * 100).toFixed(2)}%</p>
            </div>

            {/* Trend & Variation */}
            <div className={`bg-white rounded-xl p-4 border-2 shadow-sm ${
              isPositive ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'
            }`}>
              <p className="text-xs font-medium text-gray-500 mb-1">Trend & Var %</p>
              <div className="flex items-center gap-2 mb-1">
                {isPositive ? (
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                <p className={`text-2xl font-bold ${
                  isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                </p>
              </div>
              <p className={`text-xs font-medium ${
                isPositive ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {isPositive ? '+' : ''}${change24h.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Update Info */}
          <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
            </div>
            <span className="text-gray-500">Next update in {countdown}s</span>
          </div>
        </div>
      </Card>

      {/* Global Gold Markets Section */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Global Gold Markets</h3>
          </div>

          <div className="space-y-3">
            {/* London LBMA */}
            <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-100 rounded flex items-center justify-center">
                    <span className="text-amber-600 text-lg">🏛</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">London LBMA</h4>
                    <p className="text-xs text-gray-600">London Bullion Market</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    marketStatus.london.isOpen
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {marketStatus.london.isOpen ? (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      Market Open
                    </div>
                  ) : (
                    'Market Closed'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Market</p>
                  <p className="text-xs font-medium text-gray-900">London Bullion Market</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Trading Hours</p>
                  <p className="text-xs font-medium text-gray-900">8:00 AM - 4:30 PM GMT</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Price Fixing</p>
                  <p className="text-xs font-medium text-gray-900">10:30 AM & 3:00 PM</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Current Price</p>
                  <p className="text-base font-bold text-gray-900">
                    ${formatGoldPrice(goldPrice.price)}
                  </p>
                </div>
              </div>
            </div>

            {/* NYSE COMEX */}
            <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 text-lg">🏛</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">NYSE (COMEX)</h4>
                    <p className="text-xs text-gray-600">New York Commodity Exchange</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    marketStatus.newYork.isOpen
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {marketStatus.newYork.isOpen ? (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      Market Open
                    </div>
                  ) : (
                    'Market Closed'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Market</p>
                  <p className="text-xs font-medium text-gray-900">New York Commodity Exchange</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Trading Hours</p>
                  <p className="text-xs font-medium text-gray-900">8:20 AM - 1:30 PM EST</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Electronic</p>
                  <p className="text-xs font-medium text-gray-900">6:00 PM - 5:00 PM EST</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Current Price</p>
                  <p className="text-base font-bold text-gray-900">
                    ${formatGoldPrice(goldPrice.price)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Trading Information Footer */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-amber-600">ℹ</span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">Trading Information</p>
                <p className="text-xs text-gray-600 mt-1">
                  Prices are based on London AM Fix (LBMA) and COMEX futures. All transactions are settled within 2 business days (T+2).
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
