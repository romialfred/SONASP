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
import { createPaymentIdempotencyKey } from '@/services/paymentService';
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

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [virtualPayments, setVirtualPayments] = useState<VirtualPayment[]>([]);
  const [processingPayments, setProcessingPayments] = useState<ProcessingInternationalPayment[]>([]);
  const [selected, setSelected] = useState<ProcessingInternationalPayment | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    } catch (error) {
      setVirtualPayments([]);
      setProcessingPayments([]);
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger les paiements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

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
            <Alert variant="warning" title="Approbation temporairement fermée">
              Aucune URL libre n’est acceptée comme preuve. Le bouton d’approbation restera désactivé jusqu’à la livraison du gateway privé de preuve bancaire ; le serveur refuse également toute approbation sans pièce vérifiée.
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
                    </div>
                    <div className="flex gap-2">
                      <Button disabled title="Gateway privé de preuve bancaire non disponible">
                        <CheckCircle className="h-4 w-4 mr-1" /> Approuver
                      </Button>
                      <Button variant="outline" disabled={!canReconcile} onClick={() => openReject(payment)} className="border-red-600 text-red-700">
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

        <p className="flex items-center gap-2 text-xs text-gray-500">
          <FileWarning className="h-4 w-4" /> Aucun champ acteur, audit, taux FX ou statut n’est envoyé par cet écran.
        </p>
      </div>
    </MainLayout>
  );
}
