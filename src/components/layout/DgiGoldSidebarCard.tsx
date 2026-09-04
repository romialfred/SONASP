import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useCoursOr } from '@/hooks/useCoursOr';
import {
  fetchGoldPriceHistory,
  formatGoldPrice,
  type GoldPriceHistoryPoint,
} from '@/services/liveGoldPriceService';

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function freshness(timestamp: number): string {
  const age = Math.max(0, Date.now() - timestamp);
  if (age <= 15 * 60_000) return 'Mise à jour récente';
  if (age <= 24 * 60 * 60_000) return 'Cours différé';
  return 'Dernière valeur connue';
}

function MiniCurve({ history }: { history: GoldPriceHistoryPoint[] }) {
  if (history.length < 2) return null;
  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return null;
  const points = history.map((point, index) => {
    const x = 3 + index * (174 / Math.max(history.length - 1, 1));
    const y = 39 - (point.price - min) / (max - min) * 32;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="dgi-gold-card__curve" viewBox="0 0 180 43" role="img" aria-label="Évolution récente du cours de l’or">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DgiGoldSidebarCard() {
  const { cours, tauxUsdXof, prixGrammeFcfa, chargement, erreur, actualiser } = useCoursOr();
  const [history, setHistory] = useState<GoldPriceHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistory(await fetchGoldPriceHistory());
    setHistoryLoading(false);
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
    <section className="dgi-gold-card" aria-label="Cours de l’or" aria-busy={chargement || historyLoading}>
      <header><span><Coins aria-hidden="true" /> COURS DE L’OR</span><button type="button" onClick={() => void retry()} aria-label="Actualiser le cours de l’or"><RefreshCw aria-hidden="true" /></button></header>
      {chargement && !cours ? (
        <div className="dgi-gold-card__loading"><i /><i /><i /></div>
      ) : cours ? (
        <>
          <strong>{ounceFcfa === null ? 'Conversion indisponible' : formatGoldPrice(ounceFcfa, 0)} {ounceFcfa !== null && <small>FCFA/oz</small>}</strong>
          <p>{prixGrammeFcfa === null ? 'Conversion au gramme indisponible' : `${formatGoldPrice(prixGrammeFcfa, 0)} FCFA/g`}</p>
          {variation !== undefined && Number.isFinite(variation) && (
            <span className={`dgi-gold-card__variation${variation < 0 ? ' is-negative' : ''}`}>
              <VariationIcon aria-hidden="true" /> {variation >= 0 ? '+' : ''}{formatGoldPrice(variation)} %
            </span>
          )}
          <MiniCurve history={history} />
          <dl>
            <div><dt>Statut</dt><dd>{freshness(cours.timestamp)}</dd></div>
            <div><dt>Source</dt><dd title={cours.source}>{cours.source}</dd></div>
            <div><dt>Horodatage</dt><dd>{dateTimeFormatter.format(new Date(cours.timestamp))}</dd></div>
          </dl>
          {tauxUsdXof === null && <p className="dgi-gold-card__notice">Taux USD/XOF indisponible.</p>}
        </>
      ) : (
        <div className="dgi-gold-card__error">
          <p>{erreur || 'Aucun cours publié dans le référentiel.'}</p>
          <button type="button" onClick={() => void retry()}><RefreshCw aria-hidden="true" /> Réessayer</button>
        </div>
      )}
    </section>
  );
}
