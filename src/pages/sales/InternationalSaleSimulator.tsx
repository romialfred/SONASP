import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, PlusCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LiveGoldMarketPanel } from '@/components/sales/LiveGoldMarketPanel';
import { SaleJourney } from '@/components/sales/simulator/SaleJourney';
import { SimulationForm, type SimulationFormValues } from '@/components/sales/simulator/SimulationForm';
import { SimulationKpis } from '@/components/sales/simulator/SimulationKpis';
import { SimulationSummary } from '@/components/sales/simulator/SimulationSummary';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { CAPABILITIES, hasCapability } from '@/lib/capabilities';
import {
  calculateSaleSimulation,
  exportSaleSimulationCsv,
  loadSaleSimulationContext,
  saveSaleSimulation,
  toTroyOunces,
  type SaleSimulationContext,
  type SaleSimulationInputs,
  type SaleSimulationResult,
  type SaveSaleSimulationCommand,
  type SavedSaleSimulation,
} from '@/services/saleSimulationService';
import './international-sale-simulator.css';

type FormErrors = Partial<Record<keyof SimulationFormValues | 'form', string>>;

const today = () => new Date().toISOString().slice(0, 10);

function initialValues(context: SaleSimulationContext): SimulationFormValues {
  return {
    quantity: context.availableStockOz > 0 ? context.availableStockOz * 0.15 : 0,
    unit: 'oz',
    referencePriceUsdOz: context.goldPrice?.price ?? 0,
    counterpartyKey: context.counterparties[0]?.key ?? '',
    settlementCurrency: 'USD',
    premiumDiscountPct: 0,
    logisticsCostUsd: 0,
    taxRatePct: context.suggestedTaxRatePct ?? 0,
    valueDate: today(),
  };
}
function validate(values: SimulationFormValues, context: SaleSimulationContext): FormErrors {
  const errors: FormErrors = {};
  let quantityOz = 0;
  try {
    quantityOz = toTroyOunces(values.quantity, values.unit);
  } catch (error) {
    errors.quantity = error instanceof Error ? error.message : 'Quantité invalide.';
  }
  if (quantityOz > context.availableStockOz + 0.000001) errors.quantity = 'La quantité dépasse le stock exportable disponible.';
  if (!values.counterpartyKey) errors.counterpartyKey = 'Sélectionnez un acheteur ou un raffineur habilité.';
  if (values.referencePriceUsdOz <= 0) errors.referencePriceUsdOz = 'Le cours de référence est obligatoire.';
  if (values.logisticsCostUsd < 0) errors.logisticsCostUsd = 'Les frais ne peuvent pas être négatifs.';
  if (values.taxRatePct < 0 || values.taxRatePct > 100) errors.taxRatePct = 'Le taux doit être compris entre 0 et 100 %.';
  if (!values.valueDate) errors.valueDate = 'La date de valeur est obligatoire.';
  if (!context.usdXofRate) errors.form = 'Le taux USD/XOF est indisponible. La simulation ne peut pas être fiabilisée.';
  if (!context.goldPrice) errors.form = 'Le cours de l’or est indisponible. La simulation ne peut pas être lancée.';
  return errors;
}

export function InternationalSaleSimulator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const alert = useAlert();
  const [context, setContext] = useState<SaleSimulationContext | null>(null);
  const [values, setValues] = useState<SimulationFormValues | null>(null);
  const [result, setResult] = useState<SaleSimulationResult | null>(null);
  const [saved, setSaved] = useState<SavedSaleSimulation | null>(null);
  const [lastCommand, setLastCommand] = useState<SaveSaleSimulationCommand | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const nextContext = await loadSaleSimulationContext(user);
      setContext(nextContext);
      setValues(initialValues(nextContext));
      setResult(null);
      setSaved(null);
      setLastCommand(null);
      setErrors({});
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Le contexte de simulation est indisponible.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const canEditReferencePrice = useMemo(
    () => hasCapability(user, CAPABILITIES.REFERENTIALS_MANAGE),
    [user],
  );

  const reset = () => {
    if (!context) return;
    setValues(initialValues(context));
    setResult(null);
    setSaved(null);
    setLastCommand(null);
    setErrors({});
  };

  const runSimulation = async () => {
    if (!context || !values) return;
    const nextErrors = validate(values, context);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const counterparty = context.counterparties.find((entry) => entry.key === values.counterpartyKey);
    if (!counterparty || !context.usdXofRate) return;

    setSubmitting(true);
    setErrors({});
    try {
      const inputs: SaleSimulationInputs = {
        quantity: values.quantity,
        unit: values.unit,
        referencePriceUsdOz: values.referencePriceUsdOz,
        usdXofRate: context.usdXofRate,
        premiumDiscountPct: values.premiumDiscountPct,
        logisticsCostUsd: values.logisticsCostUsd,
        taxRatePct: values.taxRatePct,
      };
      const nextResult = calculateSaleSimulation(inputs);
      const command: SaveSaleSimulationCommand = {
        context,
        inputs,
        result: nextResult,
        counterparty,
        valueDate: values.valueDate,
        settlementCurrency: values.settlementCurrency,
      };
      setResult(nextResult);
      setLastCommand(command);
      try {
        const persisted = await saveSaleSimulation(command);
        setSaved(persisted);
        alert.success(`Simulation ${persisted.simulation_reference} enregistrée.`);
      } catch (saveError) {
        setSaved(null);
        setErrors({ form: 'Le résultat est calculé, mais son enregistrement dans l’historique a échoué. Réessayez avant de l’utiliser.' });
        console.error('[Simulation] Historisation impossible', saveError);
      }
    } catch (error) {
      setResult(null);
      setErrors({ form: error instanceof Error ? error.message : 'Le calcul n’a pas pu être exécuté.' });
    } finally {
      setSubmitting(false);
    }
  };

  const exportScenario = async () => {
    if (!lastCommand || !result) return;
    setExporting(true);
    try {
      exportSaleSimulationCsv(saved, lastCommand);
      alert.success('Le scénario a été exporté au format CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <MainLayout>
      <main className="sn-page sale-simulator" id="main-content">
        <header className="sale-simulator__page-header">
          <div>
            <nav aria-label="Fil d’Ariane"><span>Vente internationale</span><span aria-hidden="true">/</span><strong>Simulateur</strong></nav>
            <h1>Simulation de vente internationale</h1>
            <p>Évaluez la rentabilité d’une opération avant sa validation</p>
          </div>
          <div className="sale-simulator__header-actions">
            <button type="button" className="sale-simulator__button sale-simulator__button--secondary" onClick={() => navigate('/sales/simulations')}>
              <Archive aria-hidden="true" /> Historique des simulations
            </button>
            <button type="button" className="sale-simulator__button sale-simulator__button--primary" onClick={reset} disabled={!context}>
              <PlusCircle aria-hidden="true" /> Nouvelle simulation
            </button>
          </div>
        </header>

        {loading && (
          <section className="sale-simulator__loading" role="status" aria-label="Chargement du simulateur">
            {[0, 1, 2, 3].map((item) => <span key={item} />)}
          </section>
        )}

        {!loading && loadError && (
          <section className="sale-simulator__load-error" role="alert">
            <div><strong>Le simulateur n’a pas pu être initialisé.</strong><p>{loadError}</p></div>
            <button type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Réessayer</button>
          </section>
        )}

        {!loading && context && values && (
          <>
            <SimulationKpis context={context} />
            <div className="sale-simulator__workspace">
              <SimulationForm
                context={context}
                values={values}
                errors={errors}
                canEditReferencePrice={canEditReferencePrice}
                submitting={submitting}
                completed={Boolean(result)}
                onChange={(nextValues) => {
                  setValues(nextValues);
                  setErrors({});
                }}
                onReset={reset}
                onSubmit={() => void runSimulation()}
              />
              <SimulationSummary result={result} exporting={exporting} onExport={() => void exportScenario()} />
            </div>
            <SaleJourney />
            <LiveGoldMarketPanel initialGoldPrice={context.goldPrice} />
          </>
        )}
      </main>
    </MainLayout>
  );
}
