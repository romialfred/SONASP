import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImage, removeUnattachedSitePhoto, resolvePhotoUrl, uploadSitePhoto } from './sitePhotoService';

const storage = vi.hoisted(() => ({ upload: vi.fn(), createSignedUrl: vi.fn(), remove: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: storage.from } } }));
vi.mock('@/lib/secureRandom', () => ({ secureRandomId: () => '00000000-0000-4000-8000-000000000007' }));

describe('photos de site privées', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storage.from.mockReturnValue(storage);
    storage.upload.mockResolvedValue({ error: null });
    storage.remove.mockResolvedValue({ error: null });
    storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.test/photo.jpg' }, error: null });
    vi.stubGlobal('Image', class {
      width = 200; height = 100; onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,aW1hZ2U=');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => new Blob(['image'], { type: 'image/jpeg' }) }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('dépose dans le bucket privé et ne retourne que la référence', async () => {
    const reference = await uploadSitePhoto(new File(['image'], 'photo.png', { type: 'image/png' }));
    expect(reference).toBe('sites/00000000-0000-4000-8000-000000000007.jpg');
    expect(storage.from).toHaveBeenCalledWith('artisanal-sites');
    expect(storage.upload).toHaveBeenCalledWith(reference, expect.any(Blob), { contentType: 'image/jpeg', upsert: false });
  });

  it.each(['response', 'exception'])('ne remplace pas un échec Storage (%s) par des données encodées', async (failure) => {
    if (failure === 'response') storage.upload.mockResolvedValue({ error: new Error('secret technical error') });
    else storage.upload.mockRejectedValue(new Error('secret technical error'));
    await expect(uploadSitePhoto(new File(['image'], 'photo.png'))).rejects.toThrow('Le dépôt de la photo a échoué');
  });

  it('propage une conversion du fichier impossible sans contacter Storage', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockReturnValue('data:image/jpeg;base64,%%%');
    await expect(uploadSitePhoto(new File(['image'], 'photo.png'))).rejects.toThrow();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('dépose le JPEG compressé même quand la politique de connexion interdit fetch(data:)', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch : connect-src sans data:'));
    await expect(uploadSitePhoto(new File(['original file'], 'photo.png', { type: 'image/png' }))).resolves.toMatch(/^sites\/.+\.jpg$/);
    expect(fetch).not.toHaveBeenCalled();
    const blob = storage.upload.mock.calls[0][1] as Blob;
    expect(blob.type).toBe('image/jpeg');
    const compressedContent = await new Promise<string>(resolve => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob);
    });
    expect(compressedContent).toBe('image');
  });

  it.each([
    { data: null, error: new Error('denied') },
    { data: null, error: null },
    { data: { signedUrl: '' }, error: null },
  ])('refuse une lecture signée indisponible : %j', async (response) => {
    storage.createSignedUrl.mockResolvedValue(response);
    await expect(resolvePhotoUrl('sites/photo.jpg')).rejects.toThrow('La photo est momentanément indisponible');
  });

  it('signale également une exception réseau pendant la lecture', async () => {
    storage.createSignedUrl.mockRejectedValue(new Error('network'));
    await expect(resolvePhotoUrl('sites/photo.jpg')).rejects.toThrow('La photo est momentanément indisponible');
  });

  it('préserve la compatibilité de lecture des références historiques', async () => {
    expect(await resolvePhotoUrl('data:image/jpeg;base64,aW1hZ2U=')).toBe('data:image/jpeg;base64,aW1hZ2U=');
    expect(await resolvePhotoUrl('https://example.test/legacy.jpg')).toBe('https://example.test/legacy.jpg');
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('signe une référence privée pour la durée existante', async () => {
    expect(await resolvePhotoUrl('sites/photo.jpg')).toBe('https://example.test/photo.jpg');
    expect(storage.createSignedUrl).toHaveBeenCalledWith('sites/photo.jpg', 3600);
  });

  it('rejette une compression sans canvas', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(compressImage(new File(['image'], 'photo.png'))).rejects.toThrow('Compression indisponible');
  });
  it('retire uniquement une référence de dépôt de photo et propage les refus', async () => {
    await removeUnattachedSitePhoto('sites/photo-id.jpg');
    expect(storage.remove).toHaveBeenCalledWith(['sites/photo-id.jpg']);
    storage.remove.mockResolvedValue({ error: new Error('denied') });
    await expect(removeUnattachedSitePhoto('sites/photo-id.jpg')).rejects.toThrow('Le retrait de la photo du dépôt a échoué');
  });
  it.each(['https://example.test/photo.jpg', 'data:image/jpeg;base64,aA==', '../other/photo.jpg', 'sites/../../photo.jpg'])('refuse la compensation d’une référence non générée : %s', async (reference) => {
    await expect(removeUnattachedSitePhoto(reference)).rejects.toThrow();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('rejette une exception de compression au lieu de laisser le traitement suspendu', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockImplementation(() => { throw new Error('canvas encoding error'); });
    await expect(compressImage(new File(['image'], 'photo.png'))).rejects.toThrow('La préparation de la photo a échoué');
  });
});
