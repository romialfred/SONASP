import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Banknote,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  History,
  Hourglass,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import {
  Badge,
  DataTable,
  EmptyState,
  Note,
  PageHeader,
  SearchInput,
  StatGrid,
  type BadgeTone,
  type Column,
} from '@/components/ui/sn';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import artisanPaiementsService, {
  createArtisanPaymentIdempotencyKey,
  type VenteEnAttentePaiement,
} from '@/services/artisanPaiementsService';
import './paiements-ventes.css';

type StatutPaiement = 'non_paye' | 'facture_emise' | 'en_paiement' | 'paye';

const STATUT_LABELS: Record<StatutPaiement, string> = {
  non_paye: 'Non payé',
  facture_emise: 'Facture émise',
  en_paiement: 'En paiement',
  paye: 'Payé',
};

const STATUT_TONES: Record<StatutPaiement, BadgeTone> = {
  non_paye: 'danger',
  facture_emise: 'info',
  en_paiement: 'warning',
  paye: 'success',
};

const STATUT_ORDER: StatutPaiement[] = ['non_paye', 'facture_emise', 'en_paiement', 'paye'];

/** Seuil d'ancienneté au-delà duquel un dossier de paiement est signalé. */
export const SEUIL_ATTENTE_JOURS = 30;

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const formatFcfa = (value: number | null) => {
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

export function filterVentes(
  ventes: VenteEnAttentePaiement[],
  search: string,
  statut: StatutPaiement | 'tous'
): VenteEnAttentePaiement[] {
  const query = search.trim().toLocaleLowerCase('fr');
  return ventes.filter((vente) => {
    if (statut !== 'tous' && vente.statut_paiement !== statut) return false;
    if (!query) return true;
    return [vente.artisan_nom_complet, vente.numero_carte, vente.reference_vente, vente.numero_facture]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fr')
      .includes(query);
  });
}

export default function PaiementsVentesDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isComptoir = isComptoirScopedUser(user);
  const canIssueInvoice = hasSensitiveCapability(
    user,
    isComptoir ? CAPABILITIES.COMPTOIR_INVOICES_ISSUE : CAPABILITIES.SONASP_PREPARE,
  );
  const canExecutePayment = hasSensitiveCapability(
    user,
    isComptoir ? CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE : CAPABILITIES.FINANCE_EXECUTE,
  );
  const [ventes, setVentes] = useState<VenteEnAttentePaiement[]>([]);
  const [stats, setStats] = useState({
    total_ventes_en_attente: 0,
    montant_total_a_payer: 0,
    paiements_en_cours: 0,
    paiements_completes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState<StatutPaiement | 'tous'>('tous');
  const { alertState, showError, closeAlert } = useCustomAlert();

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      const [ventesData, statsData] = await Promise.all([
        artisanPaiementsService.getVentesEnAttentePaiement(),
        artisanPaiementsService.getDashboardStats(),
      ]);
      setVentes(ventesData || []);
      setStats(statsData);
    } catch {
      showError('Impossible de charger les paiements en attente');
      setVentes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void chargerDonnees();
  }, []);

  const results = useMemo(() => filterVentes(ventes, search, statut), [search, statut, ventes]);

  const countByStatut = useMemo(
    () =>
      STATUT_ORDER.reduce(
        (counters, key) => ({ ...counters, [key]: ventes.filter((v) => v.statut_paiement === key).length }),
        {} as Record<StatutPaiement, number>
      ),
    [ventes]
  );

  const enRetard = useMemo(
    () => ventes.filter((vente) => (vente.jours_attente || 0) > SEUIL_ATTENTE_JOURS).length,
    [ventes]
  );

  /**
   * Émet la facture définitive si elle manque, puis ouvre l'écran de paiement.
   * La navigation n'a lieu qu'après l'émission : l'ancienne version naviguait même
   * lorsque la création échouait, laissant l'utilisateur sur un dossier sans facture.
   */
  const handleProcederPaiement = async (vente: VenteEnAttentePaiement) => {
    if (vente.facture_id) {
      const opensPayment = !isComptoir || vente.certification_dgi_status === 'certified';
      if (opensPayment && !canExecutePayment) {
        showError('Une session AAL2 avec la capacité d’exécution financière est requise.');
        return;
      }
      navigate(
        isComptoir && vente.certification_dgi_status !== 'certified'
          ? `/artisan-minier/ventes-or/${vente.vente_id}/facture`
          : `/artisan-minier/paiements/${vente.vente_id}/nouveau`,
      );
      return;
    }

    if (!canIssueInvoice || !Number.isSafeInteger(vente.vente_version)) {
      showError('Émission indisponible : capacité sensible ou version serveur absente.');
      return;
    }

    setProcessing(vente.vente_id);
    try {
      await artisanPaiementsService.emettreFacture({
        saleId: vente.vente_id,
        expectedSaleStatus: vente.vente_statut,
        expectedSaleVersion: vente.vente_version,
        idempotencyKey: createArtisanPaymentIdempotencyKey(),
      });

      navigate(
        isComptoir
          ? `/artisan-minier/ventes-or/${vente.vente_id}/facture`
          : `/artisan-minier/paiements/${vente.vente_id}/nouveau`,
      );
    } catch {
      showError("L'émission de la facture définitive a échoué. Le paiement n'a pas été ouvert.");
    } finally {
      setProcessing(null);
    }
  };

  const columns: Column<VenteEnAttentePaiement & { id?: string }>[] = [
    {
      key: 'artisan',
      header: 'Artisan',
      render: (vente) => (
        <span className="paiements__artisan">
          <strong>{vente.artisan_nom_complet || 'Artisan inconnu'}</strong>
          <small>{vente.numero_carte || '—'}</small>
        </span>
      ),
    },
    { key: 'reference_vente', header: 'Référence', render: (vente) => vente.reference_vente || '—' },
    { key: 'date_vente', header: 'Date de vente', render: (vente) => formatDate(vente.date_vente) },
    { key: 'numero_facture', header: 'Facture', render: (vente) => vente.numero_facture || 'À émettre' },
    {
      key: 'montant',
      header: 'Net à payer',
      numeric: true,
      render: (vente) => formatFcfa(vente.montant_net_a_payer),
    },
    {
      key: 'attente',
      header: 'Attente',
      numeric: true,
      render: (vente) => {
        const jours = vente.jours_attente || 0;
        return jours > SEUIL_ATTENTE_JOURS ? (
          <Badge tone="danger">{integer.format(jours)} j</Badge>
        ) : (
          <span>{integer.format(jours)} j</span>
        );
      },
    },
    {
      key: 'statut_paiement',
      header: 'Statut',
      render: (vente) => {
        const key = (vente.statut_paiement || 'non_paye') as StatutPaiement;
        return <Badge tone={STATUT_TONES[key] || 'neutral'}>{STATUT_LABELS[key] || vente.statut_paiement}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (vente) => (
        <span className="paiements__actions">
          <button
            type="button"
            className="sn-btn sn-btn--sm sn-btn--icon"
            aria-label={`Consulter la vente ${vente.reference_vente || ''}`}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/artisan-minier/ventes-or/${vente.vente_id}`);
            }}
          >
            <Eye aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sn-btn sn-btn--sm sn-btn--primary"
            disabled={
              processing === vente.vente_id
              || vente.statut_paiement === 'paye'
              || (!vente.facture_id && !canIssueInvoice)
              || (
                Boolean(vente.facture_id)
                && (!isComptoir || vente.certification_dgi_status === 'certified')
                && !canExecutePayment
              )
            }
            title={
              !vente.facture_id && !canIssueInvoice
                ? 'Capacité sensible d’émission de facture requise'
                : Boolean(vente.facture_id)
                  && (!isComptoir || vente.certification_dgi_status === 'certified')
                  && !canExecutePayment
                  ? 'Capacité sensible d’exécution du paiement requise'
                  : undefined
            }
            onClick={(event) => {
              event.stopPropagation();
              void handleProcederPaiement(vente);
            }}
          >
            {processing === vente.vente_id ? (
              <Loader2 className="sn-spin" aria-hidden="true" />
            ) : vente.facture_id ? (
              <CreditCard aria-hidden="true" />
            ) : (
              <FileText aria-hidden="true" />
            )}
            {vente.facture_id
              ? isComptoir && vente.certification_dgi_status !== 'certified' ? 'Voir la facture' : 'Payer'
              : isComptoir ? 'Émettre la facture' : 'Émettre et payer'}
          </button>
        </span>
      ),
    },
  ];

  return (
    <NationalDashboardLayout>
      <div className="sn-page">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={Banknote}
          title={isComptoir ? 'Factures DGI et paiements' : 'Paiements des ventes d’or'}
          subtitle={isComptoir
            ? 'Certification fiscale, règlement des orpailleurs et suivi des taxes.'
            : 'Dossiers en attente de facturation ou de règlement auprès des artisans miniers.'}
          breadcrumb={[
            { label: isComptoir ? 'Comptoir' : 'Artisans miniers', to: isComptoir ? '/portail-comptoir' : '/artisan-minier' },
            { label: isComptoir ? 'DGI et paiements' : 'Paiements des ventes' },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void chargerDonnees()}>
                <RefreshCw aria-hidden="true" /> Actualiser
              </button>
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate('/artisan-minier/paiements/historique')}
              >
                <History aria-hidden="true" /> Historique des paiements
              </button>
            </>
          }
        />

        <div style={{ marginTop: 16 }}>
          <StatGrid
            ariaLabel="Indicateurs des paiements"
            items={[
              { label: isComptoir ? 'Achats à traiter' : 'Ventes en attente', value: integer.format(stats.total_ventes_en_attente), icon: Hourglass, tone: 'gold' },
              { label: 'Montant à payer', value: formatFcfa(stats.montant_total_a_payer), icon: Banknote, tone: 'blue' },
              { label: 'Paiements en cours', value: integer.format(stats.paiements_en_cours), icon: Clock3, tone: 'violet' },
              { label: 'Paiements finalisés', value: integer.format(stats.paiements_completes), icon: BadgeCheck, tone: 'green' },
            ]}
          />
        </div>

        {enRetard > 0 && (
          <div style={{ marginTop: 12 }}>
            <Note tone="warning" icon={Clock3}>
              {integer.format(enRetard)} dossier(s) attendent depuis plus de {SEUIL_ATTENTE_JOURS} jours.
            </Note>
          </div>
        )}

        <section className="sn-card paiements__panel" aria-label="Dossiers de paiement">
          <div className="sn-card__head">
            <div>
              <h3>
                Dossiers à traiter <span className="sn-count">{integer.format(results.length)}</span>
              </h3>
              <p className="sn-card__hint">
                L’émission atomique calcule les taxes côté serveur avant toute ouverture du paiement.
              </p>
            </div>
          </div>

          <div className="paiements__filters">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher par artisan, carte, référence ou facture"
            />
            <div className="sn-chips" role="group" aria-label="Statut de paiement">
              <button type="button" className={statut === 'tous' ? 'is-active' : ''} onClick={() => setStatut('tous')}>
                Tous <b>({integer.format(ventes.length)})</b>
              </button>
              {STATUT_ORDER.map((key) => (
                <button key={key} type="button" className={statut === key ? 'is-active' : ''} onClick={() => setStatut(key)}>
                  {STATUT_LABELS[key]} <b>({integer.format(countByStatut[key] || 0)})</b>
                </button>
              ))}
            </div>
          </div>

          {!loading && ventes.length === 0 ? (
            <EmptyState
              title="Aucun dossier en attente"
              description="Toutes les ventes déclarées ont été facturées et réglées."
            />
          ) : (
            <div style={{ padding: '0 16px 16px' }}>
              <DataTable
                columns={columns}
                rows={results.map((vente) => ({ ...vente, id: vente.vente_id }))}
                loading={loading}
                empty="Aucun dossier ne correspond à cette recherche."
                caption="Dossiers de paiement des ventes d’or"
              />
            </div>
          )}
        </section>
      </div>
    </NationalDashboardLayout>
  );
}
