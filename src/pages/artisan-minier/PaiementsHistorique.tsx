import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock3,
  FileSearch,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  DataTable,
  EmptyState,
  Note,
  PageHeader,
  SearchInput,
  SelectControl,
  StatGrid,
  type Column,
} from '@/components/ui/sn';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import artisanPaiementsService, {
  type FactureDefinitive,
  type PaiementArtisan,
} from '@/services/artisanPaiementsService';
import { useAuth } from '@/contexts/AuthContext';
import { isCollectorScopedUser } from '@/lib/collectorAccess';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import {
  ARTISAN_PAYMENT_ACTIVE_STATUSES,
  ARTISAN_PAYMENT_NEXT_STEPS,
  ARTISAN_PAYMENT_STATUS_LABELS,
  ARTISAN_PAYMENT_STATUS_ORDER,
  ARTISAN_PAYMENT_STATUS_SHORT_LABELS,
  ARTISAN_PAYMENT_STATUS_TONES,
  ARTISAN_PAYMENT_TYPE_LABELS,
  artisanPaymentHolderName,
  artisanPaymentSaleReference,
} from './artisan-payment-presentation';
import './paiements-ventes.css';

type Statut = PaiementArtisan['statut'];
type TypePaiement = PaiementArtisan['type_paiement'];

interface PaiementRow extends PaiementArtisan {
  artisan?: {
    nom?: string | null;
    prenoms?: string | null;
    raison_sociale?: string | null;
    numero_carte?: string | null;
  } | null;
  facture?: FactureDefinitive | null;
  vente?: {
    id?: string;
    reference_vente?: string | null;
    numero_recu?: string | null;
    date_vente?: string | null;
  } | null;
}
const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const formatFcfa = (value?: number) => {
  const amount = value || 0;
  return amount >= 1_000_000
    ? `${decimal.format(amount / 1_000_000)} M FCFA`
    : `${integer.format(Math.round(amount))} FCFA`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

export interface HistoriqueFilters {
  search: string;
  statut: Statut | 'tous';
  type: TypePaiement | 'tous';
  from: string;
  to: string;
}

export const EMPTY_HISTORIQUE_FILTERS: HistoriqueFilters = {
  search: '',
  statut: 'tous',
  type: 'tous',
  from: '',
  to: '',
};

/** Filtrage combinable du registre ; les bornes de date sont inclusives. */
export function filterPaiements(paiements: PaiementRow[], filters: HistoriqueFilters): PaiementRow[] {
  const query = filters.search.trim().toLocaleLowerCase('fr');
  return paiements.filter((paiement) => {
    if (filters.statut !== 'tous' && paiement.statut !== filters.statut) return false;
    if (filters.type !== 'tous' && paiement.type_paiement !== filters.type) return false;

    const date = (paiement.date_paiement || '').slice(0, 10);
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;

    if (!query) return true;
    return [
      paiement.reference_paiement,
      artisanPaymentHolderName(paiement),
      paiement.artisan?.numero_carte,
      paiement.facture?.numero_facture,
      artisanPaymentSaleReference(paiement),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fr')
      .includes(query);
  });
}

export default function PaiementsHistorique() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCollector = isCollectorScopedUser(user);
  const { workspace: collectorWorkspace } = useCollectorWorkspace();
  const [paiements, setPaiements] = useState<PaiementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<HistoriqueFilters>(EMPTY_HISTORIQUE_FILTERS);
  const { alertState, showError, closeAlert } = useCustomAlert();

  const chargerHistorique = async () => {
    setLoading(true);
    try {
      const data = await artisanPaiementsService.getAllPaiements();
      setPaiements((data || []) as PaiementRow[]);
    } catch {
      showError('Impossible de charger les dossiers de paiement');
      setPaiements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void chargerHistorique();
  }, []);

  const visiblePaiements = useMemo(() => {
    if (!isCollector) return paiements;
    const assigned = new Set(collectorWorkspace?.assignedArtisanIds || []);
    return paiements.filter((paiement) => assigned.has(paiement.artisan_id));
  }, [collectorWorkspace?.assignedArtisanIds, isCollector, paiements]);

  const results = useMemo(() => filterPaiements(visiblePaiements, filters), [filters, visiblePaiements]);

  const stats = useMemo(
    () => ({
      total: visiblePaiements.length,
      enCours: visiblePaiements.filter((payment) => ARTISAN_PAYMENT_ACTIVE_STATUSES.includes(payment.statut)).length,
      aControler: visiblePaiements.filter((payment) => payment.statut === 'en_traitement').length,
      montantRegle: visiblePaiements
        .filter((payment) => payment.statut === 'complete')
        .reduce((sum, payment) => sum + (payment.montant_paye || 0), 0),
      taxesRetenues: visiblePaiements
        .filter((payment) => payment.statut === 'complete')
        .reduce((sum, payment) => sum + (payment.montant_taxes_retenues || 0), 0),
    }),
    [visiblePaiements],
  );

  const countByStatut = useMemo(
    () => ARTISAN_PAYMENT_STATUS_ORDER.reduce(
      (counters, key) => ({
        ...counters,
        [key]: visiblePaiements.filter((payment) => payment.statut === key).length,
      }),
      {} as Record<Statut, number>,
    ),
    [visiblePaiements],
  );

  const ouvrirDossier = (paiement: PaiementRow) => {
    if (paiement.id) navigate(`/artisan-minier/paiements/historique/${paiement.id}`);
  };

  const columns: Column<PaiementRow & { id?: string }>[] = [
    {
      key: 'reference_paiement',
      header: 'Dossier',
      render: (payment) => (
        <span className="paiements__reference">
          <strong>{payment.reference_paiement || '—'}</strong>
          <small>{artisanPaymentSaleReference(payment)}</small>
        </span>
      ),
    },
    {
      key: 'artisan',
      header: 'Bénéficiaire',
      render: (payment) => (
        <span className="paiements__artisan">
          <strong>{artisanPaymentHolderName(payment)}</strong>
          <small>{payment.artisan?.numero_carte || 'Carte non renseignée'}</small>
        </span>
      ),
    },
    {
      key: 'facture',
      header: 'Facture',
      render: (payment) => (
        <span className="paiements__reference is-secondary">
          <strong>{payment.facture?.numero_facture || payment.numero_facture || '—'}</strong>
          <small>{formatDate(payment.facture?.date_emission)}</small>
        </span>
      ),
    },
    {
      key: 'date_paiement',
      header: 'Préparé le',
      render: (payment) => formatDate(payment.date_paiement),
    },
    {
      key: 'type_paiement',
      header: 'Canal',
      render: (payment) => ARTISAN_PAYMENT_TYPE_LABELS[payment.type_paiement],
    },
    {
      key: 'montant_paye',
      header: 'Net à verser',
      numeric: true,
      render: (payment) => <strong>{formatFcfa(payment.montant_paye)}</strong>,
    },
    {
      key: 'statut',
      header: 'État du dossier',
      render: (payment) => (
        <Badge tone={ARTISAN_PAYMENT_STATUS_TONES[payment.statut]}>
          {ARTISAN_PAYMENT_STATUS_LABELS[payment.statut]}
        </Badge>
      ),
    },
    {
      key: 'prochaine_etape',
      header: 'Prochaine étape',
      render: (payment) => (
        <span className="paiements__next-step">
          <strong>{ARTISAN_PAYMENT_NEXT_STEPS[payment.statut].title}</strong>
          <small>{ARTISAN_PAYMENT_NEXT_STEPS[payment.statut].description}</small>
        </span>
      ),
    },
    {
      key: 'ouvrir',
      header: '',
      render: (payment) => (
        <button
          type="button"
          className="paiements__open"
          aria-label={`Voir le dossier ${payment.reference_paiement}`}
          onClick={(event) => {
            event.stopPropagation();
            ouvrirDossier(payment);
          }}
        >
          <span>Voir</span><ArrowRight aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <NationalDashboardLayout>
      <div className="sn-page paiements-registry">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={Wallet}
          title="Dossiers de paiement"
          subtitle="Suivez chaque règlement depuis sa préparation jusqu’à la confirmation du versement."
          breadcrumb={[
            { label: isCollector ? 'Collecteur' : 'Marché d’or artisanal', to: isCollector ? '/portail-collecteur' : '/artisan-minier/ventes-or' },
            { label: 'Paiements' },
          ]}
          actions={
            <>
              {!isCollector && (
                <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/paiements')}>
                  <ArrowLeft aria-hidden="true" /> Ventes à régler
                </button>
              )}
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => void chargerHistorique()}>
                <RefreshCw aria-hidden="true" /> Actualiser
              </button>
            </>
          }
        />

        {isCollector && (
          <div className="paiements-registry__notice">
            <Note tone="info" icon={ShieldCheck}>
              Vous consultez uniquement les paiements des artisans qui vous sont rattachés. Les contrôles financiers sont réalisés par les agents habilités.
            </Note>
          </div>
        )}

        <div className="paiements-registry__stats">
          <StatGrid
            ariaLabel="Indicateurs des dossiers de paiement"
            items={[
              { label: 'Dossiers enregistrés', value: integer.format(stats.total), icon: Banknote, tone: 'blue' },
              { label: 'À contrôler', value: integer.format(stats.aControler), hint: 'Double contrôle indépendant', icon: ShieldCheck, tone: 'gold' },
              { label: 'Paiements en cours', value: integer.format(stats.enCours), icon: Clock3, tone: 'violet' },
              { label: 'Versements confirmés', value: formatFcfa(stats.montantRegle), hint: `${formatFcfa(stats.taxesRetenues)} de retenues`, icon: CheckCircle2, tone: 'green' },
            ]}
          />
        </div>

        <section className="sn-card paiements__panel paiements-registry__panel" aria-label="Registre des paiements">
          <div className="sn-card__head paiements-registry__head">
            <div>
              <h3>
                Registre des règlements <span className="sn-count">{integer.format(results.length)}</span>
              </h3>
              <p className="sn-card__hint">Cliquez sur une ligne pour consulter le dossier, ses montants et sa chronologie.</p>
            </div>
            <span className="paiements-registry__read-hint"><FileSearch aria-hidden="true" /> Détail disponible</span>
          </div>

          <div className="paiements__filters paiements-registry__filters">
            <SearchInput
              value={filters.search}
              onChange={(search) => setFilters((current) => ({ ...current, search }))}
              placeholder="Référence, vente, facture, artisan ou carte"
            />
            <label className="paiements__field">
              <span>Moyen de paiement</span>
              <SelectControl
                value={filters.type}
                onChange={(value) => setFilters((current) => ({ ...current, type: value as TypePaiement | 'tous' }))}
                ariaLabel="Filtrer par moyen de paiement"
              >
                <option value="tous">Tous les moyens</option>
                {(Object.keys(ARTISAN_PAYMENT_TYPE_LABELS) as TypePaiement[]).map((type) => (
                  <option key={type} value={type}>{ARTISAN_PAYMENT_TYPE_LABELS[type]}</option>
                ))}
              </SelectControl>
            </label>
            <label className="paiements__field paiements__dates">
              <span>Période de préparation</span>
              <div>
                <Calendar aria-hidden="true" />
                <input
                  type="date"
                  value={filters.from}
                  aria-label="Préparé à partir du"
                  onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                />
                <i aria-hidden="true">–</i>
                <input
                  type="date"
                  value={filters.to}
                  aria-label="Préparé jusqu’au"
                  onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                />
              </div>
            </label>
            <button
              type="button"
              className="sn-btn sn-btn--ghost"
              onClick={() => setFilters(EMPTY_HISTORIQUE_FILTERS)}
            >
              Réinitialiser
            </button>
          </div>

          <div className="paiements-registry__status-bar">
            <div className="sn-chips" role="group" aria-label="État du dossier de paiement">
              <button
                type="button"
                className={filters.statut === 'tous' ? 'is-active' : ''}
                onClick={() => setFilters((current) => ({ ...current, statut: 'tous' }))}
              >
                Tous <b>({integer.format(visiblePaiements.length)})</b>
              </button>
              {ARTISAN_PAYMENT_STATUS_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={filters.statut === key ? 'is-active' : ''}
                  onClick={() => setFilters((current) => ({ ...current, statut: key }))}
                >
                  {ARTISAN_PAYMENT_STATUS_SHORT_LABELS[key]} <b>({integer.format(countByStatut[key] || 0)})</b>
                </button>
              ))}
            </div>
          </div>

          {!loading && visiblePaiements.length === 0 ? (
            <EmptyState
              title="Aucun dossier de paiement"
              description="Un dossier apparaîtra ici dès qu’un règlement sera préparé à partir d’une facture."
            />
          ) : (
            <div className="paiements-registry__table">
              <DataTable
                columns={columns}
                rows={results.map((payment) => ({ ...payment, id: payment.id || payment.reference_paiement }))}
                loading={loading}
                empty="Aucun dossier ne correspond aux filtres sélectionnés."
                caption="Registre des paiements aux artisans"
                onRowClick={ouvrirDossier}
              />
            </div>
          )}
        </section>
      </div>
    </NationalDashboardLayout>
  );
}
