import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  Clock3,
  Coins,
  FileSpreadsheet,
  Info,
  LayoutGrid,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from '@/lib/recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  BurkinaTerritoryMap,
  STATUS_COLORS,
  STATUS_LABELS,
  type TerritoryStatus,
} from '@/components/artisanal-sites/BurkinaTerritoryMap';
import { useArtisanalSiteData } from '@/hooks/useArtisanalSiteData';
import { useAuth } from '@/contexts/AuthContext';
import { canManageMiningRegistry } from '@/lib/miningRegistryAccess';
import { FORMALIZATION_LABELS } from '@/lib/siteFormalization';
import {
  ANNUAL_PRODUCTION_TARGET_KG,
  buildMonthlyProduction,
  buildSiteInsights,
  computeGlobalCompliance,
  computeRegionContributions,
  computeVigilance,
} from '@/services/artisanalSiteInsights';
import type { SiteFormalization } from '@/types/artisanalSite';
import './artisanal-sites-dashboard.css';

const TABLE_SCOPES = [
  { value: 'all', label: 'Tous' },
  { value: 'formalized', label: 'Formalisés' },
  { value: 'non_formalized', label: 'Non formalisés' },
  { value: 'watch', label: 'À surveiller' },
  { value: 'suspended', label: 'Suspendus' },
] as const;
type TableScope = (typeof TABLE_SCOPES)[number]['value'];
type MapTab = 'map' | 'regions';

const REFERENCE_DATE = new Date();
const YEAR = REFERENCE_DATE.getFullYear();

const decimal = (value: number, digits = 1) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const integer = new Intl.NumberFormat('fr-FR');

function formatFcfa(value: number) {
  if (value >= 1_000_000_000) return `${decimal(value / 1_000_000_000)} Md FCFA`;
  if (value >= 1_000_000) return `${decimal(value / 1_000_000)} M FCFA`;
  return `${integer.format(Math.round(value))} FCFA`;
}

function formatDeclaration(date: string | null) {
  if (!date) return 'Aucune déclaration';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Date indisponible';

  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(REFERENCE_DATE) - startOfDay(parsed)) / 86_400_000);
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(parsed);

  if (days === 0) return `Aujourd’hui, ${time}`;
  if (days === 1) return `Hier, ${time}`;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(parsed);
}

const GAUGE = { cx: 110, cy: 96, radius: 78, thickness: 15 } as const;

/**
 * Arc SVG de la jauge : demi-cercle parcouru de la gauche (0) vers la droite (100).
 * Le balayage ne dépasse jamais 180°, donc `large-arc-flag` reste à 0 ; le mettre à 1
 * ferait tracer l'arc complémentaire.
 */
function describeArc(from: number, to: number) {
  const point = (ratio: number) => {
    const angle = Math.PI * (1 - ratio);
    return {
      x: GAUGE.cx + GAUGE.radius * Math.cos(angle),
      y: GAUGE.cy - GAUGE.radius * Math.sin(angle),
    };
  };
  const start = point(from);
  const end = point(to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${GAUGE.radius} ${GAUGE.radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function ComplianceGauge({ score }: { score: number }) {
  const ratio = Math.max(0, Math.min(100, score)) / 100;
  const angle = Math.PI * (1 - ratio);
  const needle = {
    x: GAUGE.cx + 62 * Math.cos(angle),
    y: GAUGE.cy - 62 * Math.sin(angle),
  };

  return (
    <svg className="sites-gauge__svg" viewBox="0 0 220 118" role="img" aria-label={`Indice de conformité ${score} sur 100`}>
      <path d={describeArc(0, 1)} stroke="#eef2f5" strokeWidth={GAUGE.thickness} fill="none" strokeLinecap="round" />
      {ratio > 0.002 && (
        <path d={describeArc(0, ratio)} stroke="#0f7a56" strokeWidth={GAUGE.thickness} fill="none" strokeLinecap="round" />
      )}
      {ratio < 0.998 && (
        <path d={describeArc(ratio, 1)} stroke="#e2a000" strokeWidth={GAUGE.thickness} fill="none" strokeLinecap="round" />
      )}
      <line
        x1={GAUGE.cx}
        y1={GAUGE.cy}
        x2={needle.x.toFixed(2)}
        y2={needle.y.toFixed(2)}
        stroke="#10243e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={GAUGE.cx} cy={GAUGE.cy} r="6" fill="#10243e" />
      <text x="24" y="114" className="sites-gauge__bound">0</text>
      <text x="196" y="114" className="sites-gauge__bound">100</text>
    </svg>
  );
}

export default function ArtisanalSitesOverview() {
  const navigate = useNavigate();
  const { sites, productions, loading, error, refresh } = useArtisanalSiteData();
  const { user } = useAuth();
  const canManage = canManageMiningRegistry(user);

  const [startDate, setStartDate] = useState(`${YEAR}-01-01`);
  const [endDate, setEndDate] = useState(`${YEAR}-12-31`);
  const [datePanelOpen, setDatePanelOpen] = useState(false);
  const [region, setRegion] = useState('all');
  const [status, setStatus] = useState<'all' | TerritoryStatus>('all');
  const [exploitation, setExploitation] = useState<'all' | 'unknown' | SiteFormalization>('all');
  const [search, setSearch] = useState('');

  const [mapTab, setMapTab] = useState<MapTab>('map');
  const [scope, setScope] = useState<TableScope>('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const periodProductions = useMemo(
    () => productions.filter((item) => item.productionDate >= startDate && item.productionDate <= endDate),
    [endDate, productions, startDate]
  );

  const allInsights = useMemo(
    () => {
      const current = new Map(buildSiteInsights(sites, productions, new Date()).map(item => [item.site.id, item]));
      return buildSiteInsights(sites, periodProductions, new Date()).map(item => ({
        ...item, compliance: current.get(item.site.id)!.compliance,
        status: current.get(item.site.id)!.status, lastDeclaration: current.get(item.site.id)!.lastDeclaration,
      }));
    },
    [periodProductions, productions, sites]
  );

  const insights = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return allInsights.filter(({ site, status: siteStatus }) => {
      const matchesRegion = region === 'all' || site.region === region;
      const matchesStatus = status === 'all' || siteStatus === status;
      const matchesType = exploitation === 'all' || (site.formalization || 'unknown') === exploitation;
      const matchesSearch =
        !query ||
        [site.name, site.code, site.region, site.province, site.locality]
          .join(' ')
          .toLocaleLowerCase('fr')
          .includes(query);
      return matchesRegion && matchesStatus && matchesType && matchesSearch;
    });
  }, [allInsights, exploitation, region, search, status]);

  const regions = useMemo(
    () => [...new Set(sites.map((site) => site.region))].sort((a, b) => a.localeCompare(b, 'fr')),
    [sites]
  );

  const totals = useMemo(() => {
    const authorized = insights.reduce((sum, item) => sum + item.site.authorizedMiners, 0);
    const active = insights.reduce((sum, item) => sum + item.site.activeMiners, 0);
    const productionKg = insights.reduce((sum, item) => sum + item.productionKg, 0);
    const revenue = insights.reduce((sum, item) => sum + item.revenueFcfa, 0);
    const taxes = insights.reduce((sum, item) => sum + item.taxesFcfa, 0);
    return {
      authorized,
      active,
      productionKg,
      revenue,
      taxes,
      activeSites: insights.filter((item) => item.site.status === 'active').length,
      occupancy: authorized > 0 ? Math.round((active / authorized) * 100) : 0,
      targetShare: Math.round((productionKg / ANNUAL_PRODUCTION_TARGET_KG) * 100),
      revenuePerMiner: active > 0 ? revenue / active : 0,
      recovery: revenue > 0 ? Math.min(100, Math.round((taxes / (revenue * 0.03)) * 100)) : 0,
    };
  }, [insights]);

  const monthly = useMemo(
    () => buildMonthlyProduction(periodProductions, YEAR),
    [periodProductions]
  );
  const vigilance = useMemo(() => computeVigilance(insights, REFERENCE_DATE), [insights]);
  const globalCompliance = useMemo(() => computeGlobalCompliance(insights), [insights]);
  const contributions = useMemo(() => computeRegionContributions(insights), [insights]);

  const statusCounts = useMemo(
    () =>
      insights.reduce(
        (counters, item) => ({ ...counters, [item.status]: (counters[item.status] || 0) + 1 }),
        {} as Record<TerritoryStatus, number>
      ),
    [insights]
  );

  const exploitationCounts = useMemo(() => {
    const counters = { formalized: 0, non_formalized: 0, unknown: 0 };
    insights.forEach((item) => {
      counters[item.site.formalization || 'unknown'] += 1;
    });
    return counters;
  }, [insights]);

  const topSites = useMemo(
    () => [...insights].sort((a, b) => b.site.activeMiners - a.site.activeMiners).slice(0, 4),
    [insights]
  );

  const scopedSites = useMemo(() => {
    if (scope === 'formalized' || scope === 'non_formalized') {
      return insights.filter((item) => item.site.formalization === scope);
    }
    if (scope === 'watch') return insights.filter((item) => item.status === 'watch');
    if (scope === 'suspended') return insights.filter((item) => item.status === 'suspended');
    return insights;
  }, [insights, scope]);

  const pageCount = Math.max(1, Math.ceil(scopedSites.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleSites = scopedSites.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const mapSites = useMemo(
    () =>
      insights.map((item) => ({
        id: item.site.id,
        name: item.site.name,
        region: item.site.region,
        longitude: item.site.longitude,
        latitude: item.site.latitude,
        status: item.status,
        details: [
          `${integer.format(item.site.activeMiners)} artisans`,
          `${decimal(item.site.areaHectares, 0)} ha`,
          `${decimal(item.productionKg)} kg produits`,
        ],
      })),
    [insights]
  );

  const resetFilters = () => {
    setRegion('all');
    setStatus('all');
    setExploitation('all');
    setSearch('');
    setStartDate(`${YEAR}-01-01`);
    setEndDate(`${YEAR}-12-31`);
    setScope('all');
    setPage(1);
  };

  const periodLabel = `${new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(startDate))} – ${new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(endDate))}`;

  return (
    <NationalDashboardLayout>
      <div className="sites-dashboard">
        <header className="sites-dashboard__intro">
          <div>
            <p className="sites-dashboard__eyebrow">Pilotage territorial</p>
            <h2>Tableau de bord des sites miniers artisanaux</h2>
            <p className="sites-dashboard__subtitle">
              Supervision nationale de l’activité, de la conformité et de la performance des sites
            </p>
          </div>
          <div className="sites-dashboard__actions">
            <button type="button" className="sites-button" onClick={refresh} disabled={loading}>
              <RotateCcw aria-hidden="true" /> Actualiser
            </button>
            {canManage && <button type="button" className="sites-button sites-button--gold" onClick={() => navigate('/artisan-sites/nouveau')}>
              <Plus aria-hidden="true" /> Enregistrer un site
            </button>}
          </div>
        </header>

        <section className="sites-filters" aria-label="Filtres de supervision">
          <div className="sites-filters__date">
            <button type="button" className="sites-filter" onClick={() => setDatePanelOpen((open) => !open)} aria-expanded={datePanelOpen}>
              <CalendarDays aria-hidden="true" />
              <span>{periodLabel}</span>
            </button>
            {datePanelOpen && (
              <div className="sites-filters__panel">
                <label>
                  Du
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label>
                  Au
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
                <button type="button" onClick={() => setDatePanelOpen(false)}>Appliquer</button>
              </div>
            )}
          </div>

          <label className="sites-filter sites-filter--select">
            <span>Région</span>
            <select value={region} onChange={(event) => { setRegion(event.target.value); setPage(1); }}>
              <option value="all">Toutes</option>
              {regions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>

          <label className="sites-filter sites-filter--select">
            <span>Statut</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value as 'all' | TerritoryStatus); setPage(1); }}>
              <option value="all">Tous</option>
              {(Object.keys(STATUS_LABELS) as TerritoryStatus[]).map((item) => (
                <option key={item} value={item}>{STATUS_LABELS[item]}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>

          <label className="sites-filter sites-filter--select">
            <span>Catégorie du site</span>
            <select value={exploitation} onChange={(event) => { setExploitation(event.target.value as 'all' | 'unknown' | SiteFormalization); setPage(1); }}>
              <option value="all">Tous</option>
              {(Object.keys(FORMALIZATION_LABELS) as (keyof typeof FORMALIZATION_LABELS)[]).map((item) => (
                <option key={item} value={item}>{FORMALIZATION_LABELS[item]}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>

          <label className="sites-filter sites-filter--search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={search}
              placeholder="Rechercher un site"
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              aria-label="Rechercher un site"
            />
          </label>

          <button type="button" className="sites-filters__reset" onClick={resetFilters}>
            <RotateCcw aria-hidden="true" /> Réinitialiser
          </button>
        </section>

        {error && <div className="sites-dashboard__error" role="alert">{error}</div>}

        <section className="sites-dashboard__metrics" aria-label="Indicateurs des sites artisanaux">
          <article className="sites-metric">
            <span className="sites-metric__icon is-green"><LayoutGrid aria-hidden="true" /></span>
            <div>
              <h3>Sites recensés</h3>
              <strong>{integer.format(insights.length)}</strong>
              <small>{integer.format(totals.activeSites)} actifs</small>
            </div>
            <p className="is-positive"><TrendingUp aria-hidden="true" /> +8,2 % <span>vs année précédente</span></p>
          </article>

          <article className="sites-metric">
            <span className="sites-metric__icon is-green"><Users aria-hidden="true" /></span>
            <div>
              <h3>Artisans autorisés</h3>
              <strong>{integer.format(totals.authorized)}</strong>
              <small>{totals.occupancy} % de la capacité</small>
            </div>
            <p className="is-positive"><TrendingUp aria-hidden="true" /> +4,6 % <span>vs année précédente</span></p>
          </article>

          <article className="sites-metric">
            <span className="sites-metric__icon is-green"><Coins aria-hidden="true" /></span>
            <div>
              <h3>Production déclarée</h3>
              <strong>{decimal(totals.productionKg)} kg</strong>
              <small>Objectif {totals.targetShare} %</small>
            </div>
            <div className="sites-metric__spark">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <Area type="monotone" dataKey="production" stroke="#0f7a56" strokeWidth={1.6} fill="#0f7a56" fillOpacity={0.12} dot={{ r: 1.6, fill: '#0f7a56', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="sites-metric">
            <span className="sites-metric__icon is-gold"><Banknote aria-hidden="true" /></span>
            <div>
              <h3>Valeur des transactions</h3>
              <strong>{formatFcfa(totals.revenue)}</strong>
              <small>Moyenne {formatFcfa(totals.revenuePerMiner)} / artisan</small>
            </div>
          </article>

          <article className="sites-metric">
            <span className="sites-metric__icon is-green"><FileSpreadsheet aria-hidden="true" /></span>
            <div>
              <h3>Taxes et redevances</h3>
              <strong>{formatFcfa(totals.taxes)}</strong>
              <small>Taux de recouvrement {totals.recovery} %</small>
            </div>
          </article>
        </section>

        <section className="sites-dashboard__mid">
          <article className="sites-panel sites-map-panel">
            <div className="sites-panel__header">
              <h3>Implantation et performance des sites</h3>
            </div>
            <div className="sites-map-panel__body">
              <div className="sites-map-panel__map">
                <div className="sites-tabs sites-tabs--underline" role="tablist" aria-label="Affichage de l’implantation">
                  <button type="button" role="tab" aria-selected={mapTab === 'map'} className={mapTab === 'map' ? 'is-active' : ''} onClick={() => setMapTab('map')}>Carte</button>
                  <button type="button" role="tab" aria-selected={mapTab === 'regions'} className={mapTab === 'regions' ? 'is-active' : ''} onClick={() => setMapTab('regions')}>Régions</button>
                </div>
                {mapTab === 'map' ? (
                  <BurkinaTerritoryMap variant="sites" sites={mapSites} />
                ) : (
                  <div className="sites-region-table">
                    <table>
                      <thead>
                        <tr><th>Région</th><th>Sites</th><th>Artisans</th><th>Part CA</th></tr>
                      </thead>
                      <tbody>
                        {contributions.map((row) => (
                          <tr key={row.region}>
                            <td>{row.region}</td>
                            <td>{integer.format(row.sites)}</td>
                            <td>{integer.format(row.artisans)}</td>
                            <td>{row.share} %</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="sites-top">
                <h4>Sites les plus actifs</h4>
                <ol>
                  {topSites.map((item, index) => (
                    <li key={item.site.id}>
                      <span className="sites-top__rank">{index + 1}</span>
                      <span className="sites-top__label">
                        <strong title={item.site.name}>{item.site.name}</strong>
                        <small>{item.site.region}</small>
                      </span>
                      <b>{integer.format(item.site.activeMiners)}</b>
                    </li>
                  ))}
                </ol>
                <button type="button" className="sites-ghost-button" onClick={() => { setScope('all'); setPage(1); }}>
                  Voir tous les sites
                </button>
              </div>
            </div>
          </article>

          <article className="sites-panel sites-vigilance">
            <div className="sites-panel__header">
              <h3>Vigilance opérationnelle</h3>
            </div>
            <div className="sites-vigilance__body">
              <div className="sites-gauge">
                <p>Indice de conformité <Info aria-hidden="true" /></p>
                <strong>{globalCompliance} <span>/ 100</span></strong>
                <ComplianceGauge score={globalCompliance} />
                <small>Niveau de conformité global</small>
              </div>

              <div className="sites-vigilance__alerts">
                <button type="button" onClick={() => { setScope('all'); setPage(1); }}>
                  <span className="sites-vigilance__icon is-gold"><Clock3 aria-hidden="true" /></span>
                  <span><b>{vigilance.permitsToRenew}</b> autorisations à renouveler</span>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button type="button" onClick={() => { setScope('watch'); setPage(1); }}>
                  <span className="sites-vigilance__icon is-orange"><AlertTriangle aria-hidden="true" /></span>
                  <span><b>{vigilance.missingDeclarations}</b> sites sans déclaration récente</span>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button type="button" onClick={() => { setScope('watch'); setPage(1); }}>
                  <span className="sites-vigilance__icon is-blue"><TrendingUp aria-hidden="true" /></span>
                  <span><b>{vigilance.capacityOverruns}</b> dépassement de capacité</span>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button type="button" onClick={() => { setScope('suspended'); setPage(1); }}>
                  <span className="sites-vigilance__icon is-red"><AlertCircle aria-hidden="true" /></span>
                  <span><b>{vigilance.suspendedSites}</b> site suspendu</span>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button type="button" className="sites-ghost-button" onClick={() => { setScope('watch'); setPage(1); }}>
                  Voir le plan d’actions
                </button>
              </div>
            </div>
          </article>
        </section>

        <section className="sites-dashboard__charts">
          <article className="sites-panel">
            <div className="sites-panel__header sites-panel__header--stacked">
              <h3>Production mensuelle</h3>
              <span className="sites-panel__aside">{decimal(totals.productionKg)} kg <small>cumulés</small></span>
            </div>
            <div className="sites-chart-legend">
              <span><i className="is-line" style={{ background: '#0f7a56' }} aria-hidden="true" /> Production déclarée (kg)</span>
              <span><i className="is-dashed" aria-hidden="true" /> Objectif mensuel (kg)</span>
            </div>
            <div className="sites-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e6ecf1" strokeDasharray="2 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#d7e0e8' }} tick={{ fill: '#61748a', fontSize: 9.5 }} />
                  <YAxis tickLine={false} axisLine={false} width={42} tick={{ fill: '#61748a', fontSize: 9.5 }} />
                  <Tooltip
                    formatter={(value) => `${decimal(Number(value))} kg`}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2eaf0', fontSize: 11 }}
                  />
                  <Line type="monotone" name="Production déclarée" dataKey="production" stroke="#0f7a56" strokeWidth={2} dot={{ r: 2.6, fill: '#0f7a56', strokeWidth: 0 }} />
                  <Line type="monotone" name="Objectif mensuel" dataKey="objective" stroke="#e2a000" strokeWidth={1.8} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="sites-panel">
            <div className="sites-panel__header"><h3>Répartition des sites</h3></div>
            <div className="sites-split">
              <p className="sites-split__title">Par catégorie de site</p>
              <ul className="sites-bars">
                {(Object.keys(FORMALIZATION_LABELS) as (keyof typeof FORMALIZATION_LABELS)[]).map((type) => {
                  const value = exploitationCounts[type];
                  const max = Math.max(1, ...Object.values(exploitationCounts));
                  return (
                    <li key={type}>
                      <span>{FORMALIZATION_LABELS[type]}</span>
                      <i><b style={{ width: `${(value / max) * 100}%`, background: type === 'non_formalized' ? '#e2a000' : '#149a6b' }} /></i>
                      <strong>{value}</strong>
                    </li>
                  );
                })}
              </ul>

              <p className="sites-split__title">Par statut</p>
              <div className="sites-status-grid">
                {(Object.keys(STATUS_LABELS) as TerritoryStatus[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className="sites-status-box"
                    style={{ color: STATUS_COLORS[item] }}
                    onClick={() => { setStatus(item); setPage(1); }}
                  >
                    <small>{item === 'active' ? 'Actifs' : item === 'planned' ? 'Planifiés' : item === 'watch' ? 'Surveillance' : 'Suspendus'}</small>
                    <strong>{statusCounts[item] || 0}</strong>
                  </button>
                ))}
              </div>
            </div>
          </article>

          <article className="sites-panel">
            <div className="sites-panel__header"><h3>Contribution régionale</h3></div>
            <ul className="sites-bars sites-bars--region">
              {contributions.map((row) => (
                <li key={row.region}>
                  <span>{row.region}</span>
                  <i><b style={{ width: `${row.share}%` }} /></i>
                  <strong>{row.share} %</strong>
                </li>
              ))}
            </ul>
            <p className="sites-bars__total">Total <strong>{contributions.reduce((sum, row) => sum + row.share, 0)} %</strong></p>
          </article>
        </section>

        <section className="sites-panel sites-table-panel" aria-labelledby="sites-table-title">
          <div className="sites-panel__header">
            <h3 id="sites-table-title">Suivi opérationnel des sites <span className="sites-badge">{integer.format(insights.length)} sites</span></h3>
            <div className="sites-tabs sites-tabs--scope" role="tablist" aria-label="Filtrer la liste des sites">
              {TABLE_SCOPES.map((tab, index) => (
                <button key={tab.value} type="button" role="tab" id={`site-scope-${tab.value}`}
                  aria-selected={scope === tab.value} aria-controls="site-scope-panel"
                  tabIndex={scope === tab.value ? 0 : -1}
                  className={scope === tab.value ? 'is-active' : ''}
                  onClick={() => { setScope(tab.value); setPage(1); }}
                  onKeyDown={(event) => {
                    const next = event.key === 'ArrowRight' ? (index + 1) % TABLE_SCOPES.length
                      : event.key === 'ArrowLeft' ? (index - 1 + TABLE_SCOPES.length) % TABLE_SCOPES.length
                        : event.key === 'Home' ? 0 : event.key === 'End' ? TABLE_SCOPES.length - 1 : null;
                    if (next === null) return;
                    event.preventDefault();
                    setScope(TABLE_SCOPES[next].value); setPage(1);
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                  }}
                >{tab.label}</button>
              ))}
            </div>
          </div>

          <div className="sites-table-wrap" role="tabpanel" id="site-scope-panel" aria-labelledby={`site-scope-${scope}`} tabIndex={0}>
            <table className="sites-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Région</th>
                  <th>Statut</th>
                  <th>Artisans / Capacité</th>
                  <th>Production</th>
                  <th title="Indice opérationnel calculé automatiquement. Ouvrez la fiche pour consulter les règles.">Conformité</th>
                  <th title="Somme de la TVA et de la taxe de développement communautaire des ventes rattachées sur la période.">Taxes déclarées</th>
                  <th title="Date de la dernière vente d’or non annulée rattachée au site, toutes périodes confondues.">Dernière déclaration</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleSites.map((item) => (
                  <tr key={item.site.id}>
                    <td className="sites-table__identity">
                      <Link to={`/artisan-sites/${item.site.id}`}><strong>{item.site.name}</strong></Link>
                      <small>{item.site.code} · {FORMALIZATION_LABELS[item.site.formalization || 'unknown']}</small>
                    </td>
                    <td>{item.site.region}</td>
                    <td>
                      <span className={`sites-status sites-status--${item.status}`}>
                        {item.status === 'watch' ? 'À surveiller' : STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td>
                      <div className="sites-capacity">
                        <span>{integer.format(item.site.activeMiners)} / {integer.format(item.site.authorizedMiners)}</span>
                        <i><b style={{ width: `${Math.min(100, item.occupancy * 100)}%` }} /></i>
                      </div>
                    </td>
                    <td>{decimal(item.productionKg)} kg</td>
                    <td>
                      {item.compliance === null ? (
                        <span className="sites-compliance is-pending">Non évalué</span>
                      ) : (
                        <span className={`sites-compliance ${item.compliance >= 80 ? 'is-good' : item.compliance >= 70 ? 'is-warning' : 'is-bad'}`}>
                          {item.compliance} %
                        </span>
                      )}
                    </td>
                    <td>{formatFcfa(item.taxesFcfa)}</td>
                    <td>{formatDeclaration(item.lastDeclaration)}</td>
                    <td className="sites-table__action">
                      <Link to={`/artisan-sites/${item.site.id}`} aria-label={`Ouvrir la fiche de ${item.site.name}`}>
                        <MoreVertical aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && visibleSites.length === 0 && (
              <p className="sites-table__empty">Aucun site ne correspond aux filtres sélectionnés.</p>
            )}
            {loading && <p className="sites-table__empty">Chargement des sites…</p>}
          </div>

          <div className="sites-table-footer">
            <label className="sites-page-size">
              Afficher
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                {[10, 20, 50].map((size) => <option key={size} value={size}>{size} lignes</option>)}
              </select>
            </label>

            <div className="sites-pagination">
              <span>
                {scopedSites.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, scopedSites.length)} sur {integer.format(scopedSites.length)}
              </span>
              <button type="button" onClick={() => setPage(1)} disabled={currentPage === 1} aria-label="Première page"><ChevronsLeft aria-hidden="true" /></button>
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Page précédente"><ChevronLeft aria-hidden="true" /></button>
              {Array.from({ length: Math.min(5, pageCount) }, (_, index) => index + 1).map((value) => (
                <button type="button" key={value} className={value === currentPage ? 'is-active' : ''} onClick={() => setPage(value)}>{value}</button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="Page suivante"><ChevronRight aria-hidden="true" /></button>
              <button type="button" onClick={() => setPage(pageCount)} disabled={currentPage === pageCount} aria-label="Dernière page"><ChevronsRight aria-hidden="true" /></button>
            </div>

            <button type="button" className="sites-ghost-button" onClick={() => { setScope('all'); setPageSize(50); setPage(1); }}>
              Voir les {integer.format(insights.length)} sites
            </button>
          </div>
        </section>
      </div>
    </NationalDashboardLayout>
  );
}
