import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  PlayCircle,
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
  type BadgeTone,
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
import './paiements-ventes.css';

type Statut = PaiementArtisan['statut'];
type TypePaiement = PaiementArtisan['type_paiement'];

interface PaiementRow extends PaiementArtisan {
  artisan?: { nom?: string; prenoms?: string; raison_sociale?: string; numero_carte?: string } | null;
  facture?: FactureDefinitive | null;
}

const STATUT_LABELS: Record<Statut, string> = {
  en_attente: 'En attente',
  en_traitement: 'En traitement',
  valide: 'Validé',
  complete: 'Complété',
  annule: 'Annulé',
  echec: 'Échec',
};

const STATUT_TONES: Record<Statut, BadgeTone> = {
  en_attente: 'neutral',
  en_traitement: 'info',
  valide: 'warning',
  complete: 'success',
  annule: 'danger',
  echec: 'danger',
};

const TYPE_LABELS: Record<TypePaiement, string> = {
  virement_bancaire: 'Virement bancaire',
  cash: 'Espèces',
  orange_money: 'Orange Money',
  mobile_money: 'Mobile Money',
  moov_money: 'Moov Money',
  wave: 'Wave',
  cheque: 'Chèque',
};

const STATUT_ORDER: Statut[] = ['en_attente', 'en_traitement', 'valide', 'complete', 'annule', 'echec'];
/** Statuts considérés comme en cours de traitement (ni soldés, ni abandonnés). */
export const STATUTS_EN_COURS: Statut[] = ['en_attente', 'en_traitement', 'valide'];

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const formatFcfa = (value?: number) => {
  const amount = value || 0;
  return amount >= 1_000_000
    ? `${decimal.format(amount / 1_000_000)} M FCFA`
    : `${integer.format(Math.round(amount))} FCFA`;
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

const holderName = (paiement: PaiementRow) => {
  const artisan = paiement.artisan;
  if (!artisan) return 'Artisan inconnu';
  return artisan.raison_sociale || [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Artisan';
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

/** Filtrage combinable de l'historique ; les bornes de date sont inclusives. */
export function filterPaiements(paiements: PaiementRow[], filters: HistoriqueFilters): PaiementRow[] {
  const query = filters.search.trim().toLocaleLowerCase('fr');
  return paiements.filter((paiement) => {
    if (filters.statut !== 'tous' && paiement.statut !== filters.statut) return false;
    if (filters.type !== 'tous' && paiement.type_paiement !== filters.type) return false;

    const date = (paiement.date_paiement || '').slice(0, 10);
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;

    if (!query) return true;
    return [paiement.reference_paiement, holderName(paiement), paiement.artisan?.numero_carte]
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
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [preuves, setPreuves] = useState<Record<string, string>>({});
  const { alertState, showError, showSuccess, closeAlert } = useCustomAlert();

  const chargerHistorique = async () => {
    setLoading(true);
    try {
      const data = await artisanPaiementsService.getAllPaiements();
      setPaiements((data || []) as PaiementRow[]);
    } catch {
      showError("Impossible de charger l'historique des paiements");
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
      completes: visiblePaiements.filter((p) => p.statut === 'complete').length,
      enCours: visiblePaiements.filter((p) => STATUTS_EN_COURS.includes(p.statut)).length,
      montantRegle: visiblePaiements
        .filter((p) => p.statut === 'complete')
        .reduce((sum, p) => sum + (p.montant_paye || 0), 0),
      taxesRetenues: visiblePaiements
        .filter((p) => p.statut === 'complete')
        .reduce((sum, p) => sum + (p.montant_taxes_retenues || 0), 0),
    }),
    [visiblePaiements]
  );

  const countByStatut = useMemo(
    () =>
      STATUT_ORDER.reduce(
        (counters, key) => ({ ...counters, [key]: visiblePaiements.filter((p) => p.statut === key).length }),
        {} as Record<Statut, number>
      ),
    [visiblePaiements]
  );

  const changerStatut = async (paiement: PaiementRow, statut: Statut) => {
    if (!paiement.id) return;
    const preuve = preuves[paiement.id] || '';
    if (statut === 'complete' && preuve.trim().length < 5) {
      showError('Joignez le chemin ou l’URL de la preuve bancaire avant la clôture.');
      return;
    }
    setTransitioning(paiement.id);
    try {
      await artisanPaiementsService.updatePaiementStatut(paiement.id, statut, {
        preuvePaiementUrl: statut === 'complete' ? preuve : undefined,
      });
      showSuccess('La transition a été enregistrée et auditée.');
      await chargerHistorique();
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'La transition a été refusée.');
    } finally {
      setTransitioning(null);
    }
  };


  const columns: Column<PaiementRow & { id?: string }>[] = [
    {
      key: 'reference_paiement',
      header: 'Référence',
      render: (paiement) => <strong>{paiement.reference_paiement || '—'}</strong>,
    },
    { key: 'date_paiement', header: 'Date', render: (paiement) => formatDate(paiement.date_paiement) },
    {
      key: 'artisan',
      header: 'Artisan',
      render: (paiement) => (
        <span className="paiements__artisan">
          <strong>{holderName(paiement)}</strong>
          <small>{paiement.artisan?.numero_carte || '—'}</small>
        </span>
      ),
    },
    {
      key: 'type_paiement',
      header: 'Moyen',
      render: (paiement) => TYPE_LABELS[paiement.type_paiement] || paiement.type_paiement,
    },
    { key: 'montant_paye', header: 'Montant payé', numeric: true, render: (paiement) => formatFcfa(paiement.montant_paye) },
    {
      key: 'taxes',
      header: 'Taxes retenues',
      numeric: true,
      render: (paiement) => formatFcfa(paiement.montant_taxes_retenues),
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (paiement) => (
        <Badge tone={STATUT_TONES[paiement.statut] || 'neutral'}>
          {STATUT_LABELS[paiement.statut] || paiement.statut}
        </Badge>
      ),
    },
    {
      key: 'preuve',
      header: 'Justificatif',
      render: (paiement) =>
        paiement.recu_paiement_url || paiement.preuve_paiement_url ? (
          <a
            className="sn-btn sn-btn--sm"
            href={paiement.recu_paiement_url || paiement.preuve_paiement_url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <FileText aria-hidden="true" /> Ouvrir
          </a>
        ) : (
          <span className="paiements__muted">Aucun</span>
        ),
    },
    {
      key: 'workflow',
      header: 'Traitement',
      render: (paiement) => {
        if (isCollector) return <span className="paiements__muted">Lecture seule</span>;
        const busy = transitioning === paiement.id;
        if (paiement.statut === 'en_attente') {
          return (
            <button type="button" className="sn-btn sn-btn--sm" disabled={busy} onClick={() => void changerStatut(paiement, 'en_traitement')}>
              {busy ? <Loader2 className="sn-spin" aria-hidden="true" /> : <PlayCircle aria-hidden="true" />} Prendre en charge
            </button>
          );
        }
        if (paiement.statut === 'en_traitement') {
          if (paiement.traite_par === user?.id) {
            return <small className="paiements__muted">Validation par un autre agent</small>;
          }
          return (
            <button type="button" className="sn-btn sn-btn--sm" disabled={busy} onClick={() => void changerStatut(paiement, 'valide')}>
              {busy ? <Loader2 className="sn-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />} Valider
            </button>
          );
        }
        if (paiement.statut === 'valide') {
          const certified = paiement.facture?.certification_dgi_status === 'certified';
          return (
            <span className="paiements__workflow-action">
              <input
                value={paiement.id ? preuves[paiement.id] || '' : ''}
                onChange={(event) => paiement.id && setPreuves((current) => ({ ...current, [paiement.id!]: event.target.value }))}
                placeholder="URL ou chemin de la preuve"
                aria-label={`Preuve du paiement ${paiement.reference_paiement}`}
                disabled={!certified || busy}
              />
              <button
                type="button"
                className="sn-btn sn-btn--sm sn-btn--primary"
                disabled={!certified || busy}
                title={certified ? undefined : 'Certification DGI requise'}
                onClick={() => void changerStatut(paiement, 'complete')}
              >
                {busy ? <Loader2 className="sn-spin" aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />} Clôturer
              </button>
            </span>
          );
        }
        return <span className="paiements__muted">—</span>;
      },
    },
  ];

  return (
    <NationalDashboardLayout>
      <div className="sn-page">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={Wallet}
          title="Historique des paiements"
          subtitle="Traçabilité des règlements effectués auprès des artisans miniers."
          breadcrumb={[
            { label: isCollector ? 'Collecteur' : 'Artisans miniers', to: isCollector ? '/portail-collecteur' : '/artisan-minier' },
            ...(isCollector ? [] : [{ label: 'Paiements des ventes', to: '/artisan-minier/paiements' }]),
            { label: 'Historique' },
          ]}
          actions={
            <>
              {!isCollector && <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/paiements')}>
                <ArrowLeft aria-hidden="true" /> Dossiers en attente
              </button>}
              <button type="button" className="sn-btn" onClick={() => void chargerHistorique()}>
                <RefreshCw aria-hidden="true" /> Actualiser
              </button>
            </>
          }
        />

        {isCollector && (
          <div style={{ marginTop: 16 }}>
            <Note tone="info" icon={ShieldCheck}>
              Les règlements et justificatifs des orpailleurs assignés sont consultables. Les transitions de paiement restent réservées aux agents habilités.
            </Note>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <StatGrid
            ariaLabel="Indicateurs de l’historique"
            items={[
              { label: 'Paiements enregistrés', value: integer.format(stats.total), icon: Banknote, tone: 'blue' },
              { label: 'Règlements finalisés', value: integer.format(stats.completes), icon: BadgeCheck, tone: 'green' },
              { label: 'En cours de traitement', value: integer.format(stats.enCours), icon: Clock3, tone: 'gold' },
              { label: 'Montant réglé', value: formatFcfa(stats.montantRegle), hint: `${formatFcfa(stats.taxesRetenues)} de taxes retenues`, icon: CheckCircle2, tone: 'violet' },
            ]}
          />
        </div>

        <section className="sn-card paiements__panel" aria-label="Historique des règlements">
          <div className="sn-card__head">
            <div>
              <h3>
                Règlements <span className="sn-count">{integer.format(results.length)}</span>
              </h3>
              <p className="sn-card__hint">Filtres combinables : statut, moyen de paiement et période.</p>
            </div>
          </div>

          <div className="paiements__filters">
            <SearchInput
              value={filters.search}
              onChange={(search) => setFilters((current) => ({ ...current, search }))}
              placeholder="Rechercher par référence, artisan ou numéro de carte"
            />
            <label className="paiements__field">
              <span>Moyen de paiement</span>
              <SelectControl
                value={filters.type}
                onChange={(value) => setFilters((current) => ({ ...current, type: value as TypePaiement | 'tous' }))}
                ariaLabel="Filtrer par moyen de paiement"
              >
                <option value="tous">Tous les moyens</option>
                {(Object.keys(TYPE_LABELS) as TypePaiement[]).map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </SelectControl>
            </label>
            <label className="paiements__field paiements__dates">
              <span>Période</span>
              <div>
                <Calendar aria-hidden="true" />
                <input
                  type="date"
                  value={filters.from}
                  aria-label="Payé à partir du"
                  onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                />
                <i aria-hidden="true">–</i>
                <input
                  type="date"
                  value={filters.to}
                  aria-label="Payé jusqu’au"
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

          <div className="paiements__filters" style={{ paddingTop: 0 }}>
            <div className="sn-chips" role="group" aria-label="Statut du règlement">
              <button
                type="button"
                className={filters.statut === 'tous' ? 'is-active' : ''}
                onClick={() => setFilters((current) => ({ ...current, statut: 'tous' }))}
              >
                Tous <b>({integer.format(visiblePaiements.length)})</b>
              </button>
              {STATUT_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={filters.statut === key ? 'is-active' : ''}
                  onClick={() => setFilters((current) => ({ ...current, statut: key }))}
                >
                  {STATUT_LABELS[key]} <b>({integer.format(countByStatut[key] || 0)})</b>
                </button>
              ))}
            </div>
          </div>

          {!loading && visiblePaiements.length === 0 ? (
            <EmptyState
              title="Aucun paiement enregistré"
              description="L’historique se remplit dès le premier règlement effectué auprès d’un artisan."
            />
          ) : (
            <div style={{ padding: '0 16px 16px' }}>
              <DataTable
                columns={columns}
                rows={results.map((paiement) => ({ ...paiement, id: paiement.id || paiement.reference_paiement }))}
                loading={loading}
                empty="Aucun règlement ne correspond aux filtres sélectionnés."
                caption="Historique des paiements aux artisans"
              />
            </div>
          )}
        </section>
      </div>
    </NationalDashboardLayout>
  );
}
