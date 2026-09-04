import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Filter,
  Handshake,
  PackageCheck,
  RefreshCw,
  Truck,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { useMinePortalAccess } from '@/components/auth/MinePortalGuard';
import { CAPABILITIES, hasCapability } from '@/lib/capabilities';
import { canAccessPrivateRoute } from '@/lib/routeAccessRegistry';
import {
  MinePortalDataError,
  minePortalService,
  type MinePortalSnapshot,
} from '@/services/minePortalService';
import {
  buildMineDashboard,
  previousPeriodStart,
  type MineActivity,
  type MineDashboardFilters,
  type MineDashboardModel,
  type MineNextAction,
  type MineOperationFilter,
  type MineStatusFilter,
} from './mineDashboardData';
import './mine-portal.css';

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function initialFilters(): MineDashboardFilters {
  const today = new Date();
  return {
    startDate: `${today.getFullYear()}-01-01`,
    endDate: isoDate(today),
    operation: 'all',
    status: 'all',
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Échéance non renseignée';
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'Date non renseignée' : dateFormatter.format(parsed);
}

function formatDateTime(value: string): string {
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTimeFormatter.format(parsed);
}

function formatOz(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${numberFormatter.format(value)} oz`;
}

function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${numberFormatter.format(value)} %`;
}

function formatFcfa(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (Math.abs(value) >= 1_000_000_000) return `${numberFormatter.format(value / 1_000_000_000)} Md FCFA`;
  if (Math.abs(value) >= 1_000_000) return `${numberFormatter.format(value / 1_000_000)} M FCFA`;
  return `${integerFormatter.format(value)} FCFA`;
}

function Sparkline({ values }: { values: number[] }) {
  const usable = values.length > 1 ? values : [0, values[0] || 0];
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const range = Math.max(max - min, 1);
  const coordinates = usable.map((value, index) => ({
    x: 3 + index * (94 / Math.max(usable.length - 1, 1)),
    y: 24 - ((value - min) / range) * 18,
  }));
  const points = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  return (
    <svg className="mine-kpi__sparkline" viewBox="0 0 100 28" aria-hidden="true">
      <polyline points={points} fill="none" pathLength="100" />
      {coordinates.map(({ x, y }, index) => <circle key={`${index}-${usable[index]}`} cx={x} cy={y} r="1.8" />)}
    </svg>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  hint: string;
  icon: typeof BarChart3;
  loading: boolean;
  unavailable?: boolean;
  positive?: boolean;
  warning?: boolean;
  sparkline?: number[];
}

function KpiCard({
  title, value, hint, icon: Icon, loading, unavailable = false, positive = false, warning = false, sparkline = [],
}: KpiCardProps) {
  return (
    <article className={`mine-kpi${loading ? ' is-loading' : ''}`}>
      <span className="mine-kpi__icon"><Icon aria-hidden="true" /></span>
      <div className="mine-kpi__copy">
        <span>{title}</span>
        {loading ? <i aria-hidden="true" /> : <strong>{unavailable ? '—' : value}</strong>}
        <small className={positive ? 'is-positive' : warning ? 'is-warning' : ''}>
          {unavailable ? 'Donnée indisponible' : hint}
        </small>
      </div>
      {!loading && !unavailable && <Sparkline values={sparkline} />}
    </article>
  );
}

function PanelState({ error, empty, onRetry }: { error: boolean; empty: boolean; onRetry: () => void }) {
  if (error) {
    return (
      <div className="mine-panel-state is-error" role="status">
        <AlertTriangle aria-hidden="true" />
        <strong>Impossible de charger ces données</strong>
        <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" /> Réessayer</button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="mine-panel-state">
        <ClipboardCheck aria-hidden="true" />
        <strong>Aucune donnée disponible pour cette période</strong>
      </div>
    );
  }
  return null;
}

function ContractGauge({ model }: { model: MineDashboardModel }) {
  const execution = model.contractExecution;
  const rate = execution?.rate ?? null;
  const gaugeRate = rate === null ? 0 : Math.min(100, Math.max(0, rate));
  return (
    <div className="mine-contract-gauge">
      <svg viewBox="0 0 240 132" role="img" aria-label={rate === null ? 'Taux d’exécution indisponible' : `Taux d’exécution de ${formatPercent(rate)}`}>
        <path d="M 25 112 A 95 95 0 0 1 215 112" pathLength="100" className="mine-contract-gauge__track" />
        <path d="M 25 112 A 95 95 0 0 1 215 112" pathLength="100" className="mine-contract-gauge__value" style={{ strokeDasharray: `${gaugeRate} 100` }} />
      </svg>
      <div className="mine-contract-gauge__value-copy">
        <strong>{formatPercent(rate)}</strong>
        {execution ? (
          <>
            <span>{formatOz(execution.executedOz)} / {formatOz(execution.committedOz)}</span>
            <small>{execution.expired ? 'Contrat expiré' : `Échéance ${formatDate(execution.dueAt)}`}</small>
          </>
        ) : (
          <small>{model.contractSelectionRequired ? 'Sélectionnez un contrat actif' : 'Aucun contrat actif disponible'}</small>
        )}
      </div>
    </div>
  );
}

function ActionIcon({ action }: { action: MineNextAction }) {
  if (action.kind === 'shipment') return <Truck aria-hidden="true" />;
  if (action.kind === 'payment') return <WalletCards aria-hidden="true" />;
  if (action.kind === 'contract') return <FileText aria-hidden="true" />;
  return <Handshake aria-hidden="true" />;
}

function ActivityRow({ activity, canOpen }: { activity: MineActivity; canOpen: boolean }) {
  const reference = canOpen
    ? <Link to={activity.path}>{activity.reference}</Link>
    : <span>{activity.reference}</span>;
  return (
    <tr>
      <td>{reference}</td>
      <td>{activity.operation}</td>
      <td>{formatOz(activity.quantityOz)}</td>
      <td><span className={`mine-status is-${activity.statusTone}`}>{activity.status}</span></td>
      <td>{formatDateTime(activity.occurredAt)}</td>
    </tr>
  );
}

export default function MinePortalPage() {
  const { companyId, user } = useMinePortalAccess();
  const [draftFilters, setDraftFilters] = useState<MineDashboardFilters>(initialFilters);
  const [filters, setFilters] = useState<MineDashboardFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [data, setData] = useState<MinePortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const next = await minePortalService.load(companyId, {
        force,
        startDate: previousPeriodStart(filters),
        endDate: filters.endDate,
      });
      setData(next);
      setLastUpdatedAt(new Date());
    } catch (reason) {
      setData(null);
      setError(reason instanceof MinePortalDataError
        ? reason.message
        : 'Les données de la société ne peuvent pas être chargées pour le moment.');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters]);

  useEffect(() => { void load(); }, [load]);

  const model = useMemo(
    () => data ? buildMineDashboard(data, filters, selectedContractId) : null,
    [data, filters, selectedContractId],
  );

  useEffect(() => {
    if (!model || selectedContractId || model.contracts.length !== 1) return;
    setSelectedContractId(model.contracts[0].id);
  }, [model, selectedContractId]);

  const canCreateProduction = canAccessPrivateRoute(user, '/production/daily')
    && hasCapability(user, CAPABILITIES.MINE_PRODUCTION_MANAGE);
  const canOpenPath = useCallback((path: string) => canAccessPrivateRoute(user, path), [user]);
  const companyName = data?.company.name || 'Société non identifiée';
  const loadFailed = Boolean(error);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draftFilters.startDate || !draftFilters.endDate || draftFilters.endDate < draftFilters.startDate) {
      setFilterError('La date de fin doit être postérieure ou égale à la date de début.');
      return;
    }
    setFilterError(null);
    setFilters(draftFilters);
    setFiltersOpen(false);
  };

  const productionVariation = model?.production.variationPercent;
  const productionHint = productionVariation === null || productionVariation === undefined
    ? `${model?.production.declarationCount ?? 0} déclaration(s)`
    : `${productionVariation >= 0 ? '+' : ''}${formatPercent(productionVariation)} vs période précédente`;
  const productionPositive = Boolean(productionVariation !== null && productionVariation !== undefined && productionVariation >= 0);
  const distributionHasData = Boolean(model?.distribution.some((item) => (item.valueOz || 0) > 0));
  const monthlyHasData = Boolean(model?.monthly.some((item) => item.actual > 0 || (item.objective || 0) > 0));
  const chartSummary = model?.monthly.length
    ? `Production cumulée sur la période : ${formatOz(model.monthly.at(-1)?.cumulative ?? 0)}.`
    : 'Aucune donnée mensuelle disponible.';

  return (
    <main className="mine-dashboard" data-portal="mine" aria-busy={loading}>
      <header className="mine-dashboard__page-header">
        <div>
          <nav aria-label="Fil d’Ariane"><span>Accueil</span><i>/</i><span>Portail Société Minière</span><i>/</i><strong>Tableau de bord</strong></nav>
          <h1>Tableau de bord des opérations</h1>
          <p>Suivi de la production, des engagements SONASP et des expéditions</p>
        </div>
        <div className="mine-dashboard__page-actions">
          <button type="button" className="mine-period-button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            <CalendarDays aria-hidden="true" />
            <span>{formatDate(filters.startDate)} – {formatDate(filters.endDate)}</span>
            <ChevronRight aria-hidden="true" />
          </button>
          <button type="button" className="mine-action-button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            <Filter aria-hidden="true" /> Filtres
          </button>
          {canCreateProduction && (
            <Link to="/production/daily" className="mine-action-button is-primary"><FilePlus2 aria-hidden="true" /> Nouvelle déclaration</Link>
          )}
          <button type="button" className="mine-dashboard__refresh" onClick={() => void load(true)} disabled={loading} aria-label="Actualiser les données">
            <RefreshCw aria-hidden="true" />
            <span>{lastUpdatedAt ? `Données actualisées à ${timeFormatter.format(lastUpdatedAt)}` : 'Actualisation en attente'}</span>
          </button>
        </div>
      </header>

      {filtersOpen && (
        <form className="mine-dashboard__filters" onSubmit={applyFilters}>
          <label>Date de début<input type="date" value={draftFilters.startDate} max={draftFilters.endDate} onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>Date de fin<input type="date" value={draftFilters.endDate} min={draftFilters.startDate} onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <label>Type d’opération<select value={draftFilters.operation} onChange={(event) => setDraftFilters((current) => ({ ...current, operation: event.target.value as MineOperationFilter }))}><option value="all">Toutes les opérations</option><option value="production">Productions</option><option value="request">Demandes SONASP</option><option value="purchase">Engagements SONASP</option><option value="shipment">Expéditions</option><option value="refining">Raffinage</option></select></label>
          <label>Statut<select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value as MineStatusFilter }))}><option value="all">Tous les statuts</option><option value="open">En cours</option><option value="completed">Validés ou terminés</option><option value="attention">À traiter</option></select></label>
          <button type="submit">Appliquer les filtres</button>
        </form>
      )}

      {error && <div className="mine-dashboard__alert" role="alert"><AlertTriangle aria-hidden="true" /><span>{error}</span><button type="button" onClick={() => void load(true)}><RefreshCw aria-hidden="true" /> Réessayer</button></div>}
      {filterError && <div className="mine-dashboard__alert" role="alert"><AlertTriangle aria-hidden="true" /><span>{filterError}</span></div>}
      {model?.partial && !error && <div className="mine-dashboard__alert is-warning" role="status"><AlertTriangle aria-hidden="true" /><span>Données partielles : {data?.unavailableSources.join(', ')}.</span></div>}

      <section className="mine-dashboard__kpis" aria-label={`Indicateurs opérationnels de ${companyName}`}>
        <KpiCard title="Production sur la période" value={formatOz(model?.production.valueOz)} hint={productionHint} icon={BarChart3} loading={loading} unavailable={loadFailed || model?.production.valueOz === null} positive={productionPositive} warning={!productionPositive && productionVariation !== null} sparkline={model?.production.sparkline || []} />
        <KpiCard title="Or fin disponible" value={formatOz(model?.availableFineGold.valueOz)} hint={model?.availableFineGold.productionPercent === null ? 'Part de production indisponible' : `${formatPercent(model?.availableFineGold.productionPercent)} de la production`} icon={PackageCheck} loading={loading} unavailable={loadFailed || model?.availableFineGold.valueOz === null} positive sparkline={model?.monthly.map((row) => row.actual) || []} />
        <KpiCard title="Engagement SONASP" value={formatOz(model?.sonaspCommitment.valueOz)} hint={model?.sonaspCommitment.executionPercent === null ? 'Exécution contractuelle à préciser' : `${formatPercent(model?.sonaspCommitment.executionPercent)} exécuté`} icon={Handshake} loading={loading} unavailable={loadFailed || model?.sonaspCommitment.valueOz === null} positive sparkline={model?.monthly.map((row) => row.cumulative) || []} />
        <KpiCard title="Expéditions en cours" value={model?.activeShipments.count === null || model?.activeShipments.count === undefined ? '—' : integerFormatter.format(model.activeShipments.count)} hint={`${model?.activeShipments.preparing ?? 0} en préparation`} icon={Truck} loading={loading} unavailable={loadFailed || model?.activeShipments.count === null} warning={(model?.activeShipments.preparing || 0) > 0} sparkline={model?.monthly.map((row) => row.actual) || []} />
        <KpiCard title="Paiements attendus" value={formatFcfa(model?.expectedPayments.amountFcfa)} hint={`${model?.expectedPayments.dueCount ?? 0} échéance(s)`} icon={CircleDollarSign} loading={loading} unavailable={loadFailed || model?.expectedPayments.amountFcfa === null} warning={(model?.expectedPayments.dueCount || 0) > 0} sparkline={model?.monthly.map((row) => row.cumulative) || []} />
      </section>

      <section className="mine-dashboard__analytics">
        <article className="mine-panel mine-panel--production">
          <header><h2>Production et objectifs mensuels</h2></header>
          <div className="mine-chart-legend" aria-hidden="true"><span className="is-actual">Production réelle</span>{model?.monthly.some((row) => row.objective !== null) && <span className="is-objective">Objectif</span>}<span className="is-cumulative">Cumul annuel</span></div>
          {loading ? <div className="mine-chart-skeleton" aria-hidden="true" /> : loadFailed || !monthlyHasData ? <PanelState error={loadFailed} empty={!loadFailed} onRetry={() => void load(true)} /> : (
            <div className="mine-production-chart" role="img" aria-label="Production réelle, objectifs mensuels et cumul de production, exprimés en onces">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={model?.monthly} margin={{ top: 14, right: 12, left: 2, bottom: 0 }}>
                  <CartesianGrid stroke="#eee8da" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6f6a60', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e5ddcb' }} />
                  <YAxis yAxisId="left" tick={{ fill: '#6f6a60', fontSize: 10 }} tickLine={false} axisLine={false} width={46} tickFormatter={(value) => `${numberFormatter.format(Number(value) / 1_000)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6f6a60', fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={(value) => `${numberFormatter.format(Number(value) / 1_000)}k`} />
                  <Tooltip formatter={(value) => formatOz(Number(value))} labelStyle={{ color: '#252116', fontWeight: 700 }} />
                  <Bar yAxisId="left" dataKey="actual" name="Production réelle" fill="#c99724" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar yAxisId="left" dataKey="objective" name="Objectif" fill="#ead49a" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Line yAxisId="right" type="linear" dataKey="cumulative" name="Cumul annuel" stroke="#9c7116" strokeWidth={2.2} dot={{ r: 3, fill: '#fff', stroke: '#9c7116', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="sr-only">{chartSummary}</p>
        </article>

        <div className="mine-dashboard__right-stack">
          <article className="mine-panel mine-panel--distribution">
            <header><h2>Répartition de la production</h2></header>
            {loading ? <div className="mine-distribution-skeleton" aria-hidden="true" /> : loadFailed || !distributionHasData ? <PanelState error={loadFailed} empty={!loadFailed} onRetry={() => void load(true)} /> : (
              <div className="mine-distribution" role="img" aria-label="Répartition des positions opérationnelles de l’or">
                <div className="mine-distribution__bar">
                  {model?.distribution.map((item) => item.percent !== null && item.percent > 0 && <span key={item.key} className={`is-${item.key}`} style={{ width: `${item.percent}%` }} title={`${item.label} : ${formatOz(item.valueOz)} (${formatPercent(item.percent)})`} />)}
                </div>
                <dl>{model?.distribution.map((item) => <div key={item.key} className={`is-${item.key}`}><dt>{item.label}</dt><dd>{formatPercent(item.percent)}</dd><small>{formatOz(item.valueOz)}</small></div>)}</dl>
              </div>
            )}
          </article>

          <article className="mine-panel mine-panel--contract">
            <header><h2>Exécution du contrat SONASP</h2>{model && model.contracts.length > 1 && <label><span className="sr-only">Contrat actif</span><select value={selectedContractId || ''} onChange={(event) => setSelectedContractId(event.target.value || null)}><option value="">Sélectionner un contrat</option>{model.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.reference}</option>)}</select></label>}</header>
            {loading ? <div className="mine-gauge-skeleton" aria-hidden="true" /> : loadFailed ? <PanelState error empty={false} onRetry={() => void load(true)} /> : <ContractGauge model={model as MineDashboardModel} />}
          </article>
        </div>
      </section>

      <section className="mine-dashboard__bottom-grid">
        <article className="mine-panel mine-panel--activities">
          <header><h2>Activités opérationnelles récentes</h2></header>
          {loading ? <div className="mine-table-skeleton" aria-hidden="true" /> : loadFailed || !model?.activities.length ? <PanelState error={loadFailed} empty={!loadFailed} onRetry={() => void load(true)} /> : (
            <div className="mine-table-scroll"><table><thead><tr><th>Référence</th><th>Opération</th><th>Quantité</th><th>Statut</th><th>Date</th></tr></thead><tbody>{model.activities.map((activity) => <ActivityRow key={activity.id} activity={activity} canOpen={canOpenPath(activity.path)} />)}</tbody></table></div>
          )}
        </article>

        <article className="mine-panel mine-panel--actions">
          <header><h2>Prochaines actions</h2></header>
          {loading ? <div className="mine-actions-skeleton" aria-hidden="true" /> : loadFailed || !model?.actions.length ? <PanelState error={loadFailed} empty={!loadFailed} onRetry={() => void load(true)} /> : (
            <ul>{model.actions.map((action) => {
              const canOpen = Boolean(action.path && canOpenPath(action.path));
              const content = <><i><ActionIcon action={action} /></i><span>{action.label}</span><time>{formatDate(action.dueAt)}</time>{canOpen && <ChevronRight aria-hidden="true" />}</>;
              return <li key={action.id}>{canOpen && action.path ? <Link to={action.path}>{content}</Link> : <div>{content}</div>}</li>;
            })}</ul>
          )}
        </article>
      </section>
    </main>
  );
}
