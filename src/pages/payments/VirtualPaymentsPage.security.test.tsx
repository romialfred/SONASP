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
  getProofUrl: vi.fn(),
  createKey: vi.fn(() => '90000000-0000-4000-8000-000000000001'),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/components/layout/MainLayout', () => ({ MainLayout: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useAlert', () => ({ useAlert: () => ({ success: mocks.success, error: mocks.error }) }));
vi.mock('@/services/paymentService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/paymentService')>();
  return {
    ...actual,
    createPaymentIdempotencyKey: mocks.createKey,
    getPaymentProofUrl: mocks.getProofUrl,
  };
});
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
  proof_url: 'payment-proofs/10000000-0000-4000-8000-000000000001/90000000-0000-4000-8000-000000000002.pdf',
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
    mocks.getProofUrl.mockResolvedValue('https://project.supabase.co/storage/v1/object/sign/payment-proofs/proof');
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

  it('génère une URL signée seulement à la demande pour une preuve canonique', async () => {
    mocks.user = { ...mocks.user, id: 'reconciler', capabilities: ['sonasp.finance.reconcile'] };
    render(<VirtualPaymentsPage />);
    await screen.findByText('VENTE-001');

    expect(screen.queryByRole('link', { name: /Ouvrir la preuve signée/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Consulter la preuve/ }));
    const link = await screen.findByRole('link', { name: /Ouvrir la preuve signée/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('/object/sign/payment-proofs/'));
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(mocks.getProofUrl).toHaveBeenCalledWith(processingPayment.proof_url);
  });

  it('approuve par RPC 4H avec version et clé idempotente pour un rapprochateur distinct', async () => {
    mocks.user = { ...mocks.user, id: 'reconciler', capabilities: ['sonasp.finance.reconcile'] };
    mocks.reconcile.mockResolvedValueOnce({
      success: true,
      data: {
        payment_id: processingPayment.id,
        sale_id: processingPayment.sale_id,
        payment_status: 'approved',
        sale_status: 'payment_received',
        version: 5,
        idempotency_key: '90000000-0000-4000-8000-000000000001',
        replayed: false,
        processed_at: '2026-08-25T00:01:00Z',
      },
    });
    render(<VirtualPaymentsPage />);
    await screen.findByText('VENTE-001');

    expect(screen.getByRole('button', { name: /Approuver/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Consulter la preuve/ }));
    await screen.findByRole('link', { name: /Ouvrir la preuve signée/ });
    fireEvent.click(screen.getByRole('button', { name: /Approuver/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /J’atteste avoir consulté/ }));
    fireEvent.change(screen.getByLabelText(/Commentaire de contrôle/), {
      target: { value: 'Référence et montant conformes au relevé bancaire.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’approbation' }));
    await waitFor(() => expect(mocks.reconcile).toHaveBeenCalledWith({
      paymentId: processingPayment.id,
      expectedVersion: 4,
      decision: 'approve',
      reason: 'Référence et montant conformes au relevé bancaire.',
      idempotencyKey: '90000000-0000-4000-8000-000000000001',
    }));
  });

  it('autorise le rejet RPC au rapprochateur AAL2 distinct', async () => {
    mocks.user = { ...mocks.user, id: 'reconciler', capabilities: ['sonasp.finance.reconcile'] };
    render(<VirtualPaymentsPage />);
    await screen.findByText('VENTE-001');

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

  it('reste fermé pour une preuve non canonique, un auto-rapprochement ou un refus 23514', async () => {
    mocks.user = { ...mocks.user, id: 'executor-other', capabilities: ['sonasp.finance.reconcile'] };
    const { rerender } = render(<VirtualPaymentsPage />);
    await screen.findByText('VENTE-001');
    expect(screen.getByRole('button', { name: /Approuver/ })).toBeDisabled();

    mocks.user = { ...mocks.user, id: 'reconciler' };
    mocks.getProcessing.mockResolvedValue({
      success: true,
      data: [{ ...processingPayment, proof_url: 'https://legacy.invalid/proof.pdf' }],
    });
    rerender(<VirtualPaymentsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }));
    await screen.findByText(/référence non canonique/);
    expect(screen.getByRole('button', { name: /Approuver/ })).toBeDisabled();

    mocks.getProcessing.mockResolvedValue({ success: true, data: [processingPayment] });
    mocks.reconcile.mockResolvedValueOnce({ success: false, error: '23514: preuve privée absente' });
    fireEvent.click(screen.getByRole('button', { name: /Actualiser/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Consulter la preuve/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Consulter la preuve/ }));
    await screen.findByRole('link', { name: /Ouvrir la preuve signée/ });
    fireEvent.click(screen.getByRole('button', { name: /Approuver/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /J’atteste avoir consulté/ }));
    fireEvent.change(screen.getByLabelText(/Commentaire de contrôle/), {
      target: { value: 'Preuve contrôlée mais serveur indisponible.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’approbation' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('23514')));
  });
});
