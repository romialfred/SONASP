import { useRef, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Eye, FileText, Globe2, Info, Lightbulb, LockKeyhole, Receipt, Save, ShieldCheck, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import type { CustomerBank, FXRate, SaleAwaitingPayment, SellerBank } from '@/services/paymentService';
import { UPLOAD_POLICIES } from '@/lib/uploadValidation';
import '@/styles/design-system.css';
import './international-payment-form.css';

export interface PaymentFormState {
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

export interface InternationalPaymentFormViewProps {
  form: PaymentFormState;
  sales: SaleAwaitingPayment[];
  customerBanks: CustomerBank[];
  sellerBanks: SellerBank[];
  proofFile: File | null;
  referenceFx: FXRate | null;
  saving: boolean;
  executionCompleted: boolean;
  banksLoading: boolean;
  bankError: string | null;
  loadError: string | null;
  submitError: string | null;
  minDate: string;
  maxDate: string;
  recovery?: ReactNode;
  onBack: () => void;
  onViewSale: (id: string) => void;
  onRetry: () => void;
  onRetryBanks: () => void;
  onSaleChange: (id: string) => void;
  onCustomerBankChange: (id: string) => void;
  onChange: <K extends keyof PaymentFormState>(field: K, value: PaymentFormState[K]) => void;
  onProofChange: (file: File | null) => void;
  onSubmit: (event: FormEvent) => void;
}

const number = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const money = (value: number | null | undefined, currency: string) => `${number(value)}${value == null ? '' : ` ${currency}`}`;
const percentage = (value: number | null | undefined, total: number) => value == null || total <= 0 ? '' : ` (${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / total * 100)} %)`;
const date = (value?: string | null) => value && !Number.isNaN(Date.parse(value))
  ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(new Date(value)) : 'Non renseignée';
const currencyNames: Record<string, string> = { USD: 'Dollar américain', EUR: 'Euro', XOF: 'Franc CFA', CHF: 'Franc suisse', GBP: 'Livre sterling' };

function saleStatus(sale: SaleAwaitingPayment) {
  if ((sale.confirmed_amount ?? 0) > 0) return { label: 'Partiellement payée', tone: 'partial' };
  if ((sale.processing_amount ?? 0) > 0) return { label: 'Paiement en cours de contrôle', tone: 'pending' };
  return { label: 'En attente de paiement', tone: 'pending' };
}

function BankSelect({ id, value, disabled, children, detail, onChange }: {
  id: string; value: string; disabled: boolean; children: ReactNode; detail: string; onChange: (id: string) => void;
}) {
  return <div className="ipf-bank-select">
    <select id={id} value={value} disabled={disabled} required onChange={(event) => onChange(event.target.value)} aria-describedby={`${id}-detail`}>{children}</select>
    <ChevronDown aria-hidden="true" />
    <span id={`${id}-detail`}>{detail}</span>
  </div>;
}

/** Presentation only. Authority, balance checks, execution and proof retries stay in PaymentCreate. */
export function InternationalPaymentFormView(props: InternationalPaymentFormViewProps) {
  const { form, sales, customerBanks, sellerBanks, proofFile, referenceFx, saving, executionCompleted, banksLoading, bankError, loadError, submitError } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const sale = sales.find((item) => item.id === form.saleId);
  const status = sale ? saleStatus(sale) : null;
  const customerBank = customerBanks.find((item) => item.id === form.customerBankId);
  const sellerBank = sellerBanks.find((item) => item.id === form.sellerBankId);
  const frozen = saving || executionCompleted;
  const currencies = [...new Set(customerBanks.map((bank) => bank.currency.toUpperCase()))];
  const available = sale?.remaining_amount;
  const exceedsBalance = Boolean(sale && available != null && form.paymentCurrency === sale.currency && Number(form.paidAmount) > available);
  const bankDetail = (bank?: { iban?: string | null; account_number?: string | null; swift_code?: string | null }) => {
    if (bank?.iban) return `IBAN : ${bank.iban}`;
    if (bank?.account_number) return `N° de compte : ${bank.account_number}`;
    if (bank?.swift_code) return `SWIFT : ${bank.swift_code}`;
    return bank ? 'Coordonnées complémentaires non renseignées' : 'Sélectionnez un compte bancaire';
  };

  return <div className="sn-page international-payment-form">
    <nav className="ipf-breadcrumb" aria-label="Fil d’Ariane"><button type="button" onClick={props.onBack} disabled={saving}>Paiements</button><ChevronRight aria-hidden="true" /><span aria-current="page">Exécuter un paiement</span></nav>
    <header className="ipf-heading">
      <Button variant="outline" type="button" onClick={props.onBack} disabled={saving}><ArrowLeft aria-hidden="true" />Retour</Button>
      <div><h1>Exécuter un paiement international</h1><p>Enregistrez un paiement reçu de votre client international.</p></div>
      <Button variant="outline" type="button" className="ipf-heading__detail" onClick={() => sale && props.onViewSale(sale.id)} disabled={!sale || saving}><Eye aria-hidden="true" />Voir le détail de la vente</Button>
    </header>

    {loadError ? <div className="ipf-notice ipf-notice--error" role="alert"><Info aria-hidden="true" /><div><strong>Chargement impossible</strong><p>{loadError}</p><Button type="button" variant="outline" onClick={props.onRetry}>Réessayer</Button></div></div>
      : <div className="ipf-notice ipf-notice--info" role="status"><Info aria-hidden="true" /><div><strong>{sales.length ? 'Ventes disponibles pour un paiement' : 'Aucune vente en attente'}</strong><p>{sales.length ? 'Les ventes SONASP validées ou partiellement payées avec un solde disponible sont proposées ci-dessous.' : 'Aucune vente SONASP validée avec un solde disponible dans votre périmètre. Les paiements en cours de contrôle réservent leur montant.'}</p></div></div>}

    {props.recovery}
    {submitError && <div className="ipf-notice ipf-notice--error" role="alert"><Info aria-hidden="true" /><div><strong>{executionCompleted ? 'Versement enregistré — justificatif à finaliser' : 'Versement non finalisé'}</strong><p>{submitError}</p></div></div>}

    <form onSubmit={props.onSubmit} className="ipf-form" aria-label="Enregistrement d’un paiement international">
      <div className="ipf-main">
        <section className="ipf-card ipf-selection" aria-labelledby="ipf-selection-title">
          <h2 id="ipf-selection-title"><Receipt aria-hidden="true" />Sélection de la vente et du client</h2>
          <FormField label="Vente en attente" required htmlFor="saleId">
            <div className={`ipf-sale-select${sale ? ' has-selection' : ''}`}>
              <select id="saleId" value={form.saleId} onChange={(event) => props.onSaleChange(event.target.value)} disabled={frozen || !sales.length} required>
                <option value="">Sélectionner une vente…</option>
                {sales.map((item) => <option key={item.id} value={item.id}>{item.sale_number} - {item.customer_name} - {money(item.final_proceeds, item.currency)}</option>)}
              </select>
              {status && <span className={`ipf-sale-select__status is-${status.tone}`} aria-hidden="true"><i />{status.label}</span>}
              <ChevronDown aria-hidden="true" />
            </div>
          </FormField>
          <div className="ipf-fields ipf-bank-fields">
            <FormField label="Compte du client" required htmlFor="customerBankId">
              <BankSelect id="customerBankId" value={form.customerBankId} onChange={props.onCustomerBankChange} disabled={!sale || frozen || banksLoading} detail={bankDetail(customerBank)}>
                <option value="">{banksLoading ? 'Chargement des comptes…' : sale && !customerBanks.length ? 'Aucun compte client actif' : 'Sélectionner le compte du client…'}</option>
                {customerBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.bank_name}{bank.is_primary ? ' - Compte principal' : ''} ({bank.currency})</option>)}
              </BankSelect>
            </FormField>
            <FormField label="Compte receveur SONASP" required htmlFor="sellerBankId">
              <BankSelect id="sellerBankId" value={form.sellerBankId} onChange={(id) => props.onChange('sellerBankId', id)} disabled={!sale || frozen || banksLoading} detail={bankDetail(sellerBank)}>
                <option value="">{banksLoading ? 'Chargement des comptes…' : sale && !sellerBanks.length ? 'Aucun compte SONASP vérifié' : 'Sélectionner le compte receveur…'}</option>
                {sellerBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.account_name || bank.bank_name} ({bank.account_currency})</option>)}
              </BankSelect>
            </FormField>
          </div>
          {bankError && <div className="ipf-field-error" role="alert">{bankError} <button type="button" onClick={props.onRetryBanks} disabled={frozen}>Réessayer</button></div>}
          {sale && !bankError && !banksLoading && (!customerBanks.length || !sellerBanks.length) && <p className="ipf-field-error" role="status">Un compte client actif et un compte SONASP vérifié dans la devise de la vente sont nécessaires. Faites compléter les coordonnées bancaires avant l’enregistrement.</p>}
        </section>

        <section className="ipf-card ipf-payment" aria-labelledby="ipf-payment-title">
          <h2 id="ipf-payment-title"><Receipt aria-hidden="true" />Détails du paiement</h2>
          <div className="ipf-fields">
            <FormField label="Montant payé" required htmlFor="paidAmount">
              <div className="ipf-amount"><input id="paidAmount" type="number" inputMode="decimal" min="0.01" step="0.01" value={form.paidAmount} onChange={(event) => props.onChange('paidAmount', event.target.value)} disabled={!sale || frozen} required aria-invalid={exceedsBalance} aria-describedby={exceedsBalance ? 'ipf-amount-error' : undefined} /><span>{form.paymentCurrency || sale?.currency || '—'}</span></div>
              {exceedsBalance && <p id="ipf-amount-error" className="ipf-field-error">Montant supérieur au solde disponible : {money(available, sale?.currency || '')}.</p>}
            </FormField>
            <FormField label="Devise payée" required htmlFor="paymentCurrency">
              <div className="ipf-select"><select id="paymentCurrency" value={form.paymentCurrency} required disabled={!sale || frozen || !currencies.length} aria-describedby="ipf-currency-hint" onChange={(event) => { const bank = customerBanks.find((item) => item.currency.toUpperCase() === event.target.value); if (bank) props.onCustomerBankChange(bank.id); }}>
                <option value="">Sélectionner une devise…</option>{currencies.map((currency) => <option key={currency} value={currency}>{currency}{currencyNames[currency] ? ` - ${currencyNames[currency]}` : ''}</option>)}
              </select><ChevronDown aria-hidden="true" /></div>
              <span id="ipf-currency-hint" className="sr-only">La devise correspond au compte client. Changer de devise sélectionne un compte actif dans cette devise et efface le montant à ressaisir.</span>
            </FormField>
            <FormField label="Date du paiement" required htmlFor="paymentDate"><input id="paymentDate" type="date" min={props.minDate} max={props.maxDate} value={form.paymentDate} onChange={(event) => props.onChange('paymentDate', event.target.value)} disabled={frozen} required /></FormField>
            <FormField label="Référence bancaire" required htmlFor="referenceNumber"><input id="referenceNumber" value={form.referenceNumber} onChange={(event) => props.onChange('referenceNumber', event.target.value)} minLength={5} maxLength={255} disabled={frozen} required /></FormField>
            <FormField label="Identifiant de transaction" htmlFor="transactionId"><input id="transactionId" value={form.transactionId} onChange={(event) => props.onChange('transactionId', event.target.value)} maxLength={255} disabled={frozen} /></FormField>
          </div>
          <FormField label="Notes (optionnel)" htmlFor="notes"><textarea id="notes" value={form.notes} onChange={(event) => props.onChange('notes', event.target.value)} rows={2} maxLength={4000} disabled={frozen} /></FormField>
          <div className="ipf-proof">
            <label htmlFor="paymentProof">Preuve bancaire / justificatif <span aria-hidden="true">*</span></label>
            <div className={`ipf-proof__file${proofFile ? ' has-file' : ''}`}>
              {proofFile ? <><FileText aria-hidden="true" /><div><strong>{proofFile.name}</strong><small>{proofFile.type === 'application/pdf' ? 'PDF' : proofFile.type === 'image/png' ? 'PNG' : 'JPG'} · {number(proofFile.size / 1024 / 1024)} Mo</small></div><button type="button" aria-label="Retirer le justificatif" disabled={saving} onClick={() => { props.onProofChange(null); if (fileInput.current) { fileInput.current.value = ''; fileInput.current.focus(); } }}><X aria-hidden="true" /></button></>
                : <><Upload aria-hidden="true" /><div><strong>Ajouter une preuve de paiement</strong><small>Sélectionnez le justificatif bancaire</small></div></>}
              <input ref={fileInput} id="paymentProof" type="file" className={proofFile ? 'sr-only' : 'ipf-proof__input'} accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" aria-describedby="ipf-proof-hint" onChange={(event) => { props.onProofChange(event.target.files?.[0] ?? null); event.target.value = ''; }} disabled={saving} aria-required="true" />
            </div>
            <p id="ipf-proof-hint">Formats acceptés : PDF, JPG, PNG (Max {UPLOAD_POLICIES.paymentProof.maxBytes / 1024 / 1024} Mo)</p>
          </div>
        </section>
      </div>

      <aside className="ipf-aside" aria-label="Résumé et sécurité du paiement">
        <section className="ipf-summary" aria-labelledby="ipf-summary-title" aria-live="polite">
          <h2 id="ipf-summary-title">Résumé de la vente</h2>
          <p className="ipf-summary__reference">{sale?.sale_number || 'Sélectionnez une vente'}</p>
          {sale ? <><dl>
            <div><dt>Client</dt><dd className="ipf-summary__client"><strong>{sale.customer_name}</strong>{sale.customer_country && <span><Globe2 aria-hidden="true" />{sale.customer_country}</span>}</dd></div>
            <div><dt>Date d’expédition</dt><dd>{sale.shipment_context_unavailable ? 'Indisponible' : date(sale.shipment_date)}</dd></div>
            <div><dt>Montant total</dt><dd><strong>{number(sale.final_proceeds)}</strong> {sale.currency}</dd></div>
            <div><dt>Total payé et confirmé</dt><dd><strong>{number(sale.confirmed_amount)}</strong> {sale.confirmed_amount == null ? '' : sale.currency}{percentage(sale.confirmed_amount, sale.final_proceeds)}</dd></div>
            <div><dt>En cours de contrôle</dt><dd><strong>{number(sale.processing_amount)}</strong> {sale.processing_amount == null ? '' : sale.currency}{percentage(sale.processing_amount, sale.final_proceeds)}</dd></div>
            <div className="ipf-summary__balance"><dt>Solde disponible à payer</dt><dd><strong>{number(available)}</strong> {available == null ? '' : sale.currency}{percentage(available, sale.final_proceeds)}</dd></div>
          </dl><div className="ipf-summary__status"><ShieldCheck aria-hidden="true" /><strong>Statut actuel</strong><span className={`ipf-status is-${status?.tone}`}>{status?.label}</span></div></>
            : <p className="ipf-summary__empty">Le client, les montants et le solde disponible apparaîtront ici après la sélection d’une vente autorisée.</p>}
        </section>
        <section className="ipf-aside-note ipf-aside-note--warning"><h2><Lightbulb aria-hidden="true" />Rappel important</h2><ul><li>Le montant payé ne doit pas dépasser le solde disponible.</li><li>Le paiement sera enregistré et soumis au rapprochement.</li><li>Vous pourrez ajouter d’autres paiements jusqu’au solde complet.</li></ul></section>
        <section className="ipf-aside-note ipf-aside-note--security"><h2><LockKeyhole aria-hidden="true" />Sécurité</h2><p>Les justificatifs sont privés et les opérations tracées.<br />Un autre agent habilité confirme l’encaissement. Aucune modification n’est possible après validation.</p></section>
        {referenceFx && sale && form.paymentCurrency !== sale.currency && <section className="ipf-aside-note ipf-aside-note--security"><h2>Taux indicatif</h2><strong>{referenceFx.rate.toFixed(6)}</strong><p>{referenceFx.from_currency}/{referenceFx.to_currency} au {date(referenceFx.rate_date)}. Le serveur vérifie le taux applicable à la date du paiement.</p></section>}
        {executionCompleted && <div className="ipf-notice ipf-notice--warning" role="status"><Info aria-hidden="true" /><div><strong>Versement déjà enregistré</strong><p>Renvoyez la même preuve. Aucun second versement ne sera créé ; le rapprochement reste bloqué jusqu’à confirmation du dépôt.</p></div></div>}
      </aside>
      <footer className="ipf-actions">
        <Button type="button" variant="outline" onClick={props.onBack} disabled={saving}><X aria-hidden="true" />Annuler</Button>
        <Button type="submit" loading={saving} aria-busy={saving} disabled={saving || banksLoading || !sale || !proofFile}>
          {!saving && <Save aria-hidden="true" />}{saving ? 'Contrôle et dépôt en cours…' : executionCompleted ? 'Rattacher la preuve privée et transmettre' : 'Enregistrer le paiement'}
        </Button>
      </footer>
    </form>
  </div>;
}
