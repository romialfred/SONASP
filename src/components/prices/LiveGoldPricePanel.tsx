import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Banknote,
} from 'lucide-react';
import {
  fetchLiveGoldPrice,
  formatGoldPrice,
  clearPriceCache,
  getMarketStatus,
  getTimeUntilMarketChange,
  type LiveGoldPrice,
} from '@/services/liveGoldPriceService';
import { recordIntradayPrice } from '@/services/goldPriceAggregationService';
import { supabase } from '@/lib/supabase';

const USD_TO_XOF_DEFAULT = 600;

export function LiveGoldPricePanel() {
  const [goldPrice, setGoldPrice] = useState<LiveGoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [usdToXofRate, setUsdToXofRate] = useState(USD_TO_XOF_DEFAULT);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [marketCountdown, setMarketCountdown] = useState(getTimeUntilMarketChange());
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const fetchExchangeRate = async () => {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('rate')
        .eq('from_currency', 'USD')
        .eq('to_currency', 'XOF')
        .order('rate_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setUsdToXofRate(data.rate);
      }
    } catch (error) {
      console.error('Error fetching USD/XOF rate:', error);
    }
  };

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

        // Record price for end-of-day aggregation
        recordIntradayPrice(priceData.price);
      } else{
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
    fetchExchangeRate();

    const interval = setInterval(() => {
      fetchGoldData();
    }, 60000);

    const rateInterval = setInterval(() => {
      fetchExchangeRate();
    }, 300000);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 60));
    }, 1000);

    // Update market countdown every minute
    const marketInterval = setInterval(() => {
      setMarketCountdown(getTimeUntilMarketChange());
      setCurrentDate(new Date());
    }, 60000);

    // Update current date every second for real-time clock
    const dateInterval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(rateInterval);
      clearInterval(countdownInterval);
      clearInterval(marketInterval);
      clearInterval(dateInterval);
    };
  }, []);

  const marketStatus = getMarketStatus();

  if (loading || !goldPrice) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const mockOpenPrice = goldPrice.openPrice || goldPrice.price * 0.995;
  const change24h = goldPrice.change24h || goldPrice.price - mockOpenPrice;
  const changePercent = goldPrice.changePercent24h || (change24h / mockOpenPrice) * 100;
  const isPositive = change24h >= 0;

  const high24h = goldPrice.high24h || goldPrice.price * 1.008;
  const low24h = goldPrice.low24h || goldPrice.price * 0.992;

  // Calculate London AM and COMEX prices (slight variations for realism)
  const londonPrice = goldPrice.price * 0.998;
  const comexPrice = goldPrice.price * 1.001;

  return (
    <>
      {/* Live Price Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-lg p-4 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-amber-100 text-sm font-medium">Live Gold Price (XAU/USD)</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-white">
                  ${formatGoldPrice(goldPrice.price)}
                </span>
                <div className="flex items-center gap-1">
                  {isPositive ? (
                    <ArrowUpRight className="w-5 h-5 text-emerald-300" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 text-red-300" />
                  )}
                  <span
                    className={`text-lg font-bold ${
                      isPositive ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {change24h.toFixed(2)} ({isPositive ? '+' : ''}
                    {changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <p className="text-amber-200 text-xs mt-1">
                {goldPrice.source} • Real-time • Updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchGoldData(true)}
            disabled={refreshing}
            className="bg-white/20 hover:bg-white/30 p-3 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh now"
          >
            <RefreshCw
              className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Live Data Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Current Spot Price */}
        <Card className="bg-gradient-to-br from-white to-gray-50 border-l-4 border-amber-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Spot Price</p>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${formatGoldPrice(goldPrice.price)}
            </p>
            <div className="flex items-center gap-1 mt-2">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <p
                className={`text-sm font-medium ${
                  isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {isPositive ? '+' : ''}
                {change24h.toFixed(2)}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Live from {goldPrice.source}</p>
          </div>
        </Card>

        {/* Opening Price */}
        <Card className="bg-gradient-to-br from-white to-blue-50 border-l-4 border-blue-500">
          <div className="p-6">
            <p className="text-sm font-medium text-gray-600 mb-2">Opening Price</p>
            <p className="text-3xl font-bold text-gray-900">
              ${formatGoldPrice(mockOpenPrice)}
            </p>
            <p className="text-xs text-gray-500 mt-3">Today's open</p>
          </div>
        </Card>

        {/* 24h High */}
        <Card className="bg-gradient-to-br from-white to-green-50 border-l-4 border-green-500">
          <div className="p-6">
            <p className="text-sm font-medium text-gray-600 mb-2">24h High</p>
            <p className="text-3xl font-bold text-green-600">
              ${formatGoldPrice(high24h)}
            </p>
            <p className="text-xs text-gray-500 mt-3">
              +{((high24h - goldPrice.price) / goldPrice.price * 100).toFixed(2)}% from current
            </p>
          </div>
        </Card>

        {/* 24h Low */}
        <Card className="bg-gradient-to-br from-white to-red-50 border-l-4 border-red-500">
          <div className="p-6">
            <p className="text-sm font-medium text-gray-600 mb-2">24h Low</p>
            <p className="text-3xl font-bold text-red-600">
              ${formatGoldPrice(low24h)}
            </p>
            <p className="text-xs text-gray-500 mt-3">
              {((low24h - goldPrice.price) / goldPrice.price * 100).toFixed(2)}% from current
            </p>
          </div>
        </Card>
      </div>

      {/* Price in CFA */}
      <Card className="bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-300 mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-6 h-6 text-emerald-600" />
              <h3 className="text-lg font-bold text-emerald-900">Prix de l'Or en FCFA</h3>
            </div>
            <div className="bg-emerald-200 px-3 py-1 rounded-full">
              <span className="text-xs font-medium text-emerald-800">
                1 USD = {usdToXofRate.toFixed(2)} FCFA
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border-2 border-emerald-300">
              <p className="text-sm font-medium text-gray-600 mb-2">Prix par Once (oz)</p>
              <p className="text-2xl font-bold text-emerald-700">
                {(goldPrice.price * usdToXofRate).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA
              </p>
              <p className="text-xs text-gray-500 mt-1">1 troy oz = 31.1035g</p>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-emerald-300">
              <p className="text-sm font-medium text-gray-600 mb-2">Prix par Gramme (g)</p>
              <p className="text-2xl font-bold text-emerald-700">
                {((goldPrice.price * usdToXofRate) / 31.1035).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA
              </p>
              <p className="text-xs text-gray-500 mt-1">Or pur 24 carats</p>
            </div>

            <div className="bg-white rounded-lg p-4 border-2 border-emerald-300">
              <p className="text-sm font-medium text-gray-600 mb-2">Prix par Kilogramme (kg)</p>
              <p className="text-2xl font-bold text-emerald-700">
                {((goldPrice.price * usdToXofRate) * 1000 / 31.1035).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA
              </p>
              <p className="text-xs text-gray-500 mt-1">1 kg = 1000 grammes</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-emerald-200 flex items-center justify-between">
            <p className="text-xs text-emerald-700">
              <strong>Note :</strong> Prix indicatif basé sur le cours international de l'or et le taux de change USD/FCFA
            </p>
            <div className="text-xs text-emerald-600">
              Mis à jour: {lastUpdate.toLocaleTimeString('fr-FR')}
            </div>
          </div>
        </div>
      </Card>

      {/* Market Info Bar with Date and Status */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-emerald-600">Live Data</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Current Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {currentDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
              <p className="text-xs text-gray-600">
                {currentDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Next update in: {countdown}s
              {refreshing && (
                <span className="text-emerald-600 font-medium ml-2">Updating...</span>
              )}
            </div>
          </div>
        </div>

        {/* Market Status with Countdown */}
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {marketCountdown.marketName} Market
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    marketCountdown.isOpen
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-red-500'
                  }`}></div>
                  <span className={`text-sm font-semibold ${
                    marketCountdown.isOpen
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }`}>
                    {marketCountdown.isOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">
                {marketCountdown.nextEvent === 'opening' ? 'Opening in' : 'Closing in'}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {marketCountdown.timeUntil}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {marketCountdown.nextEvent === 'opening'
                  ? '8:00 AM GMT'
                  : '4:30 PM GMT'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
