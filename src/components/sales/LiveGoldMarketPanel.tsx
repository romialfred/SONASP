import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Circle, Clock, RefreshCw, TrendingUp, X } from 'lucide-react';
import {
  clearPriceCache,
  fetchLiveGoldPrice,
  formatGoldPrice,
  getMarketStatus,
  type LiveGoldPrice,
} from '@/services/liveGoldPriceService';
import './live-gold-market-panel.css';

interface LiveGoldMarketPanelProps {
  onCollapseChange?: (isCollapsed: boolean) => void;
  /** `embedded` intègre le cours au flux de la page sans panneau flottant. */
  variant?: 'drawer' | 'embedded';
  /** Évite une deuxième lecture au montage lorsqu’une page a déjà chargé le cours. */
  initialGoldPrice?: LiveGoldPrice | null;
}
const displayPrice = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? `${formatGoldPrice(value)} $` : '—';

export function LiveGoldMarketPanel({
  onCollapseChange,
  variant = 'drawer',
  initialGoldPrice,
}: LiveGoldMarketPanelProps) {
  const embedded = variant === 'embedded';
  const [goldPrice, setGoldPrice] = useState<LiveGoldPrice | null>(initialGoldPrice ?? null);
  const [loading, setLoading] = useState(!initialGoldPrice);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(initialGoldPrice ? new Date(initialGoldPrice.timestamp) : null);
  const [isOpen, setIsOpen] = useState(embedded);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const openedOnceRef = useRef(false);

  const fetchGoldData = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
      clearPriceCache();
    }
    try {
      const priceData = await fetchLiveGoldPrice();
      setGoldPrice(priceData);
      setLastUpdate(priceData ? new Date(priceData.timestamp) : null);
      setError(priceData ? null : 'Aucune source du référentiel n’a répondu.');
    } catch {
      setGoldPrice(null);
      setError('Le référentiel de marché est momentanément inaccessible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!initialGoldPrice) void fetchGoldData();
    const interval = window.setInterval(() => void fetchGoldData(), 60_000);
    return () => window.clearInterval(interval);
  }, [fetchGoldData, initialGoldPrice]);

  const setOpen = useCallback((next: boolean, restoreFocus = true) => {
    setIsOpen(next);
    onCollapseChange?.(!next);
    if (next) openedOnceRef.current = true;
    if (!next && restoreFocus && openedOnceRef.current) window.setTimeout(() => openerRef.current?.focus(), 0);
  }, [onCollapseChange]);

  useEffect(() => {
    if (embedded || !isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [embedded, isOpen, setOpen]);

  const marketStatus = getMarketStatus();
  const marketSchedules: Array<[string, typeof marketStatus.london]> = [
    ['Londres', marketStatus.london],
    ['New York', marketStatus.newYork],
  ];
  const variationAvailable = typeof goldPrice?.changePercent24h === 'number';
  const positive = (goldPrice?.changePercent24h ?? 0) >= 0;

  return (
    <aside
      ref={wrapperRef}
      className={embedded ? 'live-gold-drawer live-gold-drawer--embedded' : `live-gold-drawer ${isOpen ? 'is-open' : 'is-closed'}`}
      aria-label="Cours de l’or"
    >
      {!embedded && (
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(!isOpen, false)}
          className="live-gold-drawer__trigger"
          aria-label={isOpen ? 'Masquer le cours de l’or' : 'Afficher le cours de l’or'}
          title={isOpen ? 'Masquer le cours de l’or' : 'Afficher le cours de l’or'}
          aria-expanded={isOpen}
          aria-controls="live-gold-market-panel"
        >
          <TrendingUp aria-hidden="true" />
          {isOpen ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
        </button>
      )}

      <div id="live-gold-market-panel" className="live-gold-drawer__panel" aria-hidden={!embedded && !isOpen}>
        <header className="live-gold-drawer__header">
          <div>
            <h2>Cours de l’or</h2>
            <p>{goldPrice ? `XAU/USD · ${goldPrice.source}` : 'XAU/USD · Référentiel SONASP'}</p>
          </div>
          <div className="live-gold-drawer__header-actions">
            <button type="button" onClick={() => void fetchGoldData(true)} disabled={refreshing || loading || (!embedded && !isOpen)} aria-label="Actualiser le cours">
              <RefreshCw aria-hidden="true" className={refreshing ? 'is-spinning' : ''} />
            </button>
            {!embedded && <button type="button" onClick={() => setOpen(false)} disabled={!isOpen} aria-label="Fermer le volet du cours de l’or"><X aria-hidden="true" /></button>}
          </div>
        </header>

        {loading ? (
          <div className="live-gold-drawer__skeleton" role="status" aria-label="Chargement du cours de l’or"><span /><span /><span /><span /></div>
        ) : !goldPrice ? (
          <div className="live-gold-drawer__error" role="status">
            <AlertTriangle aria-hidden="true" />
            <strong>Cours indisponible</strong>
            <p>{error}</p>
            <button type="button" onClick={() => void fetchGoldData(true)} disabled={refreshing || (!embedded && !isOpen)}>Réessayer</button>
          </div>
        ) : (
          <>
            <div className="live-gold-drawer__price">
              <strong>{displayPrice(goldPrice.price)}</strong>
              <span>par once troy</span>
              <p className={variationAvailable ? (positive ? 'is-positive' : 'is-negative') : ''}>
                {variationAvailable
                  ? `${positive ? '+' : ''}${formatGoldPrice(goldPrice.changePercent24h!, 2)} % aujourd’hui`
                  : 'Variation non communiquée'}
              </p>
            </div>

            <dl className="live-gold-drawer__metrics">
              {[
                ['Ouverture', goldPrice.openPrice],
                ['Plus haut 24 h', goldPrice.high24h],
                ['Plus bas 24 h', goldPrice.low24h],
                ['Variation', goldPrice.change24h],
              ].map(([label, value]) => (
                <div key={String(label)}><dt>{label}</dt><dd>{displayPrice(value as number | undefined)}</dd></div>
              ))}
            </dl>

            <section className="live-gold-drawer__markets" aria-label="Marchés de référence">
              <h3>Marchés de référence</h3>
              {marketSchedules.map(([name, value]) => (
                <div key={name}>
                  <span><Circle aria-hidden="true" className={value.isOpen ? 'is-open' : ''} />{name}</span>
                  <strong>{value.isOpen ? 'Ouvert' : 'Fermé'}</strong>
                </div>
              ))}
            </section>

            <footer className="live-gold-drawer__footer">
              <Clock aria-hidden="true" />
              {lastUpdate ? `Dernière actualisation : ${lastUpdate.toLocaleTimeString('fr-FR')}` : 'Heure indisponible'}
            </footer>
          </>
        )}
      </div>
    </aside>
  );
}
