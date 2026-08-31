import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentCreate } from './PaymentCreate';

const mocks = vi.hoisted(() => ({
  user: null as any,
  search: '',
  navigate: vi.fn(),
  addToast: vi.fn(),
  getSales: vi.fn(),
  getCustomerBanks: vi.fn(),
  getSellerBanks: vi.fn(),
  getCurrentFx: vi.fn(),
  getResumptions: vi.fn(),
  execute: vi.fn(),
  uploadProof: vi.fn(),
  createKey: vi.fn(() => '90000000-0000-4000-8000-000000000001'),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useSearchParams: () => [new URLSearchParams(mocks.search)] }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ addToast: mocks.addToast }) }));
vi.mock('@/services/paymentService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/paymentService')>();
  return {
    ...actual,
    getSalesAwaitingPayment: mocks.getSales,
    getCustomerBanks: mocks.getCustomerBanks,
    getSellerBanks: mocks.getSellerBanks,
    getCurrentFXRate: mocks.getCurrentFx,
    getPaymentProofResumptions: mocks.getResumptions,
    executeInternationalPayment: mocks.execute,
    uploadPaymentProof: mocks.uploadProof,
    createPaymentIdempotencyKey: mocks.createKey,
  };
});

const sale = {
  id: '10000000-0000-4000-8000-000000000001',
  sale_number: 'VENTE-001',
  customer_id: '20000000-0000-4000-8000-000000000001',
  customer_name: 'Client Export',
  quantity_oz: 10,
  sale_date: '2026-08-24',
  mechanism_type: 'spot',
  gross_proceeds: 1_000,
  net_proceeds: 1_000,
  final_proceeds: 1_000,
  currency: 'USD',
  seller_type: 'sonasp',
  seller_id: '30000000-0000-4000-8000-000000000001',
  status: 'waiting_for_payment',
  payment_id: '40000000-0000-4000-8000-000000000001',
  payment_version: 7,
};

const privateProof = () => ({
  success: true,
  data: {
    id: 'a0000000-0000-4000-8000-000000000001',
    payment_id: sale.payment_id,
    sale_id: sale.id,
    customer_id: sale.customer_id,
    file_path: `payment-proofs/${sale.payment_id}/90000000-0000-4000-8000-000000000001.pdf`,
    file_name: 'preuve.pdf',
    file_size: 12,
    mime_type: 'application/pdf',
    sha256: 'a'.repeat(64),
    idempotency_key: '90000000-0000-4000-8000-000000000001',
    uploaded_by: 'finance-executor',
    created_at: '2026-08-25T00:00:00Z',
    replayed: false,
  },
});

describe('PaymentCreate — exécution internationale sécurisée', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = '';
    mocks.user = {
      id: 'finance-executor',
      role: 'management',
      account_type: 'sonasp',
      is_active: true,
      capabilities: ['sonasp.finance.execute'],
    };
    mocks.getSales.mockResolvedValue({ success: true, data: [sale] });
    mocks.getResumptions.mockResolvedValue({ success: true, data: [] });
    mocks.getCustomerBanks.mockResolvedValue({
      success: true,
      data: [{
        id: '50000000-0000-4000-8000-000000000001',
        bank_name: 'Banque client',
        country: 'FR',
        currency: 'USD',
        account_number: 'CLIENT-1',
        is_primary: true,
      }],
    });
    mocks.getSellerBanks.mockResolvedValue({
      success: true,
      data: [{
        id: '60000000-0000-4000-8000-000000000001',
        stakeholder_type: 'sonasp',
        stakeholder_id: sale.seller_id,
        account_name: 'SONASP',
        bank_name: 'Banque SONASP',
        bank_country: 'BF',
        account_currency: 'USD',
        is_primary: true,
      }],
    });
    mocks.getCurrentFx.mockResolvedValue({ success: false });
    mocks.execute.mockResolvedValue({
      payment_id: sale.payment_id,
      sale_id: sale.id,
      payment_status: 'processing',
      sale_status: 'virtual_payment',
      version: 8,
      idempotency_key: '90000000-0000-4000-8000-000000000001',
      replayed: false,
      processed_at: '2026-08-25T00:00:00Z',
    });
    mocks.uploadProof.mockResolvedValue(privateProof());
  });

  it('ne charge aucun dossier sans capability sensible explicite', async () => {
    mocks.user = { ...mocks.user, capabilities: [] };
    render(<PaymentCreate />);

    expect(screen.getByText('Exécution non autorisée')).toBeInTheDocument();
    expect(mocks.getSales).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  async function fillPayment(amount = '250') {
    // The full jsdom suite shares CPU with seven other workers. Keep the
    // readiness assertion, but allow the two asynchronous catalogue reads to
    // settle instead of depending on Testing Library's one-second default.
    await screen.findByRole('option', { name: /Banque client/ }, { timeout: 10_000 });
    fireEvent.change(screen.getByLabelText(/Compte du client/), { target: { value: '50000000-0000-4000-8000-000000000001' } });
    fireEvent.change(screen.getByLabelText(/Compte receveur SONASP/), { target: { value: '60000000-0000-4000-8000-000000000001' } });
    fireEvent.change(screen.getByLabelText(/Montant payé/), { target: { value: amount } });
    fireEvent.change(screen.getByLabelText(/Référence bancaire/), { target: { value: 'BANK-PARTIAL-001' } });
    fireEvent.change(screen.getByLabelText(/Preuve bancaire \/ justificatif/), { target: { files: [new File(['%PDF-1.7\n%%EOF'], 'preuve.pdf', { type: 'application/pdf' })] } });
  }

  it('préremplit depuis la fiche et transmet le statut réel pour un second versement partiel', async () => {
    mocks.search = `saleId=${sale.id}`;
    mocks.getSales.mockResolvedValue({ success: true, data: [{ ...sale, status: 'virtual_payment', remaining_amount: 600, confirmed_amount: 400, processing_amount: 0 }] });
    render(<PaymentCreate />);
    await screen.findByRole('option', { name: /Banque client/ }, { timeout: 10_000 });
    expect(mocks.getSales).toHaveBeenCalledWith(sale.id);
    expect(screen.getByLabelText(/Montant payé/)).toHaveValue(600);
    await fillPayment();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le paiement/ }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ saleId: sale.id, expectedSaleStatus: 'virtual_payment', paidAmount: 250 })));
    expect(mocks.uploadProof).toHaveBeenCalledTimes(1);
  });

  it('refuse un dépassement du solde disponible sans appeler le serveur', async () => {
    mocks.search = `saleId=${sale.id}`;
    mocks.getSales.mockResolvedValue({ success: true, data: [{ ...sale, remaining_amount: 300 }] });
    render(<PaymentCreate />);
    await fillPayment('301');
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le paiement/ }));
    expect(await screen.findByText('Le montant dépasse le solde disponible de cette vente.')).toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('exige une preuve et conserve la saisie au retour de focus', async () => {
    mocks.search = `saleId=${sale.id}`;
    render(<PaymentCreate />);
    await screen.findByRole('option', { name: /Banque client/ });
    fireEvent.change(screen.getByLabelText(/Montant payé/), { target: { value: '250' } });
    fireEvent(window, new Event('focus'));
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByLabelText(/Montant payé/)).toHaveValue(250);
    expect(mocks.getSales).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Enregistrer le paiement/ })).toBeDisabled();
  });

  it('retire puis rattache un justificatif sans créer de paiement prématuré', async () => {
    mocks.search = `saleId=${sale.id}`;
    render(<PaymentCreate />);
    await fillPayment();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le justificatif' }));
    expect(screen.queryByText('preuve.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer le paiement' })).toBeDisabled();
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Preuve bancaire \/ justificatif/), { target: { files: [new File(['%PDF-1.7\n%%EOF'], 'preuve.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByText('preuve.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
  });

  it('affiche une erreur de comptes récupérable et conserve le refus serveur', async () => {
    mocks.search = `saleId=${sale.id}`;
    mocks.getCustomerBanks.mockResolvedValueOnce({ success: false, error: 'Comptes momentanément indisponibles.' });
    render(<PaymentCreate />);
    await screen.findByText('Comptes momentanément indisponibles.');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('option', { name: /Banque client/ });
    expect(mocks.getCustomerBanks).toHaveBeenCalledTimes(2);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('ne réinterprète pas le montant dans une autre devise et ignore un ancien taux', async () => {
    mocks.search = `saleId=${sale.id}`;
    mocks.getCustomerBanks.mockResolvedValue({ success: true, data: [
      { id: 'eur', bank_name: 'Banque EUR', currency: 'EUR' },
      { id: 'usd', bank_name: 'Banque USD', currency: 'USD' },
    ] });
    let resolveEur!: (value: unknown) => void;
    mocks.getCurrentFx.mockImplementation((currency: string) => currency === 'EUR' ? new Promise((resolve) => { resolveEur = resolve; }) : Promise.resolve({ success: false }));
    render(<PaymentCreate />);
    await screen.findByRole('option', { name: /Banque EUR/ });
    fireEvent.change(screen.getByLabelText(/Compte du client/), { target: { value: 'eur' } });
    expect(screen.getByLabelText(/Montant payé/)).toHaveValue(null);
    fireEvent.change(screen.getByLabelText(/Montant payé/), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText(/Compte du client/), { target: { value: 'usd' } });
    expect(screen.getByLabelText(/Montant payé/)).toHaveValue(null);
    resolveEur({ success: true, data: { rate: 1.2, from_currency: 'EUR', to_currency: 'USD', rate_date: '2026-08-30' } });
    await waitFor(() => expect(mocks.getCurrentFx).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('1.200000')).not.toBeInTheDocument();
  });

  it('exécute l’engagement existant avec version et clé de rejeu', async () => {
    render(<PaymentCreate />);

    await screen.findByRole('option', { name: /VENTE-001/ });
    fireEvent.change(screen.getByLabelText(/Vente en attente/), { target: { value: sale.id } });

    await screen.findByRole('option', { name: /Banque client/ });
    fireEvent.change(screen.getByLabelText(/Compte du client/), {
      target: { value: '50000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText(/Compte receveur SONASP/), {
      target: { value: '60000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText(/Référence bancaire/), {
      target: { value: 'BANK-2026-001' },
    });
    const proof = new File(['%PDF-1.7\n%%EOF'], 'preuve.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Preuve bancaire \/ justificatif/), {
      target: { files: [proof] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));

    await waitFor(() => expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      saleId: sale.id,
      expectedSaleStatus: 'waiting_for_payment',
      expectedPaymentVersion: 7,
      paidAmount: 1_000,
      paymentCurrency: 'USD',
      customerBankId: '50000000-0000-4000-8000-000000000001',
      sellerBankId: '60000000-0000-4000-8000-000000000001',
      referenceNumber: 'BANK-2026-001',
      idempotencyKey: '90000000-0000-4000-8000-000000000001',
    })));
    expect(mocks.uploadProof).toHaveBeenCalledWith(
      proof,
      sale.payment_id,
      '90000000-0000-4000-8000-000000000001',
    );
    expect(mocks.navigate).toHaveBeenCalledWith(`/payments/${sale.payment_id}`);
  });

  it('reste fermé après un échec réseau de preuve et rejoue sans réexécuter le paiement', async () => {
    mocks.uploadProof
      .mockResolvedValueOnce({ success: false, error: 'Dépôt temporairement indisponible.' })
      .mockResolvedValueOnce(privateProof());
    render(<PaymentCreate />);

    await screen.findByRole('option', { name: /VENTE-001/ });
    fireEvent.change(screen.getByLabelText(/Vente en attente/), { target: { value: sale.id } });
    await screen.findByRole('option', { name: /Banque client/ });
    fireEvent.change(screen.getByLabelText(/Compte du client/), {
      target: { value: '50000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText(/Compte receveur SONASP/), {
      target: { value: '60000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText(/Référence bancaire/), {
      target: { value: 'BANK-2026-001' },
    });
    fireEvent.change(screen.getByLabelText(/Preuve bancaire \/ justificatif/), {
      target: { files: [new File(['proof'], 'preuve.pdf', { type: 'application/pdf' })] },
    });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le paiement/ }));
    await screen.findByRole('button', { name: /Rattacher la preuve privée/ });
    expect(mocks.navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Rattacher la preuve privée/ }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(`/payments/${sale.payment_id}`));
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.uploadProof).toHaveBeenCalledTimes(2);
  });

  it('retrouve après remount le paiement processing serveur et réutilise la clé déjà commise', async () => {
    mocks.uploadProof
      .mockResolvedValueOnce({ success: false, error: 'Réponse gateway perdue.' })
      .mockResolvedValueOnce(privateProof());
    const firstMount = render(<PaymentCreate />);

    await screen.findByRole('option', { name: /VENTE-001/ });
    fireEvent.change(screen.getByLabelText(/Vente en attente/), { target: { value: sale.id } });
    await screen.findByRole('option', { name: /Banque client/ });
    fireEvent.change(screen.getByLabelText(/Compte du client/), {
      target: { value: '50000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText(/Compte receveur SONASP/), {
      target: { value: '60000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText(/Référence bancaire/), {
      target: { value: 'BANK-2026-001' },
    });
    fireEvent.change(screen.getByLabelText(/Preuve bancaire \/ justificatif/), {
      target: { files: [new File(['proof'], 'preuve.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le paiement/ }));
    await screen.findByRole('button', { name: /Rattacher la preuve privée/ });
    firstMount.unmount();

    const committedProofKey = '90000000-0000-4000-8000-000000000001';
    mocks.getSales.mockResolvedValue({ success: true, data: [] });
    mocks.getResumptions.mockResolvedValue({
      success: true,
      data: [{
        payment_id: sale.payment_id,
        sale_id: sale.id,
        sale_number: sale.sale_number,
        customer_id: sale.customer_id,
        amount: sale.final_proceeds,
        currency: sale.currency,
        payment_version: 8,
        reference_number: 'BANK-2026-001',
        executed_at: '2026-08-25T00:00:00Z',
        proof_path: `payment-proofs/${sale.payment_id}/${committedProofKey}.pdf`,
        proof_idempotency_key: committedProofKey,
        proof_file_name: 'preuve.pdf',
      }],
    });
    render(<PaymentCreate />);

    await screen.findByText('Reprendre un rattachement interrompu');
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre le rattachement' }));
    const replayFile = new File(['proof'], 'preuve.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Preuve bancaire à rattacher/), {
      target: { files: [replayFile] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rattacher la preuve privée' }));

    await waitFor(() => expect(mocks.uploadProof).toHaveBeenLastCalledWith(
      replayFile,
      sale.payment_id,
      committedProofKey,
    ));
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(`/payments/${sale.payment_id}`));
  });
});
