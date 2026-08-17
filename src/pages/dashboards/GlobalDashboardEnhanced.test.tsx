import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalDashboardEnhanced } from './GlobalDashboardEnhanced';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  from: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
}));

function unavailableQuery() {
  const result = Promise.resolve({ data: null, error: { message: 'offline' } });
  const query = {
    select: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.gt.mockReturnValue(result);
  query.order.mockReturnValue(result);
  return query;
}

describe('GlobalDashboardEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(() => unavailableQuery());
  });

  it('renders the complete national dashboard with fallback indicators', async () => {
    render(<GlobalDashboardEnhanced />);

    expect(screen.getByRole('heading', { name: 'Tableau de bord national' })).toBeInTheDocument();
    expect(screen.getByText('Or collecté')).toBeInTheDocument();
    expect(screen.getByText(/1.?244,23 oz/)).toBeInTheDocument();
    expect(screen.getByText(/2,84 Mds FCFA/)).toBeInTheDocument();
    expect(screen.getByText('Évolution des volumes collectés')).toBeInTheDocument();
    expect(screen.getByText('Répartition par origine')).toBeInTheDocument();
    expect(screen.getByText('Dernières transactions')).toBeInTheDocument();
    expect(screen.getByText('Points d’attention')).toBeInTheDocument();

    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(3));
  });

  it('switches chart mode and filters pending transactions', () => {
    render(<GlobalDashboardEnhanced />);

    const valueButton = screen.getByRole('button', { name: 'Valeur' });
    fireEvent.click(valueButton);
    expect(valueButton).toHaveClass('is-active');

    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Transactions à valider uniquement' }));

    expect(screen.queryByText('VTE-2026-0842')).not.toBeInTheDocument();
    expect(screen.getByText('COL-2026-0315')).toBeInTheDocument();
  });
});
