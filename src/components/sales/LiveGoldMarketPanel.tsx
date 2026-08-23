import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Circle, Clock, RefreshCw } from 'lucide-react';
import {
  clearPriceCache,
  fetchLiveGoldPrice,
  formatGoldPrice,
  getMarketStatus,
  type LiveGoldPrice,
} from '@/services/liveGoldPriceService';

interface LiveGoldMarketPanelProps {
  onCollapseChange?: (isCollapsed: boolean) => void;
}

const afficherCours = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? `$${formatGoldPrice(value)}` : '—';

export function LiveGoldMarketPanel({ onCollapseChange }: LiveGoldMarketPanelProps) {
  const [goldPrice, setGoldPrice] = useState<LiveGoldPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
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
      setError(priceData ? null : 'Aucune source de marché n’a répondu.');
    } catch {
      setGoldPrice(null);
      setError('La source de marché est momentanément inaccessible.');
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

  const marketStatus = getMarketStatus();
  const basculer = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapseChange?.(next);
  };

  const variationDisponible =
    typeof goldPrice?.change24h === 'number' && typeof goldPrice.changePercent24h === 'number';
  const positive = (goldPrice?.change24h ?? 0) >= 0;

  return (
    <aside
      className={`fixed right-0 top-20 z-40 transition-transform duration-300 ${isCollapsed ? 'translate-x-full' : 'translate-x-0'}`}
      aria-label="Cours de l’or"
    >
      <button
        type="button"
        onClick={basculer}
        className="absolute left-0 top-1/2 grid h-10 w-9 -translate-x-full -translate-y-1/2 place-items-center rounded-l-lg border border-r-0 border-slate-200 bg-white shadow-lg"
        aria-label={isCollapsed ? 'Afficher le cours de l’or' : 'Masquer le cours de l’or'}
      >
        {isCollapsed ? <ChevronLeft aria-hidden="true" className="h-5 w-5" /> : <ChevronRight aria-hidden="true" className="h-5 w-5" />}
      </button>

      <div className="w-80 rounded-l-2xl border border-r-0 border-slate-200 bg-white shadow-2xl">
        <div className="p-5">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-bold text-slate-900">Cours de l’or</h2>
              <p className="mt-1 text-xs text-slate-500">
                {goldPrice ? `XAU/USD · ${goldPrice.source}` : 'XAU/USD'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchGoldData(true)}
              disabled={refreshing || loading}
              aria-label="Actualiser le cours"
              className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </header>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-600" role="status">Chargement du cours…</p>
          ) : !goldPrice ? (
            <div className="py-8 text-center" role="status">
              <AlertTriangle aria-hidden="true" className="mx-auto h-6 w-6 text-amber-700" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Cours indisponible</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{error}</p>
            </div>
          ) : (
            <>
              <div className="py-5 text-center">
                <p className="text-3xl font-bold text-slate-900">${formatGoldPrice(goldPrice.price)}</p>
                <p className="mt-1 text-xs text-slate-500">par once troy</p>
                <p className={`mt-3 text-sm font-semibold ${variationDisponible ? (positive ? 'text-emerald-700' : 'text-red-700') : 'text-slate-500'}`}>
                  {variationDisponible
                    ? `${positive ? '+' : ''}${goldPrice.changePercent24h!.toFixed(2)} % sur 24 h`
                    : 'Variation non communiquée'}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-2">
                {[
                  ['Ouverture', goldPrice.openPrice],
                  ['Plus haut 24 h', goldPrice.high24h],
                  ['Plus bas 24 h', goldPrice.low24h],
                  ['Variation', variationDisponible ? goldPrice.change24h : undefined],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 text-sm font-bold text-slate-900">{afficherCours(value as number | undefined)}</dd>
                  </div>
                ))}
              </dl>

              <section className="mt-4 rounded-lg border border-slate-200 p-3" aria-label="Horaires indicatifs des marchés">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horaires indicatifs</h3>
                {[
                  ['Londres', marketStatus.london],
                  ['New York', marketStatus.newYork],
                ].map(([name, status]) => {
                  const value = status as typeof marketStatus.london;
                  return (
                    <div key={String(name)} className="mt-2 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-700">
                        <Circle aria-hidden="true" className={`h-2 w-2 ${value.isOpen ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-300 text-slate-300'}`} />
                        {name}
                      </span>
                      <span className="font-semibold text-slate-600">{value.isOpen ? 'Ouvert' : 'Fermé'}</span>
                    </div>
                  );
                })}
              </section>

              <footer className="mt-4 flex items-center justify-center gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
                <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                {lastUpdate ? `Donnée reçue à ${lastUpdate.toLocaleTimeString('fr-FR')}` : 'Heure indisponible'}
              </footer>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
