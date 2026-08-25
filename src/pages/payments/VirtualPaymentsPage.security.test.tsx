import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualPaymentsPage } from './VirtualPaymentsPage';

const mocks = vi.hoisted(() => ({
  user: null as any,
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  getVirtual: vi.fn(),
  getProcessing: vi.fn(),
  reconcile: vi.fn(),
  createKey: vi.fn(() => '90000000-0000-4000-8000-000000000001'),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/components/layout/MainLayout', () => ({ MainLayout: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useAlert', () => ({ useAlert: () => ({ success: mocks.success, error: mocks.error }) }));
vi.mock('@/services/paymentService', () => ({ createPaymentIdempotencyKey: mocks.createKey }));
vi.mock('@/services/virtualPaymentService', () => ({
  getVirtualPayments: mocks.getVirtual,
  getProcessingInternationalPayments: mocks.getProcessing,
  reconcileInternationalPayment: mocks.reconcile,
}));

const processingPayment = {
  id: '10000000-0000-4000-8000-000000000001',
  sale_id: '20000000-0000-4000-8000-000000000001',
  customer_id: '30000000-0000-4000-8000-000000000001',
  amount: 10_000,
  currency: 'USD',
  status: 'processing',
  version: 4,
  reference_number: 'BANK-001',
  executed_by: 'executor-other',
  executed_at: '2026-08-25T00:00:00Z',
  proof_url: null,
  sale: {
    id: '20000000-0000-4000-8000-000000000001',
    sale_number: 'VENTE-001',
    status: 'virtual_payment',
    customer: { id: 'customer-1', name: 'Client Export', email: 'client@example.com' },
  },
};

describe('VirtualPaymentsPage — double contrôle 4H', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: 'viewer',
      role: 'management',
      account_type: 'sonasp',
      is_active: true,
      capabilities: [],
    };
    mocks.getVirtual.mockResolvedValue({ success: true, data: [] });
    mocks.getProcessing.mockResolvedValue({ success: true, data: [processingPayment] });
    mocks.reconcile.mockResolvedValue({
      success: true,
      data: {
        payment_id: processingPayment.id,
        sale_id: processingPayment.sale_id,
        payment_status: 'rejected',
        sale_status: 'waiting_for_payment',
        version: 5,
        idempotency_key: '90000000-0000-4000-8000-000000000001',
        replayed: false,
        processed_at: '2026-08-25T00:01:00Z',
      },
    });
  });

  it('reste en lecture seule sans capability sensible et ne propose plus Quick Approve', async () => {
    render(<VirtualPaymentsPage />);
    await screen.findByText('VENTE-001');

    expect(screen.queryByText('Quick Approve')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approuver/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Rejeter/ })).toBeDisabled();
    expect(screen.getByText('Consultation uniquement')).toBeInTheDocument();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('autorise seulement le rejet RPC au rapprochateur AAL2', async () => {
    mocks.user = { ...mocks.user, id: 'reconciler', capabilities: ['sonasp.finance.reconcile'] };
    render(<VirtualPaymentsPage />);
    await screen.findByText('VENTE-001');

    expect(screen.getByRole('button', { name: /Approuver/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Rejeter/ }));
    fireEvent.change(screen.getByLabelText(/Motif du rejet/), {
      target: { value: 'Référence bancaire incohérente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rejet' }));

    await waitFor(() => expect(mocks.reconcile).toHaveBeenCalledWith({
      paymentId: processingPayment.id,
      expectedVersion: 4,
      decision: 'reject',
      reason: 'Référence bancaire incohérente',
      idempotencyKey: '90000000-0000-4000-8000-000000000001',
    }));
  });
});
