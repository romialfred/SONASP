import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowUp, Bell, Boxes, CalendarDays, ChevronDown,
  ChevronRight, Download, FileCheck2, Filter, Percent, RefreshCw,
  SlidersHorizontal, Users, X,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from '@/lib/recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  EMPTY_DASHBOARD,
  loadNationalDashboard,
  type NationalDashboardData,
} from './nationalDashboardData';
import './global-dashboard-enhanced.css';
import { GoldBarsIcon } from '@/components/layout/PortalIdentity';

type ChartMode = 'volume' | 'value';
const DASHBOARD_TABS = ['Vue d’ensemble', 'Production & collecte', 'Ventes & recettes', 'Traçabilité'] as const;

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatCompactFcfa(value: number) {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value / 1_000_000_000)} Mds FCFA`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M FCFA`;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
}

function formatTableAmount(value: number) {
  return value >= 1_000_000
    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M FCFA`
    : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
}

/** Libellé court d'une borne de période, pour la pastille de sélection. */
export function formatBorne(valeur: string) {
  const date = new Date(`${valeur}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

/** Période par défaut : du 1er janvier de l'exercice en cours à aujourd'hui. */
export function periodeParDefaut(today = new Date()) {
  return {
    debut: new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10),
    fin: today.toISOString().slice(0, 10),
  };
}

/** Variation signée, ou « — » lorsqu'elle n'est pas calculable. */
export function formatTendance(valeur: number | null) {
  if (valeur === null) return null;
  const signe = valeur >= 0 ? '+' : '−';
  return `${signe}${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(valeur))} %`;
}

function ChartTooltipContent({ active, payload, label, mode }: {
  active?: boolean; payload?: Array<{ value?: number }>; label?: string | number; mode: ChartMode;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value || 0);
  return (
    <div className="national-chart-tooltip">
      <strong>{label}</strong><span className="national-chart-tooltip__dot" aria-hidden="true" />
      <span>{mode === 'volume' ? `${formatNumber(value, 1)} oz` : formatCompactFcfa(value * 1_000_000)}</span>
    </div>
  );
}

/** Pied de carte : tendance réelle, ou mention explicite quand elle n'a pas de référence. */
function Tendance({ valeur, legende }: { valeur: number | null; legende: string }) {
  const libelle = formatTendance(valeur);
  if (libelle === null) {
    return <p className="is-muted">Pas de référence sur la période précédente</p>;
  }
  const positive = (valeur as number) >= 0;
  return (
    <p className={positive ? 'is-positive' : 'is-danger'}>
      {positive ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />} {libelle} <span>{legende}</span>
    </p>
  );
}

export function GlobalDashboardEnhanced() {
  const navigate = useNavigate();
  const periode = periodeParDefaut();

  const [data, setData] = useState<NationalDashboardData>(EMPTY_DASHBOARD);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [chartMode, setChartMode] = useState<ChartMode>('volume');
  const [startDate, setStartDate] = useState(periode.debut);
  const [endDate, setEndDate] = useState(periode.fin);
  const [datePanelOpen, setDatePanelOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const loadDashboardData = useCallback(async () => {
    const version = ++requestVersion.current;
    if (startDate > endDate) return;
    setIsRefreshing(true);
    const resultat = await loadNationalDashboard(startDate, endDate);
    if (version !== requestVersion.current) return;
    setData(resultat);
    setUpdatedAt(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
    setIsRefreshing(false);
  }, [endDate, startDate]);

  useEffect(() => {
    void loadDashboardData();
    return () => { requestVersion.current += 1; };
  }, [loadDashboardData]);

  const visibleTransactions = useMemo(
    () => pendingOnly ? data.transactions.filter((transaction) => transaction.status === 'pending') : data.transactions,
    [data.transactions, pendingOnly],
  );
  const displayMetric = (source: string, value: string) => isRefreshing || data.unavailable.includes(source) ? '—' : value;
  const chartUnavailable = isRefreshing || data.unavailable.includes(chartMode === 'volume' ? 'la production' : 'les ventes');
  const chartDataKey = chartMode === 'volume' ? 'volume' : 'value';
  const periodeInvalide = startDate > endDate;

  const exportDashboard = () => {
    const rows = [
      ['Référence', 'Acteur', 'Type', 'Quantité (oz)', 'Montant (FCFA)', 'Statut', 'Date'],
      ...visibleTransactions.map((item) => [item.reference, item.actor, item.type, item.quantity.toString(), item.amount.toString(), item.status, item.date]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tableau-de-bord-national-${endDate}.csv`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <NationalDashboardLayout>
      <div className="national-dashboard">
        <nav className="national-dashboard__breadcrumb" aria-label="Fil d’Ariane"><Link to="/dashboard">Accueil</Link><span>/</span><span>Tableau de bord</span></nav>
        <section className="national-dashboard__intro" aria-labelledby="national-dashboard-title">
          <div><h2 id="national-dashboard-title">Tableau de bord national</h2><p>Production, collecte, ventes et redevances du secteur minier</p></div>
          <div className="national-dashboard__controls">
            <div className="national-dashboard__control-popover">
              <button type="button" className="national-dashboard__control national-dashboard__date-control" onClick={() => { setDatePanelOpen((open) => !open); setFilterPanelOpen(false); }} aria-expanded={datePanelOpen}>
                {/* La pastille reflète la période réellement retenue, et non un libellé figé. */}
                <CalendarDays aria-hidden="true" /><span>{formatBorne(startDate)} – {formatBorne(endDate)}</span><ChevronDown aria-hidden="true" />
              </button>
              {datePanelOpen && <div className="national-dashboard__popover national-dashboard__date-panel">
                <label>Du<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label>Au<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
                {periodeInvalide && <p className="national-dashboard__popover-error">La date de début est postérieure à la date de fin.</p>}
                <button type="button" onClick={() => setDatePanelOpen(false)}>Appliquer</button>
              </div>}
            </div>
            <div className="national-dashboard__control-popover">
              <button type="button" className="national-dashboard__control" onClick={() => { setFilterPanelOpen((open) => !open); setDatePanelOpen(false); }} aria-expanded={filterPanelOpen}>
                <Filter aria-hidden="true" /><span>Filtres</span>
              </button>
              {filterPanelOpen && <div className="national-dashboard__popover national-dashboard__filter-panel">
                <div className="national-dashboard__popover-title"><SlidersHorizontal aria-hidden="true" /> Affichage</div>
                <label><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />Transactions à valider uniquement</label>
                <button type="button" onClick={() => setFilterPanelOpen(false)}>Fermer</button>
              </div>}
            </div>
            <button type="button" className="national-dashboard__export" onClick={exportDashboard} disabled={visibleTransactions.length === 0}><Download aria-hidden="true" /><span>Exporter</span></button>
            <div className="national-dashboard__updated"><RefreshCw className={isRefreshing ? 'is-spinning' : ''} aria-hidden="true" /><span>{updatedAt ? `Données actualisées à ${updatedAt}` : 'Chargement des données…'}</span></div>
          </div>
        </section>

        {data.unavailable.length > 0 && (
          <p className="national-dashboard__unavailable" role="status">
            <AlertTriangle aria-hidden="true" />
            Données partielles : {data.unavailable.join(', ')} n’ont pas pu être chargées.
          </p>
        )}

        <section className="national-dashboard__metrics" aria-label="Indicateurs nationaux">
          <article className="national-metric-card national-metric-card--gold"><span className="national-metric-card__icon"><GoldBarsIcon /></span><div><h3>Or collecté</h3><strong>{displayMetric('la production', formatNumber(data.collectedGold))}<small>oz</small></strong></div><Tendance valeur={data.collectedGoldTrend} legende="vs période précédente" /></article>
          <article className="national-metric-card national-metric-card--green"><span className="national-metric-card__icon"><FileCheck2 aria-hidden="true" /></span><div><h3>Valeur des ventes</h3><strong>{displayMetric('les ventes', formatCompactFcfa(data.salesValue).replace(' FCFA', ''))}<small>FCFA</small></strong></div><Tendance valeur={data.salesValueTrend} legende="vs période précédente" /></article>
          <article className="national-metric-card national-metric-card--gold"><span className="national-metric-card__icon"><Boxes aria-hidden="true" /></span><div><h3>Stock disponible</h3><strong>{displayMetric('le stock', formatNumber(data.availableStock))}<small>oz</small></strong></div>
            {data.unavailable.includes('le stock') || data.unavailable.includes('la production')
              ? <p className="is-muted">Source indisponible</p>
              : data.stockShare === null
              ? <p className="is-muted">Part non calculable sans collecte</p>
              : <p className="is-gold">{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(data.stockShare)} % <span>de la collecte</span></p>}
          </article>
          <article className="national-metric-card national-metric-card--green"><span className="national-metric-card__icon"><Percent aria-hidden="true" /></span><div><h3>Redevances dues</h3><strong>{displayMetric('les ventes', formatCompactFcfa(data.royalties).replace(' FCFA', ''))}<small>FCFA</small></strong></div>
            {/* Taux constaté sur les ventes de la période, et non un taux annoncé de 3 %. */}
            {data.unavailable.includes('les ventes')
              ? <p className="is-muted">Source indisponible</p>
              : data.royaltyRate === null
              ? <p className="is-muted">Aucune vente sur la période</p>
              : <p className="is-positive">Taux constaté {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(data.royaltyRate)} %</p>}
          </article>
          <article className="national-metric-card national-metric-card--green"><span className="national-metric-card__icon"><Users aria-hidden="true" /></span><div><h3>Artisans miniers</h3><strong>{displayMetric('les artisans miniers', new Intl.NumberFormat('fr-FR').format(data.artisansTotal))}</strong></div><p className={data.artisansActifs < data.artisansTotal ? 'is-gold' : 'is-muted'}>{new Intl.NumberFormat('fr-FR').format(data.artisansActifs)} actifs</p></article>

        </section>

        <div className="national-dashboard__tabs" role="tablist" aria-label="Vues du tableau de bord">{DASHBOARD_TABS.map((tab, index) => <button type="button" key={tab} id={`dashboard-tab-${index}`} role="tab" aria-selected={activeTab === index} aria-controls="dashboard-panel" tabIndex={activeTab === index ? 0 : -1} onKeyDown={(event) => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4; setActiveTab(next); document.getElementById(`dashboard-tab-${next}`)?.focus(); if (next === 1) setChartMode('volume'); if (next === 2) setChartMode('value'); } }} onClick={() => { setActiveTab(index); if (index === 1) setChartMode('volume'); if (index === 2) setChartMode('value'); }}>{tab}</button>)}</div>
        <div id="dashboard-panel" role="tabpanel" aria-labelledby={`dashboard-tab-${activeTab}`}>
        {activeTab !== 3 && <section className="national-dashboard__analytics-grid">
          <article className="national-panel national-volume-panel">
            <div className="national-panel__header"><div><h3>{chartMode === 'volume' ? 'Évolution des volumes collectés' : 'Évolution de la valeur des ventes'}</h3><p className="national-panel__subtitle">{chartMode === 'volume' ? 'Volumes mensuels • en oz' : 'Ventes mensuelles • en millions de FCFA'}</p></div><div className="national-chart-toggle" aria-label="Donnée du graphique">
              <button type="button" className={chartMode === 'volume' ? 'is-active' : ''} onClick={() => setChartMode('volume')}>Volume</button>
              <button type="button" className={chartMode === 'value' ? 'is-active' : ''} onClick={() => setChartMode('value')}>Valeur</button>
            </div></div>
            <div className="national-volume-chart">{chartUnavailable ? <p className="national-chart-state" role="status">{isRefreshing ? 'Chargement des données…' : 'Cette mesure est temporairement indisponible.'}</p> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.monthlyMetrics} margin={{ top: 24, right: 18, left: 1, bottom: 0 }}>
              <defs><linearGradient id="nationalVolumeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e2a000" stopOpacity={0.2} /><stop offset="100%" stopColor="#e2a000" stopOpacity={0.015} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#dde5ec" strokeDasharray="2 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#aab8c7' }} tick={{ fill: '#61748a', fontSize: 10 }} />
              <YAxis domain={[0, 'auto']} tickLine={false} axisLine={false} width={38} tick={{ fill: '#51657d', fontSize: 10 }} tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} label={{ value: chartMode === 'volume' ? 'oz' : 'M', position: 'top', offset: 12, fill: '#10243e', fontSize: 10, fontWeight: 700 }} />
              <Tooltip content={({ active, payload, label }) => <ChartTooltipContent active={active} payload={payload?.map((item) => ({ value: Number(item.value || 0) }))} label={label} mode={chartMode} />} cursor={{ stroke: '#dda000', strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey={chartDataKey} stroke="#dda000" strokeWidth={2} fill="url(#nationalVolumeFill)" activeDot={{ r: 5, fill: '#dda000', stroke: '#fff', strokeWidth: 2 }} dot={{ r: 3.5, fill: '#fff', stroke: '#dda000', strokeWidth: 2 }} />
            </AreaChart></ResponsiveContainer>}</div>
          </article>

          <article className="national-panel national-origin-panel">
            <div className="national-panel__header"><div><h3>Répartition par origine</h3><p className="national-panel__subtitle">Or vendu • période sélectionnée</p></div></div>
            {/* Répartition calculée sur les ventes de la période ; auparavant figée à 62/24/14 %. */}
            {isRefreshing || data.unavailable.includes('les ventes') ? (
              <p className="national-origin-panel__empty">{isRefreshing ? 'Chargement des données…' : 'La répartition est temporairement indisponible.'}</p>
            ) : data.origins.length === 0 ? (
              <p className="national-origin-panel__empty">Aucune vente sur la période : la répartition par origine ne peut pas être établie.</p>
            ) : (
              <div className="national-origin-panel__content"><div className="national-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.origins} dataKey="value" innerRadius="63%" outerRadius="95%" startAngle={90} endAngle={-270} paddingAngle={1} stroke="#fff" strokeWidth={1}>{data.origins.map((origin) => <Cell key={origin.name} fill={origin.color} />)}</Pie><Tooltip formatter={(value) => `${value}%`} /></PieChart></ResponsiveContainer><div className="national-donut__center"><strong>{new Intl.NumberFormat('fr-FR').format(Math.round(data.origins.reduce((total, origin) => total + origin.ounces, 0)))}</strong><span>oz</span><small>Or vendu</small></div></div>
                <ul className="national-origin-legend">{data.origins.map((origin) => <li key={origin.name}><span className="national-origin-legend__dot" style={{ background: origin.color }} /><span>{origin.name}</span><strong>{origin.value} %</strong></li>)}</ul>
              </div>
            )}
          </article>
        </section>}

        <section className="national-dashboard__bottom-grid">
          <article className="national-panel national-transactions-panel">
            <div className="national-panel__header"><h3>Suivi des opérations</h3><span>{displayMetric('les ventes', String(data.transactionsCount))} transactions · {data.pendingCount} à valider</span></div>
            <div className="national-transactions-table-wrap"><table className="national-transactions-table"><thead><tr><th>Référence</th><th>Acteur</th><th>Type</th><th>Quantité</th><th>Montant</th><th>Statut</th><th>Date</th><th>Action</th></tr></thead><tbody>
              {visibleTransactions.map((item) => <tr key={item.id || item.reference}><td><strong>{item.reference}</strong></td><td>{item.actor}</td><td>{item.type}</td><td>{formatNumber(item.quantity)} oz</td><td>{formatTableAmount(item.amount)}</td><td><span className={`national-status national-status--${item.status}`}>{item.status === 'validated' ? 'Validée' : item.status === 'control' ? 'En contrôle' : 'À valider'}</span></td><td>{item.date}</td><td>{item.id ? <Link className="national-operation-link" to={`/sales/${item.id}`}>Consulter <ChevronRight aria-hidden="true" /></Link> : '—'}</td></tr>)}
            </tbody></table>{visibleTransactions.length === 0 && <p className="national-transactions-empty">{data.unavailable.includes('les ventes') ? 'Le suivi des opérations est temporairement indisponible.' : 'Aucune transaction à afficher.'}</p>}</div>
            <button type="button" className="national-transactions-panel__link" onClick={() => navigate('/sales')}>Voir toutes les transactions <ChevronRight aria-hidden="true" /></button>
          </article>

          {(activeTab === 3 || data.pendingCount > 0 || data.expiringCards > 0 || data.unavailable.length > 0) && <article className="national-panel national-alerts-panel">
            <div className="national-panel__header"><h3>Points d’attention</h3></div>
            {/* Chaque alerte est adossée à un décompte réel ; celles qui ne le sont pas ne s'affichent plus. */}
            <div className="national-alerts-list">
              {data.pendingCount > 0 && (
                <button type="button" onClick={() => navigate('/sales')}><span className="national-alerts-list__icon is-orange"><Bell aria-hidden="true" /></span><span><strong><b>{data.pendingCount}</b> transactions à valider</strong><small>Actions requises pour validation</small></span><ChevronRight aria-hidden="true" /></button>
              )}
              {data.expiringCards > 0 && (
                <button type="button" onClick={() => navigate('/artisan-minier/cartes/expirations')}><span className="national-alerts-list__icon is-gold"><AlertTriangle aria-hidden="true" /></span><span><strong><b>{data.expiringCards}</b> carte(s) expirent sous 30 jours</strong><small>Anticipez les renouvellements</small></span><ChevronRight aria-hidden="true" /></button>
              )}
              {data.unavailable.length > 0 && (
                <button type="button" onClick={() => void loadDashboardData()}><span className="national-alerts-list__icon is-red"><AlertCircle aria-hidden="true" /></span><span><strong>Sources de données incomplètes</strong><small>{data.unavailable.join(', ')} — relancer le chargement</small></span><ChevronRight aria-hidden="true" /></button>
              )}
              {data.pendingCount === 0 && data.expiringCards === 0 && data.unavailable.length === 0 && (
                <p className="national-alerts-empty">Aucun point d’attention sur la période.</p>
              )}
            </div>
          </article>}
        </section>
        </div>

        {(datePanelOpen || filterPanelOpen) && <button type="button" className="national-dashboard__popover-backdrop" aria-label="Fermer les options" onClick={() => { setDatePanelOpen(false); setFilterPanelOpen(false); }}><X aria-hidden="true" /></button>}
      </div>
    </NationalDashboardLayout>
  );
}
