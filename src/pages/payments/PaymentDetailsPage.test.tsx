import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentDetailFixture } from './internationalPaymentDetail.fixture';
const mock = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn(), id: 'payment-a', user: { id: 'owner', role: 'owner', is_active: true, capabilities: [] as string[], module_codes: [] as string[] } }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: mock.id }), Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/internationalPaymentDetailService', async (original) => ({ ...await original<typeof import('@/services/internationalPaymentDetailService')>(), getInternationalPaymentDetail: mock.get, downloadPaymentDocument: mock.download }));
import { PaymentDetailsPage } from './PaymentDetailsPage';

describe('PaymentDetailsPage scope and lifecycle', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.id = 'payment-a'; mock.user = { id: 'owner', role: 'owner', is_active: true, capabilities: [], module_codes: [] }; mock.get.mockResolvedValue(paymentDetailFixture()); });
  it('loads the actual payment and navigates to its associated sale', async () => {
    render(<PaymentDetailsPage />);
    expect(await screen.findByRole('heading', { name: 'Paiement TRF-2026-0609-001' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'SL-2026-004' })[0]).toHaveAttribute('href', '/sales/sale-a');
  });
  it('preserves the active tab and does not reload on focus or equivalent auth refresh', async () => {
    const page = render(<PaymentDetailsPage />); await screen.findByRole('tab', { name: 'Aperçu' });
    fireEvent.click(screen.getByRole('tab', { name: 'Documents 4' }));
    mock.user = { ...mock.user, capabilities: [...mock.user.capabilities] }; page.rerender(<PaymentDetailsPage />);
    fireEvent(window, new Event('focus')); fireEvent(document, new Event('visibilitychange'));
    expect(mock.get).toHaveBeenCalledOnce(); expect(screen.getByRole('tab', { name: 'Documents 4' })).toHaveAttribute('aria-selected', 'true');
  });
  it('keeps the page visible during a manual refresh', async () => {
    render(<PaymentDetailsPage />); await screen.findByRole('tab', { name: 'Aperçu' });
    let resolve: (data: ReturnType<typeof paymentDetailFixture>) => void = () => {};
    mock.get.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole('button', { name: 'Actions' })); fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(screen.getByRole('heading', { name: 'Paiement TRF-2026-0609-001' })).toBeInTheDocument();
    await act(async () => { resolve(paymentDetailFixture()); });
  });
  it('aborts and immediately hides old data after an identity change', async () => {
    const page = render(<PaymentDetailsPage />); await screen.findByRole('tab', { name: 'Aperçu' });
    const signal = mock.get.mock.calls[0][1] as AbortSignal;
    mock.user = { ...mock.user, id: 'other' }; mock.get.mockReturnValue(new Promise(() => {})); page.rerender(<PaymentDetailsPage />);
    expect(signal.aborted).toBe(true); expect(screen.queryByText('Gold Trade Space · Suisse')).not.toBeInTheDocument();
  });
  it('ignores a late result for the old account', async () => {
    let resolve: (data: ReturnType<typeof paymentDetailFixture>) => void = () => {};
    mock.get.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const page = render(<PaymentDetailsPage />); await waitFor(() => expect(mock.get).toHaveBeenCalledOnce());
    mock.user = { ...mock.user, id: 'other' }; mock.get.mockRejectedValue(new Error('hidden')); page.rerender(<PaymentDetailsPage />);
    await screen.findByRole('alert'); await act(async () => { resolve(paymentDetailFixture()); });
    expect(screen.queryByText('Gold Trade Space · Suisse')).not.toBeInTheDocument();
  });
  it('does not query for a disabled account', async () => {
    mock.user.is_active = false; render(<PaymentDetailsPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(mock.get).not.toHaveBeenCalled();
  });
  it('resets the detail when the payment URL changes', async () => {
    const page = render(<PaymentDetailsPage />); await screen.findByRole('tab', { name: 'Aperçu' });
    mock.id = 'other-payment'; mock.get.mockRejectedValue(new Error('hidden')); page.rerender(<PaymentDetailsPage />);
    await screen.findByRole('alert'); expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(mock.get).toHaveBeenLastCalledWith('other-payment', expect.any(AbortSignal));
  });
  it('aborts private downloads when the account is changed', async () => {
    let finishDownload!: () => void;
    mock.download.mockImplementation(() => new Promise<void>((resolve) => { finishDownload = resolve; }));
    const page = render(<PaymentDetailsPage />); await screen.findByRole('tab', { name: 'Aperçu' });
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le justificatif' }));
    await waitFor(() => expect(mock.download).toHaveBeenCalledOnce());
    const signal = mock.download.mock.calls[0][1] as AbortSignal;
    mock.user = { ...mock.user, id: 'other' }; page.rerender(<PaymentDetailsPage />);
    expect(signal.aborted).toBe(true);
    await act(async () => { finishDownload(); });
    await screen.findByRole('tab', { name: 'Aperçu' });
  });
});
