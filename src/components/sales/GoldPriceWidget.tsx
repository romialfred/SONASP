import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import { getCurrentGoldPrice, getGoldPriceStatistics, type GoldPrice, type GoldPriceStats } from '@/services/goldPriceService';

interface GoldPriceWidgetProps {
  showDetailed?: boolean;
}

const formatUsd = (value: number, minimumFractionDigits = 2) => new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits,
  maximumFractionDigits: 2,
}).format(value);

const formatPercent = (value: number, maximumFractionDigits = 2) => `${new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: maximumFractionDigits,
  maximumFractionDigits,
}).format(value)} %`;

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
          <p className="text-sm">Le cours de l’or ne peut pas être chargé.</p>
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

  /**
   * Variation de la séance : du fixing du matin à celui de l'après-midi.
   * Tant que le fixing de l'après-midi n'est pas publié, il n'y a pas de
   * variation à annoncer — et surtout pas un zéro qui passerait pour stable.
   */
  const calculateVariance = (): { value: number; percentage: number } | null => {
    if (!goldPrice || goldPrice.london_pm_rate === null) return null;
    const variance = goldPrice.london_pm_rate - goldPrice.london_am_rate;
    if (goldPrice.london_am_rate === 0) return { value: variance, percentage: 0 };
    return { value: variance, percentage: (variance / goldPrice.london_am_rate) * 100 };
  };

  const variance = calculateVariance();

  return (
    <Card className={`${getBgColor()} transition-colors duration-300`}>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="text-sm font-semibold text-gray-700">Cours de l’or en direct — marché au comptant de Londres</h3>
          </div>
          <button
            onClick={fetchGoldData}
            className="p-1 hover:bg-white/50 rounded transition-colors"
            title="Actualiser le cours"
            aria-label="Actualiser le cours de l’or"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {formatUsd(goldPrice.london_am_rate)}
            </span>
            <span className="text-sm text-gray-500">/oz</span>
          </div>

          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-sm font-semibold ${getTrendColor()}`}>
              {stats.change > 0 ? '+' : ''}{formatUsd(stats.change)} ({stats.change_percentage > 0 ? '+' : ''}{formatPercent(stats.change_percentage)})
            </span>
          </div>

          <div className="text-xs text-gray-500">
            Fixing de Londres du matin • {new Date(goldPrice.price_date).toLocaleDateString('fr-FR')}
          </div>
        </div>

        {showDetailed && (
          <>
            <div className="border-t border-gray-200 pt-3">
              <div className="text-xs font-semibold text-gray-700 mb-3">Statistiques de la séance</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/60 p-2 rounded">
                  <div className="text-gray-500 text-xs">Fixing du matin</div>
                  <div className="font-semibold text-gray-900">
                    {formatUsd(goldPrice.london_am_rate)}
                  </div>
                </div>
                <div className="bg-white/60 p-2 rounded">
                  <div className="text-gray-500 text-xs">Fixing de l’après-midi</div>
                  <div className="font-semibold text-gray-900">
                    {goldPrice.london_pm_rate === null
                      ? 'non publié'
                      : formatUsd(goldPrice.london_pm_rate)}
                  </div>
                </div>
                <div className="bg-green-50 p-2 rounded border border-green-200">
                  <div className="text-gray-500 text-xs">Plus haut sur 24 h</div>
                  <div className="font-semibold text-green-700">
                    {goldPrice.high_price === null
                      ? '—'
                      : formatUsd(goldPrice.high_price)}
                  </div>
                </div>
                <div className="bg-red-50 p-2 rounded border border-red-200">
                  <div className="text-gray-500 text-xs">Plus bas sur 24 h</div>
                  <div className="font-semibold text-red-700">
                    {goldPrice.low_price === null
                      ? '—'
                      : formatUsd(goldPrice.low_price)}
                  </div>
                </div>
                {variance === null ? (
                  <div className="col-span-2 p-2 rounded border bg-gray-50 border-gray-200">
                    <div className="text-gray-500 text-xs">Variation du jour</div>
                    <div className="text-sm text-gray-600">
                      Le fixing de l’après-midi n’est pas encore publié.
                    </div>
                  </div>
                ) : (
                  <div className={`col-span-2 p-2 rounded border ${
                    variance.value >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="text-gray-500 text-xs">Variation du jour</div>
                    <div className="flex items-center justify-between">
                      <div className={`font-bold ${variance.value >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {variance.value >= 0 ? '+' : ''}{formatUsd(variance.value)}
                      </div>
                      <div className={`text-sm font-semibold ${variance.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance.percentage >= 0 ? '+' : ''}{formatPercent(variance.percentage)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="text-xs font-semibold text-gray-700">Statistiques sur 30 jours</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-gray-500 text-xs">Moyenne</div>
                  <div className="font-semibold text-gray-900">
                    {formatUsd(stats.avg_30_days, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Plus haut</div>
                  <div className="font-semibold text-green-700">
                    {formatUsd(stats.high_30_days, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Plus bas</div>
                  <div className="font-semibold text-red-700">
                    {formatUsd(stats.low_30_days, 0)}
                  </div>
                </div>
              </div>
            </div>

            <div className={`text-xs p-2 rounded ${
              stats.trend === 'up' ? 'bg-green-100 text-green-800' :
              stats.trend === 'down' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              <span className="font-semibold">Tendance du marché :</span>{' '}
              {stats.trend === 'up' ? 'haussière' : stats.trend === 'down' ? 'baissière' : 'neutre'}
              {' • '}
              Le cours actuel se situe{' '}
              {formatPercent((goldPrice.london_am_rate - stats.avg_30_days) / stats.avg_30_days * 100, 1)}
              {' '}{goldPrice.london_am_rate > stats.avg_30_days ? 'au-dessus' : 'en dessous'} de la moyenne sur 30 jours.
            </div>
          </>
        )}

        <div className="text-xs text-gray-400 flex items-center justify-between border-t border-gray-200 pt-2">
          <span>Dernière mise à jour : {lastUpdate.toLocaleTimeString('fr-FR')}</span>
          <span className="text-gray-500">Actualisation automatique : 1 min</span>
        </div>
      </div>
    </Card>
  );
}
