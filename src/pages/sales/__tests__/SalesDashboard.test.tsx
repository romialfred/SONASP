import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SalesDashboard } from '../SalesDashboard';

const supabaseMocks = vi.hoisted(() => {
  const orderMock = vi.fn();
  const selectMock = vi.fn(() => ({ order: orderMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return { orderMock, selectMock, fromMock };
});

const { orderMock } = supabaseMocks;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.fromMock,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock('@/components/dashboard/MetricCard', () => ({
  MetricCard: ({ title, value }: { title: string; value: string }) => (
    <div data-testid="metric">{title}:{value}</div>
  ),
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/charts/LineChartWidget', () => ({
  LineChartWidget: () => <div data-testid="chart" />,
}));

vi.mock('@/components/ui/Loading', () => ({
  Loading: () => <div>loading...</div>,
}));

describe('SalesDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes sales data and renders without crashing when status is missing', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'sale-1',
          sale_number: 'SL-0002',
          status: null,
          created_at: '2024-01-01T00:00:00Z',
          quantity_oz: 5,
          final_proceeds: 500,
          customer: { name: null },
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <Routes>
          <Route path="/sales" element={<SalesDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(orderMock).toHaveBeenCalled();
    });
    expect(screen.getAllByText('Pending Approval')[0]).toBeInTheDocument();
    expect(screen.getByText('Unknown Customer')).toBeInTheDocument();
  });
});
