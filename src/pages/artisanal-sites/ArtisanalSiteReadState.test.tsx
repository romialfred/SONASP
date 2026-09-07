import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/types/auth';
import type { ArtisanalSite, SiteProduction } from '@/types/artisanalSite';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';
import ArtisanalSiteProduction from './ArtisanalSiteProduction';
import ArtisanalSiteDetails from './ArtisanalSiteDetails';

const mocks = vi.hoisted(() => ({
  load: vi.fn(), document: vi.fn(), photo: vi.fn(),
  user: {} as UserProfile, locationKey: 'initial', siteId: 'site-a',
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ siteId: mocks.siteId }),
  useLocation: () => ({ key: mocks.locationKey, state: null }),
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => <a href={to} {...rest}>{children}</a>,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/services/artisanalSiteService', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/artisanalSiteService')>(),
  artisanalSiteService: { loadSiteData: mocks.load },
}));
vi.mock('@/services/siteAeaDocumentService', () => ({ siteAeaDocumentService: { url: mocks.document } }));
vi.mock('@/services/sitePhotoService', () => ({ resolvePhotoUrl: mocks.photo }));
vi.mock('@/lib/recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="production-chart">{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null, CartesianGrid: () => null, Legend: () => null,
  Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

type SiteData = { sites: ArtisanalSite[]; productions: SiteProduction[] };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const fixture = (name = 'Site A confidentiel'): SiteData => ({
  sites: [{ ...DEMO_ARTISANAL_SITES[0], id: 'site-a', name, photos: [], formalization: 'non_formalized' }],
  productions: [{ id: 'sale-a', siteId: 'site-a', productionDate: '2026-09-06', goldWeightGrams: 2500,
    revenueFcfa: 450000, taxesFcfa: 15000, artisanCount: 3, createdAt: '2026-09-06T12:00:00Z' }],
});
const refreshEvent = () => fireEvent(window, new Event('sonasp:artisanal-site-changed'));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: 'user-a', role: 'admin', organization_id: 'org-a', is_active: true } as UserProfile;
  mocks.locationKey = 'initial'; mocks.siteId = 'site-a';
  mocks.load.mockResolvedValue(fixture());
  mocks.document.mockResolvedValue('https://documents.invalid/current.pdf');
  mocks.photo.mockResolvedValue('https://photos.invalid/current.jpg');
});

describe('Production : vrai hook, disponibilité et périmètre', () => {
  it('ne rend aucun chiffre, tableau, classement ou graphique pendant la lecture initiale', () => {
    mocks.load.mockReturnValue(deferred<SiteData>().promise);
    render(<ArtisanalSiteProduction />);
    expect(screen.queryByRole('region', { name: 'Indicateurs de production' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement des productions');
    expect(screen.queryByTestId('production-chart')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Classement des sites')).not.toBeInTheDocument();
  });

  it('masque le dernier résultat pendant un refresh, puis distingue son échec du vrai vide après reprise', async () => {
    const next = deferred<SiteData>();
    mocks.load.mockResolvedValueOnce(fixture()).mockReturnValueOnce(next.promise)
      .mockResolvedValueOnce({ sites: [], productions: [] });
    render(<ArtisanalSiteProduction />);
    expect((await screen.findAllByText('Site A confidentiel')).length).toBeGreaterThan(0);
    fireEvent(window, new Event('focus'));
    expect(screen.queryAllByText('Site A confidentiel')).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Indicateurs de production' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await act(async () => next.reject(new Error('SQL détail confidentiel')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Les données de production sont momentanément indisponibles.');
    expect(screen.queryByText('Aucun site référencé.')).not.toBeInTheDocument();
    expect(screen.queryByText('SQL détail confidentiel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Aucun site référencé.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Indicateurs de production' })).toBeVisible();
    expect(mocks.load).toHaveBeenCalledTimes(3);
  });

  const changes: [string, Record<string, unknown>][] = [
    ['utilisateur', { id: 'user-b' }], ['organisation', { organization_id: 'org-b' }],
    ['société', { mining_company_id: 'mine-b' }], ['rôle d’accès', { access_role_id: 'role-b' }],
    ['rôle', { role: 'management' }], ['type organisme', { organization_type: 'comptoir' }],
    ['activité', { is_active: false }], ['portail', { access_portal_id: 'portal-b' }],
    ['code portail', { access_portal_code: 'portal-b' }], ['catégorie', { actor_category_code: 'collector' }],
    ['type compte', { account_type: 'delegated' }], ['capacités', { capabilities: ['site.read'] }],
    ['modules', { module_codes: ['sites'] }], ['sites affectés', { site_ids: ['site-b'] }],
    ['responsabilités', { responsibilities: ['territorial'] }], ['domaines', { module_domains: ['artisanat'] }],
  ];
  it.each(changes)('efface les données immédiatement et recharge après changement de %s', async (_label, change) => {
    const next = deferred<SiteData>();
    mocks.load.mockResolvedValueOnce(fixture()).mockReturnValueOnce(next.promise);
    const view = render(<ArtisanalSiteProduction />);
    expect((await screen.findAllByText('Site A confidentiel')).length).toBeGreaterThan(0);
    mocks.user = { ...mocks.user, ...change };
    view.rerender(<ArtisanalSiteProduction />);
    expect(screen.queryAllByText('Site A confidentiel')).toHaveLength(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mocks.load).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve(fixture('Site B autorisé')));
    expect((await screen.findAllByText('Site B autorisé')).length).toBeGreaterThan(0);
  });

  it('ne recharge pas lorsque seul l’ordre des capacités change', async () => {
    mocks.user = { ...mocks.user, capabilities: ['sonasp.prepare', 'sonasp.approve'] };
    const view = render(<ArtisanalSiteProduction />);
    await screen.findAllByText('Site A confidentiel');
    mocks.user = { ...mocks.user, capabilities: ['sonasp.approve', 'sonasp.prepare'] };
    view.rerender(<ArtisanalSiteProduction />);
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it.each(['réponse', 'rejet'])('ignore une ancienne %s après le changement de périmètre', async mode => {
    const old = deferred<SiteData>();
    mocks.load.mockReturnValueOnce(old.promise).mockResolvedValueOnce(fixture('Site B autorisé'));
    const view = render(<ArtisanalSiteProduction />);
    mocks.user = { ...mocks.user, organization_id: 'org-b' };
    view.rerender(<ArtisanalSiteProduction />);
    await screen.findAllByText('Site B autorisé');
    await act(async () => mode === 'réponse' ? old.resolve(fixture()) : old.reject(new Error('ancien périmètre')));
    expect(screen.queryAllByText('Site A confidentiel')).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByText('Site B autorisé').length).toBeGreaterThan(0);
  });
});

describe('Détails : vrai hook et relecture obligatoire', () => {
  it('distingue attente, erreur initiale et vrai introuvable après reprise', async () => {
    const first = deferred<SiteData>();
    mocks.load.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ sites: [], productions: [] });
    render(<ArtisanalSiteDetails />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement de la fiche');
    expect(screen.queryByText(/introuvable/)).not.toBeInTheDocument();
    await act(async () => first.reject(new Error('erreur privée')));
    expect(screen.getByRole('alert')).toHaveTextContent('Les données des sites sont momentanément indisponibles.');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Ce site est introuvable ou inaccessible.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Modifier la fiche' })).not.toBeInTheDocument();
  });

  it('retire données, photos, document et modification dès le refresh puis permet de tout retrouver après reprise', async () => {
    const data = fixture();
    data.sites[0] = { ...data.sites[0], formalization: 'formalized', photos: ['sites/photo.jpg'],
      aea: { number: 'AEA-TEST', issuedOn: '2026-01-01', durationMonths: 24, documentPath: 'site-a/aea.pdf', documentName: 'AEA test' } };
    const next = deferred<SiteData>();
    mocks.load.mockResolvedValueOnce(data).mockReturnValueOnce(next.promise).mockResolvedValueOnce(data);
    render(<ArtisanalSiteDetails />);
    expect(await screen.findByRole('heading', { name: 'Site A confidentiel' })).toBeVisible();
    expect(await screen.findByRole('img')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'AEA et documents' }));
    expect(await screen.findByRole('link', { name: 'Consulter' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(screen.queryByRole('heading', { name: 'Site A confidentiel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Modifier la fiche' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Consulter', hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    await act(async () => next.reject(new Error('serveur privé')));
    expect(screen.getByRole('alert')).toHaveTextContent('Les données des sites sont momentanément indisponibles.');
    expect(screen.queryByRole('link', { name: 'Modifier la fiche' })).not.toBeInTheDocument();
    expect(screen.queryByText(/introuvable/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { name: 'Site A confidentiel' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Modifier la fiche' })).toHaveAttribute('href', '/artisan-sites/site-a/modifier');
    expect(await screen.findByRole('link', { name: 'Consulter' })).toBeVisible();
    expect(mocks.document).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('tab', { name: 'Vue d’ensemble' }));
    expect(await screen.findByRole('img')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Conformité' }));
    expect(screen.getByRole('tabpanel', { name: 'Conformité' })).toBeVisible();
  });

  it('ignore une URL AEA tardive issue de la fiche invalidée', async () => {
    const oldDocument = deferred<string>();
    const data = fixture();
    data.sites[0].formalization = 'formalized';
    data.sites[0].aea = { number: 'AEA-A', issuedOn: '2026-01-01', durationMonths: 24, documentPath: 'old.pdf', documentName: 'Ancien document' };
    mocks.document.mockReturnValueOnce(oldDocument.promise).mockResolvedValueOnce('https://documents.invalid/new.pdf');
    mocks.load.mockResolvedValueOnce(data).mockRejectedValueOnce(new Error('refresh refusé'));
    render(<ArtisanalSiteDetails />);
    await screen.findByRole('heading', { name: 'Site A confidentiel' });
    refreshEvent();
    await screen.findByRole('alert');
    await act(async () => oldDocument.resolve('https://documents.invalid/old.pdf'));
    expect(screen.queryByRole('link', { name: 'Consulter', hidden: true })).not.toBeInTheDocument();
    mocks.load.mockResolvedValue({ ...data, sites: [{ ...data.sites[0], aea: { ...data.sites[0].aea!, documentPath: 'new.pdf' } }] });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('heading', { name: 'Site A confidentiel' });
    fireEvent.click(screen.getByRole('tab', { name: 'AEA et documents' }));
    expect(await screen.findByRole('link', { name: 'Consulter' })).toHaveAttribute('href', 'https://documents.invalid/new.pdf');
  });

  it('préserve la frontière d’organisation existante et ignore une fiche tardive de l’ancien contexte', async () => {
    const old = deferred<SiteData>();
    mocks.load.mockReturnValueOnce(old.promise).mockResolvedValueOnce(fixture('Site B autorisé'));
    const view = render(<ArtisanalSiteDetails />);
    mocks.user = { ...mocks.user, organization_id: 'org-b' };
    view.rerender(<ArtisanalSiteDetails />);
    await screen.findByRole('heading', { name: 'Site B autorisé' });
    await act(async () => old.resolve(fixture()));
    expect(screen.queryByRole('heading', { name: 'Site A confidentiel' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Site B autorisé' })).toBeVisible();
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
  });
});
