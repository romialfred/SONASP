import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtisanalSiteForm from './ArtisanalSiteForm';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';

const mocks = vi.hoisted(() => ({ siteId: 'site-test', role: 'dgmg', listSites: vi.fn(), getSite: vi.fn(), saveSite: vi.fn(), navigate: vi.fn(), resolvePhoto: vi.fn(), uploadPhoto: vi.fn(), removePhoto: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ siteId: mocks.siteId }), useNavigate: () => mocks.navigate }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, is_active: true } }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/artisanal-sites/SiteLocationPicker', () => ({ SiteLocationPicker: () => <div>Carte</div> }));
vi.mock('@/services/artisanalSiteService', () => ({ artisanalSiteService: { listSites: mocks.listSites, getSite: mocks.getSite, saveSite: mocks.saveSite } }));
vi.mock('@/services/sitePhotoService', () => ({ MAX_SITE_PHOTOS: 3, resolvePhotoUrl: mocks.resolvePhoto, uploadSitePhoto: mocks.uploadPhoto, removeUnattachedSitePhoto: mocks.removePhoto }));
vi.mock('@/services/siteAeaDocumentService', () => ({ siteAeaDocumentService: { url: async () => '/aea.pdf' }, validateAeaFile: vi.fn() }));

describe('Formulaire artisanal et AEA', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.siteId = 'site-test'; mocks.role = 'dgmg';
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    mocks.resolvePhoto.mockImplementation(async (path: string) => `https://example.test/${path}`);
    mocks.uploadPhoto.mockImplementation(async (file: File) => `sites/${file.name}.jpg`);
    mocks.removePhoto.mockResolvedValue(undefined);
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
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(`/artisan-sites/${site.id}`));
  });

  async function loadedForm(photos: string[] = []) {
    mocks.getSite.mockResolvedValue({ ...DEMO_ARTISANAL_SITES[0], formalization: 'non_formalized', aea: null, photos });
    const result = render(<ArtisanalSiteForm />);
    await waitFor(() => expect(screen.getByLabelText(/Nom du site/)).not.toHaveValue(''));
    return result;
  }
  const addPhotos = (names: string[]) => fireEvent.change(screen.getByLabelText('Ajouter des photos du site'), { target: { files: names.map(name => new File(['image'], name, { type: 'image/png' })) } });

  it('conserve un dépôt réussi quand un autre échoue, puis ne reprend que le fichier échoué', async () => {
    await loadedForm();
    mocks.uploadPhoto.mockImplementation(async (file: File) => {
      if (file.name === 'failed.png') throw new Error('private error');
      return 'sites/success.jpg';
    });
    addPhotos(['success.png', 'failed.png']);
    expect(await screen.findByRole('img', { name: 'Photo 1 du site' })).toBeInTheDocument();
    expect(await screen.findByText('Dépôt échoué')).toBeInTheDocument();
    expect(screen.queryByText(/private error/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ }));
    expect(mocks.saveSite).not.toHaveBeenCalled();
    mocks.uploadPhoto.mockResolvedValue('sites/retried.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer le dépôt de failed.png' }));
    await screen.findByRole('img', { name: 'Photo 2 du site' });
    expect(mocks.uploadPhoto).toHaveBeenCalledTimes(3);
    expect(mocks.uploadPhoto.mock.calls.map(([file]) => file.name)).toEqual(['success.png', 'failed.png', 'failed.png']);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ }));
    await waitFor(() => expect(mocks.saveSite).toHaveBeenCalledWith(expect.objectContaining({ photos: ['sites/success.jpg', 'sites/retried.jpg'], formalization: 'non_formalized' }), null));
    expect(mocks.removePhoto).not.toHaveBeenCalled();
  });

  it('permet le retrait explicite d’un fichier échoué avant la sauvegarde', async () => {
    await loadedForm(); mocks.uploadPhoto.mockRejectedValue(new Error('network'));
    addPhotos(['failed.png']);
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer le fichier failed.png' }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ }));
    await waitFor(() => expect(mocks.saveSite).toHaveBeenCalledWith(expect.objectContaining({ photos: [] }), null));
    expect(mocks.removePhoto).not.toHaveBeenCalled();
  });

  it('ne perd pas les références existantes quand une lecture d’aperçu est refusée', async () => {
    mocks.resolvePhoto.mockRejectedValue(new Error('forbidden'));
    await loadedForm(['sites/legacy.jpg']);
    await screen.findByText(/Photo 1 du site : aperçu indisponible/);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ }));
    await waitFor(() => expect(mocks.saveSite).toHaveBeenCalledWith(expect.objectContaining({ photos: ['sites/legacy.jpg'] }), null));
    expect(mocks.removePhoto).not.toHaveBeenCalled();
  });

  it('compense le retrait d’un nouveau dépôt sans supprimer une ancienne photo stockée', async () => {
    await loadedForm(['sites/legacy.jpg']);
    addPhotos(['new.png']); await screen.findByRole('img', { name: 'Photo 2 du site' });
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la photo 2' }));
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Photo 2 du site' })).not.toBeInTheDocument());
    expect(mocks.removePhoto).toHaveBeenCalledWith('sites/new.png.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la photo 1' }));
    expect(mocks.removePhoto).toHaveBeenCalledTimes(1);
  });

  it('garde une photo si sa compensation échoue et permet de retirer à nouveau', async () => {
    await loadedForm(); addPhotos(['new.png']); await screen.findByRole('img');
    mocks.removePhoto.mockRejectedValueOnce(new Error('unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la photo 1' }));
    await screen.findByText(/Elle est conservée dans le formulaire/);
    expect(screen.getByRole('img')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la photo 1' }));
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(mocks.removePhoto).toHaveBeenCalledTimes(2);
  });

  it('nettoie les nouveaux dépôts à l’annulation et reste sur place si le nettoyage échoue', async () => {
    await loadedForm(); addPhotos(['new.png']); await screen.findByRole('img');
    mocks.removePhoto.mockRejectedValueOnce(new Error('unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await screen.findByText(/Réessayez avant de quitter/);
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/artisan-sites'));
  });

  it('ne supprime jamais une photo soumise à une sauvegarde dont le résultat est incertain', async () => {
    await loadedForm(); addPhotos(['new.png']); await screen.findByRole('img');
    mocks.saveSite.mockRejectedValue(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ }));
    await waitFor(() => expect(mocks.saveSite).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Annuler' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.removePhoto).not.toHaveBeenCalled();
  });

  it('refuse un lot trop grand plutôt que d’ignorer silencieusement certains fichiers', async () => {
    await loadedForm(['sites/legacy.jpg']); addPhotos(['a.png', 'b.png', 'c.png']);
    expect(await screen.findByText(/Sélectionnez au plus 2/)).toBeInTheDocument();
    expect(mocks.uploadPhoto).not.toHaveBeenCalled();
  });

  it('bloque les doubles ajouts et nettoie un résultat tardif après un changement de site', async () => {
    const { rerender } = await loadedForm();
    let finish!: (path: string) => void;
    mocks.uploadPhoto.mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve; }));
    addPhotos(['new.png']); addPhotos(['other.png']);
    expect(mocks.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ })).toBeDisabled();
    mocks.siteId = 'site-b';
    mocks.getSite.mockResolvedValue({ ...DEMO_ARTISANAL_SITES[0], id: 'site-b', name: 'Site B', formalization: 'non_formalized', photos: [] });
    rerender(<ArtisanalSiteForm />);
    await waitFor(() => expect(screen.getByLabelText(/Nom du site/)).toHaveValue('Site B'));
    await act(async () => finish('sites/late.jpg'));
    expect(mocks.removePhoto).toHaveBeenCalledWith('sites/late.jpg');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('ne recommence que les compensations échouées quand l’annulation est partiellement réussie', async () => {
    await loadedForm(); addPhotos(['first.png', 'second.png']);
    await screen.findByRole('img', { name: 'Photo 2 du site' });
    mocks.removePhoto.mockImplementation(async (path: string) => {
      if (path.includes('second')) throw new Error('unavailable');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await screen.findByText(/Réessayez avant de quitter/);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.removePhoto.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/artisan-sites'));
    expect(mocks.removePhoto.mock.calls.map(([path]) => path)).toEqual(['sites/first.png.jpg', 'sites/second.png.jpg', 'sites/second.png.jpg']);
  });

  it('n’efface pas une photo enregistrée et ne navigue pas après un changement de contexte pendant la sauvegarde', async () => {
    const { rerender } = await loadedForm(); addPhotos(['new.png']);
    await screen.findByRole('img');
    let finish!: (value: { id: string }) => void;
    mocks.saveSite.mockReturnValueOnce(new Promise<{ id: string }>(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer|Mettre à jour/ }));
    expect(mocks.saveSite).toHaveBeenCalledTimes(1);
    mocks.role = 'management'; rerender(<ArtisanalSiteForm />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await act(async () => finish({ id: 'saved' }));
    expect(mocks.removePhoto).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('nettoie un dépôt en cours si les droits changent sur le même site', async () => {
    const { rerender } = await loadedForm();
    let finish!: (path: string) => void;
    mocks.uploadPhoto.mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve; }));
    addPhotos(['new.png']);
    mocks.role = 'management'; rerender(<ArtisanalSiteForm />);
    expect(screen.queryByLabelText('Ajouter des photos du site')).not.toBeInTheDocument();
    await act(async () => finish('sites/late.jpg'));
    expect(mocks.removePhoto).toHaveBeenCalledWith('sites/late.jpg');
    expect(mocks.saveSite).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
