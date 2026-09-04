import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveComplianceSummary, deriveDgmgSummary } from '@/lib/dgmgRegulatoryDashboard';
import type { DgmgRegulatoryDashboardData } from '@/types/dgmgRegulatory';
import { DgmgRegulatoryDashboard } from './DgmgRegulatoryDashboard';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/services/dgmgRegulatoryDashboardService', () => ({
  dgmgRegulatoryDashboardService: { load },
}));

vi.mock('@/lib/recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: ({ name }: { name: string }) => <span>{name}</span>,
  Line: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
}));

function dashboardData(overrides: Partial<DgmgRegulatoryDashboardData> = {}): DgmgRegulatoryDashboardData {
  return {
    hasData: true,
    partial: false,
    unavailableDimensions: [],
    period: { startDate: '2026-01-01', endDate: '2026-09-04' },
    summary: deriveDgmgSummary({
      miningCompaniesTotal: 11, miningCompaniesActive: 10,
      sitesTotal: 42, industrialSitesTotal: 33, artisanalSitesTotal: 9,
      declarationsTotal: 317, onTimeRate: 94,
      productionGrams: 1_817_050, previousProductionGrams: 1_676_240,
      controlsPending: 14, priorityControls: 5,
    }),
    monthly: [{ month: '2026-09', label: 'Sept. 2026', industrialGrams: 1_500_000, artisanalGrams: 317_050 }],
    compliance: deriveComplianceSummary(298, 14, 5),
    activities: [{
      id: 'activity-1', reference: 'DRP-2026-0315', operatorName: 'ESSAKANE SA',
      activity: 'Déclaration de production', zone: 'Sahel', status: 'Conforme',
      statusTone: 'success', occurredAt: '2026-09-04T09:12:00Z',
    }],
    attention: { lateDeclarations: 5, expiringLicenses: 3, productionGaps: 2 },
    filterOptions: {
      companies: [{ value: 'mine-1', label: 'ESSAKANE SA' }],
      regions: [{ value: 'Sahel', label: 'Sahel' }],
      declarationStatuses: [{ value: 'ready_for_customs', label: 'Prête pour contrôle' }],
    },
    ...overrides,
  };
}

describe('tableau de bord réglementaire DGMG', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rend la structure officielle, les données et les filtres réels', async () => {
    load.mockResolvedValue(dashboardData());
    const user = userEvent.setup();
    render(<DgmgRegulatoryDashboard />);

    expect(await screen.findByRole('heading', { name: 'Tableau de bord réglementaire' })).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('317')).toBeInTheDocument();
    expect(screen.getByText('1,82 t')).toBeInTheDocument();
    expect(screen.getByText('ESSAKANE SA')).toBeInTheDocument();
    expect(screen.getByText('94,01 %')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valeur' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Filtres' }));
    expect(screen.getByLabelText('Type de site')).toBeInTheDocument();
    expect(screen.getByLabelText('Société minière')).toHaveTextContent('ESSAKANE SA');
  });

  it('conserve chaque bloc en cas de données partielles sans inventer la conformité', async () => {
    load.mockResolvedValue(dashboardData({
      partial: true,
      unavailableDimensions: ['conformité'],
      compliance: deriveComplianceSummary(null, null, null),
      attention: { lateDeclarations: null, expiringLicenses: 3, productionGaps: null },
    }));
    render(<DgmgRegulatoryDashboard />);

    expect(await screen.findByText(/Données partielles/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conformité des déclarations' })).toBeInTheDocument();
    expect(screen.getAllByText('Aucune donnée disponible pour cette période').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Indisponible').length).toBeGreaterThan(1);
  });

  it('distingue une période vide d’une erreur réseau', async () => {
    load.mockResolvedValue(dashboardData({ hasData: false, monthly: [], activities: [] }));
    const first = render(<DgmgRegulatoryDashboard />);
    expect((await screen.findAllByText('Aucune donnée disponible pour cette période')).length).toBeGreaterThan(1);
    first.unmount();

    load.mockRejectedValue(new Error('Périmètre de supervision DGMG requis.'));
    render(<DgmgRegulatoryDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Périmètre de supervision DGMG requis.');
    expect(screen.getByRole('heading', { name: 'Évolution de la production déclarée' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activités réglementaires récentes' })).toBeInTheDocument();
  });

  it('valide la période et relaie les filtres sans recharger le shell', async () => {
    load.mockResolvedValue(dashboardData());
    const user = userEvent.setup();
    render(<DgmgRegulatoryDashboard />);
    await screen.findByText('ESSAKANE SA');
    await user.click(screen.getByRole('button', { name: 'Filtres' }));
    fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2026-09-05' } });
    fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2026-09-04' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Appliquer les filtres' }).closest('form') as HTMLFormElement);
    expect(screen.getByRole('alert')).toHaveTextContent(/date de fin/i);
    expect(load).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2026-01-01' } });
    await user.selectOptions(screen.getByLabelText('Type de site'), 'industrial');
    await user.selectOptions(screen.getByLabelText('Société minière'), 'mine-1');
    await user.click(screen.getByRole('button', { name: 'Appliquer les filtres' }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load.mock.calls[1][0]).toMatchObject({ siteType: 'industrial', companyId: 'mine-1' });
  });
});
