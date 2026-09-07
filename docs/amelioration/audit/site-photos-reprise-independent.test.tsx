import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ArtisanalSiteDetails from '@/pages/artisanal-sites/ArtisanalSiteDetails';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';

const mocks = vi.hoisted(() => ({ user: {} as Record<string, unknown>, load: vi.fn(), photo: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/artisanalSiteService', () => ({ SITE_DATA_CHANGED: 'site-data-changed-test', artisanalSiteService: { loadSiteData: mocks.load } }));
vi.mock('@/services/sitePhotoService', () => ({ resolvePhotoUrl: mocks.photo }));
vi.mock('@/services/siteAeaDocumentService', () => ({ siteAeaDocumentService: { url: vi.fn() } }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
const view = () => <MemoryRouter initialEntries={['/artisan-sites/site-a']}><Routes><Route path="/artisan-sites/:siteId" element={<ArtisanalSiteDetails />} /></Routes></MemoryRouter>;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: 'user-a', role: 'dgmg', is_active: true, organization_id: 'org-a' };
  mocks.load.mockResolvedValue({ sites: [{ ...DEMO_ARTISANAL_SITES[0], id: 'site-a', name: 'SITE CONFIDENTIEL A', aea: null, photos: ['sites/a.jpg'] }], productions: [] });
  mocks.photo.mockResolvedValue('https://photo.invalid/a.jpg');
});

it('efface le dossier et ses photos puis relit le site quand le périmètre change sans navigation', async () => {
  const { rerender } = render(view());
  await screen.findByRole('img', { name: 'Photo 1 du site SITE CONFIDENTIEL A' });
  mocks.load.mockImplementation(() => new Promise(() => {}));
  mocks.user = { ...mocks.user, organization_id: 'org-b', access_role_id: 'role-b' };
  rerender(view());
  expect(screen.queryByRole('heading', { name: 'SITE CONFIDENTIEL A' })).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Photo 1 du site SITE CONFIDENTIEL A' })).not.toBeInTheDocument();
  expect(mocks.load).toHaveBeenCalledTimes(2);
});

it('ignore la réponse du vrai hook de l’ancien périmètre après lecture du nouveau dossier', async () => {
  let resolveOld!: (value: unknown) => void;
  mocks.load.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const { rerender } = render(view());
  mocks.user = { ...mocks.user, organization_id: 'org-b', access_role_id: 'role-b' };
  mocks.load.mockResolvedValue({ sites: [{ ...DEMO_ARTISANAL_SITES[0], id: 'site-a', name: 'SITE AUTORISÉ B', aea: null, photos: ['sites/b.jpg'] }], productions: [] });
  rerender(view());
  await screen.findByRole('heading', { name: 'SITE AUTORISÉ B' });
  await act(async () => resolveOld({ sites: [{ ...DEMO_ARTISANAL_SITES[0], id: 'site-a', name: 'ANCIEN DOSSIER A', aea: null, photos: ['sites/old-a.jpg'] }], productions: [] }));
  expect(screen.getByRole('heading', { name: 'SITE AUTORISÉ B' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'ANCIEN DOSSIER A' })).not.toBeInTheDocument();
  expect(mocks.photo).not.toHaveBeenCalledWith('sites/old-a.jpg');
});
