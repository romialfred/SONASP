import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  user: {
    id: 'sonasp-1', role: 'management', is_active: true,
    capabilities: ['sonasp.approve', 'sonasp.finance.execute'],
  },
  getSonaspSalesInbox: vi.fn(),
  getSonaspSaleHistory: vi.fn(),
  transitionSaleToSonasp: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/services/comptoirPortalService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/comptoirPortalService')>();
  return { ...actual, comptoirPortalService: {
    getSonaspSalesInbox: mocks.getSonaspSalesInbox,
    getSonaspSaleHistory: mocks.getSonaspSaleHistory,
    transitionSaleToSonasp: mocks.transitionSaleToSonasp,
  } };
});

import { ComptoirSaleTransitionConflictError } from '@/services/comptoirPortalService';
import SonaspComptoirSalesInboxPage from './SonaspComptoirSalesInboxPage';

const submitted = {
  id: 'sale-1', reference: 'CESS-1', date: '2026-08-24T10:00:00Z',
  comptoirName: 'Comptoir Central', quantityGrams: 12.5, unitPriceFcfa: 40_000,
  totalFcfa: 500_000, status: 'submitted' as const,
};
const accepted = {
  ...submitted, id: 'sale-2', reference: 'CESS-2', status: 'accepted' as const,
};

describe('SonaspComptoirSalesInboxPage', () => {
  beforeEach(() => {
    mocks.user.capabilities = ['sonasp.approve', 'sonasp.finance.execute'];
    mocks.getSonaspSalesInbox.mockReset().mockResolvedValue([submitted, accepted]);
    mocks.getSonaspSaleHistory.mockReset().mockResolvedValue([{
      id: 1, saleId: 'sale-1', action: 'submitted', statusBefore: null, statusAfter: 'submitted',
      actorRole: 'customer', capabilityCode: 'comptoir.manage', reason: 'Cession initiale',
      occurredAt: '2026-08-24T10:00:00Z',
    }]);
    mocks.transitionSaleToSonasp.mockReset().mockResolvedValue(undefined);
  });

  it('expose les décisions selon la capacité, transmet le commentaire et affiche l’historique', async () => {
    const user = userEvent.setup();
    render(<SonaspComptoirSalesInboxPage />);

    expect(await screen.findByRole('button', { name: /Accepter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rejeter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Payer/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Historique \(1\)/i }));
    expect(screen.getByText('Cession initiale')).toBeInTheDocument();
    expect(screen.getByText('Création → Soumis')).toBeInTheDocument();
    expect(screen.getByText(/Client/)).toBeInTheDocument();
    expect(screen.queryByText(/customer|comptoir\.manage/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Accepter/i }));
    await user.type(screen.getByLabelText(/Commentaire/i), 'Contrôle conforme');
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => expect(mocks.transitionSaleToSonasp).toHaveBeenCalledWith(
      'sale-1', 'accepted', 'Contrôle conforme',
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('CESS-1 a été mise à jour');
  });

  it('impose un motif de rejet sans appeler le RPC', async () => {
    const user = userEvent.setup();
    render(<SonaspComptoirSalesInboxPage />);

    await user.click(await screen.findByRole('button', { name: /Rejeter/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('au moins 3 caractères');
    expect(mocks.transitionSaleToSonasp).not.toHaveBeenCalled();
  });

  it('laisse un agent de préparation consulter sans lui exposer les décisions', async () => {
    mocks.user.capabilities = ['sonasp.prepare'];
    render(<SonaspComptoirSalesInboxPage />);

    await screen.findByText('CESS-1');
    expect(screen.queryByRole('button', { name: /Accepter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rejeter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Payer/i })).not.toBeInTheDocument();
  });

  it('signale un conflit de concurrence RPC et recharge la file', async () => {
    const user = userEvent.setup();
    mocks.transitionSaleToSonasp.mockRejectedValueOnce(new ComptoirSaleTransitionConflictError());
    render(<SonaspComptoirSalesInboxPage />);

    await user.click(await screen.findByRole('button', { name: /Accepter/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('déjà changé d’état');
    await waitFor(() => expect(mocks.getSonaspSalesInbox).toHaveBeenCalledTimes(2));
  });
});
