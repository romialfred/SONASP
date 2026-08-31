import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { InternationalSaleDetailView } from './InternationalSaleDetailView';
import { detailFixture } from './internationalSaleDetail.fixture';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'fr' } }) }));
function show(detail = detailFixture(), canPay = true) {
  return render(<MemoryRouter><InternationalSaleDetailView detail={detail} canPay={canPay} canApprove={false} onDecision={vi.fn()} onDownload={vi.fn()} /></MemoryRouter>);
}
describe('International sale detail', () => {
  it('links the payment form to this sale and distinguishes pending funds', () => {
    show();
    expect(screen.getByRole('link', { name: 'Procéder au paiement' })).toHaveAttribute('href', '/payments/create?saleId=sale-a');
    const financial = within(screen.getByRole('region', { name: 'Aperçu financier' }));
    expect(financial.getByText(/^4.?000,00 USD$/)).toBeInTheDocument();
    expect(financial.getAllByText(/24.?000,00 USD/)).toHaveLength(2);
    expect(screen.getByText('Partiellement payée')).toBeInTheDocument();
  });
  it.each(['create_sales', 'pending_management_approval', 'management_approved', 'pending_for_customer_approval', 'customer_rejected', 'completed'] as const)('does not offer payment for %s', (status) => {
    const data = detailFixture(); data.sale.status = status; show(data);
    expect(screen.queryByRole('link', { name: 'Procéder au paiement' })).not.toBeInTheDocument();
  });
  it('does not infer a sensitive financial permission from read access', () => {
    show(detailFixture(), false);
    expect(screen.queryByRole('link', { name: 'Procéder au paiement' })).not.toBeInTheDocument();
  });
  it('blocks further payment when funds already cover the balance', () => {
    const data = detailFixture(); data.payments[1].amount = 24000; show(data);
    expect(screen.queryByRole('link', { name: 'Procéder au paiement' })).not.toBeInTheDocument();
  });
  it('provides distinct working tabs and links each payment to its detail', () => {
    show();
    fireEvent.click(screen.getByRole('tab', { name: /Paiements/ }));
    expect(screen.getByRole('tab', { name: /Paiements/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'BANK-2026-0001' })).toHaveAttribute('href', '/payments/payment-a');
    fireEvent.click(screen.getByRole('tab', { name: 'Expédition' }));
    expect(screen.getByText('LOT-2026-038')).toBeInTheDocument();
    expect(screen.getByText('ACH-2026-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Historique' }));
    expect(screen.getByRole('region', { name: 'Cycle de vie de la vente' })).toBeInTheDocument();
  });
  it('never invents a zero receipt for an old closed sale', () => {
    const data = detailFixture(); data.sale.status = 'completed'; data.payments = []; show(data);
    expect(screen.getByText('Encaissement à vérifier')).toBeInTheDocument();
    expect(screen.getByText(/Historique d’encaissement à vérifier/)).toBeInTheDocument();
  });
  it('uses the same dated legacy receipt evidence as the list without double counting', () => {
    const data = detailFixture(); data.sale.status = 'completed'; data.payments = [];
    data.sale.payment_amount = 48000; data.sale.payment_received_at = '2026-08-29T10:00:00Z'; show(data);
    expect(screen.getByText('Payée')).toBeInTheDocument();
    expect(screen.queryByText(/Historique d’encaissement à vérifier/)).not.toBeInTheDocument();
  });
  it('does not disguise a rejected sale as a partially paid active sale', () => {
    const data = detailFixture(); data.sale.status = 'customer_rejected'; show(data);
    expect(screen.getByText('Refusée par le client')).toBeInTheDocument();
    expect(screen.queryByText('Partiellement payée')).not.toBeInTheDocument();
  });
  it('moves keyboard focus with the selected tab', () => {
    show();
    const summary = screen.getByRole('tab', { name: 'Résumé' });
    summary.focus(); fireEvent.keyDown(summary, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Expédition' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Historique' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Historique' })).toHaveAttribute('aria-selected', 'true');
  });
});
