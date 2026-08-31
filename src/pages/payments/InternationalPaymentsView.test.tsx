import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { InternationalPaymentsView, type InternationalPaymentsViewProps } from './InternationalPaymentsView';
import { internationalPaymentFixture as fixture } from './internationalPayments.fixture';

function setup(props: Partial<InternationalPaymentsViewProps> = {}) {
  const defaults = { payments: [fixture(), fixture({ id: 'p2', invoice_number: 'FACT-2', status: 'approved', is_virtual: false, actual_date: '2026-08-20', amount: 800 })], today: '2026-08-30', canCreate: true, onRefresh: vi.fn(), onOpenPayment: vi.fn(), onOpenSale: vi.fn(), onCreate: vi.fn() };
  render(<MemoryRouter><InternationalPaymentsView {...defaults} {...props} /></MemoryRouter>);
  return defaults;
}
describe('Payment register interactions', () => {
  it('shows an overdue pending installment but never a red overdue label on a paid one', () => {
    setup();
    const pending = within(screen.getByText('FA-2026-001').closest('tr')!);
    expect(pending.getByText('de retard')).toBeInTheDocument();
    const paid = within(screen.getByText('FACT-2').closest('tr')!);
    expect(paid.getByText('Encaissé')).toBeInTheDocument();
    expect(paid.queryByText(/retard/)).not.toBeInTheDocument();
  });
  it('combines status and search, then resets to all rows', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: 'paid' } });
    expect(screen.queryByText('FA-2026-001')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher un paiement'), { target: { value: 'not found' } });
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(screen.getByText('FA-2026-001')).toBeInTheDocument();
  });
  it('exposes combinable customer, bank, method and currency filters', () => {
    setup({ payments: [fixture(), fixture({ id: 'eur', invoice_number: 'FACT-EUR', currency: 'EUR' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Filtres avancés' }));
    fireEvent.change(screen.getByLabelText('Devise'), { target: { value: 'EUR' } });
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    expect(screen.queryByText('FA-2026-001')).not.toBeInTheDocument();
    expect(screen.getByText('FACT-EUR')).toBeInTheDocument();
    expect(screen.getByLabelText('Banque')).toBeInTheDocument();
    expect(screen.getByLabelText('Mode de paiement')).toBeInTheDocument();
  });
  it('groups by client and status and keeps group headings distinct from data rows', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Regrouper les paiements par'), { target: { value: 'client' } });
    expect(screen.getByRole('rowheader', { name: /Client Export/ })).toHaveTextContent('2 règlement(s) au total');
    fireEvent.change(screen.getByLabelText('Regrouper les paiements par'), { target: { value: 'status' } });
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  });
  it('paginates after filtering and returns to page one when filters change', () => {
    setup({ payments: Array.from({ length: 26 }, (_, i) => fixture({ id: `p-${i}`, invoice_number: `INV-${i}` })) });
    expect(screen.getByText('Affichage de 1 à 10 sur 26 règlements')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(screen.getByText('Affichage de 21 à 26 sur 26 règlements')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher un paiement'), { target: { value: 'INV-25' } });
    expect(screen.getByText('Affichage de 1 à 1 sur 1 règlements')).toBeInTheDocument();
    expect(screen.getByText('INV-25')).toBeInTheDocument();
  });
  it('offers working payment, sale and installment actions in a non-clipped popup', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Actions du paiement FA-2026-001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voir la vente' }));
    expect(props.onOpenSale).toHaveBeenCalledWith('sale-1');
    fireEvent.click(screen.getByRole('button', { name: 'Actions du paiement FA-2026-001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un versement' }));
    expect(props.onCreate).toHaveBeenCalledWith('sale-1');
  });
  it('dismisses row actions with Escape and restores trigger focus', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Actions du paiement FA-2026-001' });
    fireEvent.click(button); fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Voir la vente' })).not.toBeInTheDocument();
  });
  it('does not offer SONASP execution for a mine sale even with the execution capability', () => {
    setup({ payments: [fixture({ sale: { ...fixture().sale!, seller_type: 'mining_company' } })] });
    fireEvent.click(screen.getByRole('button', { name: 'Actions du paiement FA-2026-001' }));
    expect(screen.queryByRole('button', { name: 'Enregistrer un versement' })).not.toBeInTheDocument();
  });
  it('shows invalid date ranges explicitly without invented matching rows', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Échéance à partir du'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Échéance jusqu’au'), { target: { value: '2026-08-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('date de début');
    expect(screen.queryByText('FA-2026-001')).not.toBeInTheDocument();
  });
});
