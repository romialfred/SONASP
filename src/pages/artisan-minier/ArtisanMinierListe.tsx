import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  Coins,
  Download,
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
import { PageHeader } from '@/components/ui/sn';
import { ArtisanMinierForm } from '@/components/artisan/ArtisanMinierForm';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { carteProfessionnelleService, type CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import { latestCardByArtisan, provinceOfArtisan } from '@/services/artisanTerritoryInsights';
import { BURKINA_PROVINCES } from '@/data/burkinaProvinces';
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

const displayName = (artisan: ArtisanMinier) =>
  artisan.type_personne === 'morale'
    ? artisan.raison_sociale || 'Société sans raison sociale'
    : [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Artisan sans nom';

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

/** Chiffre d'affaires : toujours exprimé en millions, comme sur les cartes de référence. */
const formatMillions = (value: number) => `${decimal.format(value / 1_000_000)}M FCFA`;

/** Échéance de la carte : date d'expiration réelle, sinon un an après l'ouverture du dossier. */
function timeUntilExpiration(expiration?: string, created?: string) {
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
  const [artisans, setArtisans] = useState<ArtisanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('recent');
  const [view, setView] = useState<ViewMode>('grid');

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
        ((list || []) as ArtisanRow[]).map((artisan) => ({
          ...artisan,
          province: provinceOfArtisan(artisan),
          carte: cardByArtisan.get(artisan.id),
          quantite_or_vendu_grammes: artisan.quantite_or_vendu_grammes || 0,
          chiffre_affaires_fcfa: artisan.chiffre_affaires_fcfa || 0,
          total_taxes_fcfa: artisan.total_taxes_fcfa || 0,
        }))
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

  const countsByType = useMemo(
    () =>
      TYPE_ORDER.reduce(
        (counters, type) => ({
          ...counters,
          [type]: artisans.filter((artisan) => artisan.type_artisan === type).length,
        }),
        {} as Record<TypeArtisan, number>
      ),
    [artisans]
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
    const rows = artisans.filter((artisan) => {
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
  }, [applied, artisans, sort]);

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

  const exportToCSV = () => {
    const headers = ['Type', 'Nom', 'N° carte', 'Téléphone', 'Email', 'Région', 'Province', 'Or vendu (g)', 'CA (FCFA)', 'Taxes (FCFA)'];
    const rows = results.map((artisan) => [
      artisan.type_artisan || '',
      displayName(artisan),
      artisan.numero_carte || '',
      artisan.telephone || '',
      artisan.email || '',
      artisan.region || '',
      artisan.province || '',
      String(artisan.quantite_or_vendu_grammes || 0),
      String(artisan.chiffre_affaires_fcfa || 0),
      String(artisan.total_taxes_fcfa || 0),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `artisans-miniers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (showForm) {
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
          <Link to="/artisan-minier">Artisans miniers</Link>
          <span aria-hidden="true">/</span>
          <strong aria-current="page">Liste</strong>
        </nav>

        <header className="artisan-list__intro">
          <div>
            <h2>Artisans miniers</h2>
            <p>{integer.format(artisans.length)} artisans enregistrés</p>
          </div>
          <div className="artisan-list__actions">
            <button type="button" className="artisan-list__button" onClick={exportToCSV} disabled={results.length === 0}>
              <Download aria-hidden="true" /> Exporter
            </button>
            <button type="button" className="artisan-list__button is-primary" onClick={() => setShowForm(true)}>
              <Plus aria-hidden="true" /> Nouvel artisan
            </button>
          </div>
        </header>

        <section className="artisan-filters" aria-label="Filtres">
          <div className="artisan-filters__head">
            <h3>Filtrer les artisans</h3>
          </div>

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
            <button type="button" className="artisan-list__button" onClick={resetFilters}>
              <RotateCcw aria-hidden="true" /> Réinitialiser
            </button>
            <button type="button" className="artisan-list__button is-primary" onClick={() => setApplied(draft)}>
              <Filter aria-hidden="true" /> Appliquer les filtres
            </button>
          </div>

          <div className="artisan-filters__grid">
            <div className="artisan-filters__field is-types">
              <span>Type d’artisan</span>
              <div className="artisan-filters__chips" role="group" aria-label="Type d’artisan">
                <button type="button" className={applied.type === 'all' ? 'is-active' : ''} onClick={() => selectType('all')}>
                  Tous <b>({integer.format(artisans.length)})</b>
                </button>
                {TYPE_ORDER.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={applied.type === type ? 'is-active' : ''}
                    onClick={() => selectType(type)}
                  >
                    {TYPE_LABELS[type]} <b>({integer.format(countsByType[type] || 0)})</b>
                  </button>
                ))}
              </div>
            </div>

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

            <div className="artisan-filters__field">
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
          </div>

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
                    <div className="artisan-card__menu">
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
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {!loading && results.length > 0 && view === 'list' && (
          <div className="artisan-list__table-wrap">
            <table className="artisan-list__table">
              <thead>
                <tr>
                  <th>Artisan</th>
                  <th>Type</th>
                  <th>N° de carte</th>
                  <th>Région</th>
                  <th>Province</th>
                  <th>Téléphone</th>
                  <th>Or vendu</th>
                  <th>Chiffre d’affaires</th>
                  <th>Expire dans</th>
                </tr>
              </thead>
              <tbody>
                {results.map((artisan) => {
                  const expiration = timeUntilExpiration(artisan.carte?.date_expiration, artisan.created_at);
                  return (
                    <tr key={artisan.id} onClick={() => navigate(`/artisan-minier/${artisan.id}`)}>
                      <td><strong>{displayName(artisan)}</strong></td>
                      <td>{TYPE_SINGULAR[(artisan.type_artisan || 'collecteur') as TypeArtisan]}</td>
                      <td>{artisan.numero_carte || '—'}</td>
                      <td>{artisan.region || '—'}</td>
                      <td>{artisan.province || '—'}</td>
                      <td>{artisan.telephone || '—'}</td>
                      <td>{decimal.format(artisan.quantite_or_vendu_grammes || 0)} g</td>
                      <td>{formatMillions(artisan.chiffre_affaires_fcfa || 0)}</td>
                      <td className={expiration.expired ? 'is-expired' : ''}>{expiration.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
