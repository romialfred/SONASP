import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  FileWarning,
  Landmark,
  MapPin,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { dgmgRegulatoryDashboardService } from '@/services/dgmgRegulatoryDashboardService';
import {
  buildDgmgRegulatoryCsv,
  formatDgmgAxisKilograms,
  formatDgmgInteger,
  formatDgmgPercent,
  formatDgmgWeight,
} from '@/lib/dgmgRegulatoryDashboard';
import { errorMessage } from '@/lib/errorMessage';
import type {
  DgmgRegulatoryDashboardData,
  DgmgRegulatoryFilters,
  DgmgSiteType,
} from '@/types/dgmgRegulatory';
import './dgmg-regulatory-dashboard.css';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: 'short', year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function isoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function initialFilters(): DgmgRegulatoryFilters {
  const today = new Date();
  return {
    startDate: `${today.getFullYear()}-01-01`,
    endDate: isoDate(today),
    siteType: 'all',
    companyId: null,
    region: null,
    declarationStatus: null,
  };
}

function displayedDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function displayedDateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTimeFormatter.format(parsed);
}

function PanelState({
  error, empty, onRetry,
}: { error: boolean; empty: boolean; onRetry: () => void }) {
  if (error) {
    return (
      <div className="dgmg-panel-state is-error" role="status">
        <AlertTriangle aria-hidden="true" />
        <strong>Impossible de charger ces données</strong>
        <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" /> Réessayer</button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="dgmg-panel-state">
        <Landmark aria-hidden="true" />
        <strong>Aucune donnée disponible pour cette période</strong>
      </div>
    );
  }
  return null;
}

interface KpiProps {
  title: string;
  value: string;
  hint: string;
  icon: typeof Building2;
  warning?: boolean;
  loading: boolean;
  error: boolean;
}

function KpiCard({ title, value, hint, icon: Icon, warning = false, loading, error }: KpiProps) {
  return (
    <article className={`dgmg-kpi${warning ? ' is-warning' : ''}${loading ? ' is-loading' : ''}`}>
      <span className="dgmg-kpi__icon"><Icon aria-hidden="true" /></span>
      <div>
        <span>{title}</span>
        {loading ? <i aria-hidden="true" /> : <strong>{error ? '—' : value}</strong>}
        <small>{error ? 'Impossible de charger ces données' : hint}</small>
      </div>
    </article>
  );
}

export function DgmgRegulatoryDashboard() {
  const [draftFilters, setDraftFilters] = useState<DgmgRegulatoryFilters>(initialFilters);
  const [filters, setFilters] = useState<DgmgRegulatoryFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<DgmgRegulatoryDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const nextData = await dgmgRegulatoryDashboardService.load(filters, signal);
      setData(nextData);
      setLastUpdatedAt(new Date());
    } catch (reason) {
      if (signal?.aborted) return;
      setData(null);
      setLoadError(errorMessage(reason, 'Impossible de charger le tableau réglementaire DGMG.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const complianceItems = useMemo(() => data ? [
    { key: 'conforming', label: 'Conformes', value: data.compliance.conforming, color: '#078f98' },
    { key: 'regularize', label: 'À régulariser', value: data.compliance.regularize, color: '#f28c00' },
    { key: 'nonConforming', label: 'Non conformes', value: data.compliance.nonConforming, color: '#e53935' },
  ] : [], [data]);
  const complianceChartData = complianceItems.filter(
    (item): item is typeof item & { value: number } => item.value !== null && item.value > 0,
  );

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draftFilters.startDate || !draftFilters.endDate || draftFilters.endDate < draftFilters.startDate) {
      setFilterError('La date de fin doit être postérieure ou égale à la date de début.');
      return;
    }
    setFilterError(null);
    setFiltersOpen(false);
    setFilters(draftFilters);
  };

  const exportReport = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      await Promise.resolve();
      const blob = new Blob([buildDgmgRegulatoryCsv(data)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport-reglementaire-dgmg-${data.period.startDate}-${data.period.endDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary;
  const sitesHint = summary?.artisanalSitesTotal === null || summary?.artisanalSitesTotal === undefined
    ? 'Ventilation indisponible'
    : `${formatDgmgInteger(summary.industrialSitesTotal)} industriels · ${formatDgmgInteger(summary.artisanalSitesTotal)} artisanaux`;
  const declarationHint = summary?.onTimeRate === null || summary?.onTimeRate === undefined
    ? 'Respect des délais indisponible'
    : `${formatDgmgPercent(summary.onTimeRate)} dans les délais`;
  const trend = summary?.productionTrendPercent;
  const productionHint = trend === null || trend === undefined
    ? 'Évolution indisponible'
    : `${trend >= 0 ? '+' : ''}${formatDgmgPercent(trend)} vs période précédente`;
  const controlsHint = summary?.priorityControls === null || summary?.priorityControls === undefined
    ? 'Priorité indisponible'
    : `${formatDgmgInteger(summary.priorityControls)} prioritaires`;

  return (
    <main className="dgmg-dashboard" data-portal="dgmg" aria-busy={loading}>
      <header className="dgmg-dashboard__page-header">
        <div>
          <nav aria-label="Fil d’Ariane"><span>Accueil</span><i>/</i><span>Portail DGMG</span><i>/</i><strong>Vue d’ensemble</strong></nav>
          <h1>Tableau de bord réglementaire</h1>
          <p>Supervision nationale des opérateurs, des sites et des déclarations minières</p>
        </div>
        <div className="dgmg-dashboard__page-actions">
          <button type="button" className="dgmg-period-button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            <CalendarDays aria-hidden="true" />
            <span>{displayedDate(filters.startDate)} – {displayedDate(filters.endDate)}</span>
            <ChevronRight aria-hidden="true" />
          </button>
          <button type="button" className="dgmg-action-button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            <SlidersHorizontal aria-hidden="true" /> Filtres
          </button>
          <button type="button" className="dgmg-action-button is-primary" onClick={() => void exportReport()} disabled={!data || exporting}>
            <Download aria-hidden="true" /> {exporting ? 'Export en cours…' : 'Exporter le rapport'}
          </button>
          <small className="dgmg-dashboard__updated"><RefreshCw aria-hidden="true" /> {lastUpdatedAt ? `Données actualisées à ${timeFormatter.format(lastUpdatedAt)}` : 'Actualisation en attente'}</small>
        </div>
      </header>

      {filtersOpen && (
        <form className="dgmg-dashboard__filters" onSubmit={applyFilters}>
          <label>Date de début<input type="date" value={draftFilters.startDate} max={draftFilters.endDate} onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>Date de fin<input type="date" value={draftFilters.endDate} min={draftFilters.startDate} onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <label>Type de site<select value={draftFilters.siteType} onChange={(event) => setDraftFilters((current) => ({ ...current, siteType: event.target.value as DgmgSiteType }))}><option value="all">Tous les sites</option><option value="industrial">Mines industrielles</option><option value="artisanal">Sites artisanaux</option></select></label>
          <label>Société minière<select value={draftFilters.companyId ?? ''} onChange={(event) => setDraftFilters((current) => ({ ...current, companyId: event.target.value || null }))}><option value="">Toutes les sociétés</option>{data?.filterOptions.companies.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Région<select value={draftFilters.region ?? ''} onChange={(event) => setDraftFilters((current) => ({ ...current, region: event.target.value || null }))}><option value="">Toutes les régions</option>{data?.filterOptions.regions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Statut de déclaration<select value={draftFilters.declarationStatus ?? ''} onChange={(event) => setDraftFilters((current) => ({ ...current, declarationStatus: event.target.value || null }))}><option value="">Tous les statuts</option>{data?.filterOptions.declarationStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <button type="submit">Appliquer les filtres</button>
        </form>
      )}

      {loadError && <div className="dgmg-dashboard__alert" role="alert"><AlertTriangle aria-hidden="true" /><span>{loadError}</span><button type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Réessayer</button></div>}
      {filterError && <div className="dgmg-dashboard__alert" role="alert"><AlertTriangle aria-hidden="true" /><span>{filterError}</span></div>}
      {data?.partial && !loadError && <div className="dgmg-dashboard__alert is-warning" role="status"><AlertTriangle aria-hidden="true" /><span>Données partielles : les dimensions non référencées restent indiquées comme indisponibles.</span></div>}

      <section className="dgmg-dashboard__kpis" aria-label="Indicateurs réglementaires">
        <KpiCard title="Sociétés minières agréées" value={formatDgmgInteger(summary?.miningCompaniesTotal)} hint={summary?.miningCompaniesActive === null || summary?.miningCompaniesActive === undefined ? 'Activité indisponible' : `${formatDgmgInteger(summary.miningCompaniesActive)} actives`} icon={Building2} loading={loading} error={Boolean(loadError)} />
        <KpiCard title="Sites miniers enregistrés" value={formatDgmgInteger(summary?.sitesTotal)} hint={sitesHint} icon={MapPin} loading={loading} error={Boolean(loadError)} />
        <KpiCard title="Déclarations reçues" value={formatDgmgInteger(summary?.declarationsTotal)} hint={declarationHint} icon={FileCheck2} loading={loading} error={Boolean(loadError)} />
        <KpiCard title="Production déclarée" value={formatDgmgWeight(summary?.productionGrams)} hint={productionHint} icon={BarChart3} loading={loading} error={Boolean(loadError)} />
        <KpiCard title="Contrôles à traiter" value={formatDgmgInteger(summary?.controlsPending)} hint={controlsHint} icon={ShieldAlert} warning loading={loading} error={Boolean(loadError)} />
      </section>

      <section className="dgmg-dashboard__analytics">
        <article className="dgmg-panel dgmg-panel--production">
          <header><h2>Évolution de la production déclarée</h2><div className="dgmg-chart-mode" aria-label="Mode du graphique"><button type="button" className="is-active">Volume</button><button type="button" disabled title="Les valeurs financières ne sont pas exposées au portail DGMG">Valeur</button></div></header>
          {loading ? <div className="dgmg-chart-skeleton" aria-hidden="true" /> : loadError || !data?.monthly.length ? <PanelState error={Boolean(loadError)} empty={!loadError} onRetry={() => void load()} /> : (
            <div className="dgmg-production-chart" role="img" aria-label="Évolution mensuelle des productions industrielles et artisanales, exprimée en kilogrammes">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthly} margin={{ top: 18, right: 14, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e3eaee" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#dce4ea' }} />
                  <YAxis tickFormatter={(value) => formatDgmgAxisKilograms(Number(value))} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(value) => formatDgmgWeight(typeof value === 'number' ? value : Number(value))} labelStyle={{ color: '#062544', fontWeight: 700 }} />
                  <Area type="linear" dataKey="industrialGrams" name="Mines industrielles" stroke="#078f98" fill="#078f98" fillOpacity={0.08} connectNulls={false} />
                  <Line type="linear" dataKey="industrialGrams" name="Mines industrielles" stroke="#078f98" strokeWidth={2.2} dot={{ r: 3, fill: '#078f98' }} connectNulls={false} />
                  <Area type="linear" dataKey="artisanalGrams" name="Sites artisanaux" stroke="#f28c00" fill="#f28c00" fillOpacity={0.06} connectNulls={false} />
                  <Line type="linear" dataKey="artisanalGrams" name="Sites artisanaux" stroke="#f28c00" strokeWidth={2.2} dot={{ r: 3, fill: '#f28c00' }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="dgmg-chart-legend"><span className="is-industrial">Mines industrielles</span><span className="is-artisanal">Sites artisanaux</span><small>kg</small></div>
        </article>

        <article className="dgmg-panel dgmg-panel--compliance">
          <header><h2>Conformité des déclarations</h2></header>
          {loading ? <div className="dgmg-donut-skeleton" aria-hidden="true" /> : loadError || !data?.compliance.classifiedTotal ? <PanelState error={Boolean(loadError)} empty={!loadError} onRetry={() => void load()} /> : (
            <div className="dgmg-compliance">
              <div className="dgmg-compliance__chart" role="img" aria-label={`Taux global de conformité : ${formatDgmgPercent(data.compliance.rate)}`}>
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={complianceChartData} dataKey="value" nameKey="label" innerRadius="67%" outerRadius="88%" stroke="none">{complianceChartData.map((item) => <Cell key={item.key} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer>
                <strong>{formatDgmgPercent(data.compliance.rate)}</strong>
              </div>
              <dl>{complianceItems.map((item) => <div key={item.key}><dt><i style={{ background: item.color }} />{item.label}</dt><dd>{formatDgmgInteger(item.value)}</dd></div>)}</dl>
            </div>
          )}
        </article>
      </section>

      <section className="dgmg-dashboard__bottom-grid">
        <article className="dgmg-panel dgmg-panel--activities">
          <header><h2>Activités réglementaires récentes</h2></header>
          {loading ? <div className="dgmg-table-skeleton" aria-hidden="true" /> : loadError || !data?.activities.length ? <PanelState error={Boolean(loadError)} empty={!loadError} onRetry={() => void load()} /> : (
            <div className="dgmg-table-scroll"><table><thead><tr><th>Référence</th><th>Opérateur</th><th>Activité</th><th>Zone</th><th>Statut</th><th>Date</th></tr></thead><tbody>{data.activities.map((activity) => <tr key={activity.id}><td>{activity.reference ?? '—'}</td><td title={activity.operatorName}>{activity.operatorName}</td><td title={activity.activity}>{activity.activity}</td><td>{activity.zone ?? 'Zone inconnue'}</td><td><span className={`dgmg-status is-${activity.statusTone}`}>{activity.status ?? 'Indisponible'}</span></td><td>{displayedDateTime(activity.occurredAt)}</td></tr>)}</tbody></table></div>
          )}
        </article>

        <article className="dgmg-panel dgmg-panel--attention">
          <header><h2>Points d’attention</h2></header>
          {loading ? <div className="dgmg-attention-skeleton" aria-hidden="true" /> : loadError ? <PanelState error onRetry={() => void load()} empty={false} /> : (
            <ul>
              <li><Clock3 aria-hidden="true" /><span><strong>{formatDgmgInteger(data?.attention.lateDeclarations)}</strong> déclarations hors délai</span></li>
              <li><CalendarDays aria-hidden="true" /><span><strong>{formatDgmgInteger(data?.attention.expiringLicenses)}</strong> licences arrivant à expiration</span></li>
              <li><FileWarning aria-hidden="true" /><span><strong>{formatDgmgInteger(data?.attention.productionGaps)}</strong> écarts de production à vérifier</span></li>
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}

export default DgmgRegulatoryDashboard;
