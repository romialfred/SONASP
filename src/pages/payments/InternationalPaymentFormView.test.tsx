import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InternationalPaymentFormView, type InternationalPaymentFormViewProps } from './InternationalPaymentFormView';

function props(overrides: Partial<InternationalPaymentFormViewProps> = {}): InternationalPaymentFormViewProps {
  return {
    form: { saleId: 'sale-a', customerBankId: 'client-usd', sellerBankId: 'sonasp-usd', paidAmount: '250', paymentCurrency: 'USD', paymentDate: '2026-08-26', referenceNumber: 'REF-001', transactionId: '', notes: '' },
    sales: [{ id: 'sale-a', sale_number: 'VE-TEST-001', customer_id: 'client-a', customer_name: 'Client autorisé', customer_country: 'Suisse', shipment_date: '2026-08-27', sale_date: '2026-08-20', quantity_oz: 1, gross_proceeds: 1000, net_proceeds: 1000, final_proceeds: 1000, currency: 'USD', seller_type: 'sonasp', seller_id: 'sonasp', status: 'virtual_payment', payment_id: null, payment_version: null, confirmed_amount: 400, processing_amount: 100, remaining_amount: 500 }],
    customerBanks: [{ id: 'client-usd', bank_name: 'Banque client', currency: 'USD', country: 'CH', account_number: '1234', is_primary: true }, { id: 'client-eur', bank_name: 'Banque EUR', currency: 'EUR', country: 'FR', account_number: '5678', is_primary: false }],
    sellerBanks: [{ id: 'sonasp-usd', stakeholder_type: 'mining_company', stakeholder_id: 'sonasp', account_name: 'Compte SONASP', bank_name: 'Banque SONASP', bank_country: 'BF', account_currency: 'USD', iban: 'IBAN-FROM-DATABASE', is_primary: true }],
    proofFile: new File(['%PDF'], 'preuve.pdf', { type: 'application/pdf' }), referenceFx: null, saving: false, executionCompleted: false, banksLoading: false, bankError: null, loadError: null, submitError: null,
    minDate: '2026-07-31', maxDate: '2026-08-30', onBack: vi.fn(), onViewSale: vi.fn(), onRetry: vi.fn(), onRetryBanks: vi.fn(), onSaleChange: vi.fn(), onCustomerBankChange: vi.fn(), onChange: vi.fn(), onProofChange: vi.fn(), onSubmit: vi.fn((event) => event.preventDefault()), ...overrides,
  };
}

describe('International payment form — presentation contract', () => {
  it('renders the reference sections, real bank coordinates and exact ledger totals', () => {
    render(<InternationalPaymentFormView {...props()} />);
    expect(screen.getByRole('heading', { name: 'Exécuter un paiement international' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sélection de la vente et du client' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Détails du paiement' })).toBeInTheDocument();
    expect(screen.getByText('IBAN : IBAN-FROM-DATABASE')).toBeInTheDocument();
    const summary = within(screen.getByRole('region', { name: 'Résumé de la vente' }));
    expect(summary.getByText('27/08/2026')).toBeInTheDocument();
    expect(summary.getByText('400')).toBeInTheDocument();
    expect(summary.getByText('100')).toBeInTheDocument();
    expect(summary.getByText('500')).toBeInTheDocument();
    expect(screen.queryByText('Aucune vente en attente')).not.toBeInTheDocument();
    expect(screen.queryByText(/préventes/i)).not.toBeInTheDocument();
  });

  it('never invents a zero or substitutes the sale date for missing context', () => {
    const data = props();
    data.sales = [{ ...data.sales[0], shipment_date: null, confirmed_amount: null, processing_amount: null, remaining_amount: null }];
    render(<InternationalPaymentFormView {...data} />);
    const summary = within(screen.getByRole('region', { name: 'Résumé de la vente' }));
    expect(summary.getByText('Non renseignée')).toBeInTheDocument();
    expect(summary.queryByText('20/08/2026')).not.toBeInTheDocument();
    expect(summary.getAllByText('—')).toHaveLength(3);
    expect(summary.queryByText(/Partiellement payée/)).not.toBeInTheDocument();
  });

  it('shows a truthful empty state and disables submission and sale details', () => {
    render(<InternationalPaymentFormView {...props({ sales: [] })} />);
    expect(screen.getByText('Aucune vente en attente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer le paiement' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Voir le détail de la vente' })).toBeDisabled();
  });

  it('does not confuse a loading error with an empty authorized list and supports retry', () => {
    const data = props({ sales: [], loadError: 'Connexion indisponible.' });
    render(<InternationalPaymentFormView {...data} />);
    expect(screen.queryByText('Aucune vente en attente')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(data.onRetry).toHaveBeenCalledOnce();
  });

  it('routes details to the selected sale, not a fixed reference', () => {
    const data = props(); render(<InternationalPaymentFormView {...data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir le détail de la vente' }));
    expect(data.onViewSale).toHaveBeenCalledWith('sale-a');
  });

  it('binds currency choices to authorized active client accounts', () => {
    const data = props(); render(<InternationalPaymentFormView {...data} />);
    const currency = screen.getByLabelText(/Devise payée/);
    expect(within(currency).queryByRole('option', { name: /GBP/ })).not.toBeInTheDocument();
    fireEvent.change(currency, { target: { value: 'EUR' } });
    expect(data.onCustomerBankChange).toHaveBeenCalledWith('client-eur');
  });

  it('removes the proof without submitting the payment', () => {
    const data = props(); render(<InternationalPaymentFormView {...data} />);
    expect(screen.getByText('preuve.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le justificatif' }));
    expect(data.onProofChange).toHaveBeenCalledWith(null);
    expect(data.onSubmit).not.toHaveBeenCalled();
  });

  it('locks details during proof retry but keeps the recovery action available', () => {
    render(<InternationalPaymentFormView {...props({ executionCompleted: true })} />);
    expect(screen.getByLabelText(/Montant payé/)).toBeDisabled();
    expect(screen.getByLabelText(/Compte du client/)).toBeDisabled();
    expect(screen.getByLabelText(/Référence bancaire/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Rattacher la preuve privée et transmettre/ })).toBeEnabled();
    expect(screen.getByText('Versement déjà enregistré')).toBeInTheDocument();
  });

  it('locks every navigation and proof action while submitting', () => {
    render(<InternationalPaymentFormView {...props({ saving: true })} />);
    for (const name of ['Retour', 'Annuler', 'Voir le détail de la vente', 'Retirer le justificatif']) expect(screen.getByRole('button', { name })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Contrôle et dépôt en cours/ })).toBeDisabled();
    expect(screen.getByLabelText(/Preuve bancaire \/ justificatif/)).toBeDisabled();
  });

  it('marks an amount above the available balance at the field', () => {
    const data = props(); data.form.paidAmount = '501'; render(<InternationalPaymentFormView {...data} />);
    expect(screen.getByLabelText(/Montant payé/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Montant supérieur au solde disponible : 500 USD.')).toBeInTheDocument();
  });
});
