import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getSalesToSonasp: vi.fn(),
  getStock: vi.fn(),
  submitSaleToSonasp: vi.fn(),
}));

vi.mock('@/hooks/useComptoirWorkspace', () => ({
  useComptoirWorkspace: () => ({ workspace: { id: 'org-1' }, displayName: 'Comptoir Test' }),
}));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/services/comptoirPortalService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/comptoirPortalService')>();
  return {
    ...actual,
    comptoirPortalService: mocks,
  };
});

import { ComptoirStockConflictError } from '@/services/comptoirPortalService';
import ComptoirSonaspSalesPage from './ComptoirSonaspSalesPage';

const submittedSale = {
  id: 'sale-1', reference: 'CESS-1', date: '2026-08-24', quantityGrams: 80,
  unitPriceFcfa: 40000, totalFcfa: 3_200_000, status: 'submitted' as const,
};
const movements = [
  { id: 'stock-1', date: '2026-08-24', direction: 'in' as const, quantityGrams: 100, type: 'purchase', reference: 'ACH-1' },
];

describe('ComptoirSonaspSalesPage — stock libre', () => {
  beforeEach(() => {
    mocks.getSalesToSonasp.mockReset().mockResolvedValue([submittedSale]);
    mocks.getStock.mockReset().mockResolvedValue(movements);
    mocks.submitSaleToSonasp.mockReset().mockResolvedValue('sale-2');
  });

  it('affiche physique/réservé/libre et refuse une quantité supérieure au libre', async () => {
    const user = userEvent.setup();
    render(<ComptoirSonaspSalesPage />);

    expect(await screen.findByText('Stock physique')).toBeInTheDocument();
    expect(screen.getByText('Stock réservé')).toBeInTheDocument();
    expect(screen.getByText('Stock libre')).toBeInTheDocument();
    expect(screen.getByText('Maximum cessible maintenant').previousElementSibling).toHaveTextContent('20,0 g');

    await user.click(screen.getByRole('button', { name: /Nouvelle cession/i }));
    const quantity = screen.getByLabelText('Quantité (g)');
    expect(quantity).toHaveAttribute('max', '20');
    await user.type(quantity, '21');
    await user.type(screen.getByLabelText('Prix unitaire (FCFA / g)'), '40000');
    fireEvent.submit(quantity.closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Le stock libre est de 20,0 g');
    expect(mocks.submitSaleToSonasp).not.toHaveBeenCalled();
  });

  it('affiche une course RPC sur le stock puis recharge les soldes', async () => {
    const user = userEvent.setup();
    mocks.submitSaleToSonasp.mockRejectedValueOnce(
      new ComptoirStockConflictError('Stock disponible insuffisant : 0 g libres.'),
    );
    render(<ComptoirSonaspSalesPage />);

    await screen.findByText('Stock libre');
    await user.click(screen.getByRole('button', { name: /Nouvelle cession/i }));
    await user.type(screen.getByLabelText('Quantité (g)'), '20');
    await user.type(screen.getByLabelText('Prix unitaire (FCFA / g)'), '40000');
    await user.click(screen.getByRole('button', { name: 'Soumettre' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Stock disponible insuffisant');
    await waitFor(() => expect(mocks.getSalesToSonasp).toHaveBeenCalledTimes(2));
  });
});
