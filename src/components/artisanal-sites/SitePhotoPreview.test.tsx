import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SitePhotoPreview } from './SitePhotoPreview';
const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('@/services/sitePhotoService', () => ({ resolvePhotoUrl: mocks.resolve }));
const props = { reference: 'sites/a.jpg', label: 'Photo 1', contextKey: 'site-a:org-a' };

describe('aperçu de photo privée', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.resolve.mockResolvedValue('https://example.test/photo.jpg'); });
  it('présente le chargement puis l’image', async () => {
    render(<SitePhotoPreview {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement');
    expect(await screen.findByRole('img', { name: 'Photo 1' })).toHaveAttribute('src', 'https://example.test/photo.jpg');
  });
  it('permet la reprise ciblée après refus de lecture sans afficher le détail technique', async () => {
    mocks.resolve.mockRejectedValueOnce(new Error('secret storage policy'));
    render(<SitePhotoPreview {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('aperçu indisponible');
    expect(screen.queryByText(/secret storage/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer photo 1' }));
    await screen.findByRole('img');
    expect(mocks.resolve).toHaveBeenCalledTimes(2);
  });
  it('renouvelle une URL dont le chargement image a échoué', async () => {
    render(<SitePhotoPreview {...props} />);
    fireEvent.error(await screen.findByRole('img'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    mocks.resolve.mockResolvedValue('https://example.test/renewed.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer photo 1' }));
    expect(await screen.findByRole('img')).toHaveAttribute('src', 'https://example.test/renewed.jpg');
  });
  it.each(['reference', 'contextKey'] as const)('efface l’ancienne URL si %s change et ignore une réponse tardive', async (field) => {
    let resolveOld!: (value: string) => void;
    mocks.resolve.mockReturnValueOnce(new Promise<string>(resolve => { resolveOld = resolve; }));
    const { rerender } = render(<SitePhotoPreview {...props} />);
    rerender(<SitePhotoPreview {...props} {...{ [field]: 'changed' }} />);
    await screen.findByRole('img');
    await act(async () => resolveOld('https://example.test/old.jpg'));
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/photo.jpg');
    expect(mocks.resolve).toHaveBeenCalledTimes(2);
  });
  it('préserve une autre photo réussie pendant la reprise d’une photo en échec', async () => {
    mocks.resolve.mockImplementation((reference: string) => reference === 'sites/a.jpg' ? Promise.reject(new Error('unavailable')) : Promise.resolve('https://example.test/b.jpg'));
    render(<><SitePhotoPreview {...props} /><SitePhotoPreview {...props} reference="sites/b.jpg" label="Photo 2" /></>);
    await screen.findByRole('alert');
    await screen.findByRole('img', { name: 'Photo 2' });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer photo 1' }));
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(3));
    expect(mocks.resolve.mock.calls.filter(([reference]) => reference === 'sites/b.jpg')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Photo 2' })).toBeInTheDocument();
  });
});
