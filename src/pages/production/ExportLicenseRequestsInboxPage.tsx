import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileCheck2,
  Loader2,
  RefreshCw,
  Scale,
  X,
  XCircle,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import {
  exportLicenseService,
  type MineExportLicenseRequest,
  type MineExportLicenseRequestStatus,
} from '@/services/exportLicenseService';
import './export-license-requests.css';

type RequestFilter = 'pending' | MineExportLicenseRequestStatus | 'all';
type Decision = 'approved' | 'rejected';

const STATUS_LABELS: Record<MineExportLicenseRequestStatus, string> = {
  submitted: 'Soumise',
  under_review: 'En instruction',
  approved: 'Accordée',
  rejected: 'Rejetée',
  cancelled: 'Annulée',
};

const STATUS_TONES: Record<MineExportLicenseRequestStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  submitted: 'warning',
  under_review: 'info',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

const PENDING_STATUSES = new Set<MineExportLicenseRequestStatus>(['submitted', 'under_review']);
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

function displayDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}

function isConcurrencyError(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null;
  return code === '40001' || code === '23514' || code === 'P0002';
}

export default function ExportLicenseRequestsInboxPage() {
  const { user } = useAuth();
  // Cette capability vient de snp_actor_capabilities : son absence (y compris
  // en mode de compatibilité) interdit tout chargement ou appel de décision.
  const canApprove = hasSensitiveCapability(user, CAPABILITIES.SONASP_APPROVE);
  const [requests, setRequests] = useState<MineExportLicenseRequest[]>([]);
  const [filter, setFilter] = useState<RequestFilter>('pending');
  const [selected, setSelected] = useState<MineExportLicenseRequest | null>(null);
  const [loading, setLoading] = useState(canApprove);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [issuingInstitution, setIssuingInstitution] = useState('SONASP');
  const [authorizedQuantity, setAuthorizedQuantity] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [comments, setComments] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!canApprove) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await exportLicenseService.getSonaspLicenseRequests();
      setRequests(rows);
      setSelected((current) => current
        ? rows.find((request) => request.id === current.id) || null
        : null);
    } catch (error) {
      setRequests([]);
      setLoadError(errorMessage(
        error,
        'La boîte sécurisée des demandes de licence est momentanément indisponible.',
      ));
    } finally {
      setLoading(false);
    }
  }, [canApprove]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!decision) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setDecision(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [decision, saving]);

  const visibleRequests = useMemo(() => requests.filter((request) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return PENDING_STATUSES.has(request.status);
    return request.status === filter;
  }), [filter, requests]);

  const pendingCount = requests.filter((request) => PENDING_STATUSES.has(request.status)).length;
  const approvedCount = requests.filter((request) => request.status === 'approved').length;
  const rejectedCount = requests.filter((request) => request.status === 'rejected').length;

  const openDecision = (request: MineExportLicenseRequest, nextDecision: Decision) => {
    setSelected(request);
    setDecision(nextDecision);
    setLicenseNumber('');
    setStartDate('');
    setEndDate('');
    setIssuingInstitution('SONASP');
    setAuthorizedQuantity(nextDecision === 'approved' ? String(request.requested_quantity_grams) : '');
    setDecisionReason('');
    setComments('');
    setActionError(null);
    setSuccess(null);
  };

  const closeDecision = () => {
    if (!saving) setDecision(null);
  };

  const submitDecision = async (event: FormEvent) => {
    event.preventDefault();
    if (!decision || !selected || !canApprove) return;
    if (!PENDING_STATUSES.has(selected.status)) {
      setActionError('Ce dossier a déjà changé d’état et ne peut plus être décidé depuis ce formulaire.');
      return;
    }

    const reason = decisionReason.trim();
    const quantity = Number(authorizedQuantity);
    if (reason.length < 10) {
      setActionError('Le motif de décision doit contenir au moins 10 caractères.');
      return;
    }
    if (decision === 'approved' && quantity > selected.requested_quantity_grams) {
      setActionError('La quantité autorisée ne peut pas dépasser la quantité demandée.');
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const updated = await exportLicenseService.decideMineLicenseRequest({
        requestId: selected.id,
        decision,
        licenseNumber: decision === 'approved' ? licenseNumber : undefined,
        startDate: decision === 'approved' ? startDate : undefined,
        endDate: decision === 'approved' ? endDate : undefined,
        issuingInstitution: decision === 'approved' ? issuingInstitution : undefined,
        authorizedQuantityGrams: decision === 'approved' ? quantity : undefined,
        decisionReason: reason,
        comments,
      });
      const company = selected.mining_company;
      const merged = { ...selected, ...updated, mining_company: company };
      setRequests((current) => current.map((item) => item.id === merged.id ? merged : item));
      setSelected(merged);
      setDecision(null);
      setSuccess(
        decision === 'approved'
          ? 'La demande a été accordée et la licence créée de façon atomique.'
          : 'La demande a été rejetée.',
      );
    } catch (error) {
      setActionError(errorMessage(error, 'La décision n’a pas pu être enregistrée.'));
      if (isConcurrencyError(error)) await load();
    } finally {
      setSaving(false);
    }
  };

  if (!canApprove) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page license-requests">
          <PageHeader
            icon={ClipboardCheck}
            title="Demandes de licences d’export"
            subtitle="Instruction nationale des demandes transmises par les sociétés minières."
            breadcrumb={[{ label: 'Production' }, { label: 'Demandes de licences' }]}
          />
          <Note tone="danger" icon={AlertTriangle}>
            Une session AAL2 et la capability explicite sonasp.approve sont requises. Aucun dossier n’a été chargé.
          </Note>
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page license-requests" aria-busy={loading}>
        <PageHeader
          icon={ClipboardCheck}
          title="Demandes de licences d’export"
          subtitle="Examinez chaque dossier avant d’accorder ou de refuser l’autorisation."
          breadcrumb={[{ label: 'Production' }, { label: 'Demandes de licences' }]}
          actions={(
            <button type="button" className="sn-btn" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'sn-spin' : undefined} aria-hidden="true" /> Actualiser
            </button>
          )}
        />

        {loadError && <Note tone="danger" icon={AlertTriangle}>{loadError}</Note>}
        {success && <p className="license-requests__success" role="status"><CheckCircle2 aria-hidden="true" />{success}</p>}

        <StatGrid
          sober
          ariaLabel="Synthèse des demandes de licences"
          items={[
            { label: 'À instruire', value: pendingCount, icon: ClipboardCheck, tone: 'gold' },
            { label: 'Accordées', value: approvedCount, icon: FileCheck2, tone: 'green' },
            { label: 'Rejetées', value: rejectedCount, icon: XCircle, tone: 'red' },
            {
              label: 'Volume demandé',
              value: `${number.format(requests.reduce((sum, item) => sum + item.requested_quantity_grams, 0))} g`,
              icon: Scale,
              tone: 'neutral',
            },
          ]}
        />

        <Section
          id="license-requests-inbox"
          icon={ClipboardCheck}
          title={`Boîte de réception (${visibleRequests.length})`}
          description="La RLS borne la lecture au périmètre SONASP ; toute décision passe par la RPC sécurisée."
        >
          <div className="license-requests__toolbar">
            <label>
              <span>État</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value as RequestFilter)}>
                <option value="pending">À instruire</option>
                <option value="all">Toutes</option>
                <option value="submitted">Soumises</option>
                <option value="under_review">En instruction</option>
                <option value="approved">Accordées</option>
                <option value="rejected">Rejetées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p className="license-requests__loading" role="status">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des demandes…
            </p>
          ) : visibleRequests.length === 0 ? (
            <EmptyState
              title="Aucune demande dans cette vue"
              description="Les nouvelles demandes des sociétés minières apparaîtront ici."
            />
          ) : (
            <div className="license-requests__table-wrap">
              <table className="license-requests__table">
                <caption className="sr-only">Demandes de licences d’export transmises à la SONASP</caption>
                <thead><tr><th>Société / destination</th><th>Date souhaitée</th><th className="is-number">Quantité</th><th>État</th><th>Actions</th></tr></thead>
                <tbody>
                  {visibleRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{request.mining_company?.name || `Société ${request.mining_company_id.slice(0, 8)}`}</strong>
                        <small>{request.destination}</small>
                      </td>
                      <td>{displayDate(request.desired_export_date)}</td>
                      <td className="is-number">{number.format(request.requested_quantity_grams)} g</td>
                      <td><Badge tone={STATUS_TONES[request.status]}>{STATUS_LABELS[request.status]}</Badge></td>
                      <td>
                        <div className="license-requests__actions">
                          <button type="button" className="sn-btn sn-btn--sm" onClick={() => setSelected(request)}>
                            <Eye aria-hidden="true" /> Voir le dossier
                          </button>
                          {PENDING_STATUSES.has(request.status) && (
                            <>
                              <button type="button" className="sn-btn sn-btn--primary sn-btn--sm" onClick={() => openDecision(request, 'approved')}>
                                <CheckCircle2 aria-hidden="true" /> Accorder
                              </button>
                              <button type="button" className="sn-btn sn-btn--danger sn-btn--sm" onClick={() => openDecision(request, 'rejected')}>
                                <XCircle aria-hidden="true" /> Rejeter
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {selected && !decision && (
          <Section
            id="license-request-file"
            icon={Eye}
            title={`Dossier ${selected.id.slice(0, 8)}`}
            description={`${selected.mining_company?.name || 'Société minière'} · soumis le ${displayDate(selected.submitted_at, true)}`}
            tone="blue"
          >
            <dl className="license-requests__dossier">
              <div><dt>Destination</dt><dd>{selected.destination}</dd></div>
              <div><dt>Date d’export souhaitée</dt><dd>{displayDate(selected.desired_export_date)}</dd></div>
              <div><dt>Quantité demandée</dt><dd>{number.format(selected.requested_quantity_grams)} g</dd></div>
              <div><dt>État</dt><dd><Badge tone={STATUS_TONES[selected.status]}>{STATUS_LABELS[selected.status]}</Badge></dd></div>
              <div className="is-wide"><dt>Motif de la demande</dt><dd>{selected.reason}</dd></div>
              <div className="is-wide"><dt>Commentaire de la société</dt><dd>{selected.comment || 'Aucun commentaire.'}</dd></div>
              {selected.decision_reason && <div className="is-wide"><dt>Motif de décision</dt><dd>{selected.decision_reason}</dd></div>}
              {selected.reviewed_at && <div><dt>Décidée le</dt><dd>{displayDate(selected.reviewed_at, true)}</dd></div>}
              {selected.license_id && <div><dt>Licence créée</dt><dd>{selected.license_id}</dd></div>}
            </dl>
            {PENDING_STATUSES.has(selected.status) && (
              <footer className="license-requests__dossier-actions">
                <button type="button" className="sn-btn sn-btn--danger" onClick={() => openDecision(selected, 'rejected')}>
                  <XCircle aria-hidden="true" /> Rejeter
                </button>
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => openDecision(selected, 'approved')}>
                  <CheckCircle2 aria-hidden="true" /> Accorder la licence
                </button>
              </footer>
            )}
          </Section>
        )}

        {decision && selected && (
          <div className="license-request-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeDecision()}>
            <section className="license-request-dialog" role="dialog" aria-modal="true" aria-labelledby="license-request-decision-title">
              <header>
                <div>
                  <span>{selected.mining_company?.name || 'Société minière'}</span>
                  <h2 id="license-request-decision-title">
                    {decision === 'approved' ? 'Accorder la licence' : 'Rejeter la demande'}
                  </h2>
                </div>
                <button type="button" onClick={closeDecision} aria-label="Fermer" disabled={saving}><X aria-hidden="true" /></button>
              </header>
              <form onSubmit={submitDecision}>
                <p className="license-request-dialog__summary">
                  <Scale aria-hidden="true" /> Demande de <strong>{number.format(selected.requested_quantity_grams)} g</strong> vers {selected.destination}
                </p>

                {decision === 'approved' && (
                  <div className="license-request-dialog__grid">
                    <label><span>Numéro de licence</span><input autoFocus required minLength={4} value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} /></label>
                    <label><span>Institution émettrice</span><input required minLength={3} value={issuingInstitution} onChange={(event) => setIssuingInstitution(event.target.value)} /></label>
                    <label><span>Date de début</span><input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                    <label><span>Date de fin</span><input type="date" required min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
                    <label className="is-wide"><span>Quantité autorisée (g)</span><input type="number" min="0.001" max={selected.requested_quantity_grams} step="0.001" required value={authorizedQuantity} onChange={(event) => setAuthorizedQuantity(event.target.value)} /></label>
                  </div>
                )}

                <label>
                  <span>Motif de décision <small>(10 caractères minimum)</small></span>
                  <textarea autoFocus={decision === 'rejected'} required minLength={10} maxLength={1000} rows={3} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} />
                </label>
                <label>
                  <span>Commentaire interne <small>(facultatif)</small></span>
                  <textarea maxLength={1000} rows={2} value={comments} onChange={(event) => setComments(event.target.value)} />
                </label>
                {actionError && <p className="license-request-dialog__error" role="alert">{actionError}</p>}
                <footer>
                  <button type="button" className="sn-btn" onClick={closeDecision} disabled={saving}>Annuler</button>
                  <button type="submit" className={`sn-btn ${decision === 'rejected' ? 'sn-btn--danger' : 'sn-btn--primary'}`} disabled={saving || !PENDING_STATUSES.has(selected.status)}>
                    {saving ? <><Loader2 className="sn-spin" aria-hidden="true" /> Enregistrement…</> : 'Confirmer la décision'}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
