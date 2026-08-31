import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsPage } from './PaymentsPage';
import { internationalPaymentFixture as fixture } from './internationalPayments.fixture';
import { CAPABILITIES } from '@/lib/capabilities';

const mock = vi.hoisted(() => ({ navigate: vi.fn(), list: vi.fn(), user: { id: 'owner', role: 'owner', is_active: true, capabilities: [] as string[], module_codes: [] as string[] } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mock.navigate, Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/internationalPaymentsListService', () => ({ listInternationalPayments: mock.list }));

describe('PaymentsPage controller and scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.user = { id: 'owner', role: 'owner', is_active: true, capabilities: [CAPABILITIES.FINANCE_EXECUTE], module_codes: [] };
    mock.list.mockResolvedValue([fixture(), fixture({ id: 'p2', invoice_number: 'FACT-2', status: 'approved', is_virtual: false })]);
  });
  it('renders actual invoices and French currency without replacing source values', async () => {
    render(<PaymentsPage />);
    expect(await screen.findByText('FA-2026-001')).toBeInTheDocument();
    expect(screen.getByText('FACT-2')).toBeInTheDocument();
    expect(screen.getAllByText('1 200,25 USD').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Paiements clients' })).toBeInTheDocument();
  });
  it('opens payment details through a keyboard-accessible action', async () => {
    render(<PaymentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Voir le paiement FA-2026-001' }));
    expect(mock.navigate).toHaveBeenCalledWith('/payments/payment-1');
  });
  it('does not grant sensitive execution from the Owner label alone', async () => {
    mock.user.capabilities = [];
    render(<PaymentsPage />);
    await screen.findByText('FA-2026-001');
    expect(screen.queryByRole('button', { name: 'Enregistrer un paiement' })).not.toBeInTheDocument();
  });
  it('navigates to the existing proof-backed payment form with the authorized capability', async () => {
    render(<PaymentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer un paiement' }));
    expect(mock.navigate).toHaveBeenCalledWith('/payments/create');
  });
  it('preserves rows and filters during a manual refresh and does not fetch on focus', async () => {
    const page = render(<PaymentsPage />);
    await screen.findByText('FA-2026-001');
    fireEvent.change(screen.getByLabelText('Rechercher un paiement'), { target: { value: 'FACT-2' } });
    mock.user = { ...mock.user, capabilities: [...mock.user.capabilities] };
    page.rerender(<PaymentsPage />);
    fireEvent(window, new Event('focus')); fireEvent(document, new Event('visibilitychange'));
    expect(mock.list).toHaveBeenCalledTimes(1);
    let resolve: (value: ReturnType<typeof fixture>[]) => void = () => {};
    mock.list.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(screen.getByText('FACT-2')).toBeInTheDocument();
    expect(screen.queryByText('FA-2026-001')).not.toBeInTheDocument();
    await act(async () => { resolve([fixture(), fixture({ id: 'p2', invoice_number: 'FACT-2' })]); });
    expect(screen.getByLabelText('Rechercher un paiement')).toHaveValue('FACT-2');
  });
  it('aborts and hides the previous account data when the identity changes', async () => {
    const page = render(<PaymentsPage />);
    await screen.findByText('FA-2026-001');
    const signal = mock.list.mock.calls[0][0] as AbortSignal;
    mock.user = { ...mock.user, id: 'other-account' };
    mock.list.mockResolvedValue([]);
    page.rerender(<PaymentsPage />);
    await screen.findByText('Aucun paiement enregistré');
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText('FA-2026-001')).not.toBeInTheDocument();
  });
  it('does not query a deactivated session', async () => {
    mock.user.is_active = false;
    render(<PaymentsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Session indisponible');
    expect(mock.list).not.toHaveBeenCalled();
  });
  it('reports read failures with retry and does not disguise them as an empty register', async () => {
    mock.list.mockRejectedValue(new Error('Lecture refusée'));
    render(<PaymentsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Lecture refusée');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.queryByText('Aucun paiement enregistré')).not.toBeInTheDocument();
    expect(screen.getByText('Registre indisponible')).toBeInTheDocument();
    expect(screen.getAllByText('Données indisponibles')).toHaveLength(4);
  });
  it('does not expose a decorative export control', async () => {
    render(<PaymentsPage />); await screen.findByText('FA-2026-001');
    expect(within(screen.getByRole('region', { name: 'Registre des paiements' })).queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });
  it('ignores a late response from the previous identity', async () => {
    let resolve: (value: ReturnType<typeof fixture>[]) => void = () => {};
    mock.list.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const page = render(<PaymentsPage />);
    await waitFor(() => expect(mock.list).toHaveBeenCalledTimes(1));
    mock.user = { ...mock.user, id: 'new-user' }; mock.list.mockResolvedValue([]);
    page.rerender(<PaymentsPage />);
    await screen.findByText('Aucun paiement enregistré');
    await act(async () => { resolve([fixture()]); });
    expect(screen.queryByText('FA-2026-001')).not.toBeInTheDocument();
  });
});
