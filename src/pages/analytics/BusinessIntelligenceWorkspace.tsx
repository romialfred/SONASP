import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import {
  Activity,
  ArrowDownToLine,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
  Gauge,
  GitBranch,
  Landmark,
  Loader2,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Scale,
  Share2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { MainLayout } from '@/components/layout/MainLayout';
import { DecompositionTree } from '@/components/reports/DecompositionTree';
import {
  DEFAULT_BI_FILTERS,
  buildBusinessIntelligenceModel,
  loadBusinessIntelligenceData,
  optionsForDimension,
  type BIBreakdownItem,
  type BIDataSnapshot,
  type BIDimension,
  type BIFilters,
  type BIModel,
  type BIRecord,
  type BIView,
} from '@/services/businessIntelligenceService';
import {
  exportBIExcel,
  exportBIPdf,
  shareBIReport,
  type BIExportContext,
} from '@/services/businessIntelligenceExportService';
import './business-intelligence.css';

export interface BusinessIntelligenceWorkspaceProps {
  view: BIView;
}

type ViewConfig = {
  eyebrow: string;
  title: string;
  subtitle: string;
  chartTitle: string;
  chartCopy: string;
};

type BIWorkspaceSection = 'overview' | 'trends' | 'diagnostic' | 'records' | 'reports';

const WORKSPACE_SECTIONS: Array<{
  id: BIWorkspaceSection;
  label: string;
  views?: BIView[];
}> = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'trends', label: 'Tendances' },
  { id: 'diagnostic', label: 'Diagnostic' },
  { id: 'records', label: 'Données' },
  { id: 'reports', label: 'Rapports', views: ['institutional'] },
];

const VIEW_CONFIG: Record<BIView, ViewConfig> = {
  sales: {
    eyebrow: 'Intelligence commerciale',
    title: 'Analyse des ventes',
    subtitle: 'Volumes, valeur, prix moyens et principaux acheteurs sur la période.',
    chartTitle: 'Dynamique des ventes',
    chartCopy: 'Volumes et valeur dans la devise principale.',
  },
  production: {
    eyebrow: 'Pilotage de la production',
    title: 'Rapports de production',
    subtitle: 'Volumes, teneurs, sites contributeurs et déclarations à traiter.',
    chartTitle: 'Trajectoire de production',
    chartCopy: 'Volumes déclarés sur la période retenue.',
  },
  institutional: {
    eyebrow: 'Édition institutionnelle',
    title: 'Rapports institutionnels',
    subtitle: 'Factures, règlements, contrats et rapports officiels traçables.',
    chartTitle: 'Activité institutionnelle',
    chartCopy: 'Montants facturés et dossiers suivis.',
  },
  national: {
    eyebrow: 'Observatoire national',
    title: 'Performance nationale',
    subtitle: 'Production, ventes, couverture et dossiers à traiter en un seul écran.',
    chartTitle: 'Tendance nationale',
    chartCopy: 'Production enregistrée et valeur commerciale.',
  },
};

const REPORT_LIBRARY = [
  {
    id: 'synthese-direction',
    title: 'Synthèse pour la Direction générale',
    description: 'Indicateurs de période, tendances, contributions majeures et points de vigilance.',
    cadence: 'Mensuel / à la demande',
  },
  {
    id: 'production-nationale',
    title: 'Situation nationale de production',
    description: 'Volumes déclarés par région, site et opérateur, avec détail des lots.',
    cadence: 'Hebdomadaire / mensuel',
  },
  {
    id: 'ventes-redevances',
    title: 'Ventes, taxes et redevances',
    description: 'Valeurs facturées, règlements, prélèvements et ventilation territoriale.',
    cadence: 'Mensuel / trimestriel',
  },
  {
    id: 'engagements-operateurs',
    title: 'Engagements des opérateurs',
    description: 'Contrats actifs, échéances, dossiers en attente et exécution financière.',
    cadence: 'Trimestriel',
  },
];

const emptySnapshot: BIDataSnapshot = { records: [], unavailable: [], loadedAt: '' };

const defaultPeriod = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  };
};

const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);

const formatCompact = (value: number, unit?: string) => {
  const formatted = new Intl.NumberFormat('fr-FR', {
    notation: Math.abs(value) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 100_000 ? 1 : 2,
  }).format(value);
  return unit && unit !== '—' ? `${formatted} ${unit}` : formatted;
};

const percent = (value: number) => `${formatNumber(value, 1)} %`;

const completionRate = (model: BIModel) =>
  model.operations > 0 ? (model.completedOperations / model.operations) * 100 : 0;

const dimensionRecordValue = (record: BIRecord, dimension: BIDimension) => {
  if (dimension === 'region') return record.region;
  if (dimension === 'site') return record.siteId;
  if (dimension === 'actor') return record.actorId;
  if (dimension === 'source') return record.source;
  return record.status;
};

type Kpi = {
  label: string;
  value: string;
  detail: string;
  icon: ElementType;
};

function kpisFor(view: BIView, model: BIModel): Kpi[] {
  const settlements = model.records.filter((record) => record.category === 'settlement');
  const settledAmount = settlements
    .filter((record) => record.currency === model.primaryCurrency)
    .reduce((sum, record) => sum + record.amount, 0);
  const contracts = model.records.filter((record) => record.category === 'contract').length;

  if (view === 'sales') {
    return [
      {
        label: 'Valeur suivie',
        value: formatCompact(model.totalAmount, model.primaryCurrency),
        detail: model.otherCurrencies.length ? `Hors ${model.otherCurrencies.join(', ')}` : 'Devise homogène',
        icon: CircleDollarSign,
      },
      {
        label: 'Volume vendu',
        value: formatCompact(model.totalQuantityOz, 'oz'),
        detail: `${model.operations} vente${model.operations > 1 ? 's' : ''}`,
        icon: Scale,
      },
      {
        label: 'Prix moyen observé',
        value: formatCompact(
          model.totalQuantityOz > 0 ? model.totalAmount / model.totalQuantityOz : 0,
          `${model.primaryCurrency}/oz`,
        ),
        detail: 'Sur la devise principale',
        icon: TrendingUp,
      },
      {
        label: 'Dossiers finalisés',
        value: percent(completionRate(model)),
        detail: `${model.pendingOperations} à suivre`,
        icon: CheckCircle2,
      },
    ];
  }

  if (view === 'production') {
    return [
      {
        label: 'Production déclarée',
        value: formatCompact(model.totalQuantityOz, 'oz'),
        detail: `${model.operations} déclaration${model.operations > 1 ? 's' : ''}`,
        icon: PackageCheck,
      },
      {
        label: 'Titre moyen pondéré',
        value: model.averageQualityPct == null ? 'Non disponible' : percent(model.averageQualityPct),
        detail: 'Pondéré par les volumes renseignés',
        icon: Gauge,
      },
      {
        label: 'Sites contributeurs',
        value: String(model.activeSites),
        detail: `${model.activeRegions} région${model.activeRegions > 1 ? 's' : ''}`,
        icon: Building2,
      },
      {
        label: 'Lots validés',
        value: percent(completionRate(model)),
        detail: `${model.pendingOperations} dossier${model.pendingOperations > 1 ? 's' : ''} en cours`,
        icon: ShieldCheck,
      },
    ];
  }

  if (view === 'institutional') {
    return [
      {
        label: 'Montants facturés',
        value: formatCompact(model.totalAmount, model.primaryCurrency),
        detail: 'Factures émises sur la période',
        icon: FileText,
      },
      {
        label: 'Règlements enregistrés',
        value: formatCompact(settledAmount, model.primaryCurrency),
        detail: `${settlements.length} règlement${settlements.length > 1 ? 's' : ''}`,
        icon: Landmark,
      },
      {
        label: 'Contrats suivis',
        value: String(contracts),
        detail: `${model.activeActors} opérateur${model.activeActors > 1 ? 's' : ''}`,
        icon: FileSpreadsheet,
      },
      {
        label: 'Dossiers finalisés',
        value: percent(completionRate(model)),
        detail: `${model.pendingOperations} à traiter`,
        icon: CheckCircle2,
      },
    ];
  }

  return [
    {
      label: 'Production nationale',
      value: formatCompact(model.totalQuantityOz, 'oz'),
      detail: `${model.activeSites} site${model.activeSites > 1 ? 's' : ''} contributeur${model.activeSites > 1 ? 's' : ''}`,
      icon: Scale,
    },
    {
      label: 'Valeur des ventes',
      value: formatCompact(model.totalAmount, model.primaryCurrency),
      detail: model.otherCurrencies.length ? `Autres devises : ${model.otherCurrencies.join(', ')}` : 'Devise homogène',
      icon: CircleDollarSign,
    },
    {
      label: 'Couverture territoriale',
      value: `${model.activeRegions} région${model.activeRegions > 1 ? 's' : ''}`,
      detail: `${model.activeActors} opérateur${model.activeActors > 1 ? 's' : ''}`,
      icon: MapPinned,
    },
    {
      label: 'Dossiers en attente',
      value: String(model.pendingOperations),
      detail: `${model.operations} flux analysés`,
      icon: Activity,
    },
  ];
}

function buildInsights(view: BIView, model: BIModel) {
  const regions = model.breakdowns.region;
  const sites = model.breakdowns.site;
  const firstRegion = regions[0];
  const firstSite = sites[0];
  const pendingRate = model.operations ? (model.pendingOperations / model.operations) * 100 : 0;
  const insights = [];
  if (firstRegion) {
    insights.push({
      title: 'Contribution territoriale',
      text: `${firstRegion.label} représente ${formatNumber(firstRegion.share, 1)} % de l’indicateur analysé.`,
    });
  }
  if (firstSite) {
    insights.push({
      title: 'Site principal',
      text: `${firstSite.label} est le premier contributeur parmi ${model.activeSites || sites.length} site(s) observé(s).`,
    });
  }
  insights.push({
    title: 'Charge à traiter',
    text:
      model.pendingOperations > 0
        ? `${model.pendingOperations} dossier(s), soit ${formatNumber(pendingRate, 1)} %, nécessitent encore une action.`
        : 'Aucun dossier explicitement identifié comme en attente dans la sélection.',
  });
  if (view === 'sales' && model.otherCurrencies.length) {
    insights.push({
      title: 'Lecture multidevise',
      text: `La valeur affichée est limitée au ${model.primaryCurrency}. Les flux en ${model.otherCurrencies.join(', ')} restent séparés.`,
    });
  }
  return insights.slice(0, 3);
}

export function BusinessIntelligenceWorkspace({ view }: BusinessIntelligenceWorkspaceProps) {
  const config = VIEW_CONFIG[view];
  const initialPeriod = useMemo(defaultPeriod, []);
  const [draftPeriod, setDraftPeriod] = useState(initialPeriod);
  const [period, setPeriod] = useState(initialPeriod);
  const [snapshot, setSnapshot] = useState<BIDataSnapshot>(emptySnapshot);
  const [filters, setFilters] = useState<BIFilters>({ ...DEFAULT_BI_FILTERS });
  const [dimension, setDimension] = useState<BIDimension>('region');
  const [selectedNode, setSelectedNode] = useState<BIBreakdownItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeReportTitle, setActiveReportTitle] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<BIWorkspaceSection>('overview');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(
    async (force = false) => {
      try {
        force ? setRefreshing(true) : setLoading(true);
        setError(null);
        const data = await loadBusinessIntelligenceData(view, period, { force });
        setSnapshot(data);
      } catch (loadError) {
        console.error('Business intelligence loading failed', loadError);
        setError('Les données de pilotage ne peuvent pas être chargées pour le moment.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, view],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setFilters({ ...DEFAULT_BI_FILTERS });
    setDimension('region');
    setSelectedNode(null);
    setActiveSection('overview');
    setFiltersOpen(false);
  }, [view]);

  const model = useMemo(
    () => buildBusinessIntelligenceModel(snapshot, view, filters),
    [filters, snapshot, view],
  );
  const rawRecords = snapshot.records;
  const regionOptions = useMemo(() => optionsForDimension(rawRecords, 'region'), [rawRecords]);
  const siteOptions = useMemo(
    () =>
      optionsForDimension(
        filters.region === 'all' ? rawRecords : rawRecords.filter((record) => record.region === filters.region),
        'site',
      ),
    [filters.region, rawRecords],
  );
  const actorOptions = useMemo(
    () =>
      optionsForDimension(
        rawRecords.filter(
          (record) =>
            (filters.region === 'all' || record.region === filters.region) &&
            (filters.siteId === 'all' || record.siteId === filters.siteId),
        ),
        'actor',
      ),
    [filters.region, filters.siteId, rawRecords],
  );
  const sourceOptions = useMemo(() => optionsForDimension(rawRecords, 'source'), [rawRecords]);
  const statusOptions = useMemo(() => optionsForDimension(rawRecords, 'status'), [rawRecords]);
  const kpis = useMemo(() => kpisFor(view, model), [model, view]);
  const insights = useMemo(() => buildInsights(view, model), [model, view]);
  const treeTotal = model.breakdowns[dimension].reduce((sum, item) => sum + item.value, 0);
  const treeUnit = view === 'production' || view === 'national' ? 'oz' : model.primaryCurrency;
  const details = selectedNode
    ? model.records.filter((record) => dimensionRecordValue(record, dimension) === selectedNode.id)
    : model.records;

  const setFilter = (key: keyof BIFilters, value: string) => {
    setSelectedNode(null);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'region' ? { siteId: 'all', actorId: 'all' } : {}),
      ...(key === 'siteId' ? { actorId: 'all' } : {}),
    }));
  };

  const applyPeriod = () => {
    if (!draftPeriod.startDate || !draftPeriod.endDate || draftPeriod.startDate > draftPeriod.endDate) {
      setActionMessage('La date de début doit précéder la date de fin.');
      return;
    }
    setSelectedNode(null);
    setPeriod(draftPeriod);
  };

  const exportContext = (title = config.title): BIExportContext => ({
    title,
    subtitle: config.subtitle,
    period,
    filters,
    dimension,
    view,
  });

  const runExport = async (format: 'pdf' | 'excel', title?: string) => {
    try {
      setActiveReportTitle(title || config.title);
      if (format === 'pdf') await exportBIPdf(model, exportContext(title));
      else await exportBIExcel(model, exportContext(title));
      setActionMessage(`Le rapport ${format.toUpperCase()} a été généré à partir de la sélection courante.`);
    } catch (exportError) {
      console.error('BI export failed', exportError);
      setActionMessage(`L’export ${format.toUpperCase()} n’a pas pu être généré.`);
    } finally {
      setActiveReportTitle(null);
    }
  };

  const share = async () => {
    try {
      const result = await shareBIReport(exportContext());
      setActionMessage(result === 'shared' ? 'Le rapport a été partagé.' : 'Le lien filtré a été copié.');
    } catch (shareError) {
      if ((shareError as DOMException)?.name !== 'AbortError') {
        setActionMessage('Le partage n’a pas pu être finalisé.');
      }
    }
  };

  const chartAmountLabel = `Valeur (${model.primaryCurrency})`;
  const primaryRanking = model.breakdowns[dimension].slice(0, 8);
  const availableSections = WORKSPACE_SECTIONS.filter((section) => !section.views || section.views.includes(view));
  const activeFilterCount = [filters.region, filters.siteId, filters.actorId, filters.source, filters.status]
    .filter((value) => value !== 'all').length;

  return (
    <MainLayout>
      <main className="bi-page sn-page">
        <header className="bi-hero">
          <div className="bi-hero-copy">
            <span className="bi-eyebrow"><BarChart3 size={16} /> {config.eyebrow}</span>
            <h1>{config.title}</h1>
            <p>{config.subtitle}</p>
          </div>
          <div className="bi-hero-meta">
            <span><ShieldCheck size={16} /> Données de la plateforme</span>
            <strong>
              {snapshot.loadedAt
                ? `Actualisé à ${new Date(snapshot.loadedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Chargement en cours'}
            </strong>
          </div>
        </header>

        <nav className="bi-workspace-tabs" aria-label="Espaces d’analyse">
          {availableSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={activeSection === section.id ? 'is-active' : ''}
              aria-current={activeSection === section.id ? 'page' : undefined}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
              {section.id === 'records' && <span>{model.records.length}</span>}
            </button>
          ))}
        </nav>

        <section className="bi-toolbar" aria-label="Filtres du rapport">
          <div className="bi-period-group">
            <label>
              <span>Du</span>
              <input
                type="date"
                value={draftPeriod.startDate}
                onChange={(event) => setDraftPeriod((current) => ({ ...current, startDate: event.target.value }))}
              />
            </label>
            <label>
              <span>Au</span>
              <input
                type="date"
                value={draftPeriod.endDate}
                onChange={(event) => setDraftPeriod((current) => ({ ...current, endDate: event.target.value }))}
              />
            </label>
            <button type="button" className="bi-filter-apply" onClick={applyPeriod}>
              <CalendarRange size={17} /> Appliquer
            </button>
          </div>

          <div className="bi-toolbar-actions">
            <button
              type="button"
              className={`bi-button bi-button-muted${filtersOpen ? ' is-active' : ''}`}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <Gauge size={17} /> Filtres
              {activeFilterCount > 0 && <span className="bi-filter-count">{activeFilterCount}</span>}
            </button>
            <button type="button" className="bi-button bi-button-muted" onClick={() => void load(true)} disabled={refreshing}>
              {refreshing ? <Loader2 size={17} className="bi-spin" /> : <RefreshCw size={17} />}
              Actualiser
            </button>
            <button type="button" className="bi-button bi-button-muted" onClick={() => void share()}>
              <Share2 size={17} /> Partager
            </button>
            <button type="button" className="bi-button bi-button-muted" onClick={() => void runExport('excel')} disabled={!model.records.length}>
              <FileSpreadsheet size={17} /> Excel
            </button>
            <button type="button" className="bi-button bi-button-primary" onClick={() => void runExport('pdf')} disabled={!model.records.length}>
              {activeReportTitle ? <Loader2 size={17} className="bi-spin" /> : <ArrowDownToLine size={17} />}
              Rapport PDF
            </button>
          </div>

          {filtersOpen && <div className="bi-filter-grid">
            <label>
              <span>Zone / région</span>
              <select value={filters.region} onChange={(event) => setFilter('region', event.target.value)}>
                <option value="all">Toutes les régions</option>
                {regionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Site minier</span>
              <select value={filters.siteId} onChange={(event) => setFilter('siteId', event.target.value)}>
                <option value="all">Tous les sites</option>
                {siteOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Opérateur / acheteur</span>
              <select value={filters.actorId} onChange={(event) => setFilter('actorId', event.target.value)}>
                <option value="all">Tous les opérateurs</option>
                {actorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Filière</span>
              <select value={filters.source} onChange={(event) => setFilter('source', event.target.value)}>
                <option value="all">Toutes les filières</option>
                {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Statut</span>
              <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                <option value="all">Tous les statuts</option>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Lecture temporelle</span>
              <select value={filters.granularity} onChange={(event) => setFilter('granularity', event.target.value)}>
                <option value="month">Par mois</option>
                <option value="quarter">Par trimestre</option>
                <option value="year">Par année</option>
              </select>
            </label>
          </div>}
        </section>

        {actionMessage && (
          <div className="bi-action-message" role="status">
            <CheckCircle2 size={16} />
            <span>{actionMessage}</span>
            <button type="button" onClick={() => setActionMessage(null)} aria-label="Fermer le message">×</button>
          </div>
        )}

        {snapshot.unavailable.length > 0 && (
          <div className="bi-source-warning" role="status">
            Certaines sources n’ont pas répondu : {snapshot.unavailable.join(', ')}. Les autres données restent consultables.
          </div>
        )}

        {loading ? (
          <div className="bi-loading" role="status"><Loader2 size={28} className="bi-spin" /> Construction du tableau de bord…</div>
        ) : error ? (
          <div className="bi-empty" role="alert">
            <BarChart3 size={32} />
            <h2>Données indisponibles</h2>
            <p>{error}</p>
            <button type="button" className="bi-button bi-button-primary" onClick={() => void load(true)}>Réessayer</button>
          </div>
        ) : !model.records.length ? (
          <div className="bi-empty">
            <BarChart3 size={32} />
            <h2>Aucune donnée sur cette sélection</h2>
            <p>Élargissez la période ou retirez un filtre. Aucun chiffre de démonstration n’est substitué aux données absentes.</p>
          </div>
        ) : (
          <>
            {activeSection === 'overview' && <section className="bi-kpi-grid" aria-label="Indicateurs clés">
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <article className="bi-kpi" key={kpi.label}>
                    <span className="bi-kpi-icon"><Icon size={20} /></span>
                    <div>
                      <small>{kpi.label}</small>
                      <strong>{kpi.value}</strong>
                      <p>{kpi.detail}</p>
                    </div>
                  </article>
                );
              })}
            </section>}

            {(activeSection === 'overview' || activeSection === 'trends') && <section className="bi-chart-grid">
              <article className="bi-panel bi-chart-panel">
                <div className="bi-panel-heading">
                  <div>
                    <span className="bi-kicker"><TrendingUp size={15} /> Évolution</span>
                    <h2>{config.chartTitle}</h2>
                    <p>{config.chartCopy}</p>
                  </div>
                </div>
                <div className="bi-chart" role="img" aria-label={`${config.chartTitle}, graphique temporel`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={model.trend} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`bi-volume-${view}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#087956" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#087956" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#dce5e0" strokeDasharray="4 5" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#60736a', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="quantity" tick={{ fill: '#60736a', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
                      <YAxis yAxisId="amount" orientation="right" tick={{ fill: '#8a6b1f', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
                      <Tooltip
                        formatter={(value: number | undefined, name: string | undefined) => [
                          formatCompact(Number(value), name === 'Volume (oz)' ? 'oz' : model.primaryCurrency),
                          name || 'Valeur',
                        ]}
                        contentStyle={{ borderRadius: 12, border: '1px solid #d8e2dc', boxShadow: '0 12px 28px rgba(18,45,34,.12)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                      <Area yAxisId="quantity" type="monotone" dataKey="quantityOz" name="Volume (oz)" stroke="#087956" strokeWidth={2.4} fill={`url(#bi-volume-${view})`} />
                      <Area yAxisId="amount" type="monotone" dataKey="amount" name={chartAmountLabel} stroke="#c28a0c" strokeWidth={2} fill="transparent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="bi-panel bi-ranking-panel">
                <div className="bi-panel-heading">
                  <div>
                    <span className="bi-kicker"><MapPinned size={15} /> Classement</span>
                    <h2>Contributions principales</h2>
                    <p>Répartition par {dimension === 'actor' ? 'opérateur' : dimension}.</p>
                  </div>
                </div>
                <div className="bi-ranking-chart" role="img" aria-label="Classement des principales contributions">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={primaryRanking} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 14 }}>
                      <CartesianGrid stroke="#e3e9e5" strokeDasharray="3 4" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" width={118} tick={{ fill: '#34483f', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value: number | undefined) => formatCompact(Number(value), treeUnit)} />
                      <Bar dataKey="value" name="Contribution" fill="#0a7755" radius={[0, 7, 7, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>}

            {activeSection === 'diagnostic' && <DecompositionTree
              view={view}
              dimension={dimension}
              dimensions={['region', 'site', 'actor', 'source', 'status']}
              items={model.breakdowns[dimension]}
              total={treeTotal}
              unit={treeUnit}
              selectedId={selectedNode?.id || null}
              onDimensionChange={(nextDimension) => {
                setDimension(nextDimension);
                setSelectedNode(null);
              }}
              onSelect={setSelectedNode}
              formatValue={formatCompact}
            />}

            {activeSection === 'overview' && <section className="bi-lower-grid">
              <article className="bi-panel bi-territory-panel">
                <div className="bi-panel-heading">
                  <div>
                    <span className="bi-kicker"><MapPinned size={15} /> Lecture territoriale</span>
                    <h2>Performance par zone</h2>
                    <p>Les régions sont classées sur l’indicateur principal de la vue.</p>
                  </div>
                </div>
                <div className="bi-territory-list">
                  {model.breakdowns.region.slice(0, 8).map((region, index) => (
                    <button
                      type="button"
                      key={region.id}
                      onClick={() => setFilter('region', region.id)}
                      className={filters.region === region.id ? 'is-active' : ''}
                    >
                      <span className="bi-territory-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="bi-territory-copy">
                        <strong>{region.label}</strong>
                        <small>{region.records} opération{region.records > 1 ? 's' : ''}</small>
                        <i><b style={{ width: `${Math.max(3, region.share)}%` }} /></i>
                      </span>
                      <span className="bi-territory-value">
                        <strong>{formatCompact(region.value, treeUnit)}</strong>
                        <small>{formatNumber(region.share, 1)} %</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              </article>

              <aside className="bi-panel bi-insights" aria-labelledby="bi-insights-title">
                <div className="bi-panel-heading">
                  <div>
                    <span className="bi-kicker"><Gauge size={15} /> Lecture de pilotage</span>
                    <h2 id="bi-insights-title">Points à retenir</h2>
                    <p>Constats calculés à partir de la sélection, sans extrapolation.</p>
                  </div>
                </div>
                <div className="bi-insight-list">
                  {insights.map((insight, index) => (
                    <div key={insight.title}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div><strong>{insight.title}</strong><p>{insight.text}</p></div>
                    </div>
                  ))}
                </div>
              </aside>
            </section>}

            {view === 'institutional' && activeSection === 'reports' && (
              <section className="bi-panel bi-report-library" aria-labelledby="bi-report-library-title">
                <div className="bi-panel-heading">
                  <div>
                    <span className="bi-kicker"><FileText size={15} /> Documents prêts à diffuser</span>
                    <h2 id="bi-report-library-title">Bibliothèque de rapports formatés</h2>
                    <p>Chaque export reprend la période, les filtres, les indicateurs, la décomposition et le détail traçable.</p>
                  </div>
                </div>
                <div className="bi-report-list">
                  {REPORT_LIBRARY.map((report) => (
                    <article key={report.id}>
                      <span className="bi-report-icon"><FileText size={20} /></span>
                      <div className="bi-report-copy">
                        <strong>{report.title}</strong>
                        <p>{report.description}</p>
                        <small><CalendarRange size={13} /> {report.cadence}</small>
                      </div>
                      <div className="bi-report-actions">
                        <button type="button" onClick={() => void runExport('excel', report.title)} disabled={!!activeReportTitle}>
                          <FileSpreadsheet size={16} /> Excel
                        </button>
                        <button type="button" className="is-primary" onClick={() => void runExport('pdf', report.title)} disabled={!!activeReportTitle}>
                          <ArrowDownToLine size={16} /> PDF
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {(activeSection === 'records' || (activeSection === 'diagnostic' && selectedNode)) && <section className="bi-panel bi-detail-panel" aria-labelledby="bi-detail-title">
              <div className="bi-panel-heading bi-detail-heading">
                <div>
                  <span className="bi-kicker"><GitBranch size={15} /> Justificatif des agrégats</span>
                  <h2 id="bi-detail-title">Données détaillées</h2>
                  <p>
                    {selectedNode
                      ? `${details.length} ligne(s) pour « ${selectedNode.label} ».`
                      : `${details.length} ligne(s) correspondant à la sélection.`}
                  </p>
                </div>
                {selectedNode && (
                  <button type="button" className="bi-button bi-button-muted" onClick={() => setSelectedNode(null)}>
                    Voir toutes les lignes
                  </button>
                )}
              </div>
              <div className="bi-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Référence</th>
                      <th>Filière</th>
                      <th>Région</th>
                      <th>Site minier</th>
                      <th>Opérateur / acheteur</th>
                      <th>Statut</th>
                      <th className="is-number">Quantité</th>
                      <th className="is-number">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.slice(0, 50).map((record) => (
                      <tr key={record.id}>
                        <td>{record.date || '—'}</td>
                        <td><strong>{record.reference}</strong></td>
                        <td>{record.source.replace('-', ' ')}</td>
                        <td>{record.region}</td>
                        <td>{record.siteName}</td>
                        <td>{record.actorName}</td>
                        <td><span className="bi-status">{record.status}</span></td>
                        <td className="is-number">{record.quantityOz ? `${formatNumber(record.quantityOz)} oz` : '—'}</td>
                        <td className="is-number">{record.amount ? formatCompact(record.amount, record.currency) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {details.length > 50 && <p className="bi-table-note">50 lignes affichées sur {details.length}. L’export Excel contient l’ensemble du détail.</p>}
            </section>}
          </>
        )}
      </main>
    </MainLayout>
  );
}
