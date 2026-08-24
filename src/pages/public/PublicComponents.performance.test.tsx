import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MinePortalPreview } from './PublicComponents';

vi.mock('@/lib/recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  BarChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('MinePortalPreview - chargement différé des graphiques', () => {
  it('préserve la structure visuelle pendant le chargement puis affiche le graphique', async () => {
    const { container } = render(<MinePortalPreview />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getByText('Flux mensuels')).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('img', {
      name: 'Évolution mensuelle de la production et des expéditions de mars à août',
    })).toBeInTheDocument();
  });
});
