import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'owner' } }),
}));
vi.mock('@/services/nationalReserveDashboardService', async () => {
  const actual = await vi.importActual<typeof import('@/services/nationalReserveDashboardService')>(
    '@/services/nationalReserveDashboardService',
  );
  return { ...actual, loadNationalReserveSnapshot: mocks.load };
});

import {
  NationalReserveOverview,
  ReserveAuditPage,
  ReserveControlsPage,
  ReservePhysicalPage,
  ReserveValuationPage,
} from './NationalReserveWorkspace';

const snapshot = {
  allocations: [],
  activeAllocations: [],
  pendingControls: [],
  physicalAssets: [],
  auditEntries: [],
  depositories: [],
  trend: [],
  totalGrossWeightGrams: 0,
  totalFineWeightGrams: 0,
  totalLotCount: 0,
  totalIngotCount: 0,
  weightedFineness: 0,
  indicativeValueFcfa: 0,
  indicativeValueUsd: 0,
  indicativeValueEur: 0,
  latestValuationAt: null,
};

describe('espace Réserve nationale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue(snapshot);
  });

  it.each([
    ['Réserve nationale', NationalReserveOverview],
    ['Réserve physique', ReservePhysicalPage],
    ['Contrôles et rapprochements', ReserveControlsPage],
    ['Valorisation et analyse', ReserveValuationPage],
    ['Rapports et audit', ReserveAuditPage],
  ] as const)('rend la page « %s » avec les données du service', async (heading, Component) => {
    render(<MemoryRouter><Component /></MemoryRouter>);

    await waitFor(() => expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument());
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('n’affiche pas de valeur patrimoniale de démonstration quand la base est vide', async () => {
    render(<MemoryRouter><NationalReserveOverview /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Aucune évolution disponible')).toBeInTheDocument());
    expect(screen.queryByText(/2 476,8/)).not.toBeInTheDocument();
  });
});
