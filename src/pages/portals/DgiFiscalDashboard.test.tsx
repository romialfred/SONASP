import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveFiscalSummary } from '@/lib/dgiFiscalDashboard';
import type { DgiFiscalDashboardData } from '@/types/dgiFiscal';
import { DgiFiscalDashboard } from './DgiFiscalDashboard';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/services/dgiFiscalDashboardService', () => ({
  dgiFiscalDashboardService: { load },
}));

vi.mock('@/lib/recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: ({ name }: { name: string }) => <span>{name}</span>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

function dashboardData(overrides: Partial<DgiFiscalDashboardData> = {}): DgiFiscalDashboardData {
  return {
    hasData: true,
    partial: false,
    period: { startDate: '2026-01-01', endDate: '2026-09-04' },
    summary: deriveFiscalSummary(4_360_000_000, 3_740_000_000, 317, 3_320_000_000),
    monthly: [
      { month: '2026-01', label: 'Janv. 2026', expectedAmount: 550_000_000, collectedAmount: 390_000_000 },
      { month: '2026-02', label: 'Févr. 2026', expectedAmount: 650_000_000, collectedAmount: 410_000_000 },
    ],
    taxBreakdown: [{ code: 'royalties', label: 'Redevances minières', amount: 1_530_000_000, sharePercent: 41 }],
    contributors: [{ id: 'mine-1', name: 'ESSAKANE SA', amount: 1_420_000_000 }],
    priorities: [{ id: 'tax-1', operatorName: 'OREZONE BOMBORE SA', taxNature: 'Redevances minières', amountDue: 220_000_000, dueDate: '2026-09-10', priority: 'high' }],
    counters: { paymentsToReconcile: 31, lateDeclarations: null, assessmentGaps: 2 },
    objectiveRate: null,
    ...overrides,
  };
}

describe('tableau de collecte fiscale DGI', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rend les agrégats réels sans objectif fictif ni compteur indisponible', async () => {
    load.mockResolvedValue(dashboardData());
    render(<DgiFiscalDashboard />);

    expect(await screen.findByRole('heading', { name: 'Collecte des taxes et impôts' })).toBeInTheDocument();
    expect(await screen.findByText('4,36 Md FCFA')).toBeInTheDocument();
    expect(screen.getByText('3,74 Md FCFA')).toBeInTheDocument();
    expect(screen.getByText('620 M FCFA')).toBeInTheDocument();
    expect(screen.getByText('85,78 %')).toBeInTheDocument();
    expect(screen.getByText('ESSAKANE SA')).toBeInTheDocument();
    expect(screen.getByText('OREZONE BOMBORE SA')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.queryByText(/déclaration\(s\) en retard/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Objectif paramétré/)).not.toBeInTheDocument();
  });

  it('présente un véritable état vide au lieu de cartes à zéro', async () => {
    load.mockResolvedValue(dashboardData({ hasData: false, monthly: [], taxBreakdown: [], contributors: [], priorities: [] }));
    render(<DgiFiscalDashboard />);

    expect(await screen.findByRole('heading', { name: 'Aucune donnée fiscale pour cette période' })).toBeInTheDocument();
    expect(screen.getAllByText('Aucune donnée')).toHaveLength(4);
    expect(screen.queryByText('0 FCFA')).not.toBeInTheDocument();
  });

  it('affiche le refus serveur et permet une nouvelle tentative', async () => {
    load.mockRejectedValueOnce(new Error('Périmètre fiscal DGI requis.'))
      .mockResolvedValueOnce(dashboardData());
    const user = userEvent.setup();
    render(<DgiFiscalDashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Périmètre fiscal DGI requis.');
    await user.click(screen.getByRole('button', { name: /Réessayer/ }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('ESSAKANE SA')).toBeInTheDocument();
  });

  it('valide la période avant de relancer la projection', async () => {
    load.mockResolvedValue(dashboardData());
    const user = userEvent.setup();
    render(<DgiFiscalDashboard />);
    await screen.findByText('ESSAKANE SA');
    await user.click(screen.getByRole('button', { name: 'Filtres' }));
    const start = screen.getByLabelText('Date de début');
    const end = screen.getByLabelText('Date de fin');
    fireEvent.change(start, { target: { value: '2026-09-05' } });
    fireEvent.change(end, { target: { value: '2026-09-04' } });
    const submit = screen.getByRole('button', { name: 'Appliquer la période' });
    fireEvent.submit(submit.closest('form') as HTMLFormElement);
    expect(screen.getByRole('alert')).toHaveTextContent(/date de fin/i);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
