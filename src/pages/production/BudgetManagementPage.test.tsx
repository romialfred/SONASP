import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BudgetManagementPage } from './BudgetManagementPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mine-user',
      role: 'mine',
      mining_company_id: 'mine-1',
    },
  }),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/sn', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

vi.mock('@/components/budget/BudgetMatrixTable', () => ({
  BudgetMatrixTable: ({ mode }: { mode: 'budget' | 'forecast' }) => (
    <div data-testid="budget-matrix">{mode}</div>
  ),
}));

vi.mock('@/services/minePortalService', () => ({
  minePortalService: {
    submitForecast: vi.fn(),
    submitMonthlyBudget: vi.fn(),
  },
}));

vi.mock('@/services/annualBudgetService', () => ({
  annualBudgetService: {
    getMonthlyBudgetWithForecasts: vi.fn().mockResolvedValue({
      budget: null,
      monthlyBudgets: [],
      quarterlyForecasts: [],
    }),
    getMonthlyActualProduction: vi.fn().mockResolvedValue({}),
    getQuarterFromMonth: (month: number) => Math.ceil(month / 3),
    getQuarterMonths: (quarter: number) => [quarter * 3 - 2, quarter * 3 - 1, quarter * 3],
    getMonthName: (month: number) => `Mois ${month}`,
    getRevisionMonth: (quarter: number) => quarter * 3,
    canReviseQuarter: () => true,
  },
}));

vi.mock('@/lib/supabase', () => {
  const result = {
    data: [{ id: 'mine-1', name: 'SOPAMIB', company_type: 'production_mine' }],
    error: null,
  };
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);

  return {
    supabase: {
      from: vi.fn(() => query),
    },
  };
});

vi.mock('@/lib/recharts', () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Wrapper,
    PieChart: Wrapper,
    Pie: Wrapper,
    Cell: Wrapper,
    Legend: Wrapper,
    Tooltip: Wrapper,
    BarChart: Wrapper,
    Bar: Wrapper,
    XAxis: Wrapper,
    YAxis: Wrapper,
  };
});

describe('BudgetManagementPage', () => {
  it('laisse une société minière ouvrir le Forecast sans budget annuel préalable', async () => {
    render(
      <MemoryRouter>
        <BudgetManagementPage />
      </MemoryRouter>,
    );

    const forecast = await screen.findByRole('button', { name: 'Forecast trimestriel' });
    expect(forecast).toBeEnabled();

    fireEvent.click(forecast);

    await waitFor(() => {
      expect(screen.getByTestId('budget-matrix')).toHaveTextContent('forecast');
    });
    expect(screen.queryByText(/Enregistrez d'abord la prévision annuelle/i)).not.toBeInTheDocument();
  });
});
