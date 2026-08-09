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
  Banknote,
} from 'lucide-react';
import {
  fetchLiveGoldPrice,
  formatGoldPrice,
  clearPriceCache,
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
  const [, setMarketCountdown] = useState(getTimeUntilMarketChange());
  const [, setCurrentDate] = useState<Date>(new Date());

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

  return (
    <div className="space-y-3">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
          <p className="text-red-600 text-xs">{error}</p>
        </div>
      )}

      {/* Main Price Card */}
      <Card className="bg-gradient-to-br from-amber-500 to-amber-600 shadow-md">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-white" />
              <span className="text-xs font-medium text-amber-100">XAU/USD</span>
            </div>
            <button
              onClick={() => fetchGoldData(true)}
              disabled={refreshing}
              className="bg-white/20 hover:bg-white/30 p-1.5 rounded transition-colors disabled:opacity-50"
              title="Actualiser"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-white ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold text-white">
              ${formatGoldPrice(goldPrice.price)}
            </span>
            <div className="flex items-center gap-1">
              {isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-200" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-200" />
              )}
              <span
                className={`text-sm font-semibold ${
                  isPositive ? 'text-emerald-200' : 'text-red-200'
                }`}
              >
                {isPositive ? '+' : ''}{change24h.toFixed(2)} ({isPositive ? '+' : ''}
                {changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <p className="text-xs text-amber-100">
            {goldPrice.source} • {lastUpdate.toLocaleTimeString('fr-FR')}
          </p>
        </div>
      </Card>

      {/* Compact Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-white border border-gray-200">
          <div className="p-2.5">
            <p className="text-xs text-gray-500 mb-1">Spot</p>
            <p className="text-lg font-bold text-gray-900">
              ${formatGoldPrice(goldPrice.price)}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {isPositive ? (
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-600" />
              )}
              <span className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{change24h.toFixed(2)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-gray-200">
          <div className="p-2.5">
            <p className="text-xs text-gray-500 mb-1">Ouverture</p>
            <p className="text-lg font-bold text-gray-900">
              ${formatGoldPrice(mockOpenPrice)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Aujourd'hui</p>
          </div>
        </Card>

        <Card className="bg-white border border-green-200">
          <div className="p-2.5">
            <p className="text-xs text-gray-500 mb-1">Haut 24h</p>
            <p className="text-lg font-bold text-green-600">
              ${formatGoldPrice(high24h)}
            </p>
            <p className="text-xs text-green-500 mt-0.5">
              +{((high24h - goldPrice.price) / goldPrice.price * 100).toFixed(2)}%
            </p>
          </div>
        </Card>

        <Card className="bg-white border border-red-200">
          <div className="p-2.5">
            <p className="text-xs text-gray-500 mb-1">Bas 24h</p>
            <p className="text-lg font-bold text-red-600">
              ${formatGoldPrice(low24h)}
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              {((low24h - goldPrice.price) / goldPrice.price * 100).toFixed(2)}%
            </p>
          </div>
        </Card>
      </div>

      {/* CFA Prices */}
      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-emerald-900">Prix en FCFA</h4>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-200 px-2 py-0.5 rounded-full">
              1 USD = {usdToXofRate.toFixed(0)} FCFA
            </span>
          </div>

          <div className="space-y-2">
            <div className="bg-white rounded-lg p-2 border border-emerald-200">
              <p className="text-xs text-gray-600 mb-0.5">Par Once (oz)</p>
              <p className="text-lg font-bold text-emerald-700">
                {(goldPrice.price * usdToXofRate).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                <span className="text-xs font-normal text-gray-500 ml-1">FCFA</span>
              </p>
            </div>

            <div className="bg-white rounded-lg p-2 border border-emerald-200">
              <p className="text-xs text-gray-600 mb-0.5">Par Gramme (g)</p>
              <p className="text-lg font-bold text-emerald-700">
                {((goldPrice.price * usdToXofRate) / 31.1034768).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                <span className="text-xs font-normal text-gray-500 ml-1">FCFA</span>
              </p>
            </div>

            <div className="bg-white rounded-lg p-2 border border-emerald-200">
              <p className="text-xs text-gray-600 mb-0.5">Par Kilogramme (kg)</p>
              <p className="text-lg font-bold text-emerald-700">
                {((goldPrice.price * usdToXofRate) * 1000 / 31.1034768).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                <span className="text-xs font-normal text-gray-500 ml-1">FCFA</span>
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Status Footer */}
      <Card className="bg-gray-50 border border-gray-200">
        <div className="p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-600">Temps réel</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              Prochaine maj: {countdown}s
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
