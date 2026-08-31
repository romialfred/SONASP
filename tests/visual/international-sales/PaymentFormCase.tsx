import { useState } from 'react';
import { InternationalPaymentFormView, type PaymentFormState } from '../../../src/pages/payments/InternationalPaymentFormView';
import type { SaleAwaitingPayment } from '../../../src/services/paymentService';

// Synthetic local visual data only. No payment execution or API call.
const sale: SaleAwaitingPayment = {
  id: 'visual-payment-sale', sale_number: 'VE-2026-00038', customer_id: 'visual-client', customer_name: 'Gold Trade Space', customer_country: 'Suisse',
  quantity_oz: 19.52, sale_date: '2026-08-20', shipment_date: '2026-08-27', gross_proceeds: 51633700, net_proceeds: 51633700, final_proceeds: 51633700,
  currency: 'USD', seller_type: 'sonasp', seller_id: 'visual-sonasp', status: 'virtual_payment', payment_id: null, payment_version: null,
  confirmed_amount: 25110000, processing_amount: 25816850, remaining_amount: 706850,
};
export function PaymentFormCase() {
  const [form, setForm] = useState<PaymentFormState>({ saleId: sale.id, customerBankId: 'client-usd', sellerBankId: 'sonasp-usd', paidAmount: '250000.00', paymentCurrency: 'USD', paymentDate: '2026-08-26', referenceNumber: 'TRF-2026-0826-001', transactionId: 'FT2026082600012345', notes: 'Paiement partiel correspondant à la facture FACT-2026-00891.' });
  const [proof, setProof] = useState<File | null>(() => new File(['%PDF-1.7\n' + ' '.repeat(1300200)], 'virement_bank_of_geneva_26082026.pdf', { type: 'application/pdf' }));
  const [message, setMessage] = useState<string | null>(null);
  return <InternationalPaymentFormView form={form} sales={[sale]}
    customerBanks={[{ id: 'client-usd', bank_name: 'Gold Trade Space', country: 'CH', currency: 'USD', account_number: null, iban: 'CH93 0076 2011 6238 5295 7', is_primary: true }]}
    sellerBanks={[{ id: 'sonasp-usd', stakeholder_type: 'mining_company', stakeholder_id: sale.seller_id, account_name: 'SONASP - Compte Opérations Internationales', bank_name: 'Banque de Genève', bank_country: 'CH', account_currency: 'USD', iban: 'CH93 0076 2011 6238 5295 7', is_primary: true }]}
    proofFile={proof} referenceFx={null} saving={false} executionCompleted={false} banksLoading={false} bankError={null} loadError={null} submitError={message}
    minDate="2026-07-31" maxDate="2026-08-30" onBack={() => setMessage('Navigation de démonstration uniquement.')} onViewSale={() => setMessage('La fiche réelle est accessible depuis le formulaire connecté.')}
    onRetry={() => setMessage(null)} onRetryBanks={() => setMessage(null)} onSaleChange={(id) => setForm((current) => ({ ...current, saleId: id }))}
    onCustomerBankChange={(id) => setForm((current) => ({ ...current, customerBankId: id, paymentCurrency: 'USD' }))}
    onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} onProofChange={setProof}
    onSubmit={(event) => { event.preventDefault(); setMessage('Démonstration : aucune écriture en base, aucun paiement enregistré.'); }} />;
}
