import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import {
  RefreshCw,
  Clock,
  Globe,
} from 'lucide-react';
import {
  fetchMultipleFxRates,
  clearFxRateCache,
  formatFxRate,
  type LiveFxRate,
} from '@/services/fxRateAggregationService';

// Le franc guinéen n'a pas cours au Burkina : les paires suivies sont celles qui
// servent réellement aux ventes à l'export et au règlement des achats.
const CURRENCY_PAIRS = [
  { pair: 'USD/XOF', label: 'Dollar américain / Franc CFA', flag: '🇺🇸🇧🇫' },
  { pair: 'EUR/XOF', label: 'Euro / Franc CFA', flag: '🇪🇺🇧🇫' },
  { pair: 'EUR/USD', label: 'Euro / Dollar américain', flag: '🇪🇺🇺🇸' },
];

export function LiveFxRatePanel() {
  const [fxRates, setFxRates] = useState<Map<string, LiveFxRate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const fetchFxData = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
      clearFxRateCache();
    }

    try {
      const pairs = CURRENCY_PAIRS.map(c => c.pair);
      const rates = await fetchMultipleFxRates(pairs);

      if (rates.size > 0) {
        setFxRates(rates);
        setLastUpdate(new Date());
        setCountdown(60);
        setError(null);
      } else {
        setError('Unable to fetch live FX rates');
      }
    } catch (error) {
      console.error('Error fetching FX rates:', error);
      setError('Connection error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFxData();

    const interval = setInterval(() => {
      fetchFxData();
    }, 60000);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 60));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
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

  return (
    <>
      {/* Live FX Rates Banner */}
      <div className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-xl p-3 mb-6 shadow-lg border border-slate-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2.5 rounded-lg border border-emerald-400/30">
              <Globe className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-slate-200 text-xs font-medium">Live Foreign Exchange Rates</p>
              <div className="flex items-baseline gap-3 mt-0.5">
                <span className="text-xl font-bold text-white">
                  {fxRates.size} Currency Pairs
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-emerald-300 font-medium">Real-time</span>
                </div>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Updated: {lastUpdate.toLocaleTimeString()} • Source: Frankfurter API
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchFxData(true)}
            disabled={refreshing}
            className="bg-white/10 hover:bg-white/20 p-2.5 rounded-lg transition-colors disabled:opacity-50 border border-white/10"
            title="Refresh now"
          >
            <RefreshCw
              className={`w-4 h-4 text-white ${refreshing ? 'animate-spin' : ''}`}
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

      {/* FX Rate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {CURRENCY_PAIRS.map((currencyInfo) => {
          const rate = fxRates.get(currencyInfo.pair);

          if (!rate) {
            return (
              <Card key={currencyInfo.pair} className="bg-gray-50">
                <div className="p-6">
                  <p className="text-sm text-gray-400">Loading {currencyInfo.pair}...</p>
                </div>
              </Card>
            );
          }

          return (
            <Card
              key={currencyInfo.pair}
              className="border-l-4 border-emerald-600 bg-gradient-to-br from-white to-emerald-50/40 transition-all hover:shadow-md"
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                      {currencyInfo.label.split(' / ')[0]} / {currencyInfo.label.split(' / ')[1].split(' ')[0]}
                    </p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">
                      {currencyInfo.pair}
                    </p>
                  </div>
                  <div className="text-xl">{currencyInfo.flag}</div>
                </div>

                <div className="mt-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-gray-900">
                      {formatFxRate(rate.rate, currencyInfo.pair.includes('XOF') ? 2 : 6)}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase font-medium">{currencyInfo.pair.split('/')[0]}</span>
                  </div>

                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    Source&nbsp;: {rate.source}
                  </p>

                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Taux observé</span>
                      <span className="font-medium text-gray-700">
                        {new Date(rate.timestamp).toLocaleTimeString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Info Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-600">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-emerald-600">Live Data</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Next update in: {countdown}s</span>
            {refreshing && (
              <span className="text-emerald-600 font-medium">Updating...</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
