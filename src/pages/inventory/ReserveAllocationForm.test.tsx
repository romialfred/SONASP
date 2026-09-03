import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReserveAllocationForm } from './ReserveAllocationForm';

const serviceMocks = vi.hoisted(() => ({
  listEligible: vi.fn(),
  listDepositories: vi.fn(),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/sn', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Note: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title }: { title: string }) => <header><h1>{title}</h1></header>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { full_name: 'Responsable réserve' } }),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('@/services/reserveAllocationService', () => ({
  reserveAllocationService: {
    listEligible: serviceMocks.listEligible,
    listDepositories: serviceMocks.listDepositories,
  },
}));

const renderForm = () => render(
  <MemoryRouter initialEntries={['/national-reserve/allocations/new']}>
    <Routes>
      <Route path="/national-reserve/allocations/new" element={<ReserveAllocationForm />} />
    </Routes>
  </MemoryRouter>,
);

describe('ReserveAllocationForm summary', () => {
  beforeEach(() => {
    serviceMocks.listEligible.mockResolvedValue([]);
    serviceMocks.listDepositories.mockResolvedValue([]);
  });

  it('présente une synthèse progressive et repliable à la première étape', async () => {
    const user = userEvent.setup();
    renderForm();

    const summary = await screen.findByRole('complementary', { name: 'Résumé de l’affectation' });
    expect(within(summary).getByText('Synthèse mise à jour en temps réel')).toBeInTheDocument();
    expect(within(summary).getByText('Sélectionnez un lot éligible pour afficher sa valorisation.')).toBeInTheDocument();
    expect(within(summary).queryByText('Valorisation indicative')).not.toBeInTheDocument();
    expect(within(summary).queryByText('Destination prévue')).not.toBeInTheDocument();

    await user.click(within(summary).getByRole('button', { name: 'Replier le résumé' }));

    expect(within(summary).getByRole('button', { name: 'Déplier le résumé' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(summary).queryByText('Statut actuel')).not.toBeInTheDocument();
  });
});
