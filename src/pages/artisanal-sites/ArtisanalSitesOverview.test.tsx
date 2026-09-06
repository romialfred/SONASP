import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ARTISANAL_SITES, DEMO_SITE_PRODUCTIONS } from '@/test/fixtures/artisanalSites';
import ArtisanalSitesOverview from './ArtisanalSitesOverview';

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
}));

vi.mock('@/lib/recharts', () => ({
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
    expect(screen.queryByRole('button', { name: /Exporter le rapport/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeInTheDocument();

    ['Sites recensés', 'Artisans autorisés', 'Production déclarée', 'Valeur des transactions', 'Taxes et redevances']
      .forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    expect(screen.getByText('Implantation et performance des sites')).toBeInTheDocument();
    expect(screen.getByText('Sites les plus actifs')).toBeInTheDocument();
    expect(screen.getByText('Vigilance opérationnelle')).toBeInTheDocument();
    expect(screen.getByText('Production mensuelle')).toBeInTheDocument();
    expect(screen.getByText('Répartition des sites')).toBeInTheDocument();
    expect(screen.getByText('Contribution régionale')).toBeInTheDocument();
    expect(screen.getByText('Artisans / Capacité')).toBeInTheDocument();

    await waitFor(() => expect(within(screen.getByRole('table')).getByText(DEMO_ARTISANAL_SITES.find(site => site.locality === 'Poura')!.name)).toBeInTheDocument());
    expect(screen.getByText('6 sites')).toBeInTheDocument();
  });

  it('filtre le tableau via les onglets de périmètre', async () => {
    render(<ArtisanalSitesOverview />);
    await waitFor(() => expect(within(screen.getByRole('table')).getByText(DEMO_ARTISANAL_SITES.find(site => site.locality === 'Gorom-Gorom')!.name)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Suspendus' }));

    const table = within(screen.getByRole('table'));
    expect(table.getByText(DEMO_ARTISANAL_SITES.find(site => site.locality === 'Gorom-Gorom')!.name)).toBeInTheDocument();
    expect(table.queryByText(DEMO_ARTISANAL_SITES.find(site => site.locality === 'Poura')!.name)).not.toBeInTheDocument();
    expect(screen.getByText(/1 – 1 sur 1/)).toBeInTheDocument();
  });

  it('distingue deux sites de la même localité par leur nom et ouvre la bonne fiche', async () => {
    const sites = [
      { ...DEMO_ARTISANAL_SITES[0], id: 'gorom-n1', name: 'Kan-ŋe Gorom N1', locality: 'Gorom-Gorom', region: 'Sahel', code: 'SA-001' },
      { ...DEMO_ARTISANAL_SITES[0], id: 'gorom-n2', name: 'Kan-ŋe Gorom N2', locality: 'Gorom-Gorom', region: 'Sahel', code: 'SA-002' },
    ];
    mocks.loadSiteData.mockResolvedValue({ sites, productions: [] });
    const { container } = render(<ArtisanalSitesOverview />);
    const table = within(screen.getByRole('table'));

    await waitFor(() => expect(table.getByRole('link', { name: sites[0].name })).toBeInTheDocument());
    for (const site of sites) {
      expect(table.getByRole('link', { name: site.name })).toHaveAttribute('href', `/artisan-sites/${site.id}`);
      expect(table.getByText(new RegExp(site.code))).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `${site.name}, ${site.region}` })).toBeInTheDocument();
      expect(within(container.querySelector('.sites-top') as HTMLElement).getByText(site.name)).toBeInTheDocument();
    }
    expect(table.queryByText('Gorom-Gorom')).not.toBeInTheDocument();
    expect(table.getAllByText('Aucune déclaration')).toHaveLength(2);
    expect(table.queryByText('Non démarré')).not.toBeInTheDocument();
  });

  it('filtre les catégories sans assimiler les dossiers historiques aux sites non formalisés', async () => {
    const sites = [
      { ...DEMO_ARTISANAL_SITES[0], id: 'formalise', name: 'Site avec AEA', formalization: 'formalized' as const },
      { ...DEMO_ARTISANAL_SITES[1], id: 'non-formalise', name: 'Site sans AEA', formalization: 'non_formalized' as const },
      { ...DEMO_ARTISANAL_SITES[2], id: 'historique', name: 'Dossier historique', formalization: null },
    ];
    mocks.loadSiteData.mockResolvedValue({ sites, productions: [] });
    render(<ArtisanalSitesOverview />);
    const table = within(screen.getByRole('table'));
    await waitFor(() => expect(table.getByText('Dossier historique')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: /^Formalisés$/ }));
    expect(screen.getByRole('tab', { name: 'Formalisés', selected: true })).toBeInTheDocument();
    expect(table.getByText('Site avec AEA')).toBeInTheDocument();
    expect(table.queryByText('Site sans AEA')).not.toBeInTheDocument();
    expect(table.queryByText('Dossier historique')).not.toBeInTheDocument();
    expect(screen.getByText(/1 – 1 sur 1/)).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('tab', { name: /^Formalisés$/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Non formalisés', selected: true })).toHaveFocus();
    expect(table.getByText('Site sans AEA')).toBeInTheDocument();
    expect(table.queryByText('Site avec AEA')).not.toBeInTheDocument();
    expect(table.queryByText('Dossier historique')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(screen.getByRole('tab', { name: 'Tous', selected: true })).toBeInTheDocument();
    expect(table.getByText('Dossier historique')).toBeInTheDocument();
    expect(screen.getByText(/1 – 3 sur 3/)).toBeInTheDocument();
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
