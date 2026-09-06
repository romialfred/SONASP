import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtisanalSiteProduction from './ArtisanalSiteProduction';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  loadSiteData: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ key: 'test' }),
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin', is_active: true } }) }));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/artisanalSiteService', () => ({
  SITE_DATA_CHANGED: 'sonasp:artisanal-site-changed',
  artisanalSiteService: { loadSiteData: mocks.loadSiteData },
  calculateSiteMetrics: () => ({
    activeMinerCount: 0,
    productionKilograms: 0,
    revenueFcfa: 0,
    taxesFcfa: 0,
  }),
  summarizeSiteProduction: () => [],
}));

vi.mock('@/lib/recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('ArtisanalSiteProduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne présente pas des zéros comme des données réelles lorsque le chargement échoue', async () => {
    mocks.loadSiteData.mockRejectedValue(new Error('relation artisanal_sites does not exist'));
    render(<ArtisanalSiteProduction />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Les données de production sont momentanément indisponibles.');
    expect(screen.queryByText('Production cumulée')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument();
  });

  it('permet une reprise explicite sans rafraîchir toute la page', async () => {
    mocks.loadSiteData
      .mockRejectedValueOnce(new Error('indisponible'))
      .mockResolvedValueOnce({ sites: [], productions: [] });
    render(<ArtisanalSiteProduction />);

    fireEvent.click(await screen.findByRole('button', { name: /Réessayer/ }));

    await waitFor(() => expect(mocks.loadSiteData).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('Production cumulée')).toBeInTheDocument();
  });
});
