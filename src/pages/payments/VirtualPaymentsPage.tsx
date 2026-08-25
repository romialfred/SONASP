import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, FileWarning, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Loading } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import {
  createPaymentIdempotencyKey,
  getPaymentProofUrl,
  paymentProofIdempotencyKey,
} from '@/services/paymentService';
import {
  getProcessingInternationalPayments,
  getVirtualPayments,
  reconcileInternationalPayment,
  type ProcessingInternationalPayment,
  type VirtualPayment,
} from '@/services/virtualPaymentService';
import { formatCurrency } from '@/utils/salesUtils';

export function VirtualPaymentsPage() {
  const navigate = useNavigate();
  const alert = useAlert();
  const { user } = useAuth();
  const canExecute = hasSensitiveCapability(user, CAPABILITIES.FINANCE_EXECUTE);
  const canReconcile = hasSensitiveCapability(user, CAPABILITIES.FINANCE_RECONCILE);
  const rejectionKey = useRef<string | null>(null);
  const approvalKeys = useRef<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [virtualPayments, setVirtualPayments] = useState<VirtualPayment[]>([]);
  const [processingPayments, setProcessingPayments] = useState<ProcessingInternationalPayment[]>([]);
  const [selected, setSelected] = useState<ProcessingInternationalPayment | null>(null);
  const [approvalCandidate, setApprovalCandidate] = useState<ProcessingInternationalPayment | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [proofReviewed, setProofReviewed] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvingPaymentId, setApprovingPaymentId] = useState<string | null>(null);
  const [openingProofId, setOpeningProofId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [virtualResult, processingResult] = await Promise.all([
        getVirtualPayments(),
        getProcessingInternationalPayments(),
      ]);
      if (!virtualResult.success) throw new Error(virtualResult.error || 'Engagements indisponibles.');
      if (!processingResult.success) throw new Error(processingResult.error || 'Rapprochements indisponibles.');
      setVirtualPayments(virtualResult.data || []);
      setProcessingPayments(processingResult.data || []);
      // Les URL signees sont courtes et ne doivent pas survivre a un refresh.
      setProofUrls({});
    } catch (error) {
      setVirtualPayments([]);
      setProcessingPayments([]);
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger les paiements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const hasCanonicalProof = (payment: ProcessingInternationalPayment) =>
    paymentProofIdempotencyKey(payment.proof_url, payment.id) !== null;

  const canViewProof = (payment: ProcessingInternationalPayment) =>
    (canExecute || canReconcile) && hasCanonicalProof(payment);

  const canApprove = (payment: ProcessingInternationalPayment) =>
    canReconcile
    && hasCanonicalProof(payment)
    && Boolean(proofUrls[payment.id])
    && Boolean(user?.id)
    && payment.executed_by !== user?.id;

  const requestProofUrl = async (payment: ProcessingInternationalPayment) => {
    if (!canViewProof(payment) || !payment.proof_url) return;
    setOpeningProofId(payment.id);
    try {
      const url = await getPaymentProofUrl(payment.proof_url);
      setProofUrls((current) => ({ ...current, [payment.id]: url }));
    } catch (error) {
      setProofUrls((current) => {
        const next = { ...current };
        delete next[payment.id];
        return next;
      });
      alert.error(error instanceof Error
        ? error.message
        : 'La preuve bancaire privee ne peut pas etre ouverte.');
    } finally {
      setOpeningProofId(null);
    }
  };

  const openApproval = (payment: ProcessingInternationalPayment) => {
    if (!canApprove(payment)) return;
    setApprovalCandidate(payment);
    setApprovalReason('');
    setProofReviewed(false);
  };

  const submitApproval = async () => {
    const payment = approvalCandidate;
    if (!payment || !canApprove(payment) || !proofReviewed || approvalReason.trim().length < 10) {
      alert.error('Confirmez la consultation de la preuve et saisissez un commentaire de contrôle.');
      return;
    }
    setApprovingPaymentId(payment.id);
    try {
      approvalKeys.current[payment.id] ||= createPaymentIdempotencyKey();
      const result = await reconcileInternationalPayment({
        paymentId: payment.id,
        expectedVersion: payment.version,
        decision: 'approve',
        reason: approvalReason.trim(),
        idempotencyKey: approvalKeys.current[payment.id],
      });
      if (!result.success) throw new Error(result.error || 'Approbation refusee.');
      alert.success(result.data?.replayed
        ? 'Cette approbation avait deja ete enregistree.'
        : 'Paiement rapproche et vente marquee comme payee.');
      delete approvalKeys.current[payment.id];
      setApprovalCandidate(null);
      await loadData();
    } catch (error) {
      // La meme cle est conservee apres une reponse reseau ambigue.
      alert.error(error instanceof Error ? error.message : 'L’approbation a ete refusee.');
    } finally {
      setApprovingPaymentId(null);
    }
  };

  const openReject = (payment: ProcessingInternationalPayment) => {
    if (!canReconcile) return;
    rejectionKey.current = null;
    setReason('');
    setSelected(payment);
  };

  const submitRejection = async () => {
    if (!selected || !canReconcile) return;
    if (reason.trim().length < 10) {
      alert.error('Le motif de rejet doit contenir au moins 10 caractères.');
      return;
    }

    setSubmitting(true);
    try {
      rejectionKey.current ||= createPaymentIdempotencyKey();
      const result = await reconcileInternationalPayment({
        paymentId: selected.id,
        expectedVersion: selected.version,
        decision: 'reject',
        reason,
        idempotencyKey: rejectionKey.current,
      });
      if (!result.success) throw new Error(result.error || 'Rejet refusé.');

      alert.success(result.data?.replayed
        ? 'Cette décision avait déjà été enregistrée.'
        : 'Paiement rejeté ; la vente est revenue en attente de paiement.');
      setSelected(null);
      await loadData();
    } catch (error) {
      alert.error(error instanceof Error ? error.message : 'Le rejet a été refusé.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <MainLayout><div className="flex h-64 items-center justify-center"><Loading /></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">Paiements internationaux</h1>
            <p className="mt-1 text-gray-600">Exécution et rapprochement séparés, sous contrôle serveur.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
            </Button>
            <Button variant="outline" onClick={() => navigate('/payments')}>Tous les paiements</Button>
          </div>
        </div>

        {loadError && <Alert variant="error" title="Chargement impossible">{loadError}</Alert>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><p className="text-sm text-gray-600">Engagements à exécuter</p><p className="text-3xl font-bold">{virtualPayments.length}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-gray-600">Rapprochements en attente</p><p className="text-3xl font-bold">{processingPayments.length}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-gray-600">Double contrôle</p><p className="mt-1 flex items-center gap-2 font-semibold text-green-700"><ShieldCheck className="h-5 w-5" /> Actif</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Engagements virtuels</CardTitle></CardHeader>
          <CardContent>
            {virtualPayments.length === 0 ? (
              <p className="py-8 text-center text-gray-500">Aucun engagement en attente d’exécution.</p>
            ) : (
              <div className="space-y-3">
                {virtualPayments.map((payment) => (
                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                    <div>
                      <p className="font-semibold">{payment.sale_number} — {payment.customer_name}</p>
                      <p className="text-sm text-gray-600">{formatCurrency(payment.amount, payment.currency)} · échéance {new Date(payment.virtual_due_date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    {canExecute ? (
                      <Button onClick={() => navigate('/payments/create')}>
                        Exécuter via le formulaire sécurisé
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-500">Lecture seule</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /> Rapprochement financier</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="info" title="Preuve privée et double contrôle">
              L’accès à la pièce est signé à la demande. L’approbation exige une preuve canonique, une session AAL2 et un rapprochateur différent de l’exécuteur ; le serveur revérifie chaque condition.
            </Alert>
            {processingPayments.length === 0 ? (
              <p className="py-8 text-center text-gray-500">Aucun paiement en attente de rapprochement.</p>
            ) : (
              <div className="space-y-3">
                {processingPayments.map((payment) => (
                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                    <div>
                      <p className="font-semibold">{payment.sale?.sale_number || payment.sale_id}</p>
                      <p className="text-sm text-gray-600">{formatCurrency(payment.amount, payment.currency)} · version {payment.version} · {payment.reference_number || '—'}</p>
                      {!hasCanonicalProof(payment) && (
                        <p className="mt-1 text-sm text-amber-700">Preuve privée absente ou référence non canonique.</p>
                      )}
                      {proofUrls[payment.id] && (
                        <a
                          href={proofUrls[payment.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm font-medium text-blue-700 underline"
                        >
                          Ouvrir la preuve signée
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={!canViewProof(payment) || openingProofId === payment.id}
                        onClick={() => void requestProofUrl(payment)}
                      >
                        <FileWarning className="h-4 w-4 mr-1" />
                        {openingProofId === payment.id ? 'Signature…' : 'Consulter la preuve'}
                      </Button>
                      <Button
                        disabled={!canApprove(payment) || approvingPaymentId === payment.id}
                        title={payment.executed_by === user?.id ? 'Double contrôle : l’exécuteur ne peut pas rapprocher.' : undefined}
                        onClick={() => openApproval(payment)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" /> Approuver
                      </Button>
                      <Button variant="outline" disabled={!canReconcile || payment.executed_by === user?.id} onClick={() => openReject(payment)} className="border-red-600 text-red-700">
                        <XCircle className="h-4 w-4 mr-1" /> Rejeter
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!canExecute && !canReconcile && (
          <Alert variant="info" title="Consultation uniquement">
            Les actions financières exigent une liste de capacités serveur explicite et une session AAL2.
          </Alert>
        )}

        {selected && (
          <Modal isOpen onClose={() => !submitting && setSelected(null)} title="Rejeter le paiement">
            <div className="space-y-4">
              <Alert variant="warning" title="Conséquence métier">
                Le paiement passera à « rejected » et la vente reviendra atomiquement à « waiting_for_payment ».
              </Alert>
              <FormField label="Motif du rejet" required htmlFor="payment-rejection-reason">
                <textarea
                  id="payment-rejection-reason"
                  value={reason}
                  onChange={(event) => { rejectionKey.current = null; setReason(event.target.value); }}
                  rows={4}
                  minLength={10}
                  maxLength={4000}
                  disabled={submitting}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={submitting} onClick={() => setSelected(null)}>Annuler</Button>
                <Button disabled={submitting || reason.trim().length < 10} onClick={() => void submitRejection()} className="bg-red-600 hover:bg-red-700">
                  {submitting ? 'Rejet en cours…' : 'Confirmer le rejet'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {approvalCandidate && (
          <Modal
            isOpen
            onClose={() => !approvingPaymentId && setApprovalCandidate(null)}
            title="Contrôler et approuver le paiement"
          >
            <div className="space-y-4">
              <Alert variant="warning" title="Attestation de rapprochement">
                Ouvrez d’abord la preuve signée, confrontez-la aux données bancaires puis documentez votre contrôle. Le serveur impose aussi la séparation exécuteur/rapprocheur.
              </Alert>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={proofReviewed}
                  onChange={(event) => setProofReviewed(event.target.checked)}
                  disabled={Boolean(approvingPaymentId)}
                />
                <span>J’atteste avoir consulté la preuve bancaire signée et vérifié sa cohérence.</span>
              </label>
              <FormField label="Commentaire de contrôle" required htmlFor="payment-approval-reason">
                <textarea
                  id="payment-approval-reason"
                  value={approvalReason}
                  onChange={(event) => setApprovalReason(event.target.value)}
                  rows={4}
                  minLength={10}
                  maxLength={4000}
                  disabled={Boolean(approvingPaymentId)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={Boolean(approvingPaymentId)} onClick={() => setApprovalCandidate(null)}>Annuler</Button>
                <Button
                  disabled={Boolean(approvingPaymentId) || !proofReviewed || approvalReason.trim().length < 10}
                  onClick={() => void submitApproval()}
                >
                  {approvingPaymentId ? 'Approbation en cours…' : 'Confirmer l’approbation'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        <p className="flex items-center gap-2 text-xs text-gray-500">
          <FileWarning className="h-4 w-4" /> Aucun champ acteur, audit, taux FX ou statut n’est envoyé par cet écran.
        </p>
      </div>
    </MainLayout>
  );
}
