import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useCoursOr } from '@/hooks/useCoursOr';
import {
  fetchGoldPriceHistory,
  formatGoldPrice,
  type GoldPriceHistoryPoint,
} from '@/services/liveGoldPriceService';

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

function freshness(timestamp: number): string {
  const age = Math.max(0, Date.now() - timestamp);
  if (age <= 15 * 60_000) return 'Mise à jour récente';
  if (age <= 24 * 60 * 60_000) return 'Cours différé';
  return 'Dernière valeur connue';
}

function MineGoldCurve({ history }: { history: GoldPriceHistoryPoint[] }) {
  if (history.length < 2) return null;
  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return null;
  const points = history.map((point, index) => {
    const x = 3 + index * (184 / Math.max(history.length - 1, 1));
    const y = 36 - (point.price - min) / (max - min) * 29;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="mine-gold-card__curve" viewBox="0 0 190 40" role="img" aria-label="Évolution récente du cours de l’or">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MineGoldSidebarCard() {
  const { cours, tauxUsdXof, prixGrammeFcfa, chargement, erreur, actualiser } = useCoursOr();
  const [history, setHistory] = useState<GoldPriceHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await fetchGoldPriceHistory());
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const ounceFcfa = useMemo(() => (
    cours && tauxUsdXof ? cours.price * tauxUsdXof : null
  ), [cours, tauxUsdXof]);
  const variation = cours?.changePercent24h;
  const VariationIcon = variation !== undefined && variation < 0 ? TrendingDown : TrendingUp;

  const retry = async () => {
    await Promise.all([actualiser(), loadHistory()]);
  };

  return (
    <section className="mine-gold-card" aria-label="Cours de l’or" aria-busy={chargement || historyLoading}>
      <header>
        <span><Coins aria-hidden="true" /> COURS DE L’OR</span>
        <button type="button" onClick={() => void retry()} aria-label="Actualiser le cours de l’or">
          <RefreshCw aria-hidden="true" />
        </button>
      </header>
      {chargement && !cours ? (
        <div className="mine-gold-card__loading" aria-label="Chargement du cours"><i /><i /><i /></div>
      ) : cours ? (
        <>
          <strong>{ounceFcfa === null ? 'Conversion indisponible' : formatGoldPrice(ounceFcfa, 0)} {ounceFcfa !== null && <small>FCFA/oz</small>}</strong>
          <p>{prixGrammeFcfa === null ? 'Conversion au gramme indisponible' : `${formatGoldPrice(prixGrammeFcfa, 0)} FCFA/g`}</p>
          {variation !== undefined && Number.isFinite(variation) && (
            <span className={`mine-gold-card__variation${variation < 0 ? ' is-negative' : ''}`}>
              <VariationIcon aria-hidden="true" /> {variation >= 0 ? '+' : ''}{formatGoldPrice(variation)} %
            </span>
          )}
          <MineGoldCurve history={history} />
          <footer>
            <span>{freshness(cours.timestamp)}</span>
            <time dateTime={new Date(cours.timestamp).toISOString()}>Mis à jour à {timeFormatter.format(new Date(cours.timestamp))}</time>
          </footer>
          {tauxUsdXof === null && <p className="mine-gold-card__notice">Taux USD/XOF indisponible.</p>}
        </>
      ) : (
        <div className="mine-gold-card__error">
          <p>{erreur || 'Aucun cours publié dans le référentiel.'}</p>
          <button type="button" onClick={() => void retry()}><RefreshCw aria-hidden="true" /> Réessayer</button>
        </div>
      )}
    </section>
  );
}
