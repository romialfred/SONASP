import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Download,
  Landmark,
  Link2,
  Percent,
  ReceiptText,
  RefreshCw,
  SlidersHorizontal,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { dgiFiscalDashboardService } from '@/services/dgiFiscalDashboardService';
import {
  buildDgiFiscalCsv,
  formatFiscalAmount,
  formatFiscalPercent,
  priorityLabel,
  recoveryPerformanceLabel,
} from '@/lib/dgiFiscalDashboard';
import { errorMessage } from '@/lib/errorMessage';
import type { DgiFiscalDashboardData } from '@/types/dgiFiscal';
import './dgi-fiscal-dashboard.css';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: 'short', year: 'numeric',
});
const compactNumberFormatter = new Intl.NumberFormat('fr-FR', {
  notation: 'compact', maximumFractionDigits: 1,
});

function isoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function initialPeriod() {
  const today = new Date();
  return { startDate: `${today.getFullYear()}-01-01`, endDate: isoDate(today) };
}

function displayedDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function Sparkline({ values, tone }: { values: Array<number | null>; tone: 'blue' | 'green' | 'orange' }) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (valid.length < 2 || Math.max(...valid) === Math.min(...valid)) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const points = valid.map((value, index) => {
    const x = 4 + index * (86 / Math.max(valid.length - 1, 1));
    const y = 34 - ((value - min) / (max - min)) * 26;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className={`dgi-kpi__sparkline is-${tone}`} viewBox="0 0 94 40" role="img" aria-label="Tendance sur la période">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(' ').map((point) => {
        const [cx, cy] = point.split(',');
        return <circle key={point} cx={cx} cy={cy} r="2" fill="currentColor" />;
      })}
    </svg>
  );
}

function Gauge({ rate, objective }: { rate: number | null; objective: number | null }) {
  const centerX = 120;
  const centerY = 112;
  const radius = 86;
  const clamped = rate === null ? 0 : Math.min(Math.max(rate, 0), 100);
  const point = (angle: number, distance = radius) => ({
    x: centerX + distance * Math.cos(angle * Math.PI / 180),
    y: centerY + distance * Math.sin(angle * Math.PI / 180),
  });
  const arc = (endAngle: number) => {
    const start = point(180);
    const end = point(endAngle);
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${endAngle - 180 > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
  };
  const objectiveAngle = objective === null ? null : 180 + Math.min(Math.max(objective, 0), 100) * 1.8;
  const markerStart = objectiveAngle === null ? null : point(objectiveAngle, radius - 8);
  const markerEnd = objectiveAngle === null ? null : point(objectiveAngle, radius + 8);

  return (
    <div className="dgi-gauge">
      <svg viewBox="0 0 240 130" role="img" aria-label={`Taux de recouvrement : ${formatFiscalPercent(rate)}`}>
        <path d={arc(360)} className="dgi-gauge__track" />
        {rate !== null && <path d={arc(180 + clamped * 1.8)} className="dgi-gauge__value" />}
        {markerStart && markerEnd && (
          <line
            x1={markerStart.x} y1={markerStart.y}
            x2={markerEnd.x} y2={markerEnd.y}
            className="dgi-gauge__objective"
          />
        )}
        <text x="120" y="92" textAnchor="middle" className="dgi-gauge__number">
          {rate === null ? '—' : `${Math.round(rate * 10) / 10} %`}
        </text>
        <text x="120" y="111" textAnchor="middle" className="dgi-gauge__caption">
          {recoveryPerformanceLabel(rate, objective)}
        </text>
        <text x="23" y="127" textAnchor="middle" className="dgi-gauge__tick">0</text>
        <text x="217" y="127" textAnchor="middle" className="dgi-gauge__tick">100</text>
      </svg>
      {objective !== null && <small>Objectif paramétré : {formatFiscalPercent(objective)}</small>}
    </div>
  );
}

interface KpiProps {
  title: string;
  value: string;
  hint: string | null;
  icon: typeof ReceiptText;
  tone: 'blue' | 'green' | 'orange';
  sparkline?: Array<number | null>;
}

function KpiCard({ title, value, hint, icon: Icon, tone, sparkline = [] }: KpiProps) {
  return (
    <article className={`dgi-kpi is-${tone}`}>
      <div className="dgi-kpi__copy">
        <span>{title}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
      <Icon className="dgi-kpi__icon" aria-hidden="true" />
      <Sparkline values={sparkline} tone={tone} />
    </article>
  );
}

export function DgiFiscalDashboard() {
  const [filters, setFilters] = useState(initialPeriod);
  const [period, setPeriod] = useState(initialPeriod);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<DgiFiscalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await dgiFiscalDashboardService.load(period.startDate, period.endDate));
    } catch (reason) {
      setData(null);
      setLoadError(errorMessage(reason, 'Impossible de charger le tableau fiscal DGI.'));
    } finally {
      setLoading(false);
    }
  }, [period.endDate, period.startDate]);

  useEffect(() => { void load(); }, [load]);

  const collectedSeries = data?.monthly.map((point) => point.collectedAmount) ?? [];
  const expectedSeries = data?.monthly.map((point) => point.expectedAmount) ?? [];
  const counters = useMemo(() => data ? [
    data.counters.paymentsToReconcile === null ? null : {
      icon: Link2, value: data.counters.paymentsToReconcile, label: 'paiement(s) à rapprocher',
    },
    data.counters.lateDeclarations === null ? null : {
      icon: CalendarDays, value: data.counters.lateDeclarations, label: 'déclaration(s) en retard',
    },
    data.counters.assessmentGaps === null ? null : {
      icon: AlertTriangle, value: data.counters.assessmentGaps, label: 'écart(s) d’assiette',
    },
  ].filter((item): item is NonNullable<typeof item> => item !== null) : [], [data]);

  const exportCurrentData = () => {
    if (!data?.hasData) return;
    const blob = new Blob([buildDgiFiscalCsv(data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `collecte-fiscale-dgi-${data.period.startDate}-${data.period.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    if (!filters.startDate || !filters.endDate || filters.endDate < filters.startDate) {
      setLoadError('La date de fin doit être postérieure ou égale à la date de début.');
      return;
    }
    setFiltersOpen(false);
    setPeriod(filters);
  };

  return (
    <main className="dgi-dashboard" aria-busy={loading}>
      <header className="dgi-dashboard__page-header">
        <div>
          <nav aria-label="Fil d’Ariane"><span>Accueil</span><i>/</i><span>Portail DGI</span><i>/</i><strong>Collecte fiscale</strong></nav>
          <h1>Collecte des taxes et impôts</h1>
          <p>Suivi du recouvrement fiscal généré par les activités aurifères</p>
        </div>
        <div className="dgi-dashboard__page-actions">
          <button type="button" className="dgi-period-button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            <CalendarDays aria-hidden="true" />
            <span>{displayedDate(period.startDate)} – {displayedDate(period.endDate)}</span>
          </button>
          <button type="button" className="dgi-action-button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            <SlidersHorizontal aria-hidden="true" /> Filtres
          </button>
          <button type="button" className="dgi-action-button is-primary" onClick={exportCurrentData} disabled={!data?.hasData}>
            <Download aria-hidden="true" /> Exporter
          </button>
        </div>
      </header>

      {filtersOpen && (
        <form className="dgi-dashboard__filters" onSubmit={applyFilters}>
          <label>Date de début<input type="date" value={filters.startDate} max={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>Date de fin<input type="date" value={filters.endDate} min={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <button type="submit">Appliquer la période</button>
        </form>
      )}

      {loadError && (
        <div className="dgi-dashboard__alert" role="alert">
          <AlertTriangle aria-hidden="true" /><span>{loadError}</span>
          <button type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Réessayer</button>
        </div>
      )}
      {data?.partial && !loadError && (
        <div className="dgi-dashboard__alert is-warning" role="status">
          <AlertTriangle aria-hidden="true" /><span>Certains agrégats fiscaux ne sont pas disponibles pour cette période.</span>
        </div>
      )}

      <section className="dgi-dashboard__kpis" aria-label="Indicateurs de recouvrement">
        {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="dgi-kpi is-loading" />) : (
          <>
            <KpiCard title="Impôts et taxes attendus" value={data?.hasData ? formatFiscalAmount(data.summary.expectedAmount) : 'Aucune donnée'} hint={data?.hasData && data.summary.declarationCount !== null ? `${data.summary.declarationCount} déclaration(s)` : null} icon={ReceiptText} tone="blue" sparkline={expectedSeries} />
            <KpiCard title="Montant encaissé" value={data?.hasData ? formatFiscalAmount(data.summary.collectedAmount) : 'Aucune donnée'} hint={data?.hasData && data.summary.collectedTrendPercent !== null ? `${data.summary.collectedTrendPercent >= 0 ? '+' : ''}${formatFiscalPercent(data.summary.collectedTrendPercent)} sur la période précédente` : null} icon={WalletCards} tone="green" sparkline={collectedSeries} />
            <KpiCard title="Reste à recouvrer" value={data?.hasData ? formatFiscalAmount(data.summary.remainingAmount) : 'Aucune donnée'} hint={null} icon={CircleDollarSign} tone="orange" sparkline={expectedSeries.map((expected, index) => expected === null || collectedSeries[index] === null ? null : Math.max(expected - (collectedSeries[index] ?? 0), 0))} />
            <KpiCard title="Taux de recouvrement" value={data?.hasData ? formatFiscalPercent(data.summary.recoveryRate) : 'Aucune donnée'} hint={data?.hasData ? recoveryPerformanceLabel(data.summary.recoveryRate, data.objectiveRate) : null} icon={Percent} tone="blue" />
          </>
        )}
      </section>

      {!loading && !loadError && data && !data.hasData && (
        <section className="dgi-dashboard__empty">
          <Landmark aria-hidden="true" />
          <h2>Aucune donnée fiscale pour cette période</h2>
          <p>Élargissez la période ou vérifiez que les écritures fiscales et reversements ont été enregistrés.</p>
          <button type="button" onClick={() => setFiltersOpen(true)}><CalendarDays aria-hidden="true" /> Modifier la période</button>
        </section>
      )}

      {!loading && data?.hasData && (
        <>
          <section className="dgi-dashboard__analytics">
            <article className="dgi-panel dgi-panel--monthly">
              <header><div><h2>Collecte mensuelle des recettes</h2><span>Montants en FCFA issus des écritures fiscales enregistrées</span></div></header>
              {data.monthly.length === 0 ? <p className="dgi-panel__empty">Série mensuelle indisponible.</p> : (
                <div className="dgi-chart" role="img" aria-label="Histogramme mensuel des montants attendus et encaissés">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthly} margin={{ top: 12, right: 10, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke="#e7edf4" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#52657d', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#cfd9e5' }} />
                      <YAxis tickFormatter={(value) => compactNumberFormatter.format(Number(value))} tick={{ fill: '#52657d', fontSize: 11 }} tickLine={false} axisLine={false} width={62} />
                      <Tooltip formatter={(value) => formatFiscalAmount(typeof value === 'number' ? value : Number(value))} labelStyle={{ color: '#12233f', fontWeight: 700 }} />
                      <Bar dataKey="expectedAmount" name="Attendu" fill="#2f6bba" radius={[3, 3, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="collectedAmount" name="Encaissé" fill="#d3a72c" radius={[3, 3, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="dgi-chart__legend"><span className="is-blue">Attendu</span><span className="is-gold">Encaissé</span></div>
            </article>

            <div className="dgi-dashboard__analytics-side">
              <article className="dgi-panel">
                <header><h2>Répartition par nature d’impôt</h2></header>
                {data.taxBreakdown.length === 0 ? <p className="dgi-panel__empty">Aucune ventilation encaissée disponible.</p> : (
                  <div className="dgi-tax-breakdown">
                    {data.taxBreakdown.map((item) => (
                      <div key={item.code}>
                        <span>{item.label}</span>
                        <i><b style={{ width: `${Math.min(item.sharePercent ?? 0, 100)}%` }} /></i>
                        <strong>{formatFiscalPercent(item.sharePercent)}</strong>
                        <small>{formatFiscalAmount(item.amount)}</small>
                      </div>
                    ))}
                  </div>
                )}
              </article>
              <article className="dgi-panel dgi-panel--gauge">
                <header><h2>Performance de recouvrement</h2></header>
                <Gauge rate={data.summary.recoveryRate} objective={data.objectiveRate} />
              </article>
            </div>
          </section>

          <section className="dgi-dashboard__bottom-grid">
            <article className="dgi-panel dgi-panel--contributors">
              <header><h2>Principaux contributeurs</h2><span>Montants encaissés</span></header>
              {data.contributors.length === 0 ? <p className="dgi-panel__empty">Aucun contributeur visible sur cette période.</p> : (
                <ol>
                  {data.contributors.map((item, index) => {
                    const max = data.contributors[0]?.amount ?? 0;
                    const width = max > 0 && item.amount !== null ? item.amount / max * 100 : 0;
                    return <li key={item.id}><b>{index + 1}</b><span>{item.name}</span><i><em style={{ width: `${width}%` }} /></i><strong>{formatFiscalAmount(item.amount)}</strong></li>;
                  })}
                </ol>
              )}
            </article>

            <article className="dgi-panel dgi-panel--priorities">
              <header><h2>Échéances et recouvrements prioritaires</h2></header>
              {data.priorities.length === 0 ? <p className="dgi-panel__empty">Aucune échéance prioritaire visible.</p> : (
                <div className="dgi-table-scroll"><table><thead><tr><th>Opérateur</th><th>Nature</th><th>Montant dû</th><th>Échéance</th><th>Priorité</th></tr></thead><tbody>
                  {data.priorities.map((item) => <tr key={item.id}><td>{item.operatorName}</td><td>{item.taxNature}</td><td>{formatFiscalAmount(item.amountDue)}</td><td>{displayedDate(item.dueDate)}</td><td><span className={`dgi-priority is-${item.priority}`}>{priorityLabel(item.priority)}</span></td></tr>)}
                </tbody></table></div>
              )}
              {counters.length > 0 && <div className="dgi-counters" aria-label="Points d’attention">
                {counters.map(({ icon: Icon, value, label }) => <span key={label}><Icon aria-hidden="true" /><strong>{value}</strong> {label}</span>)}
              </div>}
            </article>
          </section>
        </>
      )}
    </main>
  );
}

export default DgiFiscalDashboard;
