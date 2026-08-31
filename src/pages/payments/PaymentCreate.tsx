import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';
import { isPayableSaleStatus } from '@/services/internationalPaymentBalance';
import '@/styles/design-system.css';
import { InternationalPaymentFormView, type PaymentFormState } from './InternationalPaymentFormView';
import {
  InternationalPaymentConflictError,
  createPaymentIdempotencyKey,
  executeInternationalPayment,
  getCurrentFXRate,
  getCustomerBanks,
  getPaymentProofResumptions,
  getSalesAwaitingPayment,
  getSellerBanks,
  uploadPaymentProof,
  type CustomerBank,
  type FXRate,
  type SaleAwaitingPayment,
  type SellerBank,
  type InternationalPaymentMutationResult,
  type PaymentProofResumeCandidate,
} from '@/services/paymentService';

const today = () => new Date().toISOString().slice(0, 10);

function thirtyDaysAgo(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString().slice(0, 10);
}

const INITIAL_FORM: PaymentFormState = {
  saleId: '',
  customerBankId: '',
  sellerBankId: '',
  paidAmount: '',
  paymentCurrency: '',
  paymentDate: today(),
  referenceNumber: '',
  transactionId: '',
  notes: '',
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PaymentCreate() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const preferredSaleId = params.get('saleId') || '';
  const scope = JSON.stringify([user?.id, user?.role, user?.is_active, user?.mining_company_id, user?.organization_id, [...(user?.capabilities || [])].sort(), preferredSaleId]);
  return <PaymentCreateForm key={scope} preferredSaleId={preferredSaleId} />;
}

function PaymentCreateForm({ preferredSaleId }: { preferredSaleId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const canExecute = hasSensitiveCapability(user, CAPABILITIES.FINANCE_EXECUTE);
  const idempotencyKey = useRef<string | null>(null);
  const proofIdempotencyKey = useRef<string | null>(null);
  const executionResult = useRef<InternationalPaymentMutationResult | null>(null);
  const resumeProofKey = useRef<string | null>(null);
  const selectionVersion = useRef(0);
  const fxVersion = useRef(0);
  const autoSelected = useRef(false);
  const submitting = useRef(false);

  const [loading, setLoading] = useState(canExecute);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleAwaitingPayment[]>([]);
  const [resumptions, setResumptions] = useState<PaymentProofResumeCandidate[]>([]);
  const [resumeCandidate, setResumeCandidate] = useState<PaymentProofResumeCandidate | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeSaving, setResumeSaving] = useState(false);
  const [customerBanks, setCustomerBanks] = useState<CustomerBank[]>([]);
  const [sellerBanks, setSellerBanks] = useState<SellerBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [referenceFx, setReferenceFx] = useState<FXRate | null>(null);
  const [form, setForm] = useState<PaymentFormState>(INITIAL_FORM);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [executionCompleted, setExecutionCompleted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === form.saleId) || null,
    [form.saleId, sales],
  );

  const loadSales = useCallback(async () => {
    if (!canExecute) {
      setSales([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [salesResult, resumeResult] = await Promise.all([
        getSalesAwaitingPayment(preferredSaleId || undefined),
        getPaymentProofResumptions(),
      ]);
      if (!salesResult.success) throw new Error(salesResult.error || 'Chargement impossible.');
      if (!resumeResult.success) throw new Error(resumeResult.error || 'Reprises indisponibles.');
      setSales(salesResult.data || []);
      setResumptions(resumeResult.data || []);
      setResumeCandidate((current) => (
        current
          ? (resumeResult.data || []).find((candidate) => candidate.payment_id === current.payment_id) || null
          : null
      ));
    } catch (error) {
      setSales([]);
      setResumptions([]);
      setResumeCandidate(null);
      setLoadError(errorMessage(error, 'Impossible de charger les ventes en attente de paiement.'));
    } finally {
      setLoading(false);
    }
  }, [canExecute, preferredSaleId]);

  useEffect(() => { void loadSales(); }, [loadSales]);
  useEffect(() => {
    resumeProofKey.current = resumeCandidate?.proof_idempotency_key ?? null;
  }, [resumeCandidate]);

  const updateForm = <K extends keyof PaymentFormState>(field: K, value: PaymentFormState[K]) => {
    if (executionResult.current) return;
    idempotencyKey.current = null;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectSale = useCallback(async (saleId: string) => {
    if (executionResult.current) return;
    const selection = ++selectionVersion.current;
    ++fxVersion.current;
    idempotencyKey.current = null;
    proofIdempotencyKey.current = null;
    setProofFile(null);
    const sale = sales.find((candidate) => candidate.id === saleId) || null;
    setForm((current) => ({
      ...current,
      saleId,
      customerBankId: '',
      sellerBankId: '',
      paymentCurrency: '',
      paidAmount: sale ? String(sale.remaining_amount ?? sale.final_proceeds) : '',
    }));
    setCustomerBanks([]);
    setSellerBanks([]);
    setReferenceFx(null);
    setBankError(null);
    setBanksLoading(Boolean(sale));
    if (!sale) return;

    try {
      const [customers, sellers] = await Promise.all([
        getCustomerBanks(sale.customer_id),
        getSellerBanks(sale.seller_type, sale.seller_id),
      ]);
      if (selection !== selectionVersion.current) return;
      if (!customers.success) throw new Error(customers.error || 'Comptes du client indisponibles.');
      if (!sellers.success) throw new Error(sellers.error || 'Comptes SONASP indisponibles.');

      setCustomerBanks(customers.data || []);
      setSellerBanks((sellers.data || []).filter(
        (bank) => bank.account_currency?.toUpperCase() === sale.currency.toUpperCase(),
      ));
    } catch (error) {
      if (selection === selectionVersion.current) {
        const message = errorMessage(error, 'Impossible de charger les comptes bancaires autorisés.');
        setBankError(message);
        addToast(message, 'error');
      }
    } finally {
      if (selection === selectionVersion.current) setBanksLoading(false);
    }
  }, [sales, addToast]);

  useEffect(() => {
    if (preferredSaleId && !autoSelected.current && sales.some((sale) => sale.id === preferredSaleId)) {
      autoSelected.current = true;
      void selectSale(preferredSaleId);
    }
  }, [preferredSaleId, sales, selectSale]);

  const selectCustomerBank = async (bankId: string) => {
    if (executionResult.current) return;
    const request = ++fxVersion.current;
    const bank = customerBanks.find((candidate) => candidate.id === bankId) || null;
    const currency = bank?.currency?.toUpperCase() || '';
    idempotencyKey.current = null;
    setForm((current) => ({
      ...current,
      customerBankId: bankId,
      paymentCurrency: currency,
      // Never reinterpret a previously entered amount in a different currency.
      paidAmount: currency === (current.paymentCurrency || selectedSale?.currency) ? current.paidAmount : '',
    }));
    setReferenceFx(null);
    if (!bank || !selectedSale) return;

    const result = await getCurrentFXRate(bank.currency, selectedSale.currency);
    if (request === fxVersion.current && result.success && result.data) setReferenceFx(result.data);
  };

  const validationError = (): string | null => {
    if (!canExecute) return 'Une session AAL2 avec la capacité finance d’exécution est requise.';
    if (!selectedSale || !isPayableSaleStatus(selectedSale.status)) {
      return 'La vente n’est plus dans l’état attendu. Actualisez la liste.';
    }
    if (!form.customerBankId || !form.sellerBankId) return 'Sélectionnez les deux comptes bancaires validés.';
    if (!form.paymentCurrency) return 'La devise du compte payeur est manquante.';
    if (!Number.isFinite(Number(form.paidAmount)) || Number(form.paidAmount) <= 0) {
      return 'Le montant payé doit être strictement positif.';
    }
    if (form.paymentCurrency === selectedSale.currency && selectedSale.remaining_amount != null
      && Number(form.paidAmount) > selectedSale.remaining_amount) return 'Le montant dépasse le solde disponible de cette vente.';
    if (form.paymentDate < thirtyDaysAgo() || form.paymentDate > today()) {
      return 'La date de paiement doit être comprise dans les trente derniers jours.';
    }
    if (form.referenceNumber.trim().length < 5) {
      return 'La référence bancaire doit contenir au moins 5 caractères.';
    }
    if (!proofFile) return 'La preuve bancaire privée est obligatoire avant l’exécution.';
    try {
      validateUploadFile(proofFile, UPLOAD_POLICIES.paymentProof);
    } catch (error) {
      return errorMessage(error, 'La preuve bancaire est invalide.');
    }
    return null;
  };

  const selectProof = (file: File | null) => {
    proofIdempotencyKey.current = null;
    if (!file) {
      setProofFile(null);
      return;
    }
    try {
      validateUploadFile(file, UPLOAD_POLICIES.paymentProof);
      setProofFile(file);
    } catch (error) {
      setProofFile(null);
      addToast(errorMessage(error, 'La preuve bancaire est invalide.'), 'error');
    }
  };

  const selectResumeCandidate = (candidate: PaymentProofResumeCandidate) => {
    setResumeCandidate(candidate);
    setResumeFile(null);
    resumeProofKey.current = candidate.proof_idempotency_key;
  };

  const selectResumeProof = (file: File | null) => {
    if (!file) {
      setResumeFile(null);
      return;
    }
    try {
      validateUploadFile(file, UPLOAD_POLICIES.paymentProof);
      setResumeFile(file);
    } catch (error) {
      setResumeFile(null);
      addToast(errorMessage(error, 'La preuve bancaire de reprise est invalide.'), 'error');
    }
  };

  const handleResumeProof = async () => {
    if (!canExecute || !resumeCandidate || !resumeFile) {
      addToast('Sélectionnez le paiement serveur et sa preuve bancaire.', 'error');
      return;
    }
    setResumeSaving(true);
    try {
      resumeProofKey.current ||= createPaymentIdempotencyKey();
      const proof = await uploadPaymentProof(
        resumeFile,
        resumeCandidate.payment_id,
        resumeProofKey.current,
      );
      if (!proof.success || !proof.data) {
        throw new Error(proof.error || 'Le rattachement privé de reprise a échoué.');
      }
      addToast('Preuve privée rattachée ; le paiement peut être rapproché.', 'success');
      navigate(`/payments/${resumeCandidate.payment_id}`);
    } catch (error) {
      addToast(errorMessage(error, 'La reprise de la preuve bancaire a été refusée.'), 'error');
    } finally {
      setResumeSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const invalid = validationError();
    if (invalid || !selectedSale || !proofFile || !isPayableSaleStatus(selectedSale.status)) {
      setSubmitError(invalid || 'Dossier de vente incomplet.');
      addToast(invalid || 'Dossier de vente incomplet.', 'error');
      return;
    }

    submitting.current = true;
    setSubmitError(null);
    setSaving(true);
    try {
      let result = executionResult.current;
      if (!result) {
        idempotencyKey.current ||= createPaymentIdempotencyKey();
        result = await executeInternationalPayment({
          saleId: selectedSale.id,
          expectedSaleStatus: selectedSale.status,
          expectedPaymentVersion: selectedSale.payment_version,
          paidAmount: Number(form.paidAmount),
          paymentCurrency: form.paymentCurrency,
          customerBankId: form.customerBankId,
          sellerBankId: form.sellerBankId,
          paymentDate: form.paymentDate,
          referenceNumber: form.referenceNumber,
          transactionId: form.transactionId,
          notes: form.notes,
          idempotencyKey: idempotencyKey.current,
        });
        executionResult.current = result;
        setExecutionCompleted(true);
      }

      proofIdempotencyKey.current ||= createPaymentIdempotencyKey();
      const proof = await uploadPaymentProof(
        proofFile,
        result.payment_id,
        proofIdempotencyKey.current,
      );
      if (!proof.success || !proof.data) {
        throw new Error(
          proof.error
          || 'Le paiement est exécuté, mais la preuve privée n’a pas été rattachée. Réessayez sans modifier le dossier.',
        );
      }

      addToast(
        result.replayed
          ? 'Paiement rejoué sans doublon et preuve privée confirmée.'
          : 'Versement enregistré, justificatif déposé et dossier transmis au rapprochement.',
        'success',
      );
      navigate(`/payments/${result.payment_id}`);
    } catch (error) {
      setSubmitError(errorMessage(error, 'L’enregistrement du versement a été refusé.'));
      if (error instanceof InternationalPaymentConflictError) {
        addToast(error.message, 'error');
        await loadSales();
      } else {
        addToast(errorMessage(error, 'Le serveur a refusé l’exécution du paiement.'), 'error');
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return <NationalDashboardLayout><Loading message="Chargement des paiements autorisés…" /></NationalDashboardLayout>;
  }

  if (!canExecute) {
    return (
      <NationalDashboardLayout>
        <div className="max-w-3xl mx-auto p-6">
          <Alert variant="error" title="Exécution non autorisée">
            Cette opération exige une session AAL2 active et la capacité
            « Finances — exécution » fournie par le serveur.
          </Alert>
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <InternationalPaymentFormView
        form={form} sales={sales} customerBanks={customerBanks} sellerBanks={sellerBanks}
        proofFile={proofFile} referenceFx={referenceFx} saving={saving || resumeSaving}
        executionCompleted={executionCompleted} banksLoading={banksLoading} bankError={bankError}
        loadError={loadError} submitError={submitError} minDate={thirtyDaysAgo()} maxDate={today()}
        onBack={() => navigate(preferredSaleId ? `/sales/${encodeURIComponent(preferredSaleId)}` : '/payments')}
        onViewSale={(id) => navigate(`/sales/${encodeURIComponent(id)}`)}
        onRetry={() => void loadSales()} onRetryBanks={() => void selectSale(form.saleId)}
        onSaleChange={(id) => void selectSale(id)} onCustomerBankChange={(id) => void selectCustomerBank(id)}
        onChange={updateForm} onProofChange={selectProof} onSubmit={handleSubmit}
        recovery={resumptions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Reprendre un rattachement interrompu</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning" title="Versement déjà enregistré">
                Ces versements sont enregistrés, mais leur justificatif est absent ou incomplet. Rattachez la preuve sans créer un second versement pour la même opération.
              </Alert>
              <div className="space-y-2">
                {resumptions.map((candidate) => (
                  <div key={candidate.payment_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="font-semibold">{candidate.sale_number}</p>
                      <p className="text-sm text-gray-600">
                        {formatCurrency(candidate.amount, candidate.currency)} · {candidate.reference_number || 'Sans référence'} · version {candidate.payment_version}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resumeSaving}
                      onClick={() => selectResumeCandidate(candidate)}
                    >
                      Reprendre le rattachement
                    </Button>
                  </div>
                ))}
              </div>
              {resumeCandidate && (
                <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm">
                    Paiement serveur <span className="font-mono">{resumeCandidate.payment_id}</span>.
                    {resumeCandidate.proof_idempotency_key
                      ? ' La clé de preuve déjà commise sera réutilisée : sélectionnez exactement le même fichier.'
                      : ' Une nouvelle clé de preuve sécurisée sera créée.'}
                  </p>
                  <FormField label="Preuve bancaire à rattacher" required htmlFor="resumePaymentProof">
                    <Input
                      id="resumePaymentProof"
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                      onChange={(event) => selectResumeProof(event.target.files?.[0] ?? null)}
                      disabled={resumeSaving}
                    />
                  </FormField>
                  <Button
                    type="button"
                    disabled={resumeSaving || !resumeFile}
                    onClick={() => void handleResumeProof()}
                  >
                    {resumeSaving ? 'Rattachement en cours…' : 'Rattacher la preuve privée'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      />
    </NationalDashboardLayout>
  );
}
