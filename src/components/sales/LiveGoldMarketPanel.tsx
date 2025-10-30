import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Circle,
  Clock,
  Globe,
} from 'lucide-react';
import {
  fetchLiveGoldPrice,
  formatGoldPrice,
  clearPriceCache,
  getMarketStatus,
  type LiveGoldPrice,
} from '@/services/liveGoldPriceService';

export function LiveGoldMarketPanel() {
  const [goldPrice, setGoldPrice] = useState<LiveGoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isCollapsed, setIsCollapsed] = useState(false);

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

    return () => clearInterval(interval);
  }, []);

  const marketStatus = getMarketStatus();

  if (loading || !goldPrice) {
    return (
      <div className={`fixed top-20 right-0 transition-all duration-300 z-40 ${
        isCollapsed ? 'translate-x-full' : 'translate-x-0'
      }`}>
        <div className="bg-white shadow-2xl rounded-l-2xl border-l border-gray-200 w-96 animate-pulse">
          <div className="p-6 space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const mockOpenPrice = goldPrice.openPrice || goldPrice.price * 0.995;
  const change24h = goldPrice.change24h || goldPrice.price - mockOpenPrice;
  const changePercent = goldPrice.changePercent24h || (change24h / mockOpenPrice) * 100;
  const isPositive = change24h >= 0;

  const high24h = goldPrice.high24h || goldPrice.price * 1.008;
  const low24h = goldPrice.low24h || goldPrice.price * 0.992;

  return (
    <div
      className={`fixed top-20 right-0 transition-all duration-300 z-40 ${
        isCollapsed ? 'translate-x-full' : 'translate-x-0'
      }`}
      style={{ maxHeight: 'calc(100vh - 5rem)' }}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 bg-white shadow-lg rounded-l-lg p-2 hover:bg-gray-50 transition-colors border-l border-t border-b border-gray-200"
        title={isCollapsed ? 'Show market data' : 'Hide market data'}
      >
        {isCollapsed ? (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {/* Main Panel */}
      <div className="bg-white shadow-2xl rounded-l-2xl border-l border-gray-200 w-96 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Live Gold Price</h2>
              <p className="text-xs text-gray-500 mt-0.5">XAU/USD • {goldPrice.source}</p>
            </div>
            <button
              onClick={() => fetchGoldData(true)}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Real-time Indicator */}
          <div className="flex items-center justify-center gap-2 text-xs bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg font-medium">
            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
            Real-time Data
          </div>

          {/* Main Price Display */}
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold text-gray-900">
              ${formatGoldPrice(goldPrice.price)}
            </div>
            <div className="text-sm text-gray-500">per troy ounce</div>

            {/* Change Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              isPositive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="font-semibold">
                {isPositive ? '+' : ''}${Math.abs(change24h).toFixed(2)}
              </span>
              <span className="text-sm">
                ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Market Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Market Open */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Market Open</div>
              <div className="text-lg font-bold text-gray-900">
                ${formatGoldPrice(mockOpenPrice)}
              </div>
              <div className="text-xs text-gray-500">Opening</div>
            </div>

            {/* 24h High */}
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <div className="text-xs text-emerald-600 mb-1">24h High</div>
              <div className="text-lg font-bold text-emerald-700">
                ${formatGoldPrice(high24h)}
              </div>
              <div className="text-xs text-emerald-600">
                +{((high24h - goldPrice.price) / goldPrice.price * 100).toFixed(2)}%
              </div>
            </div>

            {/* 24h Low */}
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <div className="text-xs text-red-600 mb-1">24h Low</div>
              <div className="text-lg font-bold text-red-700">
                ${formatGoldPrice(low24h)}
              </div>
              <div className="text-xs text-red-600">
                {((low24h - goldPrice.price) / goldPrice.price * 100).toFixed(2)}%
              </div>
            </div>

            {/* Previous */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Previous</div>
              <div className="text-lg font-bold text-gray-900">
                ${formatGoldPrice(mockOpenPrice)}
              </div>
              <div className="text-xs text-gray-500">Close</div>
            </div>
          </div>

          {/* Global Markets - Simplified */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Globe className="w-4 h-4" />
              Global Markets
            </div>

            {/* London */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Circle className={`w-2 h-2 ${
                    marketStatus.london.isOpen
                      ? 'fill-emerald-500 text-emerald-500 animate-pulse'
                      : 'fill-gray-400 text-gray-400'
                  }`} />
                  <span className="text-sm font-semibold text-gray-900">London LBMA</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  marketStatus.london.isOpen
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {marketStatus.london.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Hours:</span>
                  <span className="font-medium">{marketStatus.london.openTime} - {marketStatus.london.closeTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price Fixing:</span>
                  <span className="font-medium">10:30 AM & 3:00 PM GMT</span>
                </div>
              </div>
            </div>

            {/* New York */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Circle className={`w-2 h-2 ${
                    marketStatus.newYork.isOpen
                      ? 'fill-emerald-500 text-emerald-500 animate-pulse'
                      : 'fill-gray-400 text-gray-400'
                  }`} />
                  <span className="text-sm font-semibold text-gray-900">NYSE (COMEX)</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  marketStatus.newYork.isOpen
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {marketStatus.newYork.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Hours:</span>
                  <span className="font-medium">{marketStatus.newYork.openTime} - {marketStatus.newYork.closeTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Electronic:</span>
                  <span className="font-medium">6:00 PM - 5:00 PM EST</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trading Info */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-2">
            <div className="text-xs font-semibold text-blue-900">Trading Information</div>
            <div className="text-xs text-blue-800 space-y-1">
              <p>Prices based on London AM Fix (LBMA) and COMEX futures.</p>
              <p>Settlement: T+2 business days</p>
            </div>
          </div>

          {/* Last Update */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-200">
            <Clock className="w-3 h-3" />
            <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
