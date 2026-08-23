import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CalendarRange,
  CircleDollarSign,
  FileText,
  FlaskConical,
  Layers,
  PackageCheck,
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

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

type ModuleCard = {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  iconClass: string;
};

const operationalModules: ModuleCard[] = [
  { title: 'Production journalière', description: 'Déclarer et suivre la production de votre mine.', path: '/production/daily', icon: BarChart3, iconClass: 'bg-emerald-50 text-emerald-700' },
  { title: 'Budgets et prévisions', description: 'Piloter le budget annuel et les révisions trimestrielles.', path: '/performance/budgets', icon: CalendarRange, iconClass: 'bg-violet-50 text-violet-700' },
  { title: 'Or en coffre', description: 'Consulter le stock physique issu de vos productions.', path: '/production/in-safe', icon: PackageCheck, iconClass: 'bg-amber-50 text-amber-700' },
  { title: "Licences d'exportation", description: 'Préparer et suivre les autorisations de votre société.', path: '/production/licenses', icon: FileText, iconClass: 'bg-blue-50 text-blue-700' },
  { title: 'Expéditions', description: 'Constituer les lots et suivre leur acheminement.', path: '/shipping/preparation', icon: Truck, iconClass: 'bg-blue-50 text-blue-700' },
  { title: 'Raffinage', description: 'Suivre vos lots réceptionnés et les opérations de raffinage.', path: '/refining', icon: FlaskConical, iconClass: 'bg-violet-50 text-violet-700' },
  { title: 'Stocks', description: 'Consulter les quantités disponibles dans votre périmètre.', path: '/inventory', icon: Layers, iconClass: 'bg-emerald-50 text-emerald-700' },
  { title: 'Marché et ventes', description: 'Consulter le marché et vendre le reliquat non racheté.', path: '/sales/trade-space', icon: TrendingUp, iconClass: 'bg-amber-50 text-amber-700' },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date non renseignée';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date non renseignée' : parsed.toLocaleDateString('fr-FR');
}

export default function MinePortalPage() {
  const { companyId, canChooseCompany } = useMinePortalAccess();
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

  const indicators = useMemo(() => {
    if (!data) return [];
    const recentProduction = data.productions.reduce(
      (total, production) => total + Number(production.estimated_oz || 0),
      0
    );
    const pendingRequests = data.requests.filter(
      (request) => !['approuvee', 'rejetee', 'annulee'].includes(request.statut)
    ).length;

    return [
      { label: 'Production récente', value: `${number.format(recentProduction)} oz`, hint: `${data.productions.length} déclaration(s)`, icon: BarChart3, tone: 'green' as const },
      { label: 'Demandes SONASP', value: pendingRequests, hint: 'dans votre périmètre', icon: ShieldCheck, tone: 'blue' as const },
      { label: 'Solde à recevoir', value: `${money.format(data.situation?.reste_du || 0)} FCFA`, hint: `${data.situation?.nb_ouvertes || 0} facture(s) ouverte(s)`, icon: CircleDollarSign, tone: 'gold' as const },
      { label: 'Documents', value: data.documents.length, hint: 'pièces accessibles', icon: FileText, tone: 'violet' as const },
    ];
  }, [data]);

  if (loading) {
    return (
      <main className="sn-page flex min-h-[55vh] items-center justify-center" aria-live="polite">
        <div className="text-center">
          <Loading size="lg" />
          <p className="mt-3 text-sm text-slate-600">Chargement du périmètre de votre société…</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
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

  const recentActivity = [
    ...data.productions.slice(0, 3).map((item) => ({
      id: `production-${item.id}`,
      title: item.bar_reference || 'Production déclarée',
      detail: `${number.format(Number(item.estimated_oz || 0))} oz`,
      date: item.production_date,
      path: `/production/${item.id}`,
    })),
    ...data.requests.slice(0, 2).map((item) => ({
      id: `request-${item.id}`,
      title: item.numero_demande,
      detail: `${number.format(Number(item.quantite_demandee_oz || 0))} oz demandées`,
      date: item.date_limite_reponse,
      path: '/achats/demandes',
    })),
  ].sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))).slice(0, 5);

  return (
    <main className="sn-page">
      <PageHeader
        icon={Building2}
        title={data.company.name}
        subtitle="Espace opérationnel de la société minière — mêmes modules, données limitées à votre périmètre."
        breadcrumb={[{ label: 'Portail Mine' }, { label: 'Tableau de bord' }]}
        actions={(
          <button type="button" className="sn-btn" onClick={() => void load(true)}>
            <RefreshCw aria-hidden="true" /> Actualiser
          </button>
        )}
      />

      {canChooseCompany && (
        <p className="sn-note" role="status">
          <ShieldCheck aria-hidden="true" />
          <span>Mode consultation Owner — périmètre sélectionné : <strong>{data.company.name}</strong>.</span>
        </p>
      )}

      <StatGrid items={indicators} ariaLabel="Indicateurs de la société minière" sober />

      <Section
        id="mine-modules"
        title="Modules opérationnels"
        description="Les modules industriels sont communs à la plateforme. La société est déterminée par votre compte et ne peut pas être remplacée dans un formulaire."
        icon={Layers}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {operationalModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.path}
                to={module.path}
                className="group min-h-36 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${module.iconClass}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <strong className="mt-4 block text-sm text-slate-900 group-hover:text-emerald-800">{module.title}</strong>
                <span className="mt-1 block text-xs leading-5 text-slate-600">{module.description}</span>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section
        id="mine-activity"
        title="Activité récente"
        description="Dernières opérations visibles pour cette société uniquement."
        icon={TrendingUp}
        tone="blue"
      >
        {recentActivity.length === 0 ? (
          <EmptyState title="Aucune activité" description="Les premières déclarations et demandes apparaîtront ici." />
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {recentActivity.map((activity) => (
              <Link key={activity.id} to={activity.path} className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition hover:bg-slate-50">
                <span><strong className="block text-sm text-slate-900">{activity.title}</strong><small className="text-slate-500">{formatDate(activity.date)}</small></span>
                <span className="text-sm font-semibold text-emerald-800">{activity.detail}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}
