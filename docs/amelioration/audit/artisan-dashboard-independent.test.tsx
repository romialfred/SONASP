import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import { artisansOfSite, siteIdOfArtisan } from '@/services/artisanTerritoryInsights';
import ArtisanMinierDashboard from '@/pages/artisan-minier/ArtisanMinierDashboard';

const mocks = vi.hoisted(() => ({
  artisans: vi.fn(), cards: vi.fn(), sites: vi.fn(), navigate: vi.fn(),
  user: { id: 'audit-user', role: 'management', organization_id: 'audit-org' } as Record<string, unknown>,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a> }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/artisanMinierService', () => ({ artisanMinierService: { getAll: mocks.artisans } }));
vi.mock('@/services/carteProfessionnelleService', () => ({ carteProfessionnelleService: { getAllCartes: mocks.cards } }));
vi.mock('@/services/artisanalSiteService', () => ({ artisanalSiteService: { listSites: mocks.sites } }));
vi.mock('@/components/artisanal-sites/BurkinaTerritoryMap', () => ({ BurkinaTerritoryMap: () => <div data-testid="map-double" /> }));
vi.mock('@/lib/recharts', () => {
  const container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { ResponsiveContainer: container, LineChart: container, PieChart: container, Pie: container,
    Cell: () => null, Line: () => null, LabelList: () => null, CartesianGrid: () => null,
    XAxis: () => null, YAxis: () => null, Tooltip: () => null };
});

const siteA = { ...DEMO_ARTISANAL_SITES[0], id: 'audit-site-a', name: 'Site audit A', locality: 'Commune partagée' };
const siteB = { ...siteA, id: 'audit-site-b', name: 'Site audit B' };
const artisan = (id: string, patch: Partial<ArtisanMinier> = {}): ArtisanMinier => ({
  id, numero_carte: `AUD-${id}`, type_personne: 'physique', type_artisan: 'exploitant',
  telephone: '+226 00 00 00 00', region: siteA.region, commune: 'Commune partagée',
  artisanal_site_id: siteA.id, actif: true, ...patch,
});
const sources = ['artisans', 'cards', 'sites'] as const;
function deferred() {
  let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function registered() {
  return screen.getByRole('heading', { name: 'Artisans enregistrés' }).parentElement?.querySelector('strong')?.textContent;
}
function expectUnavailable() {
  const metrics = within(screen.getByRole('region', { name: 'Indicateurs des artisans miniers' }));
  expect(metrics.getAllByText('—')).toHaveLength(6);
  expect(metrics.queryByText('0')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText('Aucun artisan enregistré.')).not.toBeInTheDocument();
}
function configureNewContext() {
  mocks.artisans.mockResolvedValue([artisan('new-a'), artisan('new-b')]);
  mocks.cards.mockResolvedValue([]); mocks.sites.mockResolvedValue([siteB]);
}

describe('Audit indépendant du tableau de bord Artisan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user = { id: 'audit-user', role: 'management', organization_id: 'audit-org' };
    mocks.artisans.mockResolvedValue([artisan('initial')]);
    mocks.cards.mockResolvedValue([]); mocks.sites.mockResolvedValue([siteA]);
  });

  it.each(sources)('une reprise après échec de %s ignore les anciennes sources encore pendantes', async (failed) => {
    const old = Object.fromEntries(sources.map(source => [source, deferred()])) as Record<typeof sources[number], ReturnType<typeof deferred>>;
    for (const source of sources) mocks[source].mockReturnValueOnce(old[source].promise);
    render(<ArtisanMinierDashboard />);
    await act(async () => old[failed].reject(new Error('audit technical error')));
    await screen.findByRole('alert');
    expectUnavailable();
    configureNewContext();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(registered()).toBe('2'));
    await act(async () => {
      for (const source of sources.filter(source => source !== failed)) {
        old[source].resolve(source === 'sites' ? [siteA] : source === 'artisans' ? [artisan('old')] : []);
      }
    });
    expect(registered()).toBe('2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(siteA.name)).not.toBeInTheDocument();
  });

  it.each(sources)('le rejet tardif de %s ne remplace pas les résultats du nouvel organisme', async (source) => {
    const old = deferred(); mocks[source].mockReturnValueOnce(old.promise);
    const { rerender } = render(<ArtisanMinierDashboard />);
    expectUnavailable();
    mocks.user = { ...mocks.user, organization_id: 'audit-org-b' };
    configureNewContext(); rerender(<ArtisanMinierDashboard />);
    await waitFor(() => expect(registered()).toBe('2'));
    await act(async () => old.reject(new Error('old organization error')));
    expect(registered()).toBe('2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(siteA.name)).not.toBeInTheDocument();
  });

  it.each(['site_ids', 'responsibilities', 'module_domains', 'access_portal_code', 'actor_category_code'])(
    'un changement de %s seul masque les données et ignore l’ancienne réponse', async field => {
      const pendingOld = deferred(); mocks.cards.mockReturnValueOnce(pendingOld.promise);
      const { rerender } = render(<ArtisanMinierDashboard />);
      const pendingNew = deferred(); mocks.cards.mockReturnValueOnce(pendingNew.promise);
      mocks.user = { ...mocks.user, [field]: ['site_ids', 'responsibilities', 'module_domains'].includes(field) ? ['audit-changed'] : 'audit-changed' };
      mocks.artisans.mockResolvedValue([]); mocks.sites.mockResolvedValue([]);
      rerender(<ArtisanMinierDashboard />);
      expectUnavailable();
      await act(async () => pendingOld.resolve([]));
      expectUnavailable();
      await act(async () => pendingNew.resolve([]));
      await screen.findByText('Aucun artisan enregistré.');
      expect(registered()).toBe('0');
      expect(mocks.cards).toHaveBeenCalledTimes(2);
    },
  );

  it('le cumul site/type/statut garde uniquement l’aide du parent explicite, même si le parent est filtré', async () => {
    const parentA = artisan('parent-a');
    const parentB = artisan('parent-b', { artisanal_site_id: siteB.id });
    const aideA = artisan('aide-a', { type_artisan: 'aide_exploitant', exploitant_id: parentA.id, artisanal_site_id: null, commune: 'Autre commune' });
    const aideB = artisan('aide-b', { type_artisan: 'aide_exploitant', exploitant_id: parentB.id, artisanal_site_id: null });
    const orphan = artisan('orphan', { type_artisan: 'aide_exploitant', exploitant_id: 'outside-scope', artisanal_site_id: null });
    mocks.artisans.mockResolvedValue([parentA, parentB, aideA, aideB, orphan]); mocks.sites.mockResolvedValue([siteA, siteB]);
    mocks.cards.mockResolvedValue([aideA, aideB, orphan].map(aide => ({ id: `card-${aide.id}`, artisan_id: aide.id, numero_carte: aide.numero_carte, statut: 'validee', date_delivrance: '2026-01-01' })));
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(registered()).toBe('5'));
    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    const filters = within(screen.getByRole('dialog', { name: 'Filtres des artisans' }));
    fireEvent.change(filters.getByLabelText('Site minier'), { target: { value: siteA.id } });
    fireEvent.change(filters.getByLabelText('Type d’artisan'), { target: { value: 'aide_exploitant' } });
    fireEvent.change(filters.getByLabelText('Statut de la carte'), { target: { value: 'valide' } });
    fireEvent.click(filters.getByRole('button', { name: 'Appliquer' }));
    expect(registered()).toBe('1');
    const row = within(screen.getByRole('table')).getByText(siteA.name).closest('tr')!;
    expect(within(row).getAllByRole('cell')[3]).toHaveTextContent(/^1$/);
    expect(within(row).getAllByRole('cell')[4]).toHaveTextContent(/^1$/);
    expect(screen.queryByText(siteB.name)).not.toBeInTheDocument();
  });

  it('aucun nom/localité ni ancien site propre d’un aide ne supplée son lien parent autoritatif', () => {
    const parent = artisan('parent', { artisanal_site_id: siteB.id });
    const aide = artisan('aide', { type_artisan: 'aide_exploitant', exploitant_id: parent.id, artisanal_site_id: siteA.id });
    const unrelated = artisan('unrelated', { artisanal_site_id: null });
    const index = new Map([parent, aide, unrelated].map(record => [record.id, record]));
    expect(siteIdOfArtisan(aide, index)).toBe(siteB.id);
    expect(artisansOfSite(siteA, [aide, unrelated], index)).toEqual([]);
    expect(artisansOfSite(siteB, [aide, unrelated], index).map(record => record.id)).toEqual([aide.id]);
    expect(siteIdOfArtisan(aide, new Map())).toBeNull();
  });
});
