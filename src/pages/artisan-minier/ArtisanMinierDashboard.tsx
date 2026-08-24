import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  CreditCard,
  Map as MapIcon,
  MapPin,
  Mountain,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { BurkinaTerritoryMap } from '@/components/artisanal-sites/BurkinaTerritoryMap';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { carteProfessionnelleService, type CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import { artisanalSiteService } from '@/services/artisanalSiteService';
import {
  SITE_HEALTH_LABELS,
  TOTAL_REGIONS,
  buildAdministrativeState,
  buildRegionStats,
  buildRegistrationTrend,
  buildSiteRows,
  buildTypeShares,
  isValidCard,
  latestCardByArtisan,
} from '@/services/artisanTerritoryInsights';
import type { ArtisanalSite } from '@/types/artisanalSite';
import './artisan-minier-dashboard.css';

type TerritoryTab = 'map' | 'list';

const integer = new Intl.NumberFormat('fr-FR');
const YEAR = new Date().getFullYear();

function formatUpdatedAt(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(parsed)) / 86_400_000);
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(parsed);

  if (days === 0) return `Aujourd’hui, ${time}`;
  if (days === 1) return `Hier, ${time}`;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(parsed);
}

export default function ArtisanMinierDashboard() {
  const navigate = useNavigate();
  const [artisans, setArtisans] = useState<ArtisanMinier[]>([]);
  const [cards, setCards] = useState<CarteProfessionnelle[]>([]);
  const [sites, setSites] = useState<ArtisanalSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [region, setRegion] = useState('all');
  const [province, setProvince] = useState('all');
  const [siteId, setSiteId] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [territoryTab, setTerritoryTab] = useState<TerritoryTab>('map');
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  /** Nombre de filtres reellement appliques, affiche sur le bouton. */
  const filtresActifs = [region, province, siteId, type, status].filter((valeur) => valeur !== 'all').length;

  // Le volet se ferme aussi a la touche Echap, comme toute surcouche modale.
  useEffect(() => {
    if (!filtresOuverts) return undefined;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setFiltresOuverts(false);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [filtresOuverts]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      artisanMinierService.getAll().catch(() => [] as ArtisanMinier[]),
      carteProfessionnelleService.getAllCartes().catch(() => [] as CarteProfessionnelle[]),
      artisanalSiteService.listSites().catch(() => [] as ArtisanalSite[]),
    ])
      .then(([artisanData, cardData, siteData]) => {
        if (!mounted) return;
        setArtisans((artisanData || []) as ArtisanMinier[]);
        setCards((cardData || []) as CarteProfessionnelle[]);
        setSites(siteData || []);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setError(reason instanceof Error ? reason.message : 'Impossible de charger les données des artisans.');
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const cardsByArtisan = useMemo(() => latestCardByArtisan(cards), [cards]);

  const siteOptions = useMemo(
    () => [...sites].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [sites]
  );
  const regionOptions = useMemo(
    () =>
      [...new Set([...artisans.map((item) => item.region), ...sites.map((item) => item.region)].filter(Boolean) as string[])]
        .sort((a, b) => a.localeCompare(b, 'fr')),
    [artisans, sites]
  );
  const provinceOptions = useMemo(
    () => [...new Set(sites.map((site) => site.province))].sort((a, b) => a.localeCompare(b, 'fr')),
    [sites]
  );

  const filteredSites = useMemo(
    () =>
      sites.filter((site) => {
        const matchesRegion = region === 'all' || site.region === region;
        const matchesProvince = province === 'all' || site.province === province;
        const matchesSite = siteId === 'all' || site.id === siteId;
        return matchesRegion && matchesProvince && matchesSite;
      }),
    [province, region, siteId, sites]
  );

  const filteredArtisans = useMemo(() => {
    const localities = new Set(filteredSites.map((site) => site.locality.toLocaleLowerCase('fr')));

    return artisans.filter((artisan) => {
      const card = cardsByArtisan.get(artisan.id);
      const matchesRegion = region === 'all' || artisan.region === region;
      const matchesType = type === 'all' || artisan.type_artisan === type;
      const matchesStatus =
        status === 'all' ||
        (status === 'valide' ? isValidCard(card) : card?.statut === status);
      const matchesSite =
        (province === 'all' && siteId === 'all') ||
        localities.has((artisan.commune || '').toLocaleLowerCase('fr'));
      return matchesRegion && matchesType && matchesStatus && matchesSite;
    });
  }, [artisans, cardsByArtisan, filteredSites, province, region, siteId, status, type]);

  const filteredCards = useMemo(() => {
    const ids = new Set(filteredArtisans.map((artisan) => artisan.id));
    return cards.filter((card) => ids.has(card.artisan_id));
  }, [cards, filteredArtisans]);

  const regionStats = useMemo(
    () => buildRegionStats(filteredArtisans, filteredSites),
    [filteredArtisans, filteredSites]
  );
  const siteRows = useMemo(
    () => buildSiteRows(filteredSites, filteredArtisans, cardsByArtisan),
    [cardsByArtisan, filteredArtisans, filteredSites]
  );
  const typeShares = useMemo(() => buildTypeShares(filteredArtisans), [filteredArtisans]);
  const administrative = useMemo(() => buildAdministrativeState(filteredCards), [filteredCards]);
  const trend = useMemo(
    () => buildRegistrationTrend(filteredArtisans, filteredCards, YEAR),
    [filteredArtisans, filteredCards]
  );

  const metrics = useMemo(() => {
    const validCards = filteredArtisans.filter((artisan) => isValidCard(cardsByArtisan.get(artisan.id))).length;
    const pending = filteredArtisans.filter((artisan) => cardsByArtisan.get(artisan.id)?.statut === 'en_cours').length;
    const alerts = filteredArtisans.filter((artisan) => {
      const card = cardsByArtisan.get(artisan.id);
      return !card || card.statut === 'expiree' || card.statut === 'suspendue';
    }).length;

    return {
      registered: filteredArtisans.length,
      regionsCovered: new Set(filteredArtisans.map((artisan) => artisan.region).filter(Boolean)).size,
      activeSites: filteredSites.filter((site) => site.status === 'active').length,
      validCards,
      pending,
      alerts,
    };
  }, [cardsByArtisan, filteredArtisans, filteredSites]);

  const regionValues = useMemo(
    () =>
      Object.fromEntries(
        regionStats.map((stat) => [stat.region, { artisans: stat.artisans, sites: stat.sites }])
      ),
    [regionStats]
  );

  const mapSites = useMemo(
    () =>
      filteredSites
        .filter((site) => site.status === 'active')
        .map((site) => ({
          id: site.id,
          name: site.name,
          region: site.region,
          longitude: site.longitude,
          latitude: site.latitude,
          status: 'active' as const,
          details: [`${site.locality}, ${site.province}`, `${integer.format(site.activeMiners)} artisans`],
        })),
    [filteredSites]
  );

  const maxRegionArtisans = Math.max(1, ...regionStats.map((stat) => stat.artisans));

  const resetFilters = () => {
    setRegion('all');
    setProvince('all');
    setSiteId('all');
    setType('all');
    setStatus('all');
  };

  return (
    <NationalDashboardLayout>
      <div className="artisans-dashboard">
        <header className="artisans-dashboard__intro">
          <div>
            <h2>Gestion des Artisans Miniers</h2>
            <p>Vue territoriale des artisans, régions et sites miniers</p>
          </div>
          <div className="artisans-dashboard__actions">
            <button
              type="button"
              className={`artisans-button${filtresActifs > 0 ? ' is-filtered' : ''}`}
              onClick={() => setFiltresOuverts(true)}
              aria-expanded={filtresOuverts}
            >
              <SlidersHorizontal aria-hidden="true" /> Filtres
              {filtresActifs > 0 && <em>{filtresActifs}</em>}
            </button>
            <button type="button" className="artisans-button artisans-button--gold" onClick={() => navigate('/artisan-minier/liste')}>
              <Plus aria-hidden="true" /> Nouvel artisan
            </button>
          </div>
        </header>

        {/* Les filtres passent dans un volet lateral : la bande occupait toute la
            largeur en tete de page et poussait les indicateurs vers le bas. */}
        {filtresOuverts && (
          <div className="artisans-drawer" role="presentation">
            {/* Surface de fermeture au clic hors panneau. Non focusable : le bouton
                de l'en-tete et la touche Echap portent l'affordance accessible. */}
            <div
              className="artisans-drawer__backdrop"
              aria-hidden="true"
              onClick={() => setFiltresOuverts(false)}
            />
            <aside
              className="artisans-drawer__panel"
              role="dialog"
              aria-modal="true"
              aria-label="Filtres des artisans"
            >
              <header>
                <h3>
                  <SlidersHorizontal aria-hidden="true" /> Filtres
                </h3>
                <button type="button" aria-label="Fermer les filtres" onClick={() => setFiltresOuverts(false)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="artisans-drawer__body">
                <label className="artisans-drawer__field">
                  <span>Région</span>
                  <select value={region} onChange={(event) => setRegion(event.target.value)}>
                    <option value="all">Toutes</option>
                    {regionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>

                <label className="artisans-drawer__field">
                  <span>Province</span>
                  <select value={province} onChange={(event) => setProvince(event.target.value)}>
                    <option value="all">Toutes</option>
                    {provinceOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>

                <label className="artisans-drawer__field">
                  <span>Site minier</span>
                  <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                    <option value="all">Tous</option>
                    {siteOptions.map((item) => <option key={item.id} value={item.id}>{item.locality}</option>)}
                  </select>
                </label>

                <label className="artisans-drawer__field">
                  <span>Type d’artisan</span>
                  <select value={type} onChange={(event) => setType(event.target.value)}>
                    <option value="all">Tous</option>
                    <option value="exploitant">Exploitant</option>
                    <option value="collecteur">Collecteur</option>
                    <option value="fournisseur">Fournisseur</option>
                    <option value="intermediaire">Intermédiaire</option>
                  </select>
                </label>

                <label className="artisans-drawer__field">
                  <span>Statut de la carte</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="all">Tous</option>
                    <option value="valide">Carte valide</option>
                    <option value="en_cours">En attente</option>
                    <option value="expiree">Expirée</option>
                    <option value="suspendue">Suspendue</option>
                  </select>
                </label>
              </div>

              <footer>
                <button type="button" className="artisans-drawer__reset" onClick={resetFilters} disabled={filtresActifs === 0}>
                  <RotateCcw aria-hidden="true" /> Réinitialiser
                </button>
                <button type="button" className="artisans-button artisans-button--gold" onClick={() => setFiltresOuverts(false)}>
                  Appliquer
                </button>
              </footer>
            </aside>
          </div>
        )}

        {error && <div className="artisans-dashboard__error" role="alert">{error}</div>}

        <section className="artisans-dashboard__metrics" aria-label="Indicateurs des artisans miniers">
          {[
            { key: 'registered', label: 'Artisans enregistrés', value: integer.format(metrics.registered), icon: Users, tone: 'green' },
            { key: 'regions', label: 'Régions couvertes', value: `${metrics.regionsCovered} / ${TOTAL_REGIONS}`, icon: MapIcon, tone: 'blue' },
            { key: 'sites', label: 'Sites miniers actifs', value: integer.format(metrics.activeSites), icon: Mountain, tone: 'teal' },
            { key: 'cards', label: 'Cartes valides', value: integer.format(metrics.validCards), icon: CreditCard, tone: 'indigo' },
            { key: 'pending', label: 'Dossiers en attente', value: integer.format(metrics.pending), icon: Clock3, tone: 'amber' },
            { key: 'alerts', label: 'Alertes conformité', value: integer.format(metrics.alerts), icon: AlertTriangle, tone: 'red' },
          ].map(({ key, label, value, icon: Icon, tone }) => (
            <article key={key} className={`artisans-metric is-${tone}`}>
              <span className="artisans-metric__icon"><Icon aria-hidden="true" /></span>
              <div>
                <h3>{label}</h3>
                <strong>{value}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className="artisans-dashboard__territory">
          <article className="artisans-panel">
            <div className="artisans-panel__header">
              <h3>Répartition territoriale des artisans</h3>
              <div className="artisans-tabs" role="tablist" aria-label="Affichage territorial">
                <button type="button" role="tab" aria-selected={territoryTab === 'map'} className={territoryTab === 'map' ? 'is-active' : ''} onClick={() => setTerritoryTab('map')}>Carte</button>
                <button type="button" role="tab" aria-selected={territoryTab === 'list'} className={territoryTab === 'list' ? 'is-active' : ''} onClick={() => setTerritoryTab('list')}>Liste</button>
              </div>
            </div>
            {territoryTab === 'map' ? (
              <BurkinaTerritoryMap
                variant="density"
                sites={mapSites}
                regionValues={regionValues}
                defaultHighlight={regionStats[0]?.region}
              />
            ) : (
              <div className="artisans-region-list">
                <table>
                  <thead>
                    <tr><th>Région</th><th>Artisans</th><th>Sites actifs</th></tr>
                  </thead>
                  <tbody>
                    {regionStats.map((stat) => (
                      <tr key={stat.region}>
                        <td>{stat.region}</td>
                        <td>{integer.format(stat.artisans)}</td>
                        <td>{integer.format(stat.sites)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="artisans-panel">
            <div className="artisans-panel__header"><h3>Classement par région</h3></div>
            <ol className="artisans-ranking">
              {regionStats.slice(0, 6).map((stat, index) => (
                <li key={stat.region}>
                  <span className="artisans-ranking__rank">{index + 1}</span>
                  <span className="artisans-ranking__label">
                    <strong>{stat.region}</strong>
                    <small>{integer.format(stat.sites)} sites</small>
                  </span>
                  <i><b style={{ width: `${(stat.artisans / maxRegionArtisans) * 100}%` }} /></i>
                  <b className="artisans-ranking__value">{integer.format(stat.artisans)}</b>
                </li>
              ))}
              {regionStats.length === 0 && <li className="artisans-ranking__empty">Aucune donnée pour ces filtres.</li>}
            </ol>
          </article>
        </section>

        <section className="artisans-panel artisans-sites-panel" aria-labelledby="artisans-sites-title">
          <div className="artisans-panel__header">
            <h3 id="artisans-sites-title">État des sites miniers <span className="artisans-badge">{integer.format(siteRows.length)} sites</span></h3>
            <Link to="/artisan-sites" className="artisans-panel__link">Voir tous les sites <ChevronRight aria-hidden="true" /></Link>
          </div>
          <div className="artisans-table-wrap">
            <table className="artisans-table">
              <thead>
                <tr>
                  <th>Site minier</th>
                  <th>Région</th>
                  <th>Province</th>
                  <th>Artisans</th>
                  <th>Cartes valides</th>
                  <th>En attente</th>
                  <th>Statut</th>
                  <th>Dernière mise à jour</th>
                </tr>
              </thead>
              <tbody>
                {siteRows.slice(0, 5).map((row) => (
                  <tr key={row.site.id}>
                    <td>
                      <span className="artisans-table__site">
                        <MapPin aria-hidden="true" /> {row.site.locality}
                      </span>
                    </td>
                    <td>{row.site.region}</td>
                    <td>{row.site.province}</td>
                    <td>{integer.format(row.artisans)}</td>
                    <td>{integer.format(row.validCards)}</td>
                    <td>{integer.format(row.pending)}</td>
                    <td><span className={`artisans-health artisans-health--${row.health}`}>{SITE_HEALTH_LABELS[row.health]}</span></td>
                    <td>{formatUpdatedAt(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && siteRows.length === 0 && (
              <p className="artisans-table__empty">Aucun site ne correspond aux filtres sélectionnés.</p>
            )}
            {loading && <p className="artisans-table__empty">Chargement des données…</p>}
          </div>
        </section>

        <section className="artisans-dashboard__charts">
          <article className="artisans-panel">
            <div className="artisans-panel__header"><h3>Répartition par type d’artisan</h3></div>
            <div className="artisans-donut">
              <div className="artisans-donut__chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeShares} dataKey="value" nameKey="label" innerRadius={44} outerRadius={72} paddingAngle={1} stroke="#fff" strokeWidth={2}>
                      {typeShares.map((share) => <Cell key={share.type} fill={share.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${integer.format(Number(value))} artisans`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="artisans-donut__legend">
                {typeShares.map((share) => (
                  <li key={share.type}>
                    <i style={{ background: share.color }} aria-hidden="true" />
                    <span>{share.label}</span>
                    <strong>{share.share}%</strong>
                  </li>
                ))}
                {typeShares.length === 0 && <li className="artisans-ranking__empty">Aucun artisan enregistré.</li>}
              </ul>
            </div>
          </article>

          <article className="artisans-panel">
            <div className="artisans-panel__header"><h3>État administratif</h3></div>
            <ul className="artisans-bars">
              {administrative.map((row) => (
                <li key={row.key}>
                  <span>{row.label}</span>
                  <i><b style={{ width: `${row.share}%`, background: row.color }} /></i>
                  <strong>{row.share}%</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="artisans-panel">
            <div className="artisans-panel__header">
              <h3>Évolution des enregistrements</h3>
              <div className="artisans-chart-legend">
                <span><i style={{ background: '#0f7a56' }} aria-hidden="true" /> Nouveaux artisans</span>
                <span><i style={{ background: '#e2a000' }} aria-hidden="true" /> Cartes validées</span>
              </div>
            </div>
            <div className="artisans-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 18, right: 14, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e6ecf1" strokeDasharray="2 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#d7e0e8' }} tick={{ fill: '#61748a', fontSize: 9.5 }} />
                  <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: '#61748a', fontSize: 9.5 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2eaf0', fontSize: 11 }} />
                  <Line type="monotone" dataKey="nouveaux" stroke="#0f7a56" strokeWidth={2} dot={{ r: 3, fill: '#0f7a56', strokeWidth: 0 }}>
                    <LabelList dataKey="nouveaux" position="top" style={{ fill: '#0f7a56', fontSize: 9 }} />
                  </Line>
                  <Line type="monotone" dataKey="validees" stroke="#e2a000" strokeWidth={2} dot={{ r: 3, fill: '#e2a000', strokeWidth: 0 }}>
                    <LabelList dataKey="validees" position="bottom" style={{ fill: '#c98f00', fontSize: 9 }} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>
      </div>
    </NationalDashboardLayout>
  );
}
