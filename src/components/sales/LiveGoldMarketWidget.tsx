import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Clock, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  clearPriceCache,
  fetchLiveGoldPrice,
  formatGoldPrice,
  type LiveGoldPrice,
} from '@/services/liveGoldPriceService';

const afficherCours = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? `$${formatGoldPrice(value)}` : 'Non communiqué';

export function LiveGoldMarketWidget() {
  const [goldPrice, setGoldPrice] = useState<LiveGoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchGoldData = async (manual = false) => {
    if (manual) {
      setRefreshing(true);
      clearPriceCache();
    }

    try {
      const priceData = await fetchLiveGoldPrice();
      setGoldPrice(priceData);
      setLastUpdate(priceData ? new Date(priceData.timestamp) : null);
      setError(priceData ? null : 'Le cours en temps réel est momentanément indisponible.');
    } catch {
      setGoldPrice(null);
      setError('La source de marché ne répond pas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchGoldData();
    const interval = window.setInterval(() => void fetchGoldData(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <div className="p-6" role="status">Chargement du cours de l’or…</div>
      </Card>
    );
  }

  if (!goldPrice) {
    return (
      <Card className="border-amber-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6" role="status">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <h2 className="font-semibold text-slate-900">Cours de l’or indisponible</h2>
              <p className="mt-1 text-sm text-slate-600">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchGoldData(true)}
            disabled={refreshing}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Réessayer
          </button>
        </div>
      </Card>
    );
  }

  const variationDisponible =
    typeof goldPrice.change24h === 'number' && typeof goldPrice.changePercent24h === 'number';
  const positive = (goldPrice.change24h ?? 0) >= 0;

  const metrics = [
    { label: 'Cours au comptant', value: afficherCours(goldPrice.price), note: 'USD / once troy' },
    { label: 'Ouverture', value: afficherCours(goldPrice.openPrice), note: 'Valeur fournie par la source' },
    { label: 'Plus haut 24 h', value: afficherCours(goldPrice.high24h), note: 'Valeur fournie par la source', icon: ArrowUp },
    { label: 'Plus bas 24 h', value: afficherCours(goldPrice.low24h), note: 'Valeur fournie par la source', icon: ArrowDown },
  ];

  return (
    <Card className="mb-4 border-amber-200 bg-gradient-to-br from-white to-amber-50/70 shadow-sm">
      <div className="p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-amber-500 font-bold text-white">Au</div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Cours de l’or</h2>
              <p className="text-sm text-slate-600">XAU/USD · Source : {goldPrice.source}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchGoldData(true)}
            disabled={refreshing}
            aria-label="Actualiser le cours"
            className="grid h-10 w-10 place-items-center rounded-md border border-amber-200 text-slate-700 hover:bg-amber-100 disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(({ label, value, note, icon: Icon }) => (
            <section key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-900">
                {Icon && <Icon aria-hidden="true" className="h-4 w-4 text-amber-700" />}
                {value}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
            </section>
          ))}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variation 24 h</p>
            {variationDisponible ? (
              <>
                <p className={`mt-2 text-xl font-bold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                  {positive ? '+' : ''}{goldPrice.changePercent24h!.toFixed(2)} %
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {positive ? '+' : ''}${goldPrice.change24h!.toFixed(2)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-600">Non communiquée</p>
            )}
          </section>
        </div>

        <footer className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Clock aria-hidden="true" className="h-4 w-4" />
          {lastUpdate ? `Dernière donnée reçue à ${lastUpdate.toLocaleTimeString('fr-FR')}` : 'Heure de mise à jour indisponible'}
        </footer>
      </div>
    </Card>
  );
}
