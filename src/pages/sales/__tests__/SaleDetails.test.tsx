import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SaleDetails } from '../SaleDetails';

const supabaseMocks = vi.hoisted(() => {
  const singleMock = vi.fn();
  const eqMock = vi.fn(() => ({ single: singleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return { singleMock, eqMock, selectMock, fromMock };
});

const { singleMock } = supabaseMocks;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.fromMock,
  },
}));

vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/Loading', () => ({
  Loading: () => <div>loading...</div>,
}));

describe('SaleDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sale data with fallback status when status is missing', async () => {
    singleMock.mockResolvedValue({
      data: {
        id: '1',
        sale_number: 'SL-0001',
        status: null,
        created_at: '2024-01-01T00:00:00Z',
        quantity_oz: 10,
        london_am_rate: 100,
        freight_cost: 0,
        other_costs: 0,
        gross_proceeds: 1000,
        net_proceeds: 1000,
        royalty_amount: 0,
        final_proceeds: 1000,
        customer: {
          name: null,
          email: null,
          country: null,
          phone: null,
        },
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/sales/1"]}>
        <Routes>
          <Route path="/sales/:id" element={<SaleDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('SL-0001')).toBeInTheDocument();
    });
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('shows error fallback when sale cannot be loaded', async () => {
    singleMock.mockResolvedValue({ data: null, error: null });

    render(
      <MemoryRouter initialEntries={["/sales/1"]}>
        <Routes>
          <Route path="/sales/:id" element={<SaleDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load sale')).toBeInTheDocument();
    });
    expect(screen.getByText('Back to Sales')).toBeInTheDocument();
  });
});
