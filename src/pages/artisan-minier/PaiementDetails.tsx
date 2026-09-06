import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  History,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Note } from '@/components/ui/sn';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { useAuth } from '@/contexts/AuthContext';
import { isCollectorScopedUser } from '@/lib/collectorAccess';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import artisanPaiementsService, {
  createArtisanPaymentIdempotencyKey,
  type ArtisanPaymentDossier,
  type ArtisanPaymentStatus,
  type TaxeRetenue,
} from '@/services/artisanPaiementsService';
import {
  ARTISAN_PAYMENT_NEXT_STEPS,
  ARTISAN_PAYMENT_STATUS_LABELS,
  ARTISAN_PAYMENT_STATUS_TONES,
  ARTISAN_PAYMENT_TYPE_LABELS,
  ARTISAN_PAYMENT_WORKFLOW,
  artisanPaymentHolderName,
  artisanPaymentSaleReference,
  artisanPaymentWorkflowIndex,
} from './artisan-payment-presentation';
import './paiement-details.css';

type PaymentTab = 'overview' | 'payment' | 'sale' | 'taxes' | 'history';

const TABS: Array<{ id: PaymentTab; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Aperçu', icon: WalletCards },
  { id: 'payment', label: 'Données du paiement', icon: CreditCard },
  { id: 'sale', label: 'Vente et facture', icon: ReceiptText },
  { id: 'taxes', label: 'Retenues et taxes', icon: Scale },
  { id: 'history', label: 'Historique', icon: History },
];

const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

function formatFcfa(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${integer.format(Math.round(value))} FCFA`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date);
}

function formatWeight(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${decimal.format(value)} g`;
}

function humanize(value?: string | null): string {
  if (!value) return '—';
  return value
    .split('_')
    .join(' ')
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('fr-FR'));
}

function DetailCard({ title, icon: Icon, children, action }: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="payment-detail-card">
      <header className="payment-detail-card__head">
        <h2><span><Icon aria-hidden="true" /></span>{title}</h2>
        {action}
      </header>
      <div className="payment-detail-card__body">{children}</div>
    </section>
  );
}

function DefinitionGrid({ children }: { children: ReactNode }) {
  return <dl className="payment-detail-definitions">{children}</dl>;
}

function Definition({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function documentUrl(dossier: ArtisanPaymentDossier): string | null {
  return dossier.preuve_paiement_url || dossier.recu_paiement_url || null;
}

function paymentCoordinate(dossier: ArtisanPaymentDossier): string {
  const snapshot = dossier.details_paiement && typeof dossier.details_paiement === 'object'
    ? dossier.details_paiement as Record<string, unknown>
    : {};
  const last4 = snapshot.account_last4 || snapshot.mobile_last4;
  if (typeof last4 === 'string' && last4) return `•••• ${last4}`;
  const method = dossier.moyen_paiement;
  const raw = method?.numero_compte || method?.numero_telephone;
  if (!raw) return 'Coordonnée protégée';
  const normalized = raw.replace(/\s/g, '');
  return `•••• ${normalized.slice(-4)}`;
}

function taxRows(dossier: ArtisanPaymentDossier): Array<{
  key: string;
  label: string;
  rate: number;
  amount: number;
  status?: TaxeRetenue['statut_reversement'];
  reference?: string;
}> {
  if (dossier.taxes.length > 0) {
    return dossier.taxes.map((tax) => ({
      key: tax.id || `${tax.type_taxe}-${tax.libelle_taxe}`,
      label: tax.libelle_taxe,
      rate: tax.taux_taxe,
      amount: tax.montant_taxe,
      status: tax.statut_reversement,
      reference: tax.reversement_reference ?? undefined,
    }));
  }
  const invoice = dossier.facture;
  if (!invoice) return [];
  return [
    { key: 'vat', label: 'Taxe sur la valeur ajoutée', rate: invoice.taux_tva || 0, amount: invoice.montant_taxe_tva || 0 },
    { key: 'withholding', label: 'Retenue à la source', rate: invoice.taux_retenue_source || 0, amount: invoice.montant_taxe_retenue_source || 0 },
    {
      key: 'other',
      label: 'Taxe de développement communal',
      rate: invoice.montant_brut > 0 ? (invoice.montant_autres_taxes || 0) * 100 / invoice.montant_brut : 0,
      amount: invoice.montant_autres_taxes || 0,
    },
  ].filter((tax) => tax.amount > 0);
}

function workflowEventLabel(action: string, after?: string | null): string {
  if (action === 'created') return 'Dossier de paiement créé';
  if (action === 'status-changed' && after) return `Passage à « ${ARTISAN_PAYMENT_STATUS_LABELS[after as ArtisanPaymentStatus] || humanize(after)} »`;
  return humanize(action);
}

export default function PaiementDetails() {
  const navigate = useNavigate();
  const { paiementId } = useParams();
  const { user } = useAuth();
  const isCollector = isCollectorScopedUser(user);
  const canExecute = isCollector
    ? hasSensitiveCapability(user, CAPABILITIES.COLLECTOR_PAYMENTS_EXECUTE)
    : hasSensitiveCapability(user, CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE) || hasSensitiveCapability(user, CAPABILITIES.FINANCE_EXECUTE);
  const canReconcile = hasSensitiveCapability(user, CAPABILITIES.COMPTOIR_PAYMENTS_RECONCILE)
    || hasSensitiveCapability(user, CAPABILITIES.FINANCE_RECONCILE);
  const [dossier, setDossier] = useState<ArtisanPaymentDossier | null>(null);
  const [activeTab, setActiveTab] = useState<PaymentTab>('overview');
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { alertState, showError, showSuccess, closeAlert } = useCustomAlert();
  const confirmation = useConfirmationDialog();

  const loadDossier = useCallback(async () => {
    if (!paiementId) {
      setError('Référence de paiement absente.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payment = await artisanPaiementsService.getPaiementDossier(paiementId);
      setDossier(payment);
      if (!payment) setError('Ce dossier n’existe pas ou ne vous est pas accessible.');
    } catch {
      setDossier(null);
      setError('Les données du paiement ne peuvent pas être chargées pour le moment.');
    } finally {
      setLoading(false);
    }
  }, [paiementId]);

  useEffect(() => {
    void loadDossier();
  }, [loadDossier]);

  const taxes = useMemo(() => dossier ? taxRows(dossier) : [], [dossier]);

  const submitNextStep = async () => {
    if (!dossier?.id || transitioning) return;
    const step = ARTISAN_PAYMENT_NEXT_STEPS[dossier.statut];
    if (!step.targetStatus || !step.actionLabel) return;

    const confirmed = await confirmation.open({
      title: `${step.actionLabel} ?`,
      message: step.description,
      confirmText: step.actionLabel,
      cancelText: 'Annuler',
      severity: 'warning',
      details: {
        Dossier: dossier.reference_paiement,
        Bénéficiaire: artisanPaymentHolderName(dossier),
        'Net à verser': formatFcfa(dossier.montant_paye),
      },
    });
    if (!confirmed) return;

    setTransitioning(true);
    try {
      await artisanPaiementsService.transitionPaiement({
        paymentId: dossier.id,
        expectedStatus: dossier.statut,
        expectedVersion: dossier.version as number,
        newStatus: step.targetStatus,
        idempotencyKey: createArtisanPaymentIdempotencyKey(),
        notes: typeof confirmed === 'string' ? confirmed : undefined,
      });
      showSuccess(step.targetStatus === 'en_traitement'
        ? 'Le dossier a été transmis au contrôle indépendant.'
        : 'Le contrôle du paiement a été validé.');
      await loadDossier();
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : 'La transition du paiement a été refusée.');
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return (
      <NationalDashboardLayout>
        <main className="sn-page payment-detail-state">
          <Loader2 className="sn-spin" aria-hidden="true" />
          <h1>Chargement du dossier de paiement…</h1>
          <p>Récupération du règlement, de la facture et de sa chronologie.</p>
        </main>
      </NationalDashboardLayout>
    );
  }

  if (!dossier) {
    return (
      <NationalDashboardLayout>
        <main className="sn-page payment-detail-state">
          <AlertTriangle aria-hidden="true" />
          <h1>Dossier de paiement indisponible</h1>
          <p>{error || 'Ce dossier n’existe pas ou ne vous est pas accessible.'}</p>
          <div>
            <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/paiements/historique')}>
              <ArrowLeft aria-hidden="true" /> Retour au registre
            </button>
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void loadDossier()}>
              <RefreshCw aria-hidden="true" /> Réessayer
            </button>
          </div>
        </main>
      </NationalDashboardLayout>
    );
  }

  const statusStep = ARTISAN_PAYMENT_NEXT_STEPS[dossier.statut];
  const currentIndex = artisanPaymentWorkflowIndex(dossier.statut);
  const isTerminalFailure = dossier.statut === 'annule' || dossier.statut === 'echec';
  const proof = documentUrl(dossier);
  const validVersion = Number.isSafeInteger(dossier.version);
  const submitterMustNotValidate = dossier.statut === 'en_traitement' && dossier.traite_par === user?.id;
  const canRunCurrentAction = dossier.statut === 'en_attente'
    ? canExecute
    : dossier.statut === 'en_traitement' && canReconcile && !submitterMustNotValidate;

  const renderOverview = () => (
    <>
      <DetailCard title="Informations générales" icon={FileCheck2}>
        <DefinitionGrid>
          <Definition label="Référence du paiement">{dossier.reference_paiement}</Definition>
          <Definition label="Date de préparation">{formatDateTime(dossier.date_paiement)}</Definition>
          <Definition label="Bénéficiaire">{artisanPaymentHolderName(dossier)}</Definition>
          <Definition label="Carte professionnelle">{dossier.artisan?.numero_carte || '—'}</Definition>
          <Definition label="Vente liée">
            <button type="button" className="payment-detail-inline-link" onClick={() => navigate(`/artisan-minier/ventes-or/${dossier.vente_or_id}`)}>
              {artisanPaymentSaleReference(dossier)} <ArrowRight aria-hidden="true" />
            </button>
          </Definition>
          <Definition label="Facture">{dossier.facture?.numero_facture || dossier.numero_facture || '—'}</Definition>
          <Definition label="Canal de règlement">{ARTISAN_PAYMENT_TYPE_LABELS[dossier.type_paiement]}</Definition>
          <Definition label="Coordonnée utilisée">{paymentCoordinate(dossier)}</Definition>
          <Definition label="Entité payeuse">{dossier.organisation?.short_name || dossier.organisation?.name || 'SONASP'}</Definition>
          <Definition label="Version du dossier">{dossier.version ?? '—'}</Definition>
        </DefinitionGrid>
      </DetailCard>

      <DetailCard title="Circuit de traitement" icon={ShieldCheck}>
        <div className={`payment-workflow${isTerminalFailure ? ' is-terminal' : ''}`}>
          {ARTISAN_PAYMENT_WORKFLOW.map((step, index) => {
            const state = isTerminalFailure
              ? (index === 0 ? 'current' : 'pending')
              : index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending';
            return (
              <div key={step.status} className={`payment-workflow__step is-${state}`}>
                <span className="payment-workflow__marker">
                  {state === 'done' ? <CheckCircle2 aria-hidden="true" /> : <span>{index + 1}</span>}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                  {index === 0 && <small>{formatDateTime(dossier.date_paiement)}</small>}
                  {index === 2 && dossier.date_validation && <small>{formatDateTime(dossier.date_validation)}</small>}
                  {index === 3 && dossier.date_completion && <small>{formatDateTime(dossier.date_completion)}</small>}
                </div>
              </div>
            );
          })}
        </div>
        {isTerminalFailure && (
          <Note tone="danger" icon={ShieldAlert}>
            {dossier.terminal_reason || 'Le motif de fin du dossier n’est pas renseigné.'}
          </Note>
        )}
      </DetailCard>
    </>
  );

  const renderPayment = () => (
    <div className="payment-detail-two-columns">
      <DetailCard title="Ordre de paiement" icon={CreditCard}>
        <DefinitionGrid>
          <Definition label="Canal">{ARTISAN_PAYMENT_TYPE_LABELS[dossier.type_paiement]}</Definition>
          <Definition label="Libellé">{dossier.moyen_paiement?.libelle || 'Moyen principal de l’artisan'}</Definition>
          <Definition label="Titulaire">{dossier.moyen_paiement?.titulaire || artisanPaymentHolderName(dossier)}</Definition>
          <Definition label="Coordonnée protégée">{paymentCoordinate(dossier)}</Definition>
          <Definition label="Banque / opérateur">{dossier.moyen_paiement?.banque || humanize(dossier.moyen_paiement?.type)}</Definition>
          <Definition label="Vérification du moyen">{dossier.moyen_paiement?.verifie_le ? `Vérifié le ${formatDate(dossier.moyen_paiement.verifie_le)}` : 'Non renseignée'}</Definition>
        </DefinitionGrid>
      </DetailCard>
      <DetailCard title="Justificatifs" icon={FileText}>
        {proof ? (
          <a className="payment-document" href={proof} target="_blank" rel="noreferrer">
            <span><FileCheck2 aria-hidden="true" /></span>
            <div><strong>Preuve de versement</strong><small>Document rattaché au dossier</small></div>
            <ArrowRight aria-hidden="true" />
          </a>
        ) : (
          <div className="payment-detail-empty">
            <FileText aria-hidden="true" />
            <strong>Preuve sécurisée non reçue</strong>
            <p>Le document sera rattaché par le canal bancaire ou mobile autorisé. Aucune URL libre n’est acceptée.</p>
          </div>
        )}
        {dossier.notes && <div className="payment-detail-note"><strong>Note du préparateur</strong><p>{dossier.notes}</p></div>}
      </DetailCard>
    </div>
  );

  const renderSale = () => (
    <div className="payment-detail-two-columns">
      <DetailCard
        title="Vente d’or liée"
        icon={Banknote}
        action={<button type="button" className="payment-detail-text-button" onClick={() => navigate(`/artisan-minier/ventes-or/${dossier.vente_or_id}`)}>Voir la vente <ArrowRight aria-hidden="true" /></button>}
      >
        <DefinitionGrid>
          <Definition label="Référence">{artisanPaymentSaleReference(dossier)}</Definition>
          <Definition label="Date de vente">{formatDate(dossier.vente?.date_vente)}</Definition>
          <Definition label="Type d’or">{humanize(dossier.vente?.type_or)}</Definition>
          <Definition label="Quantité">{formatWeight(dossier.vente?.quantite_grammes)}</Definition>
          <Definition label="Pureté">{dossier.vente?.purete_karat ? `${decimal.format(dossier.vente.purete_karat)} K` : '—'}</Definition>
          <Definition label="Montant brut">{formatFcfa(dossier.vente?.montant_brut_fcfa)}</Definition>
        </DefinitionGrid>
      </DetailCard>
      <DetailCard
        title="Facture associée"
        icon={ReceiptText}
        action={<button type="button" className="payment-detail-text-button" onClick={() => navigate(`/artisan-minier/ventes-or/${dossier.vente_or_id}/facture`)}>Voir la facture <ArrowRight aria-hidden="true" /></button>}
      >
        <DefinitionGrid>
          <Definition label="Numéro">{dossier.facture?.numero_facture || dossier.numero_facture || '—'}</Definition>
          <Definition label="Émise le">{formatDate(dossier.facture?.date_emission)}</Definition>
          <Definition label="Échéance">{formatDate(dossier.facture?.date_echeance)}</Definition>
          <Definition label="Montant brut">{formatFcfa(dossier.facture?.montant_brut)}</Definition>
          <Definition label="Total des taxes">{formatFcfa(dossier.facture?.montant_total_taxes)}</Definition>
          <Definition label="Certification DGI">{dossier.facture?.certification_dgi_status === 'certified' ? 'Certifiée' : 'En attente de certification'}</Definition>
        </DefinitionGrid>
      </DetailCard>
    </div>
  );

  const renderTaxes = () => (
    <DetailCard title={dossier.taxes.length > 0 ? 'Écritures fiscales du paiement' : 'Retenues calculées sur la facture'} icon={Scale}>
      {taxes.length === 0 ? (
        <div className="payment-detail-empty"><Scale aria-hidden="true" /><strong>Aucune retenue renseignée</strong><p>La facture ne porte aucune écriture fiscale exploitable.</p></div>
      ) : (
        <div className="payment-tax-table" role="table" aria-label="Retenues et taxes du paiement">
          <div role="row" className="payment-tax-table__head"><span>Nature</span><span>Taux</span><span>Montant</span><span>Reversement</span></div>
          {taxes.map((tax) => (
            <div role="row" key={tax.key}>
              <span><strong>{tax.label}</strong>{tax.reference && <small>Réf. {tax.reference}</small>}</span>
              <span>{decimal.format(tax.rate)} %</span>
              <span>{formatFcfa(tax.amount)}</span>
              <span>{tax.status ? humanize(tax.status) : 'À générer à la clôture'}</span>
            </div>
          ))}
          <footer><span>Total retenues et taxes</span><strong>{formatFcfa(dossier.facture?.montant_total_taxes ?? dossier.montant_taxes_retenues)}</strong></footer>
        </div>
      )}
    </DetailCard>
  );

  const renderHistory = () => (
    <DetailCard title="Journal du dossier" icon={History}>
      {dossier.historique.length === 0 ? (
        <div className="payment-detail-empty"><History aria-hidden="true" /><strong>Aucune transition enregistrée</strong><p>Le dossier a été créé le {formatDateTime(dossier.created_at || dossier.date_paiement)}.</p></div>
      ) : (
        <ol className="payment-audit-list">
          {dossier.historique.map((event) => (
            <li key={event.id}>
              <span><CircleDot aria-hidden="true" /></span>
              <div>
                <strong>{workflowEventLabel(event.action, event.status_after)}</strong>
                <p>{event.reason || ARTISAN_PAYMENT_NEXT_STEPS[(event.status_after || dossier.statut) as ArtisanPaymentStatus]?.description || 'Événement enregistré par le serveur.'}</p>
                <small>{formatDateTime(event.occurred_at)} · {event.actor_role ? humanize(event.actor_role) : 'Acteur authentifié'}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DetailCard>
  );

  return (
    <NationalDashboardLayout>
      <main className="sn-page payment-detail-page">
        <CustomAlert {...alertState} onClose={closeAlert} />
        <confirmation.ConfirmationDialog />

        <nav className="payment-detail-breadcrumb" aria-label="Fil d’Ariane">
          <button type="button" onClick={() => navigate('/artisan-minier/ventes-or')}>Marché d’or artisanal</button>
          <ArrowRight aria-hidden="true" />
          <button type="button" onClick={() => navigate('/artisan-minier/paiements/historique')}>Paiements</button>
          <ArrowRight aria-hidden="true" />
          <span>Détail du dossier</span>
        </nav>

        <div className="payment-detail-toolbar">
          <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/paiements/historique')}>
            <ArrowLeft aria-hidden="true" /> Retour au registre
          </button>
          <button type="button" className="sn-btn" onClick={() => void loadDossier()}>
            <RefreshCw aria-hidden="true" /> Actualiser
          </button>
        </div>

        <section className="payment-detail-hero">
          <div className="payment-detail-hero__identity">
            <Badge tone={ARTISAN_PAYMENT_STATUS_TONES[dossier.statut]}>{ARTISAN_PAYMENT_STATUS_LABELS[dossier.statut]}</Badge>
            <h1>{dossier.reference_paiement}</h1>
            <p>Dossier de règlement artisan</p>
          </div>
          <div className="payment-detail-hero__facts">
            <div><CalendarDays aria-hidden="true" /><span><small>Préparé le</small><strong>{formatDate(dossier.date_paiement)}</strong></span></div>
            <div><UserRound aria-hidden="true" /><span><small>Bénéficiaire</small><strong>{artisanPaymentHolderName(dossier)}</strong></span></div>
            <div><ReceiptText aria-hidden="true" /><span><small>Vente</small><strong>{artisanPaymentSaleReference(dossier)}</strong></span></div>
            <div><CreditCard aria-hidden="true" /><span><small>Canal</small><strong>{ARTISAN_PAYMENT_TYPE_LABELS[dossier.type_paiement]}</strong></span></div>
          </div>
          <div className="payment-detail-hero__amount"><small>Net à verser</small><strong>{formatFcfa(dossier.montant_paye)}</strong><span>{formatFcfa(dossier.montant_taxes_retenues)} de retenues</span></div>
        </section>

        <div className="payment-detail-tabs" role="tablist" aria-label="Sections du dossier de paiement">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}>
              <Icon aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <div className="payment-detail-layout">
          <div className="payment-detail-main">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'payment' && renderPayment()}
            {activeTab === 'sale' && renderSale()}
            {activeTab === 'taxes' && renderTaxes()}
            {activeTab === 'history' && renderHistory()}
          </div>

          <aside className="payment-detail-aside">
            <section className={`payment-next-action is-${dossier.statut}`}>
              <span className="payment-next-action__icon">
                {dossier.statut === 'complete' ? <CheckCircle2 aria-hidden="true" /> : isTerminalFailure ? <ShieldAlert aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
              </span>
              <small>ÉTAPE ACTUELLE</small>
              <h2>{statusStep.title}</h2>
              <p>{statusStep.description}</p>
              {statusStep.targetStatus && (!isCollector || canExecute) && canRunCurrentAction && (
                <button type="button" className="sn-btn sn-btn--primary" disabled={transitioning || !validVersion} onClick={() => void submitNextStep()}>
                  {transitioning ? <Loader2 className="sn-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                  {statusStep.actionLabel}
                </button>
              )}
              {dossier.statut === 'en_traitement' && submitterMustNotValidate && (
                <div className="payment-next-action__constraint"><ShieldAlert aria-hidden="true" /><span>Le préparateur ne peut pas valider son propre paiement. Un second agent doit intervenir.</span></div>
              )}
              {statusStep.targetStatus && (!isCollector || canExecute) && !canRunCurrentAction && !submitterMustNotValidate && (
                <div className="payment-next-action__constraint"><ShieldAlert aria-hidden="true" /><span>Cette décision requiert une habilitation financière renforcée.</span></div>
              )}
              {dossier.statut === 'valide' && (
                <div className={`payment-next-action__proof${proof ? ' is-ready' : ''}`}>
                  {proof ? <FileCheck2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
                  <span><strong>{proof ? 'Preuve reçue' : 'Preuve en attente'}</strong><small>Transmise par le canal sécurisé</small></span>
                </div>
              )}
            </section>

            <section className="payment-financial-summary">
              <h2><Banknote aria-hidden="true" /> Synthèse financière</h2>
              <dl>
                <div><dt>Montant brut</dt><dd>{formatFcfa(dossier.facture?.montant_brut)}</dd></div>
                <div><dt>Retenues et taxes</dt><dd>- {formatFcfa(dossier.facture?.montant_total_taxes ?? dossier.montant_taxes_retenues)}</dd></div>
                <div className="is-total"><dt>Net à verser</dt><dd>{formatFcfa(dossier.montant_paye)}</dd></div>
              </dl>
            </section>

            <section className="payment-beneficiary-card">
              <h2><UserRound aria-hidden="true" /> Bénéficiaire</h2>
              <strong>{artisanPaymentHolderName(dossier)}</strong>
              <span>{dossier.artisan?.numero_carte || 'Carte non renseignée'}</span>
              <dl>
                <div><dt>Téléphone</dt><dd>{dossier.artisan?.telephone || '—'}</dd></div>
                <div><dt>Localisation</dt><dd>{[dossier.artisan?.commune, dossier.artisan?.region].filter(Boolean).join(', ') || '—'}</dd></div>
              </dl>
              <button type="button" onClick={() => navigate(`/artisan-minier/${dossier.artisan_id}`)}>Voir la fiche artisan <ArrowRight aria-hidden="true" /></button>
            </section>

            <section className="payment-compliance-card">
              <h2><Landmark aria-hidden="true" /> Contrôles requis</h2>
              <ul>
                <li className={dossier.facture?.certification_dgi_status === 'certified' ? 'is-ok' : ''}><span>{dossier.facture?.certification_dgi_status === 'certified' ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</span> Facture certifiée DGI</li>
                <li className={dossier.moyen_paiement?.verifie_le ? 'is-ok' : ''}><span>{dossier.moyen_paiement?.verifie_le ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</span> Moyen de paiement vérifié</li>
                <li className={proof ? 'is-ok' : ''}><span>{proof ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</span> Preuve canonique reçue</li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </NationalDashboardLayout>
  );
}
