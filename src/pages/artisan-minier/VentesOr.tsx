import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  AlertCircle,
  Coins,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
  SearchInput,
  SelectControl,
  StatGrid,
  type BadgeTone,
  type Column,
} from '@/components/ui/sn';
import { useConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { artisanGoldSalesService, type ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import './ventes-or.css';

type Statut = ArtisanGoldSale['statut'];
type TypeOr = ArtisanGoldSale['type_or'];
type SortKey = 'date' | 'montant' | 'quantite';

const STATUT_LABELS: Record<Statut, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  payee: 'Payée',
  annulee: 'Annulée',
};

const STATUT_TONES: Record<Statut, BadgeTone> = {
  en_attente: 'warning',
  validee: 'info',
  payee: 'success',
  annulee: 'danger',
};

const TYPE_OR_LABELS: Record<TypeOr, string> = {
  poudre: 'Poudre',
  lingot: 'Lingot',
  pepites: 'Pépites',
  bijoux: 'Bijoux',
  autre: 'Autre',
};

const STATUT_ORDER: Statut[] = ['en_attente', 'validee', 'payee', 'annulee'];

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const formatFcfa = (value: number) =>
  value >= 1_000_000 ? `${decimal.format(value / 1_000_000)} M FCFA` : `${integer.format(Math.round(value))} FCFA`;

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

interface Filters {
  search: string;
  statut: Statut | 'all';
  typeOr: TypeOr | 'all';
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { search: '', statut: 'all', typeOr: 'all', from: '', to: '' };

/** Filtrage combinable : chaque critère se cumule aux autres. */
export function filterSales(sales: ArtisanGoldSale[], filters: Filters): ArtisanGoldSale[] {
  const query = filters.search.trim().toLocaleLowerCase('fr');
  return sales.filter((sale) => {
    if (filters.statut !== 'all' && sale.statut !== filters.statut) return false;
    if (filters.typeOr !== 'all' && sale.type_or !== filters.typeOr) return false;
    if (filters.from && (sale.date_vente || '') < filters.from) return false;
    if (filters.to && (sale.date_vente || '') > filters.to) return false;
    if (!query) return true;
    return [sale.numero_recu, sale.observations, TYPE_OR_LABELS[sale.type_or]]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fr')
      .includes(query);
  });
}

export function sortSales(sales: ArtisanGoldSale[], key: SortKey): ArtisanGoldSale[] {
  return [...sales].sort((a, b) => {
    if (key === 'montant') return b.montant_total_fcfa - a.montant_total_fcfa;
    if (key === 'quantite') return b.quantite_grammes - a.quantite_grammes;
    return (b.date_vente || '').localeCompare(a.date_vente || '');
  });
}

export default function VentesOr() {
  const navigate = useNavigate();
  const [sales, setSales] = useState<ArtisanGoldSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('date');

  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();
  const confirmation = useConfirmationDialog();

  const loadSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await artisanGoldSalesService.getAll();
      setSales(data || []);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Impossible de charger les ventes d'or";
      setError(message);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSales();
  }, []);

  const results = useMemo(() => sortSales(filterSales(sales, filters), sort), [filters, sales, sort]);

  const stats = useMemo(
    () => ({
      total: results.length,
      enAttente: results.filter((sale) => sale.statut === 'en_attente').length,
      quantite: results.reduce((sum, sale) => sum + (sale.quantite_grammes || 0), 0),
      montant: results.reduce((sum, sale) => sum + (sale.montant_total_fcfa || 0), 0),
      taxes: results.reduce(
        (sum, sale) => sum + (sale.tva_montant_fcfa || 0) + (sale.taxe_dev_comm_montant_fcfa || 0),
        0
      ),
    }),
    [results]
  );

  const countByStatut = useMemo(
    () =>
      STATUT_ORDER.reduce(
        (counters, statut) => ({ ...counters, [statut]: sales.filter((sale) => sale.statut === statut).length }),
        {} as Record<Statut, number>
      ),
    [sales]
  );

  /** Suppression confirmée par le dialogue de la plateforme (plus de `confirm()` natif). */
  const handleDelete = async (sale: ArtisanGoldSale) => {
    const confirmed = await confirmation.open({
      title: 'Supprimer cette vente ?',
      message: `La vente ${sale.numero_recu || ''} sera définitivement retirée du registre.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      severity: 'danger',
      details: {
        Quantité: `${decimal.format(sale.quantite_grammes)} g`,
        Montant: formatFcfa(sale.montant_total_fcfa),
        Statut: STATUT_LABELS[sale.statut],
      },
    });
    if (!confirmed) return;

    setDeleting(sale.id);
    try {
      await artisanGoldSalesService.delete(sale.id);
      showSuccess('Vente supprimée avec succès');
      await loadSales();
    } catch {
      showError('Impossible de supprimer la vente');
    } finally {
      setDeleting(null);
    }
  };

  const columns: Column<ArtisanGoldSale>[] = [
    { key: 'numero_recu', header: 'N° de reçu', render: (sale) => <strong>{sale.numero_recu || '—'}</strong> },
    { key: 'date_vente', header: 'Date', render: (sale) => formatDate(sale.date_vente) },
    { key: 'type_or', header: 'Type d’or', render: (sale) => TYPE_OR_LABELS[sale.type_or] || sale.type_or },
    { key: 'purete', header: 'Pureté', numeric: true, render: (sale) => `${sale.purete_karat} K` },
    { key: 'quantite', header: 'Quantité', numeric: true, render: (sale) => `${decimal.format(sale.quantite_grammes)} g` },
    { key: 'montant', header: 'Montant total', numeric: true, render: (sale) => formatFcfa(sale.montant_total_fcfa) },
    {
      key: 'statut',
      header: 'Statut',
      render: (sale) => <Badge tone={STATUT_TONES[sale.statut]}>{STATUT_LABELS[sale.statut]}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (sale) => (
        <span className="ventes-or__actions">
          <button
            type="button"
            className="sn-btn sn-btn--sm sn-btn--icon"
            aria-label={`Consulter la vente ${sale.numero_recu || ''}`}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/artisan-minier/ventes-or/${sale.id}`);
            }}
          >
            <Eye aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sn-btn sn-btn--sm sn-btn--icon"
            aria-label={`Modifier la vente ${sale.numero_recu || ''}`}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/artisan-minier/ventes-or/${sale.id}/modifier`);
            }}
          >
            <Pencil aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sn-btn sn-btn--sm sn-btn--icon sn-btn--danger"
            aria-label={`Supprimer la vente ${sale.numero_recu || ''}`}
            disabled={deleting === sale.id}
            onClick={(event) => {
              event.stopPropagation();
              void handleDelete(sale);
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <NationalDashboardLayout>
      <div className="sn-page">
        <CustomAlert {...alertState} onClose={closeAlert} />
        <confirmation.ConfirmationDialog />

        <PageHeader
          icon={Coins}
          title="Ventes d’or des artisans"
          subtitle="Registre des collectes déclarées par les artisans miniers, taxes incluses."
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: "Ventes d'or" },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void loadSales()}>
                <RefreshCw aria-hidden="true" /> Actualiser
              </button>
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate('/artisan-minier/ventes-or/nouvelle')}
              >
                <Plus aria-hidden="true" /> Nouvelle vente
              </button>
            </>
          }
        />

        {error ? (
          <div className="sn-card ventes-or__error">
            <AlertCircle aria-hidden="true" />
            <div>
              <h3>Impossible de charger le registre</h3>
              <p>{error}</p>
            </div>
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void loadSales()}>
              <RefreshCw aria-hidden="true" /> Réessayer
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 16 }}>
              <StatGrid
                ariaLabel="Indicateurs des ventes d’or"
                items={[
                  { label: 'Ventes filtrées', value: integer.format(stats.total), hint: `${integer.format(stats.enAttente)} en attente`, icon: Coins, tone: 'gold' },
                  { label: 'Quantité collectée', value: `${decimal.format(stats.quantite)} g`, icon: Scale, tone: 'green' },
                  { label: 'Montant déclaré', value: formatFcfa(stats.montant), icon: Wallet, tone: 'blue' },
                  { label: 'Taxes et redevances', value: formatFcfa(stats.taxes), hint: 'TVA + taxe de développement', icon: TrendingUp, tone: 'violet' },
                ]}
              />
            </div>

            <section className="sn-card ventes-or__filters" aria-label="Filtres du registre">
              <div className="ventes-or__filters-row">
                <SearchInput
                  value={filters.search}
                  onChange={(search) => setFilters((current) => ({ ...current, search }))}
                  placeholder="Rechercher par numéro de reçu ou observation"
                />
                <label className="ventes-or__field">
                  <span>Type d’or</span>
                  <SelectControl
                    value={filters.typeOr}
                    onChange={(value) => setFilters((current) => ({ ...current, typeOr: value as TypeOr | 'all' }))}
                    ariaLabel="Filtrer par type d’or"
                  >
                    <option value="all">Tous les types</option>
                    {(Object.keys(TYPE_OR_LABELS) as TypeOr[]).map((type) => (
                      <option key={type} value={type}>{TYPE_OR_LABELS[type]}</option>
                    ))}
                  </SelectControl>
                </label>
                <label className="ventes-or__field">
                  <span>Trier par</span>
                  <SelectControl value={sort} onChange={(value) => setSort(value as SortKey)} ariaLabel="Trier les ventes">
                    <option value="date">Date (récentes)</option>
                    <option value="montant">Montant décroissant</option>
                    <option value="quantite">Quantité décroissante</option>
                  </SelectControl>
                </label>
                <label className="ventes-or__field ventes-or__dates">
                  <span>Période</span>
                  <div>
                    <Calendar aria-hidden="true" />
                    <input
                      type="date"
                      value={filters.from}
                      aria-label="Vendu à partir du"
                      onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                    />
                    <i aria-hidden="true">–</i>
                    <input
                      type="date"
                      value={filters.to}
                      aria-label="Vendu jusqu’au"
                      onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                    />
                  </div>
                </label>
                <button type="button" className="sn-btn sn-btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Réinitialiser
                </button>
              </div>

              <div className="sn-chips ventes-or__statuts" role="group" aria-label="Statut de la vente">
                <button
                  type="button"
                  className={filters.statut === 'all' ? 'is-active' : ''}
                  onClick={() => setFilters((current) => ({ ...current, statut: 'all' }))}
                >
                  Toutes <b>({integer.format(sales.length)})</b>
                </button>
                {STATUT_ORDER.map((statut) => (
                  <button
                    key={statut}
                    type="button"
                    className={filters.statut === statut ? 'is-active' : ''}
                    onClick={() => setFilters((current) => ({ ...current, statut }))}
                  >
                    {STATUT_LABELS[statut]} <b>({integer.format(countByStatut[statut] || 0)})</b>
                  </button>
                ))}
              </div>
            </section>

            <section className="sn-card ventes-or__table" aria-label="Registre des ventes">
              <div className="sn-card__head">
                <div>
                  <h3>
                    Registre des ventes <span className="sn-count">{integer.format(results.length)}</span>
                  </h3>
                  <p className="sn-card__hint">Cliquez sur une ligne pour ouvrir le détail de la vente.</p>
                </div>
              </div>

              {!loading && sales.length === 0 ? (
                <EmptyState
                  title="Aucune vente enregistrée"
                  description="Enregistrez la première collecte déclarée par un artisan minier."
                  action={
                    <button
                      type="button"
                      className="sn-btn sn-btn--primary"
                      onClick={() => navigate('/artisan-minier/ventes-or/nouvelle')}
                    >
                      <Plus aria-hidden="true" /> Nouvelle vente
                    </button>
                  }
                />
              ) : (
                <div style={{ padding: '0 16px 16px' }}>
                  <DataTable
                    columns={columns}
                    rows={results}
                    loading={loading}
                    empty="Aucune vente ne correspond aux filtres sélectionnés."
                    caption="Registre des ventes d’or des artisans"
                    onRowClick={(sale) => navigate(`/artisan-minier/ventes-or/${sale.id}`)}
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
