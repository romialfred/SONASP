import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';
import type { ArtisanMinier } from '@/services/artisanMinierService';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import ArtisanMinierDashboard from './ArtisanMinierDashboard';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAll: vi.fn(),
  getAllCartes: vi.fn(),
  listSites: vi.fn(),
  user: { id: 'user-a', role: 'admin', organization_id: 'org-a' } as Record<string, unknown>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/artisanMinierService', () => ({
  artisanMinierService: { getAll: mocks.getAll },
}));

vi.mock('@/services/carteProfessionnelleService', () => ({
  carteProfessionnelleService: { getAllCartes: mocks.getAllCartes },
}));

vi.mock('@/services/artisanalSiteService', () => ({
  artisanalSiteService: { listSites: mocks.listSites },
}));

vi.mock('@/lib/recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Line: () => null,
  LabelList: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const artisans: ArtisanMinier[] = [
  { id: 'a1', numero_carte: 'CP-1', type_personne: 'physique', type_artisan: 'exploitant', telephone: '+226 70 00 00 01', region: 'Nord', commune: 'Kalsaka', artisanal_site_id: 'site-kalsaka', created_at: '2026-02-10T09:00:00.000Z' },
  { id: 'a2', numero_carte: 'CP-2', type_personne: 'physique', type_artisan: 'collecteur', telephone: '+226 70 00 00 02', region: 'Boucle du Mouhoun', commune: 'Poura', artisanal_site_id: 'site-poura', created_at: '2026-03-12T09:00:00.000Z' },
  { id: 'a3', numero_carte: 'CP-3', type_personne: 'physique', type_artisan: 'exploitant', telephone: '+226 70 00 00 03', region: 'Nord', commune: 'Kalsaka', artisanal_site_id: 'site-kalsaka', created_at: '2026-04-02T09:00:00.000Z' },
];

const cards: CarteProfessionnelle[] = [
  { id: 'c1', artisan_id: 'a1', numero_carte: 'CP-1', statut: 'validee', date_delivrance: '2026-02-20', date_expiration: '2027-02-20' },
  { id: 'c2', artisan_id: 'a2', numero_carte: 'CP-2', statut: 'en_cours', date_delivrance: '2026-03-20', date_expiration: '2027-03-20' },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function expectUnknownMetrics() {
  const metrics = within(screen.getByRole('region', { name: 'Indicateurs des artisans miniers' }));
  expect(metrics.getAllByText('—')).toHaveLength(6);
  expect(metrics.queryByText('0')).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText('Aucun artisan enregistré.')).not.toBeInTheDocument();
}

async function openFilters() {
  await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
  return within(screen.getByRole('dialog', { name: 'Filtres des artisans' }));
}

function registeredCount() {
  return screen.getByRole('heading', { name: 'Artisans enregistrés' }).parentElement?.querySelector('strong')?.textContent;
}

describe('ArtisanMinierDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user = { id: 'user-a', role: 'admin', organization_id: 'org-a' };
    mocks.getAll.mockResolvedValue(artisans);
    mocks.getAllCartes.mockResolvedValue(cards);
    mocks.listSites.mockResolvedValue(DEMO_ARTISANAL_SITES);
  });

  it('affiche les indicateurs et panneaux de la vue territoriale', async () => {
    render(<ArtisanMinierDashboard />);

    expect(screen.getByRole('heading', { name: 'Gestion des Artisans Miniers' })).toBeInTheDocument();
    expect(screen.getByText('Vue territoriale des artisans, régions et sites miniers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouvel artisan/ })).toBeInTheDocument();

    const metrics = within(screen.getByRole('region', { name: 'Indicateurs des artisans miniers' }));
    ['Artisans enregistrés', 'Régions couvertes', 'Sites miniers actifs', 'Cartes valides', 'Dossiers en attente', 'Alertes conformité']
      .forEach((label) => expect(metrics.getByText(label)).toBeInTheDocument());

    expect(await screen.findByText('Répartition territoriale des artisans')).toBeInTheDocument();
    expect(screen.getByText('Classement par région')).toBeInTheDocument();
    expect(screen.getByText('État administratif')).toBeInTheDocument();
    expect(screen.getByText('Évolution des enregistrements')).toBeInTheDocument();

    await waitFor(() => expect(metrics.getByText('2 / 13')).toBeInTheDocument());
    expect(metrics.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('6 sites')).toBeInTheDocument();
  });

  it('affiche le nom du site et les artisans qui lui sont rattachés', async () => {
    render(<ArtisanMinierDashboard />);

    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Site artisanal de Kalsaka')).toBeInTheDocument());

    const row = within(screen.getByRole('table')).getByText('Site artisanal de Kalsaka').closest('tr');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('Yatenga');
    expect(row).toHaveTextContent('Surveillance');
  });

  it('bascule la carte vers la liste des régions', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Liste' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Liste' }));

    expect(screen.getByRole('columnheader', { name: 'Sites actifs' })).toBeInTheDocument();
  });

  it('n’affiche plus de zone de recherche', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument());

    expect(screen.queryByPlaceholderText(/Rechercher/)).not.toBeInTheDocument();
  });

  it('ouvre les filtres dans un volet et le referme à l’application', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument());

    // Les filtres occupaient une bande pleine largeur au-dessus des indicateurs.
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    const volet = screen.getByRole('dialog', { name: 'Filtres des artisans' });
    expect(within(volet).getByLabelText('Région')).toBeInTheDocument();

    fireEvent.click(within(volet).getByRole('button', { name: 'Appliquer' }));
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();
  });

  it('referme le volet au clic hors du panneau, par le bouton et par Échap', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    fireEvent.click(document.querySelector('.artisans-drawer__backdrop') as HTMLElement);
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer les filtres' }));
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Filtres des artisans' })).not.toBeInTheDocument();
  });

  it('compte les filtres appliqués sur le bouton', async () => {
    render(<ArtisanMinierDashboard />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtres/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Filtres/ }));
    const volet = screen.getByRole('dialog', { name: 'Filtres des artisans' });
    fireEvent.change(within(volet).getByLabelText('Type d’artisan'), { target: { value: 'collecteur' } });
    fireEvent.click(within(volet).getByRole('button', { name: 'Appliquer' }));

    expect(screen.getByRole('button', { name: /Filtres/ })).toHaveTextContent('1');
  });

  it.each(['getAll', 'getAllCartes', 'listSites'] as const)('signale le rejet de %s sans faux zéros ni détails techniques', async (source) => {
    mocks[source].mockRejectedValueOnce(new Error('secret SQL request token'));
    render(<ArtisanMinierDashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Les indicateurs sont indisponibles');
    expect(screen.queryByText(/secret SQL/)).not.toBeInTheDocument();
    expectUnknownMetrics();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled();
  });

  it.each(['getAll', 'getAllCartes', 'listSites'] as const)('ne traite pas une réponse absente de %s comme une liste vide', async (source) => {
    mocks[source].mockResolvedValueOnce(null);
    render(<ArtisanMinierDashboard />);
    await screen.findByRole('alert');
    expectUnknownMetrics();
  });

  it('attend les trois lectures avant de calculer les indicateurs', async () => {
    const pendingCards = deferred<CarteProfessionnelle[]>();
    mocks.getAllCartes.mockReturnValueOnce(pendingCards.promise);
    render(<ArtisanMinierDashboard />);
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent('Chargement');
    expectUnknownMetrics();
    await act(async () => pendingCards.resolve(cards));
    expect(registeredCount()).toBe('3');
    expect(screen.queryByText('Chargement des artisans, des cartes et des sites…')).not.toBeInTheDocument();
  });

  it('réessaie toutes les lectures et distingue une réponse réellement vide', async () => {
    mocks.getAll.mockRejectedValueOnce(new Error('network'));
    render(<ArtisanMinierDashboard />);
    await screen.findByRole('alert');
    mocks.getAll.mockResolvedValue([]);
    mocks.getAllCartes.mockResolvedValue([]);
    mocks.listSites.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expectUnknownMetrics();
    expect(await screen.findByText('Aucun artisan enregistré.')).toBeInTheDocument();
    expect(registeredCount()).toBe('0');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    [mocks.getAll, mocks.getAllCartes, mocks.listSites].forEach((mock) => expect(mock).toHaveBeenCalledTimes(2));
  });

  it('conserve un état indisponible si une autre source échoue lors de la reprise', async () => {
    mocks.getAll.mockRejectedValueOnce(new Error('network'));
    render(<ArtisanMinierDashboard />);
    await screen.findByRole('alert');
    mocks.listSites.mockRejectedValueOnce(new Error('sites unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('alert');
    expectUnknownMetrics();
  });

  it('sépare deux sites de même localité et exclut les artisans sans rattachement', async () => {
    const site = DEMO_ARTISANAL_SITES[0];
    mocks.listSites.mockResolvedValue([site, { ...site, id: 'site-b', name: 'Site distinct', province: 'Autre province' }]);
    mocks.getAll.mockResolvedValue([
      { ...artisans[0], commune: 'Autre commune' },
      { ...artisans[2], artisanal_site_id: 'site-b' },
      { ...artisans[0], id: 'a4', artisanal_site_id: null },
    ]);
    render(<ArtisanMinierDashboard />);
    const filters = await openFilters();
    expect(filters.getByRole('option', { name: site.name })).toHaveValue(site.id);
    fireEvent.change(filters.getByLabelText('Site minier'), { target: { value: site.id } });
    fireEvent.click(filters.getByRole('button', { name: 'Appliquer' }));
    expect(registeredCount()).toBe('1');
    const row = within(screen.getByRole('table')).getByText(site.name).closest('tr')!;
    expect(within(row).getAllByRole('cell')[3]).toHaveTextContent(/^1$/);
    expect(within(row).getAllByRole('cell')[4]).toHaveTextContent(/^1$/);
    expect(within(row).getAllByRole('cell')[6]).toHaveTextContent('Actif');
  });

  it('filtre la province par le site enregistré plutôt que par une commune homonyme', async () => {
    const site = DEMO_ARTISANAL_SITES[0];
    mocks.listSites.mockResolvedValue([site, { ...site, id: 'site-b', name: 'Site distinct', province: 'Autre province' }]);
    mocks.getAll.mockResolvedValue([
      { ...artisans[0], commune: 'Autre commune' },
      { ...artisans[2], artisanal_site_id: 'site-b' },
    ]);
    render(<ArtisanMinierDashboard />);
    const filters = await openFilters();
    fireEvent.change(filters.getByLabelText('Province'), { target: { value: site.province } });
    fireEvent.click(filters.getByRole('button', { name: 'Appliquer' }));
    expect(registeredCount()).toBe('1');
    expect(within(screen.getByRole('table')).queryByText('Site distinct')).not.toBeInTheDocument();
  });

  it('conserve le site hérité de l’exploitant lorsque le filtre ne garde que les aides', async () => {
    mocks.getAll.mockResolvedValue([
      artisans[0],
      { ...artisans[2], type_artisan: 'aide_exploitant', exploitant_id: 'a1', artisanal_site_id: null, commune: 'Autre commune' },
    ]);
    render(<ArtisanMinierDashboard />);
    const filters = await openFilters();
    fireEvent.change(filters.getByLabelText('Site minier'), { target: { value: 'site-kalsaka' } });
    fireEvent.change(filters.getByLabelText('Type d’artisan'), { target: { value: 'aide_exploitant' } });
    fireEvent.click(filters.getByRole('button', { name: 'Appliquer' }));
    expect(registeredCount()).toBe('1');
    const row = within(screen.getByRole('table')).getByText('Site artisanal de Kalsaka').closest('tr')!;
    expect(within(row).getAllByRole('cell')[3]).toHaveTextContent(/^1$/);
  });

  it.each(['id', 'organization_id', 'mining_company_id', 'access_role_id', 'role', 'organization_type', 'account_type', 'access_portal_id', 'is_active', 'capabilities', 'module_codes'])(
    'masque immédiatement les données quand le contexte %s change', async (field) => {
      const { rerender } = render(<ArtisanMinierDashboard />);
      await waitFor(() => expect(registeredCount()).toBe('3'));
      const pending = deferred<ArtisanMinier[]>();
      mocks.getAll.mockReturnValueOnce(pending.promise);
      mocks.user = { ...mocks.user, [field]: ['capabilities', 'module_codes'].includes(field) ? ['changed'] : field === 'is_active' ? false : 'changed' };
      rerender(<ArtisanMinierDashboard />);
      expectUnknownMetrics();
      await act(async () => pending.resolve([]));
      expect(registeredCount()).toBe('0');
      expect(mocks.getAll).toHaveBeenCalledTimes(2);
    },
  );

  it('ignore les réponses tardives du contexte précédent', async () => {
    const pendingA = deferred<ArtisanMinier[]>();
    mocks.getAll.mockReturnValueOnce(pendingA.promise);
    const { rerender } = render(<ArtisanMinierDashboard />);
    mocks.user = { ...mocks.user, organization_id: 'org-b' };
    mocks.getAll.mockResolvedValue([]);
    mocks.listSites.mockResolvedValue([]);
    mocks.getAllCartes.mockResolvedValue([]);
    rerender(<ArtisanMinierDashboard />);
    await screen.findByText('Aucun artisan enregistré.');
    await act(async () => pendingA.resolve(artisans));
    expect(registeredCount()).toBe('0');
    expect(screen.queryByText('Site artisanal de Kalsaka')).not.toBeInTheDocument();
  });

  it('réinitialise les filtres de l’ancien contexte sans remonter le cadre de navigation', async () => {
    const { rerender } = render(<ArtisanMinierDashboard />);
    const filters = await openFilters();
    fireEvent.change(filters.getByLabelText('Type d’artisan'), { target: { value: 'collecteur' } });
    fireEvent.click(filters.getByRole('button', { name: 'Appliquer' }));
    expect(registeredCount()).toBe('1');
    mocks.user = { ...mocks.user, organization_id: 'org-b' };
    rerender(<ArtisanMinierDashboard />);
    await waitFor(() => expect(registeredCount()).toBe('3'));
    expect(screen.getByRole('button', { name: /Filtres/ })).toHaveTextContent(/^Filtres$/);
    expect((await openFilters()).getByLabelText('Type d’artisan')).toHaveValue('all');
  });

  it('ignore une ancienne lecture encore en vol après une reprise réussie', async () => {
    const oldCards = deferred<CarteProfessionnelle[]>();
    mocks.getAll.mockRejectedValueOnce(new Error('artisans unavailable'));
    mocks.getAllCartes.mockReturnValueOnce(oldCards.promise);
    render(<ArtisanMinierDashboard />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(registeredCount()).toBe('3'));
    await act(async () => oldCards.reject(new Error('old cards request')));
    expect(registeredCount()).toBe('3');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
