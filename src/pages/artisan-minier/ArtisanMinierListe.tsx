import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  FileText,
  Filter,
  Handshake,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Phone,
  Pickaxe,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';
import { isCollectorScopedUser } from '@/lib/collectorAccess';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import { PageHeader } from '@/components/ui/sn';
import { ArtisanMinierForm } from '@/components/artisan/ArtisanMinierForm';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { carteProfessionnelleService, type CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import { latestCardByArtisan, provinceOfArtisan } from '@/services/artisanTerritoryInsights';
import { BURKINA_PROVINCES } from '@/data/burkinaProvinces';
import { normaliserArtisan } from './artisanRow';
import './artisan-minier-liste.css';

type TypeArtisan = 'collecteur' | 'fournisseur' | 'exploitant' | 'intermediaire';
type SortKey = 'recent' | 'name' | 'gold' | 'revenue';
type ViewMode = 'grid' | 'list';

interface ArtisanRow extends ArtisanMinier {
  province: string | null;
  carte?: CarteProfessionnelle;
  quantite_or_vendu_grammes?: number;
  chiffre_affaires_fcfa?: number;
  total_taxes_fcfa?: number;
}

/** Lignes affichees par page dans la vue tableau. */
export const TAILLE_PAGE = 30;

const TYPE_LABELS: Record<TypeArtisan, string> = {
  collecteur: 'Collecteurs',
  fournisseur: 'Fournisseurs',
  exploitant: 'Exploitants',
  intermediaire: 'Intermédiaires',
};

const TYPE_SINGULAR: Record<TypeArtisan, string> = {
  collecteur: 'Collecteur',
  fournisseur: 'Fournisseur',
  exploitant: 'Exploitant',
  intermediaire: 'Intermédiaire',
};

const TYPE_ICONS: Record<TypeArtisan, typeof Users> = {
  collecteur: Users,
  fournisseur: Package,
  exploitant: Pickaxe,
  intermediaire: Handshake,
};

const TYPE_ORDER: TypeArtisan[] = ['collecteur', 'fournisseur', 'exploitant', 'intermediaire'];

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Plus récent',
  name: 'Nom (A-Z)',
  gold: "Or vendu",
  revenue: "Chiffre d'affaires",
};

const REGIONS = [...new Set(BURKINA_PROVINCES.map((province) => province.region))].sort((a, b) =>
  a.localeCompare(b, 'fr')
);

interface Filters {
  search: string;
  type: TypeArtisan | 'all';
  region: string;
  province: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { search: '', type: 'all', region: '', province: '', from: '', to: '' };

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Initiales affichees en pastille devant le nom, dans le tableau. */
export const initiales = (nom: string): string =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() || '')
    .join('') || '?';

const displayName = (artisan: ArtisanMinier) =>
  artisan.type_personne === 'morale'
    ? artisan.raison_sociale || 'Société sans raison sociale'
    : [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Artisan sans nom';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

/** Chiffre d'affaires : toujours exprimé en millions, comme sur les cartes de référence. */
const formatMillions = (value: number) => `${decimal.format(value / 1_000_000)}M FCFA`;

/** Échéance de la carte : date d'expiration réelle, sinon un an après l'ouverture du dossier. */
function timeUntilExpiration(expiration?: string | null, created?: string | null) {
  const reference = expiration
    ? new Date(expiration)
    : created
      ? new Date(new Date(created).setFullYear(new Date(created).getFullYear() + 1))
      : null;

  if (!reference || Number.isNaN(reference.getTime())) return { expired: true, text: 'Non définie' };

  const remaining = reference.getTime() - Date.now();
  if (remaining <= 0) return { expired: true, text: 'Expirée' };

  const days = Math.floor(remaining / 86_400_000);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const rest = days % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mois`);
  if (years === 0 && rest > 0) parts.push(`${rest} jour${rest > 1 ? 's' : ''}`);

  return { expired: false, text: parts.join(', ') || '< 1 jour' };
}

export default function ArtisanMinierListe() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isComptoir = isComptoirScopedUser(user);
  const isCollector = isCollectorScopedUser(user);
  const { workspace: collectorWorkspace } = useCollectorWorkspace();
  const isScopedPartner = isComptoir || isCollector;
  const [artisans, setArtisans] = useState<ArtisanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('recent');
  const [view, setView] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [filtresDeplies, setFiltresDeplies] = useState(false);

  const loadArtisans = async () => {
    setLoading(true);
    try {
      // Une seule requête pour les cartes : l'ancien chargement en interrogeait une par artisan.
      const [list, cards] = await Promise.all([
        artisanMinierService.getAll(),
        carteProfessionnelleService.getAllCartes().catch(() => [] as CarteProfessionnelle[]),
      ]);
      const cardByArtisan = latestCardByArtisan((cards || []) as CarteProfessionnelle[]);

      setArtisans(
        (list || []).map((row): ArtisanRow => {
          const artisan = normaliserArtisan(row);
          return {
            ...artisan,
            province: provinceOfArtisan(artisan),
            carte: cardByArtisan.get(artisan.id),
            quantite_or_vendu_grammes: row.quantite_or_vendu_grammes || 0,
            chiffre_affaires_fcfa: row.chiffre_affaires_fcfa || 0,
            total_taxes_fcfa: 0,
          };
        })
      );
    } catch {
      setArtisans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadArtisans();
  }, []);

  const visibleArtisans = useMemo(() => {
    if (!isCollector) return artisans;
    const assigned = new Set(collectorWorkspace?.assignedArtisanIds || []);
    return artisans.filter((artisan) => assigned.has(artisan.id) && artisan.type_artisan !== 'collecteur');
  }, [artisans, collectorWorkspace?.assignedArtisanIds, isCollector]);

  const countsByType = useMemo(
    () =>
      TYPE_ORDER.reduce(
        (counters, type) => ({
          ...counters,
          [type]: visibleArtisans.filter((artisan) => artisan.type_artisan === type).length,
        }),
        {} as Record<TypeArtisan, number>
      ),
    [visibleArtisans]
  );

  const provinceOptions = useMemo(
    () =>
      BURKINA_PROVINCES.filter((province) => !applied.region || province.region === applied.region)
        .map((province) => province.name)
        .sort((a, b) => a.localeCompare(b, 'fr')),
    [applied.region]
  );

  const results = useMemo(() => {
    const query = applied.search.trim().toLocaleLowerCase('fr');
    const rows = visibleArtisans.filter((artisan) => {
      if (applied.type !== 'all' && artisan.type_artisan !== applied.type) return false;
      if (applied.region && artisan.region !== applied.region) return false;
      if (applied.province && artisan.province !== applied.province) return false;
      if (applied.from && (artisan.created_at || '') < applied.from) return false;
      if (applied.to && (artisan.created_at || '') > `${applied.to}T23:59:59`) return false;
      if (!query) return true;
      return [displayName(artisan), artisan.numero_carte, artisan.telephone, artisan.email]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(query);
    });

    return rows.sort((a, b) => {
      if (sort === 'name') return displayName(a).localeCompare(displayName(b), 'fr');
      if (sort === 'gold') return (b.quantite_or_vendu_grammes || 0) - (a.quantite_or_vendu_grammes || 0);
      if (sort === 'revenue') return (b.chiffre_affaires_fcfa || 0) - (a.chiffre_affaires_fcfa || 0);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [applied, visibleArtisans, sort]);

  const pagesTotal = Math.max(1, Math.ceil(results.length / TAILLE_PAGE));
  const pageCourante = Math.min(page, pagesTotal);
  const pageResults = useMemo(
    () => results.slice((pageCourante - 1) * TAILLE_PAGE, pageCourante * TAILLE_PAGE),
    [results, pageCourante]
  );

  // Un changement de filtre ou de tri ramene a la premiere page.
  useEffect(() => {
    setPage(1);
  }, [applied, sort]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: keyof Filters; label: string }> = [];
    if (applied.search) chips.push({ key: 'search', label: `Recherche : ${applied.search}` });
    if (applied.type !== 'all') chips.push({ key: 'type', label: `Type : ${TYPE_LABELS[applied.type]}` });
    if (applied.region) chips.push({ key: 'region', label: `Région : ${applied.region}` });
    if (applied.province) chips.push({ key: 'province', label: `Province : ${applied.province}` });
    if (applied.from) chips.push({ key: 'from', label: `Du ${formatDate(applied.from)}` });
    if (applied.to) chips.push({ key: 'to', label: `Au ${formatDate(applied.to)}` });
    return chips;
  }, [applied]);

  const removeChip = (key: keyof Filters) => {
    const next: Filters = { ...applied, [key]: key === 'type' ? 'all' : '' };
    setApplied(next);
    setDraft(next);
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  const selectType = (type: TypeArtisan | 'all') => {
    setDraft((current) => ({ ...current, type }));
    setApplied((current) => ({ ...current, type }));
  };

  if (showForm && !isScopedPartner) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page artisan-list">
          <PageHeader
            icon={UserPlus}
            title="Nouvel artisan minier"
            subtitle="Enregistrement d'un acteur du circuit artisanal et de sa pièce d'identité."
            breadcrumb={[
              { label: 'Artisans miniers', to: '/artisan-minier' },
              { label: 'Liste des artisans', to: '/artisan-minier/liste' },
              { label: 'Nouvel artisan' },
            ]}
            actions={
              <button type="button" className="sn-btn" onClick={() => setShowForm(false)}>
                <ArrowLeft aria-hidden="true" /> Retour à la liste
              </button>
            }
          />
          <ArtisanMinierForm
            artisan={null}
            onCancel={() => setShowForm(false)}
            onSuccess={async () => {
              setShowForm(false);
              await loadArtisans();
            }}
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="artisan-list">
        <nav className="artisan-list__breadcrumb" aria-label="Fil d’Ariane">
          <Link to={isCollector ? '/portail-collecteur' : isComptoir ? '/portail-comptoir' : '/artisan-minier'}>
            {isCollector ? 'Collecteur' : isComptoir ? 'Comptoir' : 'Artisans miniers'}
          </Link>
          <span aria-hidden="true">/</span>
          <strong aria-current="page">Liste</strong>
        </nav>

        <header className="artisan-list__intro">
          <div>
            <h2>{isCollector ? 'Mes orpailleurs assignés' : isComptoir ? 'Mes orpailleurs' : 'Artisans miniers'}</h2>
            <p>
              {integer.format(visibleArtisans.length)} {isCollector ? 'orpailleurs assignés' : isComptoir ? 'orpailleurs rattachés' : 'artisans enregistrés'}
            </p>
          </div>
          {!isScopedPartner && <div className="artisan-list__actions">
            <button type="button" className="artisan-list__button is-primary" onClick={() => setShowForm(true)}>
              <Plus aria-hidden="true" /> Nouvel artisan
            </button>
          </div>}
        </header>

        <section className="artisan-filters" aria-label="Filtres">
          {/* La section occupait un tiers de l'ecran en permanence : elle est
              desormais repliee a l'ouverture et se deplie au besoin. */}
          <button
            type="button"
            className="artisan-filters__toggle"
            aria-expanded={filtresDeplies}
            onClick={() => setFiltresDeplies((ouvert) => !ouvert)}
          >
            <Filter aria-hidden="true" />
            <h3>Filtrer les artisans</h3>
            {activeChips.length > 0 && <em>{activeChips.length}</em>}
            <ChevronDown aria-hidden="true" className={filtresDeplies ? 'is-open' : ''} />
          </button>

          {filtresDeplies && (
          <div className="artisan-filters__search-row">
            <label className="artisan-filters__search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={draft.search}
                onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => event.key === 'Enter' && setApplied(draft)}
                placeholder="Rechercher par nom, numéro de carte ou téléphone…"
                aria-label="Rechercher un artisan"
              />
            </label>
          </div>
          )}

          {filtresDeplies && (
          <div className="artisan-filters__grid">
            {/* Le type se choisissait par une rangee de pastilles qui occupait deux
                lignes ; une liste deroulante suffit et aligne ce filtre sur les autres. */}
            <label className="artisan-filters__field">
              <span>Type d’artisan</span>
              <div className="artisan-filters__select is-compact">
                <select
                  value={applied.type}
                  onChange={(event) => selectType(event.target.value as TypeArtisan | 'all')}
                >
                  <option value="all">Tous les types ({integer.format(visibleArtisans.length)})</option>
                  {TYPE_ORDER.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]} ({integer.format(countsByType[type] || 0)})
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" />
              </div>
            </label>

            <label className="artisan-filters__field">
              <span>Région</span>
              <div className="artisan-filters__select">
                <select
                  value={draft.region}
                  onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value, province: '' }))}
                >
                  <option value="">Toutes les régions</option>
                  {REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
                </select>
                <ChevronDown aria-hidden="true" />
              </div>
            </label>

            <label className="artisan-filters__field">
              <span>Province</span>
              <div className="artisan-filters__select">
                <select
                  value={draft.province}
                  onChange={(event) => setDraft((current) => ({ ...current, province: event.target.value }))}
                >
                  <option value="">Toutes les provinces</option>
                  {(draft.region
                    ? BURKINA_PROVINCES.filter((province) => province.region === draft.region).map((province) => province.name)
                    : provinceOptions
                  ).map((province) => <option key={province} value={province}>{province}</option>)}
                </select>
                <ChevronDown aria-hidden="true" />
              </div>
            </label>

            <div className="artisan-filters__field is-dates">
              <span>Date d’ouverture</span>
              <div className="artisan-filters__dates">
                <label>
                  <Calendar aria-hidden="true" />
                  <input
                    type="date"
                    value={draft.from}
                    onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
                    aria-label="Ouvert à partir du"
                  />
                </label>
                <i aria-hidden="true">-</i>
                <label>
                  <input
                    type="date"
                    value={draft.to}
                    onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
                    aria-label="Ouvert jusqu’au"
                  />
                </label>
              </div>
            </div>

            <div className="artisan-filters__actions">
              <button type="button" className="artisan-list__button" onClick={resetFilters}>
                <RotateCcw aria-hidden="true" /> Réinitialiser
              </button>
              <button type="button" className="artisan-list__button is-primary" onClick={() => setApplied(draft)}>
                <Filter aria-hidden="true" /> Appliquer
              </button>
            </div>
          </div>
          )}

          {activeChips.length > 0 && (
            <div className="artisan-filters__active">
              {activeChips.map((chip) => (
                <button key={chip.key} type="button" onClick={() => removeChip(chip.key)}>
                  {chip.label} <X aria-hidden="true" />
                </button>
              ))}
              <button type="button" className="artisan-filters__clear" onClick={resetFilters}>Effacer tout</button>
            </div>
          )}
        </section>

        <section className="artisan-list__toolbar" aria-label="Résultats">
          <p><List aria-hidden="true" /> {integer.format(results.length)} résultat{results.length > 1 ? 's' : ''}</p>
          <div className="artisan-list__toolbar-right">
            <label className="artisan-list__sort">
              Trier par :
              <div className="artisan-filters__select">
                <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <option key={key} value={key}>{SORT_LABELS[key]}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" />
              </div>
            </label>
            <div className="artisan-list__view" role="group" aria-label="Affichage">
              <button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} aria-label="Affichage en cartes">
                <LayoutGrid aria-hidden="true" />
              </button>
              <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')} aria-label="Affichage en tableau">
                <List aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {loading && <p className="artisan-list__empty">Chargement des artisans…</p>}
        {!loading && results.length === 0 && (
          <p className="artisan-list__empty">Aucun artisan ne correspond aux filtres sélectionnés.</p>
        )}

        {!loading && results.length > 0 && view === 'grid' && (
          <div className="artisan-cards">
            {results.map((artisan) => {
              const type = (artisan.type_artisan || 'collecteur') as TypeArtisan;
              const TypeIcon = TYPE_ICONS[type];
              const expiration = timeUntilExpiration(artisan.carte?.date_expiration, artisan.created_at);
              return (
                <article key={artisan.id} className={`artisan-card is-${type}`}>
                  <header>
                    <span className="artisan-card__badge"><TypeIcon aria-hidden="true" /> {TYPE_SINGULAR[type]}</span>
                    <img src="/sonasp_logo.png" alt="" aria-hidden="true" />
                  </header>

                  <h3>{displayName(artisan)}</h3>
                  <p className="artisan-card__code">{artisan.numero_carte || '—'}</p>

                  <p className="artisan-card__place">
                    <MapPin aria-hidden="true" /> {artisan.region || '—'}
                    <i aria-hidden="true">·</i>
                    <MapPin aria-hidden="true" /> {artisan.province || artisan.commune || '—'}
                  </p>

                  <div className="artisan-card__dates">
                    <span>
                      <Calendar aria-hidden="true" />
                      <b>Ouvert le</b>
                      {formatDate(artisan.created_at)}
                    </span>
                    <span>
                      <Clock aria-hidden="true" />
                      <b>Expire dans</b>
                      <em className={expiration.expired ? 'is-expired' : ''}>{expiration.text}</em>
                    </span>
                  </div>

                  <p className="artisan-card__contact"><Phone aria-hidden="true" /> {artisan.telephone || '—'}</p>
                  <p className="artisan-card__contact"><Mail aria-hidden="true" /> {artisan.email || '—'}</p>

                  <div className="artisan-card__stats">
                    <span className="is-gold">
                      <b><Coins aria-hidden="true" /> Or vendu</b>
                      <strong>{decimal.format(artisan.quantite_or_vendu_grammes || 0)} g</strong>
                    </span>
                    <span className="is-green">
                      <b><TrendingUp aria-hidden="true" /> Chiffre d’affaires</b>
                      <strong>{formatMillions(artisan.chiffre_affaires_fcfa || 0)}</strong>
                    </span>
                    <span className="is-blue">
                      <b><Receipt aria-hidden="true" /> Taxes</b>
                      <strong>{integer.format(artisan.total_taxes_fcfa || 0)} FCFA</strong>
                    </span>
                  </div>

                  <footer>
                    <button type="button" onClick={() => navigate(`/artisan-minier/${artisan.id}`)}>
                      <FileText aria-hidden="true" /> Voir le dossier
                    </button>
                    {!isScopedPartner && <div className="artisan-card__menu">
                      <button
                        type="button"
                        aria-label={`Actions pour ${displayName(artisan)}`}
                        aria-expanded={openMenu === artisan.id}
                        onClick={() => setOpenMenu((current) => (current === artisan.id ? null : artisan.id))}
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </button>
                      {openMenu === artisan.id && (
                        <div className="artisan-card__menu-panel">
                          <button type="button" onClick={() => navigate(`/artisan-minier/${artisan.id}`)}>Consulter</button>
                          <button type="button" onClick={() => navigate(`/artisan-minier/${artisan.id}/edit`)}>Modifier</button>
                          <button type="button" onClick={() => navigate('/artisan-minier/cartes/suivi')}>Suivi de la carte</button>
                        </div>
                      )}
                    </div>}
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {!loading && results.length > 0 && view === 'list' && (
          <div className="artisan-list__table-wrap">
            <table className="artisan-list__table">
              <caption className="sr-only">Artisans miniers enregistrés</caption>
              <thead>
                <tr>
                  <th scope="col">Artisan</th>
                  <th scope="col">Type</th>
                  <th scope="col">N° de carte</th>
                  <th scope="col">Province</th>
                  <th scope="col" className="is-num">Or vendu</th>
                  <th scope="col" className="is-num">Chiffre d’affaires</th>
                  <th scope="col">Carte</th>
                </tr>
              </thead>
              <tbody>
                {/* Région et téléphone quittent le tableau : l'un doublonne la province,
                    l'autre relève de la fiche de l'artisan. */}
                {pageResults.map((artisan) => {
                  const expiration = timeUntilExpiration(artisan.carte?.date_expiration, artisan.created_at);
                  const type = (artisan.type_artisan || 'collecteur') as TypeArtisan;
                  return (
                    <tr key={artisan.id} onClick={() => navigate(`/artisan-minier/${artisan.id}`)}>
                      <td>
                        <span className="artisan-list__cell-name">
                          <i aria-hidden="true">{initiales(displayName(artisan))}</i>
                          <strong>{displayName(artisan)}</strong>
                        </span>
                      </td>
                      <td>
                        <span className={`artisan-list__type is-${type}`}>{TYPE_SINGULAR[type]}</span>
                      </td>
                      <td><code className="artisan-list__card">{artisan.numero_carte || '—'}</code></td>
                      <td>{artisan.province || '—'}</td>
                      <td className="is-num">{decimal.format(artisan.quantite_or_vendu_grammes || 0)} g</td>
                      <td className="is-num">{formatMillions(artisan.chiffre_affaires_fcfa || 0)}</td>
                      <td>
                        <span className={`artisan-list__expiry${expiration.expired ? ' is-expired' : ''}`}>
                          {expiration.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pagesTotal > 1 && (
              <nav className="artisan-list__pagination" aria-label="Pagination des artisans">
                <span>
                  {integer.format((pageCourante - 1) * TAILLE_PAGE + 1)}–
                  {integer.format(Math.min(pageCourante * TAILLE_PAGE, results.length))} sur{' '}
                  {integer.format(results.length)}
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setPage((courante) => Math.max(1, courante - 1))}
                    disabled={pageCourante === 1}
                  >
                    <ChevronLeft aria-hidden="true" /> Précédent
                  </button>
                  <b>
                    Page {pageCourante} / {pagesTotal}
                  </b>
                  <button
                    type="button"
                    onClick={() => setPage((courante) => Math.min(pagesTotal, courante + 1))}
                    disabled={pageCourante === pagesTotal}
                  >
                    Suivant <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
