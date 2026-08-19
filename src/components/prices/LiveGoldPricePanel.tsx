import { useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, RefreshCw } from 'lucide-react';
import { formatGoldPrice, type LiveGoldPrice } from '@/services/liveGoldPriceService';
import { GRAMMES_PAR_ONCE, useCoursOr } from '@/hooks/useCoursOr';
import './live-gold-price-panel.css';

export const fcfa = (valeur: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(valeur);

/**
 * Variation depuis l'ouverture.
 *
 * `null` quand la source ne fournit ni variation ni cours d'ouverture. Le panneau
 * fabriquait auparavant l'ouverture à `cours × 0,995`, le haut à `× 1,008` et le
 * bas à `× 0,992`, puis les affichait comme des données de marché : un acheteur
 * fixait son prix sur des chiffres inventés.
 */
export function variationDepuisOuverture(cours: LiveGoldPrice): { valeur: number; pourcentage: number } | null {
  if (typeof cours.change24h === 'number' && typeof cours.changePercent24h === 'number') {
    return { valeur: cours.change24h, pourcentage: cours.changePercent24h };
  }
  if (typeof cours.openPrice === 'number' && cours.openPrice > 0) {
    const valeur = cours.price - cours.openPrice;
    return { valeur, pourcentage: (valeur / cours.openPrice) * 100 };
  }
  return null;
}

export function LiveGoldPricePanel() {
  const { cours, tauxUsdXof, derniereMaj, chargement, erreur, actualiser } = useCoursOr();
  const [actualisation, setActualisation] = useState(false);

  const relancer = async () => {
    setActualisation(true);
    await actualiser();
    setActualisation(false);
  };

  if (chargement) {
    return (
      <section className="cours-or cours-or--attente" aria-label="Cours de l’or">
        <p>Chargement du cours…</p>
      </section>
    );
  }

  if (!cours) {
    return (
      <section className="cours-or" aria-label="Cours de l’or">
        <header className="cours-or__tete">
          <h3>Cours de l’or</h3>
        </header>
        <p className="cours-or__indispo">
          <AlertTriangle aria-hidden="true" />
          {erreur || 'Cours indisponible.'}
        </p>
      </section>
    );
  }

  const variation = variationDepuisOuverture(cours);
  const taux = tauxUsdXof;
  const parOnce = taux === null ? null : cours.price * taux;
  const parGramme = parOnce === null ? null : parOnce / GRAMMES_PAR_ONCE;

  return (
    <section className="cours-or" aria-label="Cours de l’or">
      <header className="cours-or__tete">
        <h3>Cours de l’or</h3>
        <button
          type="button"
          onClick={() => void relancer()}
          disabled={actualisation}
          aria-label="Actualiser le cours"
        >
          <RefreshCw className={actualisation ? 'sn-spin' : ''} aria-hidden="true" />
        </button>
      </header>

      <p className="cours-or__valeur">
        <strong>{formatGoldPrice(cours.price)}</strong>
        <span>USD / oz</span>
      </p>

      {variation === null ? (
        /* Aucune variation n'est calculable : la source ne donne pas l'ouverture. */
        <p className="cours-or__variation is-inconnue">Variation non communiquée par la source</p>
      ) : (
        <p className={`cours-or__variation${variation.valeur >= 0 ? ' is-hausse' : ' is-baisse'}`}>
          {variation.valeur >= 0 ? <ArrowUpRight aria-hidden="true" /> : <ArrowDownRight aria-hidden="true" />}
          {variation.valeur >= 0 ? '+' : ''}
          {variation.valeur.toFixed(2)} ({variation.pourcentage >= 0 ? '+' : ''}
          {variation.pourcentage.toFixed(2)} %)
        </p>
      )}

      <dl className="cours-or__conversions">
        <div>
          <dt>
            <Banknote aria-hidden="true" /> Par once
          </dt>
          <dd>{parOnce === null ? '—' : `${fcfa(parOnce)} FCFA`}</dd>
        </div>
        <div>
          <dt>Par gramme</dt>
          <dd>{parGramme === null ? '—' : `${fcfa(parGramme)} FCFA`}</dd>
        </div>
        <div>
          <dt>Par kilogramme</dt>
          <dd>{parGramme === null ? '—' : `${fcfa(parGramme * 1000)} FCFA`}</dd>
        </div>
      </dl>

      <footer className="cours-or__source">
        {taux === null ? (
          /* Sans taux de change au référentiel, aucune conversion n'est affichée. */
          <span className="is-avertissement">
            <AlertTriangle aria-hidden="true" /> Taux USD/XOF absent du référentiel : conversions
            indisponibles.
          </span>
        ) : (
          <span>1 USD = {fcfa(taux)} FCFA</span>
        )}
        <span>
          {cours.source}
          {derniereMaj && ` · ${derniereMaj.toLocaleTimeString('fr-FR')}`}
        </span>
      </footer>

      {erreur && <p className="cours-or__indispo">{erreur}</p>}
    </section>
  );
}

export default LiveGoldPricePanel;
