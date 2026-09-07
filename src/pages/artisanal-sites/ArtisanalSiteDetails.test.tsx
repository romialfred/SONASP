import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtisanalSiteDetails from './ArtisanalSiteDetails';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';

const mocks = vi.hoisted(() => ({ status: 'planned', role: 'dgmg', photos: [] as string[], resolvePhoto: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ siteId: 'test' }), useLocation: () => ({ state: null }), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, is_active: true } }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useArtisanalSiteData', () => {
  let data: unknown;
  let previousStatus: string;
  let previousPhotos: string[];
  return { useArtisanalSiteData: () => {
    if (!data || previousStatus !== mocks.status || previousPhotos !== mocks.photos) {
      previousStatus = mocks.status;
      previousPhotos = mocks.photos;
      data = { sites: [{ ...DEMO_ARTISANAL_SITES[0], id: 'test', status: mocks.status, activeMiners: 80, authorizedMiners: 100, formalization: 'non_formalized', photos: mocks.photos }], productions: [], loading: false, error: null, refresh: vi.fn() };
    }
    return data;
  } };
});
vi.mock('@/services/siteAeaDocumentService', () => ({ siteAeaDocumentService: { url: vi.fn() } }));
vi.mock('@/services/sitePhotoService', () => ({ resolvePhotoUrl: mocks.resolvePhoto }));
describe('Fiche du site et conformité', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.status = 'planned'; mocks.role = 'dgmg'; mocks.photos = []; });
  it('explique pourquoi le site planifié n’est pas évalué et propose les quatre règles', () => {
    render(<ArtisanalSiteDetails />);
    fireEvent.click(screen.getByRole('tab', { name: 'Conformité' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Conformité' }));
    expect(panel.getByText('Non évalué')).toBeInTheDocument();
    expect(panel.getAllByText('Non appliqué')).toHaveLength(4);
    expect(panel.getByText(/L’évaluation démarre/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Modifier la fiche/ })).toHaveAttribute('href', '/artisan-sites/test/modifier');
  });
  it('affiche 70 points pour un site actif sans déclaration avec une occupation normale', () => {
    mocks.status = 'active'; render(<ArtisanalSiteDetails />);
    fireEvent.click(screen.getByRole('tab', { name: 'Conformité' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Conformité' }));
    expect(panel.getByText(/100 − 30 = 70 points/)).toBeInTheDocument();
    expect(panel.getByText('−30 pts')).toBeInTheDocument();
  });
  it('permet de naviguer au clavier entre les onglets sans donner la modification à la consultation', () => {
    mocks.role = 'management'; render(<ArtisanalSiteDetails />);
    const first = screen.getByRole('tab', { name: 'Vue d’ensemble' });
    first.focus(); fireEvent.keyDown(first, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Conformité' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Conformité' })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Modifier la fiche/ })).not.toBeInTheDocument();
  });
  it('maintient la galerie et les autres photos quand une lecture échoue, avec reprise ciblée', async () => {
    mocks.photos = ['sites/photo-a.jpg', 'sites/photo-b.jpg'];
    mocks.resolvePhoto.mockImplementation((reference: string) => reference.endsWith('a.jpg')
      ? Promise.resolve('https://example.test/a.jpg') : Promise.reject(new Error('Storage secret')));
    render(<ArtisanalSiteDetails />);
    expect(await screen.findByRole('img', { name: /Photo 1 du site/ })).toHaveAttribute('src', 'https://example.test/a.jpg');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Photo 2 du site.*aperçu indisponible/);
    expect(screen.queryByText('Storage secret')).not.toBeInTheDocument();
    mocks.resolvePhoto.mockResolvedValue('https://example.test/b.jpg');
    fireEvent.click(screen.getByRole('button', { name: /Réessayer photo 2 du site/ }));
    expect(await screen.findByRole('img', { name: /Photo 2 du site/ })).toHaveAttribute('src', 'https://example.test/b.jpg');
    expect(mocks.resolvePhoto.mock.calls.map(([reference]) => reference)).toEqual(['sites/photo-a.jpg', 'sites/photo-b.jpg', 'sites/photo-b.jpg']);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'Conformité' }));
    expect(screen.getByRole('tabpanel', { name: 'Conformité' })).toBeVisible();
  });
  it('ne demande aucune URL lorsque le dossier ne comporte réellement aucune photo', () => {
    render(<ArtisanalSiteDetails />);
    expect(mocks.resolvePhoto).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: /Photo .*du site/ })).not.toBeInTheDocument();
  });
});
