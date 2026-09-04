import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, Calculator, Check, CheckCircle2, Clock3, ExternalLink,
  FileCheck2, FileText, Landmark, LockKeyhole, PackageCheck, Save, Search,
  Send, ShieldCheck, WalletCards,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { supabase } from '@/lib/supabase';
import {
  checkSaleAuthorization, getAuthorizedCustomersForMine, type AuthorizedCustomer,
} from '@/services/goldSalesSettingsService';
import { getApprovedRefineries, type PricingMechanism } from '@/services/goldTradeSpaceService';
import { mineStockService, type MineExportableStock } from '@/services/mineStockService';
import {
  calculateSaleCreationSummary, loadCustomerSaleContext, loadSaleMarketContext,
  normalizeSaleWorkspaceError, quantityToOunces, saveSaleDraft, submitSaleDraft,
  validateSaleCreationInputs, type CustomerContractContext, type CustomerSaleContext,
  type GoldPricePoint, type SaleCreationInputs, type SaleCreationSummary,
  type SaleDraftRecord, type SaleFixingMethod, type SaleMarketContext, type SaleWeightUnit,
} from '@/services/saleCreationWorkspaceService';
import { stockSonaspService, type StockSonasp } from '@/services/stockSonaspService';
import {
  composer, messageIndisponibiliteLots, tracabiliteVenteService, validerComposition,
  type LotsVenteDisponibles,
} from '@/services/tracabiliteVenteService';
import './sale-create.css';

interface SellerContext {
  id: string;
  name: string;
  abbreviation: string | null;
  country: string;
  companyType: string;
}

interface RefineryOption { id: string; name: string; location: string }

interface SaleFormState {
  customerId: string;
  quantity: string;
  unit: SaleWeightUnit;
  proposedPrice: string;
  fixingDate: string;
  settlementCurrency: 'USD';
  freightCost: string;
  otherCosts: string;
  fixingMethod: SaleFixingMethod;
  paymentTermDays: string;
  customerContractId: string;
  inProcessRefineryId: string;
}

type FormErrors = Partial<Record<keyof SaleCreationInputs | 'form', string>>;

const numberValue = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const money = (value: number | null, currency = 'USD', digits = 2) => value === null
  ? '—'
  : new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);

const number = (value: number | null, digits = 2) => value === null
  ? '—'
  : new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);

const initials = (name: string) => name.split(/\s+/u).filter(Boolean).slice(0, 2)
  .map((part) => part[0]?.toUpperCase()).join('');

const validFixingMethod = (value: unknown): SaleFixingMethod => (
  value === 'forward' || value === 'in_process' ? value : 'spot'
);

function parsePaymentDays(value: string | null | undefined) {
  const match = value?.match(/\d+/u);
  return match ? Math.min(365, Number(match[0])) : null;
}

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Une erreur inattendue est survenue.';
}

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function Field({ label, controlId, error, help, wide = false, children }: {
  label: string; controlId: string; error?: string; help?: string; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`sale-create__field${wide ? ' sale-create__field--wide' : ''}`}>
      <label htmlFor={controlId}>{label}</label>
      {children}
      {error ? <p className="sale-create__error" role="alert">{error}</p> : help ? <p className="sale-create__help">{help}</p> : null}
    </div>
  );
}

function CreationStepper({ activeStep }: { activeStep: number }) {
  const steps = [
    ['Client', 'seller-client'], ['Conditions de vente', 'sale-conditions'],
    ['Analyse du prix', 'price-analysis'], ['Validation', 'sale-actions'],
  ];
  return (
    <nav className="sale-create__stepper" aria-label="Étapes de création de la vente">
      <ol>{steps.map(([label, target], index) => {
        const step = index + 1;
        const state = step < activeStep ? 'is-complete' : step === activeStep ? 'is-current' : '';
        return <li key={label}><button type="button" className={state} aria-current={step === activeStep ? 'step' : undefined}
          onClick={() => scrollToSection(target)}>
          <span>{step < activeStep ? <Check aria-hidden="true" size={13} /> : step}</span>{label}
        </button></li>;
      })}</ol>
    </nav>
  );
}

function CustomerContextPanel({ context, loading, selectedSetting, selectedContract }: {
  context: CustomerSaleContext | null;
  loading: boolean;
  selectedSetting: AuthorizedCustomer | null;
  selectedContract: CustomerContractContext | null;
}) {
  if (loading) return <aside className="sale-create__panel sale-create__client-loading" aria-label="Chargement du contexte client"><span aria-hidden="true" /><p>Chargement du contexte client…</p></aside>;
  if (!context) return <aside className="sale-create__panel sale-create__client-empty"><div><Building2 aria-hidden="true" size={32} /><p>Sélectionnez un client autorisé pour afficher son contexte commercial et financier.</p></div></aside>;
  const performance = context.performance;
  const contract = selectedContract ?? context.contracts[0] ?? null;
  return (
    <aside className="sale-create__panel" aria-label={`Contexte du client ${context.name}`}>
      <div className="sale-create__client-head">
        <div className="sale-create__avatar" aria-hidden="true">{initials(context.name)}</div>
        <div><h2>{context.name}</h2><p>{context.country}</p><span className="sale-create__badge"><CheckCircle2 aria-hidden="true" size={10} />{context.isActive ? 'Client actif' : 'Client inactif'}</span></div>
        <Link to={`/customers/${context.id}`}>Voir la fiche <ExternalLink aria-hidden="true" size={11} /></Link>
      </div>
      <section className="sale-create__context-section">
        <h3>Performance commerciale confirmée</h3>
        <div className="sale-create__metrics">
          <div className="sale-create__metric"><span>Quantité déjà vendue</span><strong>{number(performance.confirmedQuantityOz, 3)} oz</strong></div>
          <div className="sale-create__metric"><span>Prix moyen pondéré</span><strong>{money(performance.weightedAveragePriceUsdOz)}/oz</strong></div>
          <div className="sale-create__metric"><span>Montant encaissé</span><strong>{money(performance.confirmedPaymentsUsd)}</strong></div>
          <div className="sale-create__metric"><span>Ventes réalisées</span><strong>{performance.confirmedSalesCount}</strong></div>
        </div>
      </section>
      <section className="sale-create__context-section">
        <h3>Conditions contractuelles</h3>
        {contract ? <dl className="sale-create__definition">
          <div><dt>Contrat actif</dt><dd>{contract.contractNumber}</dd></div>
          <div><dt>Modèle de prix</dt><dd>{contract.pricingModel}{contract.priceAdjustmentPct !== null ? ` · ${number(contract.priceAdjustmentPct, 2)} %` : ''}</dd></div>
          <div><dt>Plafond par commande</dt><dd>{contract.maximumOrderOz === null ? 'Non défini' : `${number(contract.maximumOrderOz, 3)} oz`}</dd></div>
          <div><dt>Conditions de paiement</dt><dd>{contract.paymentTerms}</dd></div>
          <div><dt>Responsable des frais</dt><dd>Transport : {selectedSetting?.transport_fees_paid_by_customer ? 'Client' : 'Vendeur'} · Raffinage : {selectedSetting?.refining_fees_paid_by_customer ? 'Client' : 'Vendeur'}</dd></div>
        </dl> : <p className="sale-create__help">Aucun contrat client actif n’est visible. Les règles d’autorisation du vendeur restent applicables.</p>}
      </section>
      <section className="sale-create__context-section">
        <h3>Performance de paiement</h3>
        <div className="sale-create__performance"><div><strong>{performance.onTimePaymentPct === null ? 'Non mesurée' : `${number(performance.onTimePaymentPct, 1)} % à l’échéance`}</strong><p>Calcul fondé uniquement sur les paiements réels approuvés.</p></div><WalletCards aria-hidden="true" size={28} /></div>
        <dl className="sale-create__definition">
          <div><dt>Retard moyen</dt><dd>{performance.averagePaymentDelayDays === null ? '—' : `${number(performance.averagePaymentDelayDays, 1)} jour(s)`}</dd></div>
          <div><dt>Encours confirmé</dt><dd>{money(performance.outstandingUsd)}</dd></div>
          <div><dt>Contrôle du risque</dt><dd>{performance.riskLabel}</dd></div>
        </dl>
        <div className="sale-create__risk"><ShieldCheck aria-hidden="true" /><span>{performance.riskReason}</span></div>
      </section>
    </aside>
  );
}

function PriceChart({ history }: { history: GoldPricePoint[] }) {
  if (history.length < 2) return <div className="sale-create__chart"><p className="sale-create__help">Historique insuffisant pour tracer une courbe fiable.</p></div>;
  const prices = history.map((point) => point.priceUsdOz);
  const min = Math.min(...prices); const max = Math.max(...prices); const span = Math.max(1, max - min);
  const points = history.map((point, index) => `${index / (history.length - 1) * 100},${95 - (point.priceUsdOz - min) / span * 80}`).join(' ');
  return <figure className="sale-create__chart"><svg viewBox="0 0 100 105" preserveAspectRatio="none" role="img" aria-label="Évolution récente du cours de l’or en dollars par once">
    <line className="sale-create__chart-axis" x1="0" y1="100" x2="100" y2="100" /><line className="sale-create__chart-axis" x1="0" y1="55" x2="100" y2="55" />
    <polygon className="sale-create__chart-area" points={`0,100 ${points} 100,100`} /><polyline className="sale-create__chart-line" points={points} />
  </svg><figcaption><span>{history[0]?.date}</span><strong>{number(history.at(-1)?.priceUsdOz ?? null, 2)} USD/oz</strong><span>{history.at(-1)?.date}</span></figcaption></figure>;
}

function PriceAnalysisPanel({ market, proposedPrice, analyzed }: { market: SaleMarketContext | null; proposedPrice: number; analyzed: boolean }) {
  const delta = market?.spotPriceUsdOz && Number.isFinite(proposedPrice) ? proposedPrice - market.spotPriceUsdOz : null;
  const deltaPct = delta !== null && market?.spotPriceUsdOz ? delta / market.spotPriceUsdOz * 100 : null;
  return <section id="price-analysis" className="sale-create__panel sale-create__analysis" aria-labelledby="price-analysis-title">
    <div className="sale-create__analysis-head"><div><h2 id="price-analysis-title">Analyse du cours et projection</h2><p>Comparaison du prix proposé avec le référentiel de marché disponible.</p></div><span className="sale-create__source"><Clock3 aria-hidden="true" size={13} />{market?.goldPriceUpdatedAt ? `Cours horodaté le ${new Date(market.goldPriceUpdatedAt).toLocaleString('fr-FR')}` : 'Cours indisponible'}</span></div>
    <div className="sale-create__analysis-grid">
      <PriceChart history={market?.history ?? []} />
      <div className="sale-create__price-card"><span>Clôture précédente</span><strong>{money(market?.previousCloseUsdOz ?? null)}</strong><small>Réel · USD/oz</small></div>
      <div className="sale-create__price-card is-current"><span>Cours de référence</span><strong>{money(market?.spotPriceUsdOz ?? null)}</strong><small>{market?.goldPriceSource ?? 'Source indisponible'}</small></div>
      <div className="sale-create__price-card is-unavailable"><span>J+7 / J+14</span><strong>Projection indisponible</strong><small>Aucun moteur validé</small></div>
      <div className="sale-create__price-card is-unavailable"><span>J+30</span><strong>Projection indisponible</strong><small>Aucune valeur inventée</small></div>
    </div>
    <div className="sale-create__delta" aria-live="polite"><span>Prix proposé : <strong>{Number.isFinite(proposedPrice) ? `${money(proposedPrice)}/oz` : '—'}</strong></span><span>Écart au cours : <strong>{delta === null ? '—' : `${delta >= 0 ? '+' : ''}${money(delta)} (${deltaPct && deltaPct >= 0 ? '+' : ''}${number(deltaPct, 2)} %)`}</strong></span><span>{analyzed ? 'Analyse actualisée' : 'Analyse à actualiser'}</span></div>
    {market && market.history.length > 0 && <details className="sale-create__history"><summary>Afficher les valeurs textuelles de l’historique</summary><table><thead><tr><th>Date</th><th>Cours (USD/oz)</th><th>Source</th></tr></thead><tbody>{market.history.map((point) => <tr key={`${point.date}-${point.priceUsdOz}`}><td>{point.date}</td><td>{number(point.priceUsdOz, 2)}</td><td>{point.source ?? 'Référentiel SONASP'}</td></tr>)}</tbody></table></details>}
  </section>;
}

export function SaleCreate() {
  const { user } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const alert = useAlert();
  const navigationState = location.state as { mechanismData?: PricingMechanism; quantityOz?: number; preselectedCustomerId?: string; preselectedRefineryId?: string } | null;
  const mechanismData = navigationState?.mechanismData;
  const [form, setForm] = useState<SaleFormState>({
    customerId: navigationState?.preselectedCustomerId ?? '', quantity: navigationState?.quantityOz ? String(navigationState.quantityOz) : '', unit: 'oz',
    proposedPrice: mechanismData?.pricePerOz ? String(mechanismData.pricePerOz) : '', fixingDate: new Date().toISOString().slice(0, 10), settlementCurrency: 'USD',
    freightCost: '', otherCosts: '', fixingMethod: validFixingMethod(mechanismData?.mechanism), paymentTermDays: mechanismData?.settlementDays ? String(mechanismData.settlementDays) : '15',
    customerContractId: '', inProcessRefineryId: navigationState?.preselectedRefineryId ?? '',
  });
  const [seller, setSeller] = useState<SellerContext | null>(null);
  const [authorizedCustomers, setAuthorizedCustomers] = useState<AuthorizedCustomer[]>([]);
  const [availableStockOz, setAvailableStockOz] = useState(0);
  const [saleEligibility, setSaleEligibility] = useState<LotsVenteDisponibles | null>(null);
  const [stockExport, setStockExport] = useState<StockSonasp | null>(null);
  const [mineStock, setMineStock] = useState<MineExportableStock | null>(null);
  const [market, setMarket] = useState<SaleMarketContext | null>(null);
  const [refineries, setRefineries] = useState<RefineryOption[]>([]);
  const [customerContext, setCustomerContext] = useState<CustomerSaleContext | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<SaleDraftRecord | null>(null); const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [dirty, setDirty] = useState(false); const [analyzedSignature, setAnalyzedSignature] = useState<string | null>(null);
  const isMineAccount = Boolean(user?.mining_company_id);
  const selectedSetting = useMemo(() => authorizedCustomers.find((customer) => customer.customer_id === form.customerId) ?? null, [authorizedCustomers, form.customerId]);
  const selectedContract = useMemo(() => customerContext?.contracts.find((contract) => contract.id === form.customerContractId) ?? null, [customerContext, form.customerContractId]);
  const filteredCustomers = useMemo(() => { const query = customerSearch.trim().toLocaleLowerCase('fr'); return authorizedCustomers.filter((customer) => !query || customer.customer_name.toLocaleLowerCase('fr').includes(query)); }, [authorizedCustomers, customerSearch]);
  const inputs = useMemo<SaleCreationInputs>(() => ({
    customerId: form.customerId, sellerId: seller?.id ?? '', quantity: numberValue(form.quantity), unit: form.unit,
    proposedPriceUsdOz: numberValue(form.proposedPrice), fixingDate: form.fixingDate, settlementCurrency: form.settlementCurrency,
    freightCostUsd: form.freightCost ? numberValue(form.freightCost) : 0, otherCostsUsd: form.otherCosts ? numberValue(form.otherCosts) : 0,
    fixingMethod: form.fixingMethod, paymentTermDays: numberValue(form.paymentTermDays), customerContractId: form.customerContractId || null,
    inProcessRefineryId: form.inProcessRefineryId || null,
  }), [form, seller?.id]);
  const signature = JSON.stringify(inputs); const analyzed = analyzedSignature === signature;
  const summary = useMemo<SaleCreationSummary | null>(() => {
    if (market?.royaltyRatePct === null || market?.royaltyRatePct === undefined || !market.usdXofRate) return null;
    try { return calculateSaleCreationSummary(inputs, market.royaltyRatePct, market.usdXofRate); } catch { return null; }
  }, [inputs, market]);

  useEffect(() => {
    if (!user) return; let active = true;
    const load = async () => {
      setLoading(true); setLoadError(null);
      try {
        const sellerQuery = user.mining_company_id
          ? supabase.from('mining_companies').select('id,name,abbreviation,country,company_type').eq('id', user.mining_company_id).eq('is_active', true).maybeSingle()
          : supabase.from('mining_companies').select('id,name,abbreviation,country,company_type').eq('code', 'SONASP').eq('company_type', 'institution').eq('is_active', true).maybeSingle();
        const [sellerResult, marketContext, refineryResult] = await Promise.all([sellerQuery, loadSaleMarketContext(), getApprovedRefineries()]);
        if (sellerResult.error) throw sellerResult.error; if (!sellerResult.data) throw new Error('Le vendeur rattaché au compte est indisponible.');
        const sellerData: SellerContext = { id: sellerResult.data.id, name: sellerResult.data.name, abbreviation: sellerResult.data.abbreviation, country: sellerResult.data.country, companyType: sellerResult.data.company_type };
        const [customersResult, inventoryResult] = await Promise.all([
          getAuthorizedCustomersForMine(sellerData.id), user.mining_company_id
            ? mineStockService.stock(sellerData.id)
            : Promise.all([tracabiliteVenteService.lotsDisponibles(), stockSonaspService.stock(sellerData.id).catch(() => null)]),
        ]);
        if (!customersResult.success) throw new Error(customersResult.error?.message ?? 'Les clients autorisés sont indisponibles.'); if (!active) return;
        setSeller(sellerData); setMarket(marketContext); setAuthorizedCustomers(customersResult.data);
        setRefineries(refineryResult.success ? (refineryResult.data ?? []).map((refinery) => ({ id: refinery.id, name: refinery.refinery_name, location: refinery.refinery_location })) : []);
        if (user.mining_company_id) { const stock = inventoryResult as MineExportableStock; setMineStock(stock); setAvailableStockOz(stock.availableOz); }
        else { const [eligibility, stock] = inventoryResult as [LotsVenteDisponibles, StockSonasp | null]; setSaleEligibility(eligibility); setStockExport(stock); setAvailableStockOz(eligibility.lots.reduce((total, lot) => total + lot.disponibleOz, 0)); }
        if (!form.proposedPrice && marketContext.spotPriceUsdOz) setForm((current) => ({ ...current, proposedPrice: String(marketContext.spotPriceUsdOz) }));
      } catch (error) { if (active) setLoadError(errorText(error)); } finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [user?.id, user?.mining_company_id]);

  useEffect(() => {
    if (!form.customerId) { setCustomerContext(null); return; } let active = true; setCustomerLoading(true); setCustomerContext(null);
    void loadCustomerSaleContext(form.customerId).then((context) => {
      if (!active) return; setCustomerContext(context); const firstContract = context.contracts[0] ?? null;
      setForm((current) => { const paymentDays = parsePaymentDays(firstContract?.paymentTerms ?? context.paymentTerms); return { ...current, customerContractId: firstContract?.id ?? '', paymentTermDays: paymentDays === null ? current.paymentTermDays : String(paymentDays) }; });
    }).catch((error) => { if (active) setErrors((current) => ({ ...current, form: `Contexte client indisponible : ${errorText(error)}` })); })
      .finally(() => { if (active) setCustomerLoading(false); });
    return () => { active = false; };
  }, [form.customerId]);

  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, [dirty]);

  const setField = <K extends keyof SaleFormState>(field: K, value: SaleFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined, form: undefined })); setDirty(true); setAnalyzedSignature(null);
  };

  const validateCurrent = () => {
    const next: FormErrors = validateSaleCreationInputs(inputs, availableStockOz, selectedContract);
    if (selectedSetting && Number.isFinite(inputs.quantity) && inputs.quantity > 0) {
      const settingLimit = availableStockOz * selectedSetting.max_stock_percentage / 100;
      if (quantityToOunces(inputs.quantity, inputs.unit) > settingLimit + 0.000001) next.quantity = `La règle d’autorisation limite ce client à ${number(settingLimit, 3)} oz (${number(selectedSetting.max_stock_percentage, 2)} % du stock).`;
    }
    if (!customerContext?.isActive && inputs.customerId) next.customerId = 'Le client sélectionné n’est plus actif.';
    if (!market?.usdXofRate) next.form = 'Le taux USD/XOF est indisponible : les montants locaux ne peuvent pas être fiabilisés.';
    if (market?.royaltyRatePct === null || market?.royaltyRatePct === undefined) next.form = 'La règle de redevance est indisponible : la vente ne peut pas être calculée.';
    if (!summary && !next.form) next.form = 'Les paramètres financiers ne permettent pas de calculer un produit net positif.';
    setErrors(next); return Object.keys(next).length === 0;
  };

  const analyzeSale = async () => {
    if (!validateCurrent() || !seller) return;
    try {
      const authorization = await checkSaleAuthorization(seller.id, inputs.customerId, quantityToOunces(inputs.quantity, inputs.unit), availableStockOz);
      if (!authorization.success || !authorization.data?.is_authorized) { setErrors({ form: authorization.data?.reason || 'La règle d’autorisation du client refuse cette quantité.' }); return; }
      setAnalyzedSignature(signature); window.setTimeout(() => scrollToSection('price-analysis'), 0);
    } catch (error) { setErrors({ form: normalizeSaleWorkspaceError(error).message }); }
  };

  const snapshot = () => ({ capturedAt: new Date().toISOString(), seller: seller ? { id: seller.id, name: seller.name, country: seller.country } : null,
    customer: customerContext, authorization: selectedSetting, contract: selectedContract, stockAvailableOz: availableStockOz,
    physicalEligibility: saleEligibility?.diagnostic ?? null, market: market ? { spotPriceUsdOz: market.spotPriceUsdOz, previousCloseUsdOz: market.previousCloseUsdOz,
      goldPriceSource: market.goldPriceSource, goldPriceUpdatedAt: market.goldPriceUpdatedAt, usdXofRate: market.usdXofRate, fxSource: market.fxSource,
      fxRateDate: market.fxRateDate, royaltyRatePct: market.royaltyRatePct, projectionMethod: 'unavailable' } : null, calculation: summary });

  const persistDraft = async (notify: boolean) => {
    if (!validateCurrent()) return null; setSaving(true);
    try {
      const saved = await saveSaleDraft({ draftId: draft?.id ?? null, expectedVersion: draft?.version ?? null, idempotencyKey, inputs, snapshot: snapshot() });
      setDraft(saved); setDirty(false); if (notify) alert.success(`Brouillon ${saved.draftNumber} enregistré sans réservation de stock.`); return saved;
    } catch (error) { const failure = normalizeSaleWorkspaceError(error); setErrors({ [failure.field ?? 'form']: failure.message }); return null; }
    finally { setSaving(false); }
  };

  const submit = async () => {
    if (!validateCurrent() || !analyzed) { if (!analyzed) setErrors((current) => ({ ...current, form: 'Actualisez l’analyse du prix avant la soumission.' })); return; }
    setSubmitting(true);
    try {
      const saved = await persistDraft(false); if (!saved) return; let lots: Array<{ source_type: string; source_id: string; quantite_oz: number }> = [];
      if (!isMineAccount) { const eligibility = await tracabiliteVenteService.lotsDisponibles(); const unavailable = messageIndisponibiliteLots(eligibility); if (unavailable) throw new Error(unavailable);
        const quantityOz = quantityToOunces(inputs.quantity, inputs.unit); const composition = composer(eligibility.lots, quantityOz); const refusal = validerComposition(composition, quantityOz); if (refusal) throw new Error(refusal); lots = composition.affectations; }
      const result = await submitSaleDraft({ draftId: saved.id, expectedVersion: saved.version, lots }); setDirty(false); alert.success(`Vente ${result.saleNumber} transmise à la direction pour validation.`); navigate(`/sales/${result.saleId}`);
    } catch (error) { const failure = normalizeSaleWorkspaceError(error); setErrors({ [failure.field ?? 'form']: failure.message }); }
    finally { setSubmitting(false); }
  };

  const cancel = () => { if ((dirty || draft) && !window.confirm('Des informations ont été saisies. Voulez-vous quitter cette vente ?')) return; navigate('/sales'); };
  const activeStep = !form.customerId ? 1 : !analyzed ? 2 : draft?.status === 'submitted' ? 4 : 3;
  const canSave = Boolean(seller && form.customerId && summary && !saving && !submitting); const canSubmit = canSave && analyzed && customerContext?.isActive === true;
  const stockProblem = stockExport?.decouvert || mineStock?.overAllocated || saleEligibility?.diagnostic.blocked;

  if (loading) return <MainLayout><main className="sn-page sale-create"><div className="sale-create__loading" role="status"><div><span aria-hidden="true" /><p>Chargement sécurisé du formulaire de vente…</p></div></div></main></MainLayout>;

  return <MainLayout><main className="sn-page sale-create">
    <header className="sale-create__header"><div><div className="sale-create__breadcrumb"><span>Ventes internationales</span><span>/</span><strong>Nouvelle vente</strong></div><h1>Créer une vente internationale</h1><p>Définissez le client, le volume et les conditions commerciales avant validation.</p></div>
      <div className="sale-create__header-actions"><button className="sale-create__button" type="button" onClick={() => void persistDraft(true)} disabled={!canSave}><Save aria-hidden="true" />{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button><button className="sale-create__button sale-create__button--primary" type="button" onClick={() => void submit()} disabled={!canSubmit}><Send aria-hidden="true" />{submitting ? 'Soumission…' : 'Soumettre pour validation'}</button></div></header>
    <CreationStepper activeStep={activeStep} />
    {loadError && <div className="sale-create__notice" role="alert"><strong>Chargement incomplet.</strong> {loadError}</div>}
    {errors.form && <div className="sale-create__notice" role="alert">{errors.form}</div>}
    {draft && !errors.form && <div className="sale-create__notice is-success" role="status">Brouillon {draft.draftNumber} · version {draft.version} · dernière sauvegarde {new Date(draft.updatedAt).toLocaleString('fr-FR')}.</div>}
    <div className="sale-create__workspace">
      <section className="sale-create__panel" aria-label="Paramètres de la vente">
        <div id="seller-client" className="sale-create__section"><h2 className="sale-create__section-title">1. Vendeur et client <span>Le vendeur provient du compte connecté.</span></h2>
          <div className="sale-create__seller"><div className="sale-create__seller-main"><span className="sale-create__seller-icon"><Landmark aria-hidden="true" /></span><div><strong>{seller?.name ?? 'Vendeur indisponible'}</strong><small>{seller?.country ?? '—'} · vendeur verrouillé</small></div></div><div className="sale-create__stock"><span>Stock exportable vérifié</span><strong>{number(availableStockOz, 3)} oz</strong></div></div>
          <p className={`sale-create__stock-note${!stockProblem && availableStockOz > 0 ? ' is-valid' : ''}`}><LockKeyhole aria-hidden="true" />{stockProblem ? 'Un contrôle de stock bloque actuellement la soumission.' : 'Le stock est contrôlé à nouveau sous verrou transactionnel lors de la soumission.'}</p>
          <div className="sale-create__customer-search"><label htmlFor="customer-search" className="sale-create__section-title">Client international autorisé</label><Search aria-hidden="true" /><input id="customer-search" type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder={selectedSetting?.customer_name ?? 'Rechercher un client actif…'} autoComplete="off" />
            <div className="sale-create__customer-options" role="listbox" aria-label="Clients internationaux autorisés">{filteredCustomers.length === 0 ? <p className="sale-create__help">Aucun client autorisé ne correspond à la recherche.</p> : filteredCustomers.map((customer) => <button key={customer.customer_id} type="button" role="option" aria-selected={form.customerId === customer.customer_id} onClick={() => { setField('customerId', customer.customer_id); setCustomerSearch(customer.customer_name); }}><span>{customer.customer_name}</span><small>{form.customerId === customer.customer_id ? 'Sélectionné' : 'Autorisé'}</small></button>)}</div>{errors.customerId && <p className="sale-create__error" role="alert">{errors.customerId}</p>}
          </div>
        </div>
        <div id="sale-conditions" className="sale-create__section"><h2 className="sale-create__section-title">2. Conditions de la vente <span>Montants exprimés dans la devise de règlement.</span></h2>
          <div className="sale-create__fields">
            <Field label="Quantité à vendre" controlId="sale-quantity" error={errors.quantity} help={`Disponible : ${number(availableStockOz, 3)} oz`}><div className="sale-create__affix"><input id="sale-quantity" type="number" min="0" step="any" value={form.quantity} onChange={(event) => setField('quantity', event.target.value)} aria-invalid={Boolean(errors.quantity)} /><select aria-label="Unité de poids" value={form.unit} onChange={(event) => setField('unit', event.target.value as SaleWeightUnit)}><option value="oz">oz</option><option value="g">g</option></select></div></Field>
            <Field label="Prix proposé" controlId="sale-price" error={errors.proposedPriceUsdOz} help={market?.spotPriceUsdOz ? `Cours de référence : ${money(market.spotPriceUsdOz)}/oz` : 'Cours de référence indisponible'}><div className="sale-create__affix"><input id="sale-price" type="number" min="0" step="0.01" value={form.proposedPrice} onChange={(event) => setField('proposedPrice', event.target.value)} aria-invalid={Boolean(errors.proposedPriceUsdOz)} /><span>USD/oz</span></div></Field>
            <Field label="Date de fixation du prix" controlId="sale-fixing-date" error={errors.fixingDate}><input id="sale-fixing-date" type="date" value={form.fixingDate} onChange={(event) => setField('fixingDate', event.target.value)} aria-invalid={Boolean(errors.fixingDate)} /></Field>
            <Field label="Devise de règlement" controlId="sale-currency"><select id="sale-currency" value={form.settlementCurrency} disabled><option value="USD">USD — Dollar américain</option></select></Field>
            <Field label="Frais de transport" controlId="sale-freight" error={errors.freightCostUsd}><div className="sale-create__affix"><input id="sale-freight" type="number" min="0" step="0.01" value={form.freightCost} onChange={(event) => setField('freightCost', event.target.value)} aria-invalid={Boolean(errors.freightCostUsd)} /><span>USD</span></div></Field>
            <Field label="Autres frais" controlId="sale-other-costs" error={errors.otherCostsUsd}><div className="sale-create__affix"><input id="sale-other-costs" type="number" min="0" step="0.01" value={form.otherCosts} onChange={(event) => setField('otherCosts', event.target.value)} aria-invalid={Boolean(errors.otherCostsUsd)} /><span>USD</span></div></Field>
            <Field label="Mode de fixation" controlId="sale-fixing-method"><select id="sale-fixing-method" value={form.fixingMethod} onChange={(event) => setField('fixingMethod', event.target.value as SaleFixingMethod)}><option value="spot">Prix fixé à la date de valeur</option><option value="forward">Prix à terme</option><option value="in_process">Prix en cours de traitement</option></select></Field>
            <Field label="Délai de paiement" controlId="sale-payment-days" error={errors.paymentTermDays}><div className="sale-create__affix"><input id="sale-payment-days" type="number" min="0" max="365" step="1" value={form.paymentTermDays} onChange={(event) => setField('paymentTermDays', event.target.value)} aria-invalid={Boolean(errors.paymentTermDays)} /><span>jours</span></div></Field>
            <Field label="Contrat applicable" controlId="sale-contract" error={errors.customerContractId} wide><select id="sale-contract" value={form.customerContractId} onChange={(event) => { const contract = customerContext?.contracts.find((item) => item.id === event.target.value); setField('customerContractId', event.target.value); const days = parsePaymentDays(contract?.paymentTerms); if (days !== null) setField('paymentTermDays', String(days)); }} disabled={!customerContext || customerContext.contracts.length === 0}><option value="">{customerContext?.contracts.length ? 'Autorisation sans contrat sélectionné' : 'Aucun contrat client actif'}</option>{customerContext?.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contractNumber} · valide jusqu’au {new Date(contract.validUntil).toLocaleDateString('fr-FR')}</option>)}</select></Field>
            {form.fixingMethod === 'in_process' && <Field label="Raffinerie agréée" controlId="sale-refinery" error={errors.inProcessRefineryId} wide><select id="sale-refinery" value={form.inProcessRefineryId} onChange={(event) => setField('inProcessRefineryId', event.target.value)} aria-invalid={Boolean(errors.inProcessRefineryId)}><option value="">Sélectionner une raffinerie</option>{refineries.map((refinery) => <option key={refinery.id} value={refinery.id}>{refinery.name} · {refinery.location}</option>)}</select></Field>}
          </div>
          <div className="sale-create__form-summary" aria-live="polite"><span>Montant brut estimé</span><strong>{summary ? money(summary.grossUsd) : '—'}</strong><strong>{summary ? money(summary.grossXof, 'XOF', 0) : '—'}</strong></div>
          <div id="sale-actions" className="sale-create__form-footer"><span className="sale-create__save-state">{draft ? `${dirty ? 'Modifications non enregistrées' : 'Brouillon à jour'} · ${draft.draftNumber}` : 'Aucun brouillon enregistré'}</span><div className="sale-create__actions"><button className="sale-create__button" type="button" onClick={cancel}>Annuler</button><button className="sale-create__button" type="button" onClick={() => void persistDraft(true)} disabled={!canSave}><FileText aria-hidden="true" />Enregistrer</button><button className="sale-create__button sale-create__button--primary" type="button" onClick={() => void analyzeSale()} disabled={!canSave}><Calculator aria-hidden="true" />Analyser la vente</button></div></div>
        </div>
      </section>
      <CustomerContextPanel context={customerContext} loading={customerLoading} selectedSetting={selectedSetting} selectedContract={selectedContract} />
    </div>
    <PriceAnalysisPanel market={market} proposedPrice={inputs.proposedPriceUsdOz} analyzed={analyzed} />
    <section className="sale-create__panel sale-create__analysis" aria-labelledby="journey-title"><div className="sale-create__analysis-head"><div><h2 id="journey-title">Parcours de la vente</h2><p>Les contrôles aval restent inchangés et s’appuient sur la vente validée.</p></div></div><div className="sale-create__analysis-grid">
      <div className="sale-create__price-card is-current"><Calculator aria-hidden="true" /><strong>Préparation</strong><small>Brouillon et analyse</small></div><div className="sale-create__price-card"><FileCheck2 aria-hidden="true" /><strong>Validation</strong><small>Revue et approbation</small></div><div className="sale-create__price-card"><WalletCards aria-hidden="true" /><strong>Contrat et paiement</strong><small>Facturation et règlement</small></div><div className="sale-create__price-card"><PackageCheck aria-hidden="true" /><strong>Expédition et conciliation</strong><small>Traçabilité jusqu’à la clôture</small></div>
    </div></section>
  </main></MainLayout>;
}
