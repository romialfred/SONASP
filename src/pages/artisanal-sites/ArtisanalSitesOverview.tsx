import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Banknote,
  CircleDollarSign,
  HardHat,
  MapPinned,
  Pencil,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { BurkinaSitesMap } from '@/components/artisanal-sites/BurkinaSitesMap';
import { calculateSiteMetrics, artisanalSiteService } from '@/services/artisanalSiteService';
import type { ArtisanalSite, ArtisanalSiteStatus, SiteProduction } from '@/types/artisanalSite';

const currency = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const statusLabels: Record<ArtisanalSiteStatus, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  planned: 'Planifié',
};

const statusClasses: Record<ArtisanalSiteStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  suspended: 'bg-red-50 text-red-700 ring-red-200',
  planned: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const metricColorClasses = {
  emerald: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
} as const;

export default function ArtisanalSitesOverview() {
  const [sites, setSites] = useState<ArtisanalSite[]>([]);
  const [productions, setProductions] = useState<SiteProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ArtisanalSiteStatus>('all');

  useEffect(() => {
    let mounted = true;
    Promise.all([artisanalSiteService.listSites(), artisanalSiteService.listProductions()])
      .then(([siteData, productionData]) => {
        if (!mounted) return;
        setSites(siteData);
        setProductions(productionData);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setError(reason instanceof Error ? reason.message : 'Impossible de charger les sites artisanaux.');
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => calculateSiteMetrics(sites, productions), [productions, sites]);
  const filteredSites = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return sites.filter((site) => {
      const matchesStatus = status === 'all' || site.status === status;
      const matchesSearch =
        !query ||
        [site.name, site.code, site.region, site.province, site.locality]
          .join(' ')
          .toLocaleLowerCase('fr')
          .includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [search, sites, status]);

  const metricCards = [
    { label: 'Sites recensés', value: metrics.siteCount, detail: `${metrics.activeSiteCount} actifs`, icon: MapPinned, color: 'emerald' },
    { label: 'Artisans actifs', value: metrics.activeMinerCount.toLocaleString('fr-FR'), detail: 'Tous sites confondus', icon: Users, color: 'blue' },
    { label: 'Production enregistrée', value: `${metrics.productionKilograms.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`, detail: 'Période disponible', icon: HardHat, color: 'amber' },
    { label: "Chiffre d'affaires", value: `${currency.format(metrics.revenueFcfa)} FCFA`, detail: 'Ventes consolidées', icon: Banknote, color: 'violet' },
    { label: 'Taxes collectées', value: `${currency.format(metrics.taxesFcfa)} FCFA`, detail: 'Taxes et redevances', icon: CircleDollarSign, color: 'rose' },
  ] as const;

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Gestion territoriale</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Gestion des sites artisanaux</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Pilotez la capacité, les équipes, la production, le chiffre d’affaires et les taxes de chaque site.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/artisan-sites/production"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Activity className="h-4 w-4" aria-hidden="true" /> Production des sites
            </Link>
            <Link
              to="/artisan-sites/nouveau"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter un site
            </Link>
          </div>
        </header>

        {artisanalSiteService.isUsingLocalFallback() && !error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            Données de démonstration locales actives. Le module basculera automatiquement sur Supabase après application de la migration.
          </div>
        )}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicateurs des sites artisanaux">
          {metricCards.map(({ label, value, detail, icon: Icon, color }) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="mt-2 whitespace-nowrap text-[17px] font-bold text-slate-950">{value}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
                </div>
                <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${metricColorClasses[color]}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </article>
          ))}
        </section>

        {loading ? (
          <div className="grid h-80 place-items-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
            Chargement des sites…
          </div>
        ) : (
          <BurkinaSitesMap sites={sites} productions={productions} />
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="site-list-title">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center">
            <div>
              <h2 id="site-list-title" className="text-base font-bold text-slate-900">Répertoire des sites</h2>
              <p className="mt-1 text-xs text-slate-500">{filteredSites.length} résultat(s) affiché(s)</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <span className="sr-only">Rechercher un site</span>
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nom, code ou localité…"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-64"
                />
              </label>
              <label>
                <span className="sr-only">Filtrer par statut</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as 'all' | ArtisanalSiteStatus)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="active">Actifs</option>
                  <option value="planned">Planifiés</option>
                  <option value="suspended">Suspendus</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Site</th>
                  <th className="px-5 py-3 font-semibold">Localisation</th>
                  <th className="px-5 py-3 font-semibold">Exploitation</th>
                  <th className="px-5 py-3 text-right font-semibold">Artisans</th>
                  <th className="px-5 py-3 text-right font-semibold">Superficie</th>
                  <th className="px-5 py-3 font-semibold">Statut</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5">
                      <strong className="block text-sm text-slate-900">{site.name}</strong>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{site.code}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {site.locality}, {site.province}<span className="block text-[11px] text-slate-500">{site.region}</span>
                    </td>
                    <td className="px-5 py-3.5 capitalize text-slate-700">{site.exploitationType.replace('_', ' ')}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{site.activeMiners} / {site.authorizedMiners}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{site.areaHectares.toLocaleString('fr-FR')} ha</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${statusClasses[site.status]}`}>
                        {statusLabels[site.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/artisan-sites/${site.id}/modifier`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Modifier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filteredSites.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-slate-500">Aucun site ne correspond aux filtres.</div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
