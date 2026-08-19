import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ARTISANAL_SITES, DEMO_SITE_PRODUCTIONS } from '@/data/artisanalSitesData';
import ArtisanalSitesOverview from './ArtisanalSitesOverview';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  loadSiteData: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/artisanalSiteService', () => ({
  artisanalSiteService: { loadSiteData: mocks.loadSiteData },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Area: () => null,
  Line: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

describe('ArtisanalSitesOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadSiteData.mockResolvedValue({
      sites: DEMO_ARTISANAL_SITES,
      productions: DEMO_SITE_PRODUCTIONS,
    });
  });

  it('affiche les blocs du tableau de bord de pilotage territorial', async () => {
    render(<ArtisanalSitesOverview />);

    expect(
      screen.getByRole('heading', { name: 'Tableau de bord des sites miniers artisanaux' })
    ).toBeInTheDocument();
    expect(screen.getByText('Pilotage territorial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enregistrer un site/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exporter le rapport/ })).toBeInTheDocument();

    ['Sites recensés', 'Artisans autorisés', 'Production déclarée', 'Valeur des transactions', 'Taxes et redevances']
      .forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    expect(screen.getByText('Implantation et performance des sites')).toBeInTheDocument();
    expect(screen.getByText('Sites les plus actifs')).toBeInTheDocument();
    expect(screen.getByText('Vigilance opérationnelle')).toBeInTheDocument();
    expect(screen.getByText('Production mensuelle')).toBeInTheDocument();
    expect(screen.getByText('Répartition des sites')).toBeInTheDocument();
    expect(screen.getByText('Contribution régionale')).toBeInTheDocument();
    expect(screen.getByText('Artisans / Capacité')).toBeInTheDocument();

    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Poura')).toBeInTheDocument());
    expect(screen.getByText('6 sites')).toBeInTheDocument();
  });

  it('filtre le tableau via les onglets de périmètre', async () => {
    render(<ArtisanalSitesOverview />);
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Gorom-Gorom')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Suspendus' }));

    const table = within(screen.getByRole('table'));
    expect(table.getByText('Gorom-Gorom')).toBeInTheDocument();
    expect(table.queryByText('Poura')).not.toBeInTheDocument();
    expect(screen.getByText(/1 – 1 sur 1/)).toBeInTheDocument();
  });

  it('trace la jauge de conformité en demi-cercle (large-arc-flag à 0)', async () => {
    const { container } = render(<ArtisanalSitesOverview />);
    await waitFor(() => expect(container.querySelector('.sites-gauge__svg')).toBeInTheDocument());

    const arcs = [...container.querySelectorAll('.sites-gauge__svg path')].map((path) => path.getAttribute('d') || '');

    expect(arcs.length).toBeGreaterThanOrEqual(2);
    // Un arc complémentaire (flag à 1) réapparaîtrait sous la forme « A 78 78 0 1 1 ».
    arcs.forEach((d) => expect(d).toMatch(/A 78 78 0 0 1/));
    // La piste de fond va de l'extrémité gauche à l'extrémité droite du demi-cercle.
    expect(arcs[0]).toBe('M 32.00 96.00 A 78 78 0 0 1 188.00 96.00');
  });

  it('bascule la carte vers la vue par régions', async () => {
    render(<ArtisanalSitesOverview />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Régions' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Régions' }));

    expect(screen.getByRole('columnheader', { name: 'Part CA' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Carte des régions/ })).not.toBeInTheDocument();
  });
});
