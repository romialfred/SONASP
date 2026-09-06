import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtisanalSiteForm from './ArtisanalSiteForm';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';

const mocks = vi.hoisted(() => ({ siteId: 'site-test', role: 'dgmg', listSites: vi.fn(), getSite: vi.fn(), saveSite: vi.fn(), navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ siteId: mocks.siteId }), useNavigate: () => mocks.navigate }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, is_active: true } }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/artisanal-sites/SiteLocationPicker', () => ({ SiteLocationPicker: () => <div>Carte</div> }));
vi.mock('@/services/artisanalSiteService', () => ({ artisanalSiteService: { listSites: mocks.listSites, getSite: mocks.getSite, saveSite: mocks.saveSite } }));
vi.mock('@/services/sitePhotoService', () => ({ MAX_SITE_PHOTOS: 3, resolvePhotoUrl: async (path: string) => path, uploadSitePhoto: vi.fn() }));
vi.mock('@/services/siteAeaDocumentService', () => ({ siteAeaDocumentService: { url: async () => '/aea.pdf' }, validateAeaFile: vi.fn() }));

describe('Formulaire artisanal et AEA', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.siteId = 'site-test'; mocks.role = 'dgmg';
    mocks.listSites.mockResolvedValue([]);
    mocks.getSite.mockResolvedValue({ ...DEMO_ARTISANAL_SITES[0], formalization: null, aea: null, photos: [] });
    mocks.saveSite.mockResolvedValue({ id: 'saved' });
  });
  it('affiche les références AEA uniquement pour un site formalisé et les conserve à la sauvegarde', async () => {
    render(<ArtisanalSiteForm />);
    await waitFor(() => expect(screen.getByLabelText(/Nom du site/)).not.toHaveValue(''));
    expect(screen.queryByText('Semi-mécanisée')).not.toBeInTheDocument();
    expect(screen.queryByText('Mixte')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Numéro de l’AEA/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /^Site formalisé/ }));
    fireEvent.change(screen.getByLabelText(/Numéro de l’AEA/), { target: { value: 'AEA-2026-001' } });
    fireEvent.change(screen.getByLabelText(/Date d’émission/), { target: { value: '2026-01-31' } });
    fireEvent.change(screen.getByLabelText(/Durée de validité/), { target: { value: '1' } });
    expect(screen.getByText('28 février 2026')).toBeInTheDocument();
    const file = new File(['%PDF'], 'attestation.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Joindre le justificatif AEA'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ }));
    await waitFor(() => expect(mocks.saveSite).toHaveBeenCalledWith(expect.objectContaining({ exploitationType: 'artisanale', formalization: 'formalized', aea: expect.objectContaining({ number: 'AEA-2026-001', durationMonths: 1 }) }), file));
    expect(mocks.navigate).toHaveBeenCalledWith('/artisan-sites/saved', { state: { saved: true } });
  });
  it('permet de compléter une fiche historique comme non formalisée sans AEA', async () => {
    render(<ArtisanalSiteForm />);
    await waitFor(() => expect(screen.getByLabelText(/Nom du site/)).not.toHaveValue(''));
    fireEvent.click(screen.getByRole('radio', { name: /^Site non formalisé/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ }));
    await waitFor(() => expect(mocks.saveSite).toHaveBeenCalledWith(expect.objectContaining({ formalization: 'non_formalized' }), null));
  });
  it('empêche l’enregistrement après un échec du chargement en modification', async () => {
    mocks.getSite.mockRejectedValue(new Error('indisponible'));
    render(<ArtisanalSiteForm />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ })).toBeDisabled());
    expect(mocks.saveSite).not.toHaveBeenCalled();
  });

  it('identifie les sites référencés par leur nom et conserve la navigation vers leur fiche', async () => {
    const site = { ...DEMO_ARTISANAL_SITES[0], name: 'Kan-ŋe Gorom N1', locality: 'Gorom-Gorom' };
    mocks.listSites.mockResolvedValue([site]);
    render(<ArtisanalSiteForm />);
    const entry = await screen.findByRole('button', { name: /Kan-ŋe Gorom N1/ });
    expect(screen.queryByRole('button', { name: /^Gorom-Gorom/ })).not.toBeInTheDocument();
    fireEvent.click(entry);
    expect(mocks.navigate).toHaveBeenCalledWith(`/artisan-sites/${site.id}`);
  });
});
