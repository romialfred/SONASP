import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productionDocumentService } from './productionDocumentService';

const mocks = vi.hoisted(() => ({
  uploadSensitiveFile: vi.fn(),
  createSignedUrl: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock('./sensitiveUploadGateway', () => ({ uploadSensitiveFile: mocks.uploadSensitiveFile }));
vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: mocks.storageFrom }, from: vi.fn() },
}));

const PRODUCTION_ID = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const DOCUMENT_ID = 'ac585840-4d30-4a67-9e66-8d1fd77279ee';
const ACTOR_ID = '01c34df2-98a3-44c3-87aa-35cd62dd8228';

describe('productionDocumentService — upload privé', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFrom.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
  });

  it('délègue les octets au profil Production fermé', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'rapport.pdf', { type: 'application/pdf' });
    mocks.uploadSensitiveFile.mockResolvedValue({
      id: DOCUMENT_ID,
      production_id: PRODUCTION_ID,
      document_name: 'Rapport journalier',
      file_name: 'rapport.pdf',
      file_path: `${PRODUCTION_ID}/format-validated/2026/08/${DOCUMENT_ID}.pdf`,
      file_size: file.size,
      file_type: 'application/pdf',
      uploaded_by: ACTOR_ID,
      created_at: '2026-08-24T10:00:00.000Z',
      updated_at: '2026-08-24T10:00:00.000Z',
    });

    await expect(productionDocumentService.uploadDocument(PRODUCTION_ID, file, 'Rapport journalier'))
      .resolves.toEqual(expect.objectContaining({ id: DOCUMENT_ID }));
    expect(mocks.uploadSensitiveFile).toHaveBeenCalledWith(
      'production-document', file,
      { productionId: PRODUCTION_ID, documentName: 'Rapport journalier', fileName: 'rapport.pdf' },
      { mimeType: 'application/pdf' },
    );
  });

  it('échoue fermé sur une confirmation de chemin hors parent', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'rapport.pdf', { type: 'application/pdf' });
    mocks.uploadSensitiveFile.mockResolvedValue({ id: DOCUMENT_ID, production_id: PRODUCTION_ID });
    await expect(productionDocumentService.uploadDocument(PRODUCTION_ID, file, 'Rapport journalier'))
      .rejects.toThrow('confirmation');
  });

  it('signe une référence privée et ne produit jamais d’URL publique', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/doc' }, error: null });
    await expect(productionDocumentService.getDocumentUrl(
      `${PRODUCTION_ID}/format-validated/2026/08/${DOCUMENT_ID}.pdf`,
    )).resolves.toBe('https://signed.example/doc');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      `${PRODUCTION_ID}/format-validated/2026/08/${DOCUMENT_ID}.pdf`, 300,
    );
  });

  it('ne tente jamais de créer ou lister un bucket depuis le navigateur', async () => {
    await expect(productionDocumentService.ensureBucketExists()).resolves.toBeUndefined();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });
});
