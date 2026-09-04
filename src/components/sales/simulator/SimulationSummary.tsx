import { CheckCircle2, Download, Tag } from 'lucide-react';
import type { SaleSimulationResult } from '@/services/saleSimulationService';
import { formatCompactXof, formatNumberFr } from './saleSimulationFormatters';

interface SimulationSummaryProps {
  result: SaleSimulationResult | null;
  exporting: boolean;
  onExport: () => void;
}

const signedCompact = (value: number) => {
  const formatted = formatCompactXof(Math.abs(value));
  return `${value < 0 ? '−' : value > 0 ? '+' : ''}${formatted}`;
};

const deductionCompact = (value: number) => value > 0
  ? `−${formatCompactXof(value)}`
  : formatCompactXof(0);

export function SimulationSummary({ result, exporting, onExport }: SimulationSummaryProps) {
  const margin = result?.netMarginPct ?? 0;

  return (
    <aside className="sale-simulator__panel sale-simulator__summary" aria-labelledby="simulation-summary-title" aria-live="polite">
      <header className="sale-simulator__panel-header">
        <h2 id="simulation-summary-title">Synthèse estimative</h2>
        <span className={`sale-simulator__status ${result ? 'is-ready' : ''}`}>
          {result && <CheckCircle2 aria-hidden="true" />}
          {result ? 'Simulation prête' : 'En attente des paramètres'}
        </span>
      </header>

      <div className="sale-simulator__net-result">
        <p>Produit net estimé</p>
        <strong>{result ? formatCompactXof(result.netProceedsXof) : '—'}</strong>
      </div>

      <dl className="sale-simulator__financial-lines">
        <div><dt>Valeur brute</dt><dd>{result ? formatCompactXof(result.grossValueXof) : '—'}</dd></div>
        <div><dt>Prime / Décote</dt><dd className={(result?.premiumDiscountAmountXof ?? 0) < 0 ? 'is-negative' : ''}>{result ? signedCompact(result.premiumDiscountAmountXof) : '—'}</dd></div>
        <div><dt>Frais logistiques</dt><dd className={result?.logisticsCostXof ? 'is-negative' : ''}>{result ? deductionCompact(result.logisticsCostXof) : '—'}</dd></div>
        <div><dt>Taxes et prélèvements</dt><dd className={result?.taxAmountXof ? 'is-negative' : ''}>{result ? deductionCompact(result.taxAmountXof) : '—'}</dd></div>
      </dl>

      <div className="sale-simulator__net-price">
        <span><Tag aria-hidden="true" /></span>
        <div><p>Prix net moyen</p><strong>{result ? `${formatNumberFr(result.netPriceXofOz, 0)} FCFA/oz` : '—'}</strong></div>
      </div>

      <div className="sale-simulator__margin">
        <div><span>Marge nette</span><strong>{result ? `${formatNumberFr(margin, 2, 2)} %` : '—'}</strong></div>
        <div className="sale-simulator__progress" role="progressbar" aria-label="Marge nette" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result ? Math.max(0, Math.min(100, margin)) : 0}>
          <span style={{ width: `${result ? Math.max(0, Math.min(100, margin)) : 0}%` }} />
        </div>
      </div>

      <button
        type="button"
        className="sale-simulator__button sale-simulator__button--secondary sale-simulator__export"
        onClick={onExport}
        disabled={!result || exporting}
        aria-busy={exporting}
      >
        <Download aria-hidden="true" /> {exporting ? 'Export en cours…' : 'Exporter le scénario'}
      </button>
    </aside>
  );
}
