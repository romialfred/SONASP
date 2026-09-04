import { BarChart3, Coins, DollarSign, PackageOpen } from 'lucide-react';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import type { SaleSimulationContext } from '@/services/saleSimulationService';
import { formatCompactXof, formatDateFr, formatNumberFr } from './saleSimulationFormatters';

interface SimulationKpisProps {
  context: SaleSimulationContext;
}

export function SimulationKpis({ context }: SimulationKpisProps) {
  const stockValueXof = context.goldPrice && context.usdXofRate
    ? context.availableStockOz * context.goldPrice.price * context.usdXofRate
    : null;
  const variation = context.goldPrice?.changePercent24h;

  return (
    <section className="sale-simulator__kpis" aria-label="Indicateurs de référence">
      <article className="sale-simulator__kpi">
        <PackageOpen aria-hidden="true" />
        <div>
          <p>Stock exportable</p>
          <strong>{formatNumberFr(context.availableStockOz, 3, 3)} oz</strong>
          <small>{formatNumberFr(context.availableStockOz * TROY_OZ_GRAMS, 2)} g</small>
        </div>
      </article>
      <article className="sale-simulator__kpi">
        <BarChart3 aria-hidden="true" />
        <div>
          <p>Cours de l’or</p>
          <strong>{context.goldPrice ? `${formatNumberFr(context.goldPrice.price, 2, 2)} $/oz` : 'Indisponible'}</strong>
          {typeof variation === 'number'
            ? <small className={variation >= 0 ? 'is-positive' : 'is-negative'}>{variation >= 0 ? '+' : ''}{formatNumberFr(variation, 2, 2)} %</small>
            : <small>Variation non communiquée</small>}
        </div>
      </article>
      <article className="sale-simulator__kpi">
        <DollarSign aria-hidden="true" />
        <div>
          <p>Taux USD/XOF</p>
          <strong>{formatNumberFr(context.usdXofRate, 2, 2)}</strong>
          <small>{context.fxRateDate ? `Référentiel du ${formatDateFr(context.fxRateDate)}` : 'Taux indisponible'}</small>
        </div>
      </article>
      <article className="sale-simulator__kpi">
        <Coins aria-hidden="true" />
        <div>
          <p>Valeur estimée du stock</p>
          <strong>{formatCompactXof(stockValueXof)}</strong>
          <small>Valorisation indicative</small>
        </div>
      </article>
    </section>
  );
}
