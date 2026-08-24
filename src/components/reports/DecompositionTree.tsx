import { ChevronRight, GitBranch, Layers3 } from 'lucide-react';
import type {
  BIBreakdownItem,
  BIDimension,
  BIView,
} from '@/services/businessIntelligenceService';
import { BI_DIMENSION_LABELS } from '@/services/businessIntelligenceService';

interface DecompositionTreeProps {
  view: BIView;
  dimension: BIDimension;
  dimensions: BIDimension[];
  items: BIBreakdownItem[];
  total: number;
  unit: string;
  selectedId: string | null;
  onDimensionChange: (dimension: BIDimension) => void;
  onSelect: (item: BIBreakdownItem | null) => void;
  formatValue: (value: number, unit?: string) => string;
}

const rootLabels: Record<BIView, string> = {
  sales: 'Valeur analysée',
  production: 'Production analysée',
  institutional: 'Montant analysé',
  national: 'Production nationale',
};

export function DecompositionTree({
  view,
  dimension,
  dimensions,
  items,
  total,
  unit,
  selectedId,
  onDimensionChange,
  onSelect,
  formatValue,
}: DecompositionTreeProps) {
  const visible = items.slice(0, 10);
  const selected = items.find((item) => item.id === selectedId) || null;

  return (
    <section className="bi-panel bi-tree-panel" aria-labelledby="bi-tree-title">
      <div className="bi-panel-heading bi-tree-heading">
        <div>
          <span className="bi-kicker"><GitBranch size={15} /> Diagnostic</span>
          <h2 id="bi-tree-title">Décomposer l’indicateur</h2>
          <p>Changez d’axe puis sélectionnez une contribution pour retrouver ses opérations.</p>
        </div>
        <div className="bi-segmented" aria-label="Axe de décomposition">
          {dimensions.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === dimension ? 'is-active' : ''}
              aria-pressed={candidate === dimension}
              onClick={() => onDimensionChange(candidate)}
            >
              {BI_DIMENSION_LABELS[candidate]}
            </button>
          ))}
        </div>
      </div>

      <div className="bi-driver-map" role="tree" aria-label={`Décomposition par ${BI_DIMENSION_LABELS[dimension]}`}>
        <div className="bi-driver-root-wrap">
          <button
            type="button"
            className={`bi-driver-root${selectedId === null ? ' is-selected' : ''}`}
            role="treeitem"
            aria-selected={selectedId === null}
            onClick={() => onSelect(null)}
          >
            <span className="bi-tree-icon"><Layers3 size={20} /></span>
            <span>
              <small>{rootLabels[view]}</small>
              <strong>{formatValue(total, unit)}</strong>
              <em>{items.length} contribution{items.length > 1 ? 's' : ''}</em>
            </span>
          </button>
          <span className="bi-driver-connector" aria-hidden="true"><i /></span>
        </div>

        <ol className="bi-driver-list" role="group">
          {visible.length === 0 ? (
            <li className="bi-tree-empty">Aucune contribution pour la sélection courante.</li>
          ) : (
            visible.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`bi-driver-node${selectedId === item.id ? ' is-selected' : ''}`}
                  role="treeitem"
                  aria-selected={selectedId === item.id}
                  aria-label={`${item.label}, ${formatValue(item.value, unit)}, ${item.share.toFixed(1)} pour cent, ${item.records} opérations`}
                  onClick={() => onSelect(item)}
                >
                  <span className="bi-driver-rank">{String(index + 1).padStart(2, '0')}</span>
                  <span className="bi-driver-label">
                    <strong title={item.label}>{item.label}</strong>
                    <small>{item.records} opération{item.records > 1 ? 's' : ''}</small>
                  </span>
                  <span className="bi-driver-share" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, item.share)}%` }} />
                  </span>
                  <span className="bi-driver-value">
                    <strong>{formatValue(item.value, unit)}</strong>
                    <small>{item.share.toFixed(1).replace('.', ',')} %</small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </li>
            ))
          )}
        </ol>
      </div>

      <div className="bi-driver-footer" aria-live="polite">
        <span>
          {selected
            ? <><strong>{selected.label}</strong> isole {selected.records} opération{selected.records > 1 ? 's' : ''} dans le justificatif.</>
            : <>Sélection complète · {items.length} contribution{items.length > 1 ? 's' : ''}.</>}
        </span>
        {items.length > visible.length && (
          <small>{items.length - visible.length} contribution{items.length - visible.length > 1 ? 's' : ''} supplémentaire{items.length - visible.length > 1 ? 's' : ''} dans les données.</small>
        )}
      </div>
    </section>
  );
}
