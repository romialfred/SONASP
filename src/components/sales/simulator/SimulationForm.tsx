import { useEffect, useState } from 'react';
import { Calculator, Info, RotateCcw } from 'lucide-react';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import type {
  SaleSimulationContext,
  SimulationWeightUnit,
} from '@/services/saleSimulationService';
import { formatNumberFr, parseLocalizedNumber } from './saleSimulationFormatters';

export interface SimulationFormValues {
  quantity: number;
  unit: SimulationWeightUnit;
  referencePriceUsdOz: number;
  counterpartyKey: string;
  settlementCurrency: 'USD';
  premiumDiscountPct: number;
  logisticsCostUsd: number;
  taxRatePct: number;
  valueDate: string;
}

interface LocalizedNumberInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  decimals?: number;
  minimumDecimals?: number;
  allowNegative?: boolean;
  describedBy?: string;
  invalid?: boolean;
}

function LocalizedNumberInput({
  id,
  value,
  onChange,
  disabled,
  readOnly,
  decimals = 2,
  minimumDecimals = decimals,
  allowNegative = false,
  describedBy,
  invalid,
}: LocalizedNumberInputProps) {
  const [raw, setRaw] = useState(() => formatNumberFr(value, decimals, minimumDecimals));
  useEffect(
    () => setRaw(formatNumberFr(value, decimals, minimumDecimals)),
    [value, decimals, minimumDecimals],
  );

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={raw}
      disabled={disabled}
      readOnly={readOnly}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const nextRaw = event.target.value;
        setRaw(nextRaw);
        const parsed = parseLocalizedNumber(nextRaw);
        if (parsed !== null && (allowNegative || parsed >= 0)) onChange(parsed);
      }}
      onBlur={() => setRaw(formatNumberFr(value, decimals, minimumDecimals))}
    />
  );
}

interface SimulationFormProps {
  context: SaleSimulationContext;
  values: SimulationFormValues;
  errors: Partial<Record<keyof SimulationFormValues | 'form', string>>;
  canEditReferencePrice: boolean;
  submitting: boolean;
  completed: boolean;
  onChange: (values: SimulationFormValues) => void;
  onReset: () => void;
  onSubmit: () => void;
}

export function SimulationForm({
  context,
  values,
  errors,
  canEditReferencePrice,
  submitting,
  completed,
  onChange,
  onReset,
  onSubmit,
}: SimulationFormProps) {
  const maxQuantity = values.unit === 'oz'
    ? context.availableStockOz
    : context.availableStockOz * TROY_OZ_GRAMS;
  const percentage = maxQuantity > 0 ? Math.min(100, values.quantity / maxQuantity * 100) : 0;
  const set = <K extends keyof SimulationFormValues>(key: K, value: SimulationFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };
  const errorId = (field: keyof SimulationFormValues) => errors[field] ? `${String(field)}-error` : undefined;

  return (
    <section className="sale-simulator__panel sale-simulator__form-panel" aria-labelledby="simulation-form-title">
      <header className="sale-simulator__panel-header">
        <h2 id="simulation-form-title">Paramètres de la simulation</h2>
        <ol className="sale-simulator__steps" aria-label="Progression de la simulation">
          <li className={completed ? 'is-complete' : 'is-active'}><span>1</span> Paramètres</li>
          <li aria-hidden="true" className="sale-simulator__step-line" />
          <li className={completed ? 'is-active' : ''}><span>2</span> Résultats</li>
        </ol>
      </header>

      <div className="sale-simulator__fields">
        <div className="sale-simulator__field sale-simulator__quantity-field">
          <label htmlFor="simulation-quantity">Quantité à vendre</label>
          <div className="sale-simulator__input-affix sale-simulator__input-affix--select">
            <LocalizedNumberInput
              id="simulation-quantity"
              value={values.quantity}
              onChange={(value) => set('quantity', value)}
              decimals={values.unit === 'oz' ? 3 : 2}
              minimumDecimals={2}
              describedBy={errorId('quantity') || 'simulation-quantity-help'}
              invalid={Boolean(errors.quantity)}
            />
            <select
              aria-label="Unité de la quantité"
              value={values.unit}
              onChange={(event) => {
                const unit = event.target.value as SimulationWeightUnit;
                const quantity = unit === 'g'
                  ? values.quantity * TROY_OZ_GRAMS
                  : values.quantity / TROY_OZ_GRAMS;
                onChange({ ...values, unit, quantity });
              }}
            >
              <option value="oz">oz</option>
              <option value="g">g</option>
            </select>
          </div>
          <input
            className="sale-simulator__range"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={percentage}
            aria-label="Pourcentage du stock à vendre"
            onChange={(event) => set('quantity', maxQuantity * Number(event.target.value) / 100)}
          />
          <p id="simulation-quantity-help" className="sale-simulator__field-help">
            {formatNumberFr(percentage, 1, 1)} % du stock disponible
          </p>
          {errors.quantity && <p id="quantity-error" className="sale-simulator__field-error" role="alert">{errors.quantity}</p>}
        </div>

        <div className="sale-simulator__field">
          <label htmlFor="simulation-reference-price">Prix de référence</label>
          <div className="sale-simulator__input-affix">
            <LocalizedNumberInput
              id="simulation-reference-price"
              value={values.referencePriceUsdOz}
              onChange={(value) => set('referencePriceUsdOz', value)}
              readOnly={!canEditReferencePrice}
              describedBy={errorId('referencePriceUsdOz')}
              invalid={Boolean(errors.referencePriceUsdOz)}
            />
            <span>USD/oz</span>
          </div>
          {errors.referencePriceUsdOz && <p id="referencePriceUsdOz-error" className="sale-simulator__field-error" role="alert">{errors.referencePriceUsdOz}</p>}
        </div>

        <div className="sale-simulator__field">
          <label htmlFor="simulation-counterparty">Acheteur / Raffineur</label>
          <select
            id="simulation-counterparty"
            value={values.counterpartyKey}
            aria-invalid={Boolean(errors.counterpartyKey) || undefined}
            aria-describedby={errorId('counterpartyKey')}
            onChange={(event) => set('counterpartyKey', event.target.value)}
          >
            <option value="">Sélectionner une contrepartie</option>
            {context.counterparties.map((counterparty) => (
              <option key={counterparty.key} value={counterparty.key}>
                {counterparty.name}{counterparty.detail ? ` — ${counterparty.detail}` : ''}
              </option>
            ))}
          </select>
          {context.counterparties.length === 0 && <p className="sale-simulator__field-error" role="status">Aucun acheteur ou raffineur habilité n’est disponible.</p>}
          {errors.counterpartyKey && <p id="counterpartyKey-error" className="sale-simulator__field-error" role="alert">{errors.counterpartyKey}</p>}
        </div>

        <div className="sale-simulator__field">
          <label htmlFor="simulation-currency">Devise de règlement</label>
          <select id="simulation-currency" value={values.settlementCurrency} disabled>
            <option value="USD">USD — Dollar des États-Unis</option>
          </select>
        </div>

        <div className="sale-simulator__field">
          <label htmlFor="simulation-premium">Prime / Décote</label>
          <div className="sale-simulator__input-affix">
            <LocalizedNumberInput
              id="simulation-premium"
              value={values.premiumDiscountPct}
              onChange={(value) => set('premiumDiscountPct', value)}
              allowNegative
              describedBy={errorId('premiumDiscountPct')}
              invalid={Boolean(errors.premiumDiscountPct)}
            />
            <span>%</span>
          </div>
          {errors.premiumDiscountPct && <p id="premiumDiscountPct-error" className="sale-simulator__field-error" role="alert">{errors.premiumDiscountPct}</p>}
        </div>

        <div className="sale-simulator__field">
          <label htmlFor="simulation-logistics">Frais logistiques</label>
          <div className="sale-simulator__input-affix">
            <LocalizedNumberInput
              id="simulation-logistics"
              value={values.logisticsCostUsd}
              onChange={(value) => set('logisticsCostUsd', value)}
              decimals={0}
              describedBy={errorId('logisticsCostUsd')}
              invalid={Boolean(errors.logisticsCostUsd)}
            />
            <span>USD</span>
          </div>
          {errors.logisticsCostUsd && <p id="logisticsCostUsd-error" className="sale-simulator__field-error" role="alert">{errors.logisticsCostUsd}</p>}
        </div>

        <div className="sale-simulator__field">
          <label htmlFor="simulation-taxes">Taxes et prélèvements</label>
          <div className="sale-simulator__input-affix">
            <LocalizedNumberInput
              id="simulation-taxes"
              value={values.taxRatePct}
              onChange={(value) => set('taxRatePct', value)}
              describedBy={errorId('taxRatePct') || 'simulation-tax-help'}
              invalid={Boolean(errors.taxRatePct)}
            />
            <span>%</span>
          </div>
          <p id="simulation-tax-help" className="sale-simulator__field-help">
            {context.taxRulesAvailable ? 'Taux suggéré par le référentiel fiscal applicable.' : 'Aucun taux n’a pu être appliqué automatiquement.'}
          </p>
          {errors.taxRatePct && <p id="taxRatePct-error" className="sale-simulator__field-error" role="alert">{errors.taxRatePct}</p>}
        </div>

        <div className="sale-simulator__field">
          <label htmlFor="simulation-value-date">Date de valeur</label>
          <input
            id="simulation-value-date"
            type="date"
            value={values.valueDate}
            min={new Date().toISOString().slice(0, 10)}
            aria-invalid={Boolean(errors.valueDate) || undefined}
            aria-describedby={errorId('valueDate')}
            onChange={(event) => set('valueDate', event.target.value)}
          />
          {errors.valueDate && <p id="valueDate-error" className="sale-simulator__field-error" role="alert">{errors.valueDate}</p>}
        </div>
      </div>

      <div className="sale-simulator__notice">
        <Info aria-hidden="true" />
        <p>Le prix final sera recalculé à partir du cours de référence, de la prime ou décote et du taux de change en vigueur.</p>
      </div>

      {errors.form && <p className="sale-simulator__form-error" role="alert">{errors.form}</p>}

      <footer className="sale-simulator__form-actions">
        <button type="button" className="sale-simulator__button sale-simulator__button--secondary" onClick={onReset} disabled={submitting}>
          <RotateCcw aria-hidden="true" /> Réinitialiser
        </button>
        <button type="button" className="sale-simulator__button sale-simulator__button--primary" onClick={onSubmit} disabled={submitting || context.counterparties.length === 0} aria-busy={submitting}>
          <Calculator aria-hidden="true" /> {submitting ? 'Simulation en cours…' : 'Lancer la simulation'}
        </button>
      </footer>
    </section>
  );
}
