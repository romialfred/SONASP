import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle, DollarSign, ShieldCheck } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';
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

interface PaymentFormState {
  saleId: string;
  customerBankId: string;
  sellerBankId: string;
  paidAmount: string;
  paymentCurrency: string;
  paymentDate: string;
  referenceNumber: string;
  transactionId: string;
  notes: string;
}

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const canExecute = hasSensitiveCapability(user, CAPABILITIES.FINANCE_EXECUTE);
  const idempotencyKey = useRef<string | null>(null);
  const proofIdempotencyKey = useRef<string | null>(null);
  const executionResult = useRef<InternationalPaymentMutationResult | null>(null);
  const resumeProofKey = useRef<string | null>(null);

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
  const [referenceFx, setReferenceFx] = useState<FXRate | null>(null);
  const [form, setForm] = useState<PaymentFormState>(INITIAL_FORM);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [executionCompleted, setExecutionCompleted] = useState(false);

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
        getSalesAwaitingPayment(),
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
  }, [canExecute]);

  useEffect(() => { void loadSales(); }, [loadSales]);
  useEffect(() => {
    resumeProofKey.current = resumeCandidate?.proof_idempotency_key ?? null;
  }, [resumeCandidate]);

  const updateForm = <K extends keyof PaymentFormState>(field: K, value: PaymentFormState[K]) => {
    if (executionResult.current) return;
    idempotencyKey.current = null;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectSale = async (saleId: string) => {
    if (executionResult.current) return;
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
      paidAmount: sale ? String(sale.final_proceeds) : '',
    }));
    setCustomerBanks([]);
    setSellerBanks([]);
    setReferenceFx(null);
    if (!sale) return;

    try {
      const [customers, sellers] = await Promise.all([
        getCustomerBanks(sale.customer_id),
        getSellerBanks(sale.seller_type, sale.seller_id),
      ]);
      if (!customers.success) throw new Error(customers.error || 'Comptes du client indisponibles.');
      if (!sellers.success) throw new Error(sellers.error || 'Comptes SONASP indisponibles.');

      setCustomerBanks(customers.data || []);
      setSellerBanks((sellers.data || []).filter(
        (bank) => bank.account_currency?.toUpperCase() === sale.currency.toUpperCase(),
      ));
    } catch (error) {
      addToast(errorMessage(error, 'Impossible de charger les comptes bancaires autorisés.'), 'error');
    }
  };

  const selectCustomerBank = async (bankId: string) => {
    const bank = customerBanks.find((candidate) => candidate.id === bankId) || null;
    idempotencyKey.current = null;
    setForm((current) => ({
      ...current,
      customerBankId: bankId,
      paymentCurrency: bank?.currency?.toUpperCase() || '',
    }));
    setReferenceFx(null);
    if (!bank || !selectedSale) return;

    const result = await getCurrentFXRate(bank.currency, selectedSale.currency);
    if (result.success && result.data) setReferenceFx(result.data);
  };

  const validationError = (): string | null => {
    if (!canExecute) return 'Une session AAL2 avec la capacité finance d’exécution est requise.';
    if (!selectedSale || selectedSale.status !== 'waiting_for_payment') {
      return 'La vente n’est plus dans l’état attendu. Actualisez la liste.';
    }
    if (!form.customerBankId || !form.sellerBankId) return 'Sélectionnez les deux comptes bancaires validés.';
    if (!form.paymentCurrency) return 'La devise du compte payeur est manquante.';
    if (!Number.isFinite(Number(form.paidAmount)) || Number(form.paidAmount) <= 0) {
      return 'Le montant payé doit être strictement positif.';
    }
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
    const invalid = validationError();
    if (invalid || !selectedSale || !proofFile) {
      addToast(invalid || 'Dossier de vente incomplet.', 'error');
      return;
    }

    setSaving(true);
    try {
      let result = executionResult.current;
      if (!result) {
        idempotencyKey.current ||= createPaymentIdempotencyKey();
        result = await executeInternationalPayment({
          saleId: selectedSale.id,
          expectedSaleStatus: 'waiting_for_payment',
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
          : 'Paiement exécuté, preuve privée validée et dossier transmis au rapprochement.',
        'success',
      );
      navigate(`/payments/${result.payment_id}`);
    } catch (error) {
      if (error instanceof InternationalPaymentConflictError) {
        addToast(error.message, 'error');
        await loadSales();
      } else {
        addToast(errorMessage(error, 'Le serveur a refusé l’exécution du paiement.'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <MainLayout><Loading message="Chargement des paiements autorisés…" /></MainLayout>;
  }

  if (!canExecute) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto p-6">
          <Alert variant="error" title="Exécution non autorisée">
            Cette opération exige une session AAL2 active et la capacité
            « Finances — exécution » fournie par le serveur.
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/payments')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">Exécuter un paiement international</h1>
            <p className="text-gray-600 mt-1">Conversion atomique de l’engagement existant, sans création en double.</p>
          </div>
        </div>

        {loadError && <Alert variant="error" title="Chargement impossible">{loadError}</Alert>}
        {resumptions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Reprendre un rattachement interrompu</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning" title="Paiement déjà exécuté">
                Ces paiements ont été confirmés par le serveur, mais leur preuve privée est absente ou incomplète. Ne relancez pas l’exécution bancaire.
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
        {!loadError && sales.length === 0 && (
          <Alert variant="info" title="Aucune vente en attente">
            Seules les ventes SONASP au statut « waiting_for_payment » sont proposées.
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Vente et comptes contrôlés</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Vente en attente" required htmlFor="saleId">
                  <Select id="saleId" value={form.saleId} onChange={(event) => void selectSale(event.target.value)} disabled={saving || executionCompleted} required>
                    <option value="">Sélectionner une vente…</option>
                    {sales.map((sale) => (
                      <option key={sale.id} value={sale.id}>
                        {sale.sale_number} — {sale.customer_name} — {formatCurrency(sale.final_proceeds, sale.currency)}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {selectedSale && (
                  <div className="rounded-lg bg-gray-50 p-4 grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-600">Client</span><p className="font-semibold">{selectedSale.customer_name}</p></div>
                    <div><span className="text-gray-600">Montant de la vente</span><p className="font-semibold">{formatCurrency(selectedSale.final_proceeds, selectedSale.currency)}</p></div>
                    <div><span className="text-gray-600">Engagement</span><p className="font-semibold">{selectedSale.payment_id ? `version ${selectedSale.payment_version}` : 'Dette historique — secours serveur'}</p></div>
                    <div><span className="text-gray-600">Devise de règlement</span><p className="font-semibold">{selectedSale.currency}</p></div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Compte du client" required htmlFor="customerBankId">
                    <Select id="customerBankId" value={form.customerBankId} onChange={(event) => void selectCustomerBank(event.target.value)} disabled={!selectedSale || saving || executionCompleted} required>
                      <option value="">Compte payeur actif…</option>
                      {customerBanks.map((bank) => (
                        <option key={bank.id} value={bank.id}>{bank.bank_name} — {bank.currency}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Compte receveur SONASP" required htmlFor="sellerBankId">
                    <Select id="sellerBankId" value={form.sellerBankId} onChange={(event) => updateForm('sellerBankId', event.target.value)} disabled={!selectedSale || saving || executionCompleted} required>
                      <option value="">Compte vérifié dans la devise de vente…</option>
                      {sellerBanks.map((bank) => (
                        <option key={bank.id} value={bank.id}>{bank.bank_name} — {bank.account_currency}</option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Détails bancaires</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Montant payé" required htmlFor="paidAmount">
                    <Input id="paidAmount" type="number" min="0.01" step="0.01" value={form.paidAmount} onChange={(event) => updateForm('paidAmount', event.target.value)} disabled={!selectedSale || saving || executionCompleted} required />
                  </FormField>
                  <FormField label="Devise payée" required htmlFor="paymentCurrency">
                    <Input id="paymentCurrency" value={form.paymentCurrency} readOnly placeholder="Dérivée du compte client" />
                  </FormField>
                  <FormField label="Date du paiement" required htmlFor="paymentDate">
                    <Input id="paymentDate" type="date" min={thirtyDaysAgo()} max={today()} value={form.paymentDate} onChange={(event) => updateForm('paymentDate', event.target.value)} disabled={saving || executionCompleted} required />
                  </FormField>
                  <FormField label="Référence bancaire" required htmlFor="referenceNumber">
                    <Input id="referenceNumber" value={form.referenceNumber} onChange={(event) => updateForm('referenceNumber', event.target.value)} minLength={5} maxLength={255} disabled={saving || executionCompleted} required />
                  </FormField>
                  <FormField label="Identifiant de transaction" htmlFor="transactionId">
                    <Input id="transactionId" value={form.transactionId} onChange={(event) => updateForm('transactionId', event.target.value)} maxLength={255} disabled={saving || executionCompleted} />
                  </FormField>
                </div>
                <FormField label="Notes" htmlFor="notes">
                  <textarea id="notes" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} rows={3} maxLength={4000} disabled={saving || executionCompleted} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                </FormField>
                <FormField label="Preuve bancaire privée" required htmlFor="paymentProof">
                  <Input
                    id="paymentProof"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                    onChange={(event) => selectProof(event.target.files?.[0] ?? null)}
                    disabled={saving}
                    required={!proofFile}
                  />
                  <p className="mt-1 text-xs text-gray-600">
                    PDF/JPEG/PNG, 10 Mo maximum. Le serveur contrôle les octets réels et stocke la preuve dans un bucket privé.
                  </p>
                </FormField>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Contrôles serveur</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 mt-0.5" /> Acteur, statut et horodatages sont dérivés du JWT.</p>
                <p className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 mt-0.5" /> Les deux comptes, leur devise et leur validité sont revérifiés.</p>
                <p className="flex gap-2"><DollarSign className="h-4 w-4 text-green-600 mt-0.5" /> Le taux FX est choisi dans le référentiel serveur.</p>
                <p className="flex gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" /> Un autre agent habilité devra rapprocher l’opération.</p>
              </CardContent>
            </Card>

            {referenceFx && selectedSale && (
              <Card>
                <CardHeader><CardTitle>Taux indicatif</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="text-2xl font-bold">{referenceFx.rate.toFixed(6)}</p>
                  <p>{referenceFx.from_currency}/{referenceFx.to_currency} au {referenceFx.rate_date}</p>
                  <p className="text-gray-600">Indication uniquement : la RPC sélectionne et contrôle le taux final.</p>
                </CardContent>
              </Card>
            )}

            <Alert variant={executionCompleted ? 'warning' : 'info'} title="Preuve bancaire privée obligatoire">
              {executionCompleted
                ? 'Le paiement est déjà exécuté. Renvoyez la même preuve : l’approbation reste fermée tant que le rattachement privé n’est pas confirmé.'
                : 'Le dépôt est contrôlé par le serveur et lié exactement au paiement et à sa vente. Aucune URL publique n’est créée.'}
            </Alert>

            <Button type="submit" disabled={saving || !selectedSale || !proofFile} className="w-full">
              {saving
                ? 'Contrôle et dépôt en cours…'
                : executionCompleted
                  ? 'Rattacher la preuve privée et transmettre'
                  : 'Exécuter, rattacher la preuve et transmettre'}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
