import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/types/auth';
import { detailFixture } from './internationalSaleDetail.fixture';
import type { InternationalSaleDetail } from '@/services/internationalSaleDetailService';
const mock = vi.hoisted(() => ({ load: vi.fn(), user: null as UserProfile | null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.user }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'fr' } }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/services/internationalSaleDetailService', () => ({ getInternationalSaleDetail: mock.load }));
vi.mock('./InternationalSaleDetailView', () => ({ InternationalSaleDetailView: ({ detail, canPay }: { detail: InternationalSaleDetail; canPay: boolean }) => <div>{detail.sale.sale_number}<span>{canPay ? 'pay-authorized' : 'pay-denied'}</span></div> }));
import { SaleDetails } from './SaleDetails';

describe('SaleDetails — stable scope lifecycle', () => {
  const owner = { id: 'owner-a', role: 'owner', is_active: true, capabilities: [], module_codes: ['sales'] } as unknown as UserProfile;
  const page = <MemoryRouter initialEntries={['/sales/sale-a']}><Routes><Route path="/sales/:id" element={<SaleDetails />} /></Routes></MemoryRouter>;
  beforeEach(() => { vi.clearAllMocks(); mock.user = owner; mock.load.mockResolvedValue(detailFixture()); });
  it('does not refresh on focus, visibility or an equivalent refreshed profile', async () => {
    const view = render(page); await screen.findByText('VE-2026-00038');
    fireEvent(window, new Event('focus')); fireEvent(document, new Event('visibilitychange'));
    mock.user = { ...owner, capabilities: [], module_codes: ['sales'] }; view.rerender(page);
    expect(mock.load).toHaveBeenCalledTimes(1);
    expect(screen.getByText('VE-2026-00038')).toBeInTheDocument();
    expect(screen.getByText('pay-denied')).toBeInTheDocument();
  });
  it('clears the old tenant immediately and ignores its late response', async () => {
    let resolveOld!: (data: InternationalSaleDetail) => void;
    mock.load.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(page);
    const oldSignal = mock.load.mock.calls[0][1] as AbortSignal;
    mock.user = { ...owner, id: 'mine-b', role: 'mine', mining_company_id: 'mine-b' };
    mock.load.mockResolvedValueOnce({ ...detailFixture(), sale: { ...detailFixture().sale, sale_number: 'MINE-B' } });
    view.rerender(<MemoryRouter initialEntries={['/sales/sale-a']}><Routes><Route path="/sales/:id" element={<SaleDetails />} /></Routes></MemoryRouter>);
    expect(oldSignal.aborted).toBe(true);
    await screen.findByText('MINE-B');
    await act(async () => { resolveOld(detailFixture()); });
    expect(screen.queryByText('VE-2026-00038')).not.toBeInTheDocument();
  });
  it('shows a recoverable failure instead of an empty screen', async () => {
    mock.load.mockRejectedValueOnce(new Error('offline'));
    render(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    await screen.findByText('VE-2026-00038');
    await waitFor(() => expect(mock.load).toHaveBeenCalledTimes(2));
  });
});
