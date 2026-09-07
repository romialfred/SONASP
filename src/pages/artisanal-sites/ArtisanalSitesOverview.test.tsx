import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ARTISANAL_SITES, DEMO_SITE_PRODUCTIONS } from '@/test/fixtures/artisanalSites';
import ArtisanalSitesOverview from './ArtisanalSitesOverview';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  loadSiteData: vi.fn(),
  chartData: vi.fn(),
  line: vi.fn(),
  locationKey: 'test',
  user: { id: 'user-a', role: 'admin', is_active: true } as Record<string, unknown> | null,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ key: mocks.locationKey }),
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));

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
  LineChart: ({ children, data }: { children: ReactNode; data: unknown }) => { mocks.chartData(data); return <div>{children}</div>; },
  Area: () => null,
  Line: ({ dataKey }: { dataKey: string }) => { mocks.line(dataKey); return null; },
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

describe('ArtisanalSitesOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadSiteData.mockReset();
    mocks.locationKey = 'test';
    mocks.user = { id: 'user-a', role: 'admin', is_active: true };
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

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

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
    expect(screen.getByRole('button', { name: /Fiches à actualiser/ })).toHaveAccessibleDescription(
      'Fiches dont la dernière mise à jour du dossier remonte à plus de 365 jours.'
    );
    expect(screen.queryByText(/autorisations à renouveler/i)).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Taxes déclarées' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Taxes recouvrées' })).not.toBeInTheDocument();
  });

  it('filtre le tableau via les onglets de périmètre', async () => {
    render(<ArtisanalSitesOverview />);
    await waitFor(() => expect(within(screen.getByRole('table')).getByText(DEMO_ARTISANAL_SITES.find(site => site.locality === 'Gorom-Gorom')!.name)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Suspendus' }));

    const table = within(await screen.findByRole('table'));
    expect(table.getByText(DEMO_ARTISANAL_SITES.find(site => site.locality === 'Gorom-Gorom')!.name)).toBeInTheDocument();
    expect(table.queryByText(DEMO_ARTISANAL_SITES.find(site => site.locality === 'Poura')!.name)).not.toBeInTheDocument();
    expect(screen.getByText(/1 – 1 sur 1/)).toBeInTheDocument();
  });

  it('garde le même champ de recherche, les filtres et la vue au retour d’onglet', async () => {
    render(<ArtisanalSitesOverview />);
    const search = await screen.findByRole('searchbox', { name: 'Rechercher un site' });
    fireEvent.change(search, { target: { value: DEMO_ARTISANAL_SITES[0].name } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Région' }), {
      target: { value: DEMO_ARTISANAL_SITES[0].region },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Régions' }));
    mocks.loadSiteData.mockImplementation(() => new Promise(() => undefined));

    for (let index = 0; index < 3; index += 1) {
      act(() => {
        fireEvent(window, new Event('blur'));
        fireEvent(document, new Event('visibilitychange'));
        fireEvent(window, new Event('focus'));
        fireEvent(window, new Event('pageshow'));
      });
      expect(screen.getByRole('searchbox', { name: 'Rechercher un site' })).toBe(search);
      expect(search).toHaveValue(DEMO_ARTISANAL_SITES[0].name);
      expect(screen.getByRole('combobox', { name: 'Région' })).toHaveValue(DEMO_ARTISANAL_SITES[0].region);
      expect(screen.getByRole('tab', { name: 'Régions', selected: true })).toBeInTheDocument();
      expect(screen.queryByText('Chargement des données des sites…')).not.toBeInTheDocument();
    }
    expect(mocks.loadSiteData).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(mocks.loadSiteData).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Chargement des données des sites…')).toBeInTheDocument();
  });

  it('distingue deux sites de la même localité par leur nom et ouvre la bonne fiche', async () => {
    const sites = [
      { ...DEMO_ARTISANAL_SITES[0], id: 'gorom-n1', name: 'Kan-ŋe Gorom N1', locality: 'Gorom-Gorom', region: 'Sahel', code: 'SA-001' },
      { ...DEMO_ARTISANAL_SITES[0], id: 'gorom-n2', name: 'Kan-ŋe Gorom N2', locality: 'Gorom-Gorom', region: 'Sahel', code: 'SA-002' },
    ];
    mocks.loadSiteData.mockResolvedValue({ sites, productions: [] });
    const { container } = render(<ArtisanalSitesOverview />);
    const table = within(await screen.findByRole('table'));

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
    const table = within(await screen.findByRole('table'));
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

  it('ne présente ni progression annuelle ni objectif de démonstration en l’absence de référence', async () => {
    mocks.loadSiteData.mockResolvedValue({ sites: [DEMO_ARTISANAL_SITES[0]], productions: [] });
    render(<ArtisanalSitesOverview />);
    await waitFor(() => expect(within(screen.getByRole('table')).getByText(DEMO_ARTISANAL_SITES[0].name)).toBeInTheDocument());
    expect(screen.queryByText(/\+8,2|\+4,6|vs année précédente/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Comparaison annuelle : référence non disponible')).toHaveLength(2);
    expect(screen.getByText('Objectif de production : référence non disponible')).toBeInTheDocument();
    expect(screen.getByText('Objectif mensuel : référence non disponible')).toBeInTheDocument();
    expect(mocks.line).not.toHaveBeenCalledWith('objective');
    const points = mocks.chartData.mock.calls.at(-1)?.[0] as { production: number; objective: number | null }[];
    expect(points).toHaveLength(12);
    expect(points.every(point => point.objective === null && point.production === 0)).toBe(true);
  });

  it('préserve les montants chargés sans fabriquer un recouvrement à partir d’un taux de 3 %', async () => {
    mocks.loadSiteData.mockResolvedValue({ sites: [DEMO_ARTISANAL_SITES[0]], productions: [{
      ...DEMO_SITE_PRODUCTIONS[0], siteId: DEMO_ARTISANAL_SITES[0].id, productionDate: `${new Date().getFullYear()}-08-10`,
      goldWeightGrams: 2500, revenueFcfa: 6000, taxesFcfa: 120,
    }] });
    render(<ArtisanalSitesOverview />);
    const taxesTile = (await screen.findByText('Taxes et redevances')).closest('article')!;
    await waitFor(() => expect(within(taxesTile).getByText('120 FCFA')).toBeInTheDocument());
    expect(screen.queryByText(/Taux de recouvrement \d/)).not.toBeInTheDocument();
    expect(within(taxesTile).getByText('Recouvrement : référence non disponible')).toBeInTheDocument();
    const productionTile = screen.getByText('Production déclarée').closest('article')!;
    expect(within(productionTile).getByText('2,5 kg')).toBeInTheDocument();
    expect(mocks.line).toHaveBeenCalledWith('production');
  });

  it.each([
    ['liste vide', []],
    ['sites planifiés', [{ ...DEMO_ARTISANAL_SITES[0], status: 'planned' as const }]],
  ])('présente un indice non évalué sans jauge ni zéro pour une %s', async (_label, sites) => {
    mocks.loadSiteData.mockResolvedValue({ sites, productions: [] });
    const { container } = render(<ArtisanalSitesOverview />);
    await screen.findByRole('table');
    const summary = within(container.querySelector('.sites-gauge') as HTMLElement);
    expect(summary.getByText('Non évalué')).toBeInTheDocument();
    expect(summary.getByText('Aucun site évalué dans le périmètre sélectionné.')).toBeInTheDocument();
    expect(summary.queryByRole('img')).not.toBeInTheDocument();
    expect(summary.queryByText('/ 100')).not.toBeInTheDocument();
    expect(summary.queryByText('0', { exact: true })).not.toBeInTheDocument();
  });

  it('affiche la jauge zéro pour un site réellement évalué à zéro point', async () => {
    mocks.loadSiteData.mockResolvedValue({ sites: [
      { ...DEMO_ARTISANAL_SITES[0], status: 'suspended', authorizedMiners: 1, activeMiners: 2 },
    ], productions: [] });
    const { container } = render(<ArtisanalSitesOverview />);
    await screen.findByRole('table');
    const summary = within(container.querySelector('.sites-gauge') as HTMLElement);
    expect(summary.getByRole('img', { name: 'Indice de conformité 0 sur 100' })).toBeInTheDocument();
    expect(summary.getByText('/ 100')).toBeInTheDocument();
    expect(summary.queryByText('Non évalué')).not.toBeInTheDocument();
  });

  describe('lecture avec le vrai hook useArtisanalSiteData', () => {
    const dataset = (name: string) => ({
      sites: [{ ...DEMO_ARTISANAL_SITES[0], id: name, name, region: `Région ${name}` }],
      productions: [{ ...DEMO_SITE_PRODUCTIONS[0], siteId: name, productionDate: `${new Date().getFullYear()}-08-10`, goldWeightGrams: 2500, revenueFcfa: 9876, taxesFcfa: 120 }],
    });
    type LoadedData = ReturnType<typeof dataset>;
    const deferred = () => {
      let resolve!: (data: LoadedData) => void;
      let reject!: (reason: Error) => void;
      const promise = new Promise<LoadedData>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
      return { promise, resolve, reject };
    };
    const expectDataHidden = (container: HTMLElement) => {
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(container.querySelector('.sites-dashboard__metrics')).not.toBeInTheDocument();
      expect(container.querySelector('.sites-gauge')).not.toBeInTheDocument();
      expect(container.querySelector('.sites-chart')).not.toBeInTheDocument();
      expect(screen.queryByText('Sites les plus actifs')).not.toBeInTheDocument();
      expect(screen.queryByText('Contribution régionale')).not.toBeInTheDocument();
      expect(screen.queryByText(/Aucun site ne correspond/)).not.toBeInTheDocument();
      expect(screen.queryByText('0 FCFA')).not.toBeInTheDocument();
      expect(screen.queryByText('0,0 kg')).not.toBeInTheDocument();
    };
    const expectSite = async (name: string) => {
      await waitFor(() => expect(screen.getByRole('link', { name })).toBeInTheDocument());
    };

    it('masque les indicateurs pendant le chargement initial et après son rejet, puis permet la reprise', async () => {
      const request = deferred();
      mocks.loadSiteData.mockReturnValueOnce(request.promise).mockResolvedValueOnce(dataset('SITE CONFIRMÉ'));
      const { container } = render(<ArtisanalSitesOverview />);
      expect(screen.getByRole('status')).toHaveTextContent('Chargement des données des sites…');
      expect(screen.getByRole('button', { name: 'Actualiser' })).toBeDisabled();
      expectDataHidden(container);
      await act(async () => request.reject(new Error('Erreur réseau privée')));
      expect(screen.getByRole('alert')).toHaveTextContent('Les données des sites sont momentanément indisponibles.');
      expect(screen.queryByText('Erreur réseau privée')).not.toBeInTheDocument();
      expectDataHidden(container);
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
      await expectSite('SITE CONFIRMÉ');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('affiche les vrais zéros et l’absence de sites uniquement après une réponse vide réussie', async () => {
      const request = deferred();
      mocks.loadSiteData.mockReturnValueOnce(request.promise);
      const { container } = render(<ArtisanalSitesOverview />);
      expectDataHidden(container);
      await act(async () => request.resolve({ sites: [], productions: [] }));
      expect(screen.getByText('Aucun site ne correspond aux filtres sélectionnés.')).toBeInTheDocument();
      expect(screen.getByText('0 sites')).toBeInTheDocument();
      const sitesTile = screen.getByText('Sites recensés').closest('article')!;
      expect(within(sitesTile).getByText('0', { exact: true })).toBeInTheDocument();
      expect(screen.getAllByText('0 FCFA').length).toBeGreaterThan(0);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('cache les données précédentes pendant une actualisation échouée et permet de reprendre vers une liste vide', async () => {
      const reread = deferred();
      mocks.loadSiteData.mockResolvedValueOnce(dataset('ANCIEN SITE')).mockReturnValueOnce(reread.promise).mockResolvedValueOnce({ sites: [], productions: [] });
      const { container } = render(<ArtisanalSitesOverview />);
      await expectSite('ANCIEN SITE');
      fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByText('ANCIEN SITE')).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Région ANCIEN SITE' })).not.toBeInTheDocument();
      expectDataHidden(container);
      await act(async () => reread.reject(new Error('Relecture refusée')));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expectDataHidden(container);
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
      await screen.findByText('Aucun site ne correspond aux filtres sélectionnés.');
      expect(screen.queryByText('ANCIEN SITE')).not.toBeInTheDocument();
      expect(mocks.loadSiteData).toHaveBeenCalledTimes(3);
    });

    it.each([
      ['id', 'user-b'], ['organization_id', 'org-b'], ['mining_company_id', 'mine-b'],
      ['access_role_id', 'access-b'], ['role', 'dgmg'], ['organization_type', 'comptoir'],
      ['is_active', false], ['access_portal_id', 'portal-b'], ['access_portal_code', 'portal-code-b'],
      ['actor_category_code', 'category-b'], ['account_type', 'external'], ['capabilities', ['read-b']],
      ['module_codes', ['module-b']], ['site_ids', ['site-b']], ['responsibilities', ['responsibility-b']],
      ['module_domains', ['domain-b']],
    ])('remonte le vrai hook et masque immédiatement l’ancien périmètre quand %s change seul', async (field, value) => {
      const next = deferred();
      mocks.loadSiteData.mockResolvedValueOnce(dataset('PÉRIMÈTRE A')).mockReturnValueOnce(next.promise);
      const { container, rerender } = render(<ArtisanalSitesOverview />);
      await expectSite('PÉRIMÈTRE A');
      mocks.user = { ...mocks.user, [field as string]: value };
      rerender(<ArtisanalSitesOverview />);
      expect(mocks.loadSiteData).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('PÉRIMÈTRE A')).not.toBeInTheDocument();
      expectDataHidden(container);
      await act(async () => next.resolve(dataset('PÉRIMÈTRE B')));
      await expectSite('PÉRIMÈTRE B');
      expect(screen.queryByText('PÉRIMÈTRE A')).not.toBeInTheDocument();
    });

    it('masque également l’ancien dossier lorsque le profil devient absent', async () => {
      mocks.loadSiteData.mockResolvedValueOnce(dataset('ANCIEN COMPTE')).mockReturnValueOnce(deferred().promise);
      const { container, rerender } = render(<ArtisanalSitesOverview />);
      await expectSite('ANCIEN COMPTE');
      mocks.user = null;
      rerender(<ArtisanalSitesOverview />);
      expect(screen.queryByText('ANCIEN COMPTE')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Enregistrer un site/ })).not.toBeInTheDocument();
      expectDataHidden(container);
      expect(mocks.loadSiteData).toHaveBeenCalledTimes(2);
    });

    it.each(['résolution', 'rejet'])('ignore une %s tardive de la relecture du contexte précédent', async completion => {
      const oldRequest = deferred();
      mocks.loadSiteData.mockResolvedValueOnce(dataset('SITE A')).mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce(dataset('SITE B'));
      const { rerender } = render(<ArtisanalSitesOverview />);
      await expectSite('SITE A');
      fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
      mocks.user = { ...mocks.user, organization_id: 'org-b' };
      rerender(<ArtisanalSitesOverview />);
      await expectSite('SITE B');
      await act(async () => {
        if (completion === 'résolution') oldRequest.resolve(dataset('RÉPONSE OBSOLÈTE A'));
        else oldRequest.reject(new Error('Rejet obsolète A'));
      });
      expect(screen.queryByText('SITE A')).not.toBeInTheDocument();
      expect(screen.queryByText('RÉPONSE OBSOLÈTE A')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'SITE B' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it.each(['navigation', 'mutation', 'bouton'])('conserve la relecture par %s et masque les données jusqu’à sa réponse', async trigger => {
      const next = deferred();
      mocks.loadSiteData.mockResolvedValueOnce(dataset('AVANT RELECTURE')).mockReturnValueOnce(next.promise);
      const { container, rerender } = render(<ArtisanalSitesOverview />);
      await expectSite('AVANT RELECTURE');
      if (trigger === 'navigation') { mocks.locationKey = 'return'; rerender(<ArtisanalSitesOverview />); }
      else if (trigger === 'mutation') act(() => window.dispatchEvent(new Event('sonasp:artisanal-site-changed')));
      else fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
      expectDataHidden(container);
      expect(mocks.loadSiteData).toHaveBeenCalledTimes(2);
      await act(async () => next.resolve(dataset('APRÈS RELECTURE')));
      await expectSite('APRÈS RELECTURE');
    });

    it('ignore une réponse tardive après deux relectures du même contexte', async () => {
      const oldRequest = deferred();
      mocks.loadSiteData.mockResolvedValueOnce(dataset('INITIAL')).mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce(dataset('DERNIÈRE LECTURE'));
      render(<ArtisanalSitesOverview />);
      await expectSite('INITIAL');
      fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
      act(() => window.dispatchEvent(new Event('sonasp:artisanal-site-changed')));
      await expectSite('DERNIÈRE LECTURE');
      await act(async () => oldRequest.resolve(dataset('RÉPONSE OBSOLÈTE')));
      expect(screen.queryByText('RÉPONSE OBSOLÈTE')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'DERNIÈRE LECTURE' })).toBeInTheDocument();
    });

    it('réinitialise recherche, catégorie, onglet, pagination et panneau de dates au changement de contexte', async () => {
      const sites = Array.from({ length: 12 }, (_, index) => ({ ...DEMO_ARTISANAL_SITES[0], id: `a-${index}`, name: `Ancien ${index}`, formalization: 'formalized' as const }));
      mocks.loadSiteData.mockResolvedValueOnce({ sites, productions: [] }).mockResolvedValueOnce(dataset('NOUVEAU CONTEXTE'));
      const { rerender } = render(<ArtisanalSitesOverview />);
      await expectSite('Ancien 0');
      fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un site' }), { target: { value: 'Ancien' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Catégorie du site' }), { target: { value: 'formalized' } });
      fireEvent.click(screen.getByRole('tab', { name: 'Formalisés' }));
      fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
      expect(screen.getByText('11 – 12 sur 12')).toBeInTheDocument();
      const dateButton = screen.getByRole('button', { expanded: false });
      fireEvent.click(dateButton);
      expect(screen.getByLabelText('Du')).toBeInTheDocument();
      mocks.user = { ...mocks.user, organization_id: 'org-b' };
      rerender(<ArtisanalSitesOverview />);
      await expectSite('NOUVEAU CONTEXTE');
      expect(screen.getByRole('searchbox', { name: 'Rechercher un site' })).toHaveValue('');
      expect(screen.getByRole('combobox', { name: 'Catégorie du site' })).toHaveValue('all');
      expect(screen.getByRole('tab', { name: 'Tous', selected: true })).toBeInTheDocument();
      expect(screen.getByText('1 – 1 sur 1')).toBeInTheDocument();
      expect(screen.queryByLabelText('Du')).not.toBeInTheDocument();
    });

    it('ne recharge pas pour un simple réordonnancement des listes de portée', async () => {
      const fields = ['capabilities', 'module_codes', 'site_ids', 'responsibilities', 'module_domains'];
      mocks.user = { ...mocks.user, ...Object.fromEntries(fields.map(field => [field, ['a', 'b']])) };
      mocks.loadSiteData.mockResolvedValue(dataset('PÉRIMÈTRE STABLE'));
      const { rerender } = render(<ArtisanalSitesOverview />);
      await expectSite('PÉRIMÈTRE STABLE');
      mocks.user = { ...mocks.user, ...Object.fromEntries(fields.map(field => [field, ['b', 'a']])) };
      rerender(<ArtisanalSitesOverview />);
      expect(mocks.loadSiteData).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('link', { name: 'PÉRIMÈTRE STABLE' })).toBeInTheDocument();
    });
  });
});
