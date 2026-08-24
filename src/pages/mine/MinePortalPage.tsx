import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarRange,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Gauge,
  Layers,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useMinePortalAccess } from '@/components/auth/MinePortalGuard';
import { Loading } from '@/components/ui/Loading';
import { EmptyState, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import {
  MinePortalDataError,
  minePortalService,
  type MinePortalSnapshot,
} from '@/services/minePortalService';
import './mine-portal.css';

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

type ModuleCard = {
  title: string;
  label: string;
  path: string;
  icon: LucideIcon;
  tone: 'emerald' | 'violet' | 'amber' | 'blue';
};

const operationalModules: ModuleCard[] = [
  { title: 'Production', label: 'Déclarer et suivre les coulées', path: '/production/daily', icon: BarChart3, tone: 'emerald' },
  { title: 'Budgets', label: 'Planifier les objectifs mensuels', path: '/performance/budgets', icon: CalendarRange, tone: 'violet' },
  { title: 'Or en coffre', label: 'Consulter le stock physique', path: '/production/in-safe', icon: PackageCheck, tone: 'amber' },
  { title: "Licences d’export", label: 'Suivre les autorisations', path: '/production/licenses', icon: FileText, tone: 'blue' },
  { title: 'Expéditions', label: 'Préparer et acheminer les lots', path: '/shipping/preparation', icon: Truck, tone: 'blue' },
  { title: 'Raffinage', label: 'Suivre le traitement des lots', path: '/refining', icon: FlaskConical, tone: 'violet' },
  { title: 'Stocks', label: 'Contrôler les quantités disponibles', path: '/inventory', icon: Layers, tone: 'emerald' },
  { title: 'Marché et ventes', label: 'Vendre et suivre les transactions', path: '/sales/trade-space', icon: TrendingUp, tone: 'amber' },
];

const closedStatuses = new Set([
  'approuvee', 'approuvée', 'rejetee', 'rejetée', 'annulee', 'annulée',
  'validee', 'validée', 'terminee', 'terminée', 'payee', 'payée', 'execute',
  'exécuté', 'confirmee', 'confirmée', 'livree', 'livrée',
  'received_at_refinery', 'processed', 'stocked', 'completed', 'payment_received',
]);

function isOpenStatus(status: string | null | undefined): boolean {
  return !closedStatuses.has((status || '').trim().toLowerCase());
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date non renseignée';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date non renseignée' : parsed.toLocaleDateString('fr-FR');
}

function buildMonthlySeries(data: MinePortalSnapshot) {
  const latestProductionDate = data.productions
    .map((production) => new Date(production.production_date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0];
  const anchor = latestProductionDate || new Date();
  const latestBudget = [...data.budgets].sort((left, right) => right.year - left.year)[0];
  const budgets = data.monthlyBudgets.filter((budget) => !latestBudget || budget.annual_budget_id === latestBudget.id);
  const forecasts = data.forecasts.filter((forecast) => !latestBudget || forecast.annual_budget_id === latestBudget.id);

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - (5 - index), 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const actual = data.productions
      .filter((production) => {
        const productionDate = new Date(production.production_date);
        return productionDate.getMonth() + 1 === month && productionDate.getFullYear() === year;
      })
      .reduce((total, production) => total + Number(production.estimated_oz || 0), 0);
    const budget = budgets.find((item) => item.month === month)?.budget_oz || 0;
    const forecast = forecasts.find((item) => item.month === month)?.forecast_oz || 0;
    return {
      key: `${year}-${month}`,
      label: monthLabel.format(date).replace('.', ''),
      actual,
      budget: Number(budget),
      forecast: Number(forecast),
    };
  });
}

export default function MinePortalPage() {
  const { companyId } = useMinePortalAccess();
  const [searchParams] = useSearchParams();
  const dashboardView = searchParams.get('vue') === 'tableau-de-bord';
  const [data, setData] = useState<MinePortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await minePortalService.load(companyId, { force }));
    } catch (reason) {
      setData(null);
      setError(reason instanceof MinePortalDataError
        ? reason.message
        : 'Les données de la société ne peuvent pas être chargées pour le moment.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dashboard = useMemo(() => {
    if (!data) return null;
    const productionOz = data.productions.reduce(
      (total, production) => total + Number(production.estimated_oz || 0),
      0
    );
    const latestBudget = [...data.budgets].sort((left, right) => right.year - left.year)[0];
    const annualBudget = data.monthlyBudgets
      .filter((budget) => !latestBudget || budget.annual_budget_id === latestBudget.id)
      .reduce((total, budget) => total + Number(budget.budget_oz || 0), 0);
    const pendingRequests = data.requests.filter((request) => isOpenStatus(request.statut)).length;
    const pendingAnalyses = data.analyses.filter((analysis) => isOpenStatus(analysis.statut)).length;
    const pendingRequisitions = data.requisitions.filter((requisition) => isOpenStatus(requisition.statut)).length;
    const pendingPayments = data.payments.filter((payment) => payment.reception_statut === 'a_confirmer').length;
    const pendingShipments = data.shipments.filter((shipment) => isOpenStatus(shipment.status)).length;
    const pendingSales = data.sales.filter((sale) => isOpenStatus(sale.status)).length;
    const pendingTotal = pendingRequests + pendingAnalyses + pendingRequisitions
      + pendingPayments + pendingShipments + pendingSales;

    return {
      productionOz,
      annualBudget,
      achievement: annualBudget > 0 ? (productionOz / annualBudget) * 100 : null,
      pendingRequests,
      pendingAnalyses,
      pendingRequisitions,
      pendingPayments,
      pendingShipments,
      pendingSales,
      pendingTotal,
      series: buildMonthlySeries(data),
    };
  }, [data]);

  if (loading) {
    return (
      <main className="sn-page flex min-h-[55vh] items-center justify-center" aria-live="polite">
        <div className="text-center">
          <Loading size="lg" />
          <p className="mt-3 text-sm text-slate-600">Chargement de votre espace…</p>
        </div>
      </main>
    );
  }

  if (error || !data || !dashboard) {
    return (
      <main className="sn-page">
        <EmptyState
          title="Périmètre indisponible"
          description={error || 'La société demandée ne peut pas être affichée.'}
          action={(
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void load(true)}>
              <RefreshCw aria-hidden="true" /> Réessayer
            </button>
          )}
        />
      </main>
    );
  }

  const refreshAction = (
    <button type="button" className="sn-btn" onClick={() => void load(true)}>
      <RefreshCw aria-hidden="true" /> Actualiser
    </button>
  );

  if (!dashboardView) {
    return (
      <main className="sn-page mine-portal-page mine-portal-home">
        <PageHeader
          icon={Building2}
          title="Accueil"
          subtitle="Accédez directement aux opérations de votre société."
          breadcrumb={[{ label: 'Portail Mine' }, { label: 'Accueil' }]}
          actions={refreshAction}
        />

        <Section id="mine-modules" title="Modules" icon={Layers}>
          <div className="mine-module-grid">
            {operationalModules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.path}
                  to={module.path}
                  className={`mine-module-card mine-module-card--${module.tone}`}
                >
                  <span className="mine-module-card__icon"><Icon aria-hidden="true" /></span>
                  <span className="mine-module-card__copy">
                    <strong>{module.title}</strong>
                    <small>{module.label}</small>
                  </span>
                  <ArrowUpRight className="mine-module-card__arrow" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </Section>
      </main>
    );
  }

  const indicators = [
    { label: 'Production récente', value: `${number.format(dashboard.productionOz)} oz`, hint: `${data.productions.length} déclarations`, icon: BarChart3, tone: 'green' as const },
    { label: 'Réalisation du budget', value: dashboard.achievement === null ? 'Non défini' : `${number.format(dashboard.achievement)} %`, hint: dashboard.annualBudget > 0 ? `${number.format(dashboard.annualBudget)} oz planifiées` : 'Aucun budget actif', icon: Gauge, tone: 'blue' as const },
    { label: 'Solde à recevoir', value: `${money.format(data.situation?.reste_du || 0)} FCFA`, hint: `${data.situation?.nb_ouvertes || 0} factures ouvertes`, icon: CircleDollarSign, tone: 'gold' as const },
    { label: 'Actions en attente', value: dashboard.pendingTotal, hint: 'à traiter', icon: ClipboardCheck, tone: 'violet' as const },
  ];

  const recentActivity = [
    ...data.productions.slice(0, 4).map((item) => ({
      id: `production-${item.id}`,
      title: item.bar_reference || 'Production déclarée',
      detail: `${number.format(Number(item.estimated_oz || 0))} oz`,
      date: item.production_date,
      path: `/production/${item.id}`,
    })),
    ...data.requests.slice(0, 3).map((item) => ({
      id: `request-${item.id}`,
      title: item.numero_demande,
      detail: `${number.format(Number(item.quantite_demandee_oz || 0))} oz demandées`,
      date: item.date_limite_reponse,
      path: '/achats/demandes',
    })),
    ...data.shipments.slice(0, 2).map((item) => ({
      id: `shipment-${item.id}`,
      title: item.expedition_lot_number || 'Expédition préparée',
      detail: `${number.format(Number(item.total_weight_oz || 0))} oz`,
      date: item.created_at,
      path: '/shipping/preparation',
    })),
    ...data.sales.slice(0, 2).map((item) => ({
      id: `sale-${item.id}`,
      title: item.sale_number,
      detail: `${number.format(Number(item.quantity_oz || 0))} oz`,
      date: item.sale_date,
      path: '/sales',
    })),
  ].sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))).slice(0, 6);

  const chartMax = Math.max(1, ...dashboard.series.flatMap((item) => [item.actual, item.budget, item.forecast]));
  const paid = Number(data.situation?.facture_payee || 0);
  const billed = Number(data.situation?.facture_total || 0);
  const paidRatio = billed > 0 ? Math.min(100, (paid / billed) * 100) : 0;

  return (
    <main className="sn-page mine-portal-page mine-dashboard">
      <PageHeader
        icon={Gauge}
        title="Tableau de bord"
        subtitle={`Suivi opérationnel de ${data.company.name}.`}
        breadcrumb={[{ label: 'Portail Mine' }, { label: 'Tableau de bord' }]}
        actions={refreshAction}
      />

      <StatGrid items={indicators} ariaLabel="Indicateurs de la société minière" sober />

      <div className="mine-dashboard__grid">
        <Section id="mine-performance" title="Production et objectifs" icon={TrendingUp}>
          <div className="mine-performance-chart" role="img" aria-label="Production, budget et prévisions des six derniers mois">
            <div className="mine-performance-chart__legend" aria-hidden="true">
              <span className="is-actual">Production</span>
              <span className="is-budget">Budget</span>
              <span className="is-forecast">Prévision</span>
            </div>
            <div className="mine-performance-chart__columns">
              {dashboard.series.map((item) => (
                <div className="mine-performance-chart__month" key={item.key} title={`${item.label} : ${number.format(item.actual)} oz produites`}>
                  <div className="mine-performance-chart__bars">
                    <span className="is-actual" style={{ height: `${(item.actual / chartMax) * 100}%` }} />
                    <span className="is-budget" style={{ height: `${(item.budget / chartMax) * 100}%` }} />
                    <span className="is-forecast" style={{ height: `${(item.forecast / chartMax) * 100}%` }} />
                  </div>
                  <strong>{item.label}</strong>
                  <small>{number.format(item.actual)} oz</small>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section id="mine-finance" title="Situation financière" icon={ReceiptText} tone="blue">
          <div className="mine-finance-summary">
            <div><span>Facturé</span><strong>{money.format(billed)} FCFA</strong></div>
            <div><span>Réglé</span><strong>{money.format(paid)} FCFA</strong></div>
            <div><span>Échu</span><strong className={Number(data.situation?.dette_echue || 0) > 0 ? 'is-alert' : ''}>{money.format(data.situation?.dette_echue || 0)} FCFA</strong></div>
            <div className="mine-finance-summary__progress">
              <span>Taux de règlement</span>
              <strong>{number.format(paidRatio)} %</strong>
              <progress max="100" value={paidRatio}>{paidRatio}%</progress>
            </div>
          </div>
        </Section>
      </div>

      <div className="mine-dashboard__grid mine-dashboard__grid--lower">
        <Section id="mine-actions" title="À traiter" icon={ShieldCheck} tone="violet">
          <div className="mine-pending-grid">
            <Link to="/achats/demandes"><span>Demandes SONASP</span><strong>{dashboard.pendingRequests}</strong></Link>
            <Link to="/documents/assay-certificates"><span>Analyses</span><strong>{dashboard.pendingAnalyses}</strong></Link>
            <Link to="/requisitions"><span>Réquisitions</span><strong>{dashboard.pendingRequisitions}</strong></Link>
            <Link to="/achats/reglements"><span>Règlements à confirmer</span><strong>{dashboard.pendingPayments}</strong></Link>
            <Link to="/shipping/preparation"><span>Expéditions en cours</span><strong>{dashboard.pendingShipments}</strong></Link>
            <Link to="/sales"><span>Ventes en cours</span><strong>{dashboard.pendingSales}</strong></Link>
          </div>
        </Section>

        <Section id="mine-activity" title="Dernières opérations" icon={TrendingUp} tone="blue">
          {recentActivity.length > 0 ? (
            <div className="mine-activity-list">
              {recentActivity.map((activity) => (
                <Link key={activity.id} to={activity.path}>
                  <span><strong>{activity.title}</strong><small>{formatDate(activity.date)}</small></span>
                  <b>{activity.detail}</b>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mine-dashboard__empty">Aucune opération enregistrée.</p>
          )}
        </Section>
      </div>
    </main>
  );
}
