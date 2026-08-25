import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentCreate } from './PaymentCreate';

const mocks = vi.hoisted(() => ({
  user: null as any,
  navigate: vi.fn(),
  addToast: vi.fn(),
  getSales: vi.fn(),
  getCustomerBanks: vi.fn(),
  getSellerBanks: vi.fn(),
  getCurrentFx: vi.fn(),
  execute: vi.fn(),
  createKey: vi.fn(() => '90000000-0000-4000-8000-000000000001'),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/components/layout/MainLayout', () => ({ MainLayout: ({ children }: any) => <div>{children}</div> }));
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
    executeInternationalPayment: mocks.execute,
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

describe('PaymentCreate — exécution internationale sécurisée', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: 'finance-executor',
      role: 'management',
      account_type: 'sonasp',
      is_active: true,
      capabilities: ['sonasp.finance.execute'],
    };
    mocks.getSales.mockResolvedValue({ success: true, data: [sale] });
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
  });

  it('ne charge aucun dossier sans capability sensible explicite', async () => {
    mocks.user = { ...mocks.user, capabilities: [] };
    render(<PaymentCreate />);

    expect(screen.getByText('Exécution non autorisée')).toBeInTheDocument();
    expect(mocks.getSales).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole('button', { name: 'Exécuter et transmettre au rapprochement' }));

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
    expect(mocks.navigate).toHaveBeenCalledWith(`/payments/${sale.payment_id}`);
  });
});
