import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadAssayCertificate } from './assayCertificateService';

const mocks = vi.hoisted(() => ({
  uploadSensitiveFile: vi.fn(),
  storageFrom: vi.fn(),
  tableFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: mocks.storageFrom },
    from: mocks.tableFrom,
  },
}));

vi.mock('./sensitiveUploadGateway', () => ({
  uploadSensitiveFile: mocks.uploadSensitiveFile,
}));

const SHIPPING_ID = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const DECLARED_USER_ID = 'ac585840-4d30-4a67-9e66-8d1fd77279ee';
const SERVER_ACTOR_ID = 'ff2f6c94-dd31-487d-9447-d54b3f3abda8';

describe('uploadAssayCertificate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passe le PDF au gateway sans chemin Storage ni acteur fourni par le navigateur', async () => {
    const file = new File(['%PDF-1.7\ncontenu\n%%EOF'], 'analyse finale.pdf', {
      type: 'application/pdf',
    });
    mocks.uploadSensitiveFile.mockResolvedValue({
      id: '0e052595-dcbc-4670-9557-3cd2069f81e7',
      shipping_preparation_id: SHIPPING_ID,
      file_path: `${SHIPPING_ID}/format-validated/2026/08/672f4a91-a4bc-4a6d-88f3-7e714069c959.pdf`,
      file_name: 'analyse finale.pdf',
      file_size: file.size,
      mime_type: 'application/pdf',
      parsing_status: 'pending',
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      uploaded_by: SERVER_ACTOR_ID,
      created_at: '2026-08-24T12:00:00.000Z',
    });

    await expect(uploadAssayCertificate(SHIPPING_ID, file, DECLARED_USER_ID)).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
    expect(mocks.uploadSensitiveFile).toHaveBeenCalledWith(
      'assay-certificate',
      file,
      { shippingPreparationId: SHIPPING_ID, fileName: file.name },
      { mimeType: 'application/pdf' },
    );
    expect(JSON.stringify(mocks.uploadSensitiveFile.mock.calls)).not.toContain(DECLARED_USER_ID);
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.tableFrom).not.toHaveBeenCalled();
  });

  it('échoue fermé si la réponse du gateway ne respecte pas le parent demandé', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'analyse.pdf', { type: 'application/pdf' });
    mocks.uploadSensitiveFile.mockResolvedValue({
      id: '0e052595-dcbc-4670-9557-3cd2069f81e7',
      shipping_preparation_id: '7b98c65f-3e9b-48ea-b3b8-e407ddce04e4',
      file_path: `${SHIPPING_ID}/format-validated/2026/08/672f4a91-a4bc-4a6d-88f3-7e714069c959.pdf`,
    });

    await expect(uploadAssayCertificate(SHIPPING_ID, file, DECLARED_USER_ID)).resolves.toEqual({
      success: false,
      error: 'La confirmation du dépôt est invalide.',
    });
  });

  it('rejette un identifiant parent invalide avant tout appel réseau', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'analyse.pdf', { type: 'application/pdf' });
    await expect(uploadAssayCertificate('shipping-1', file, DECLARED_USER_ID)).resolves.toEqual({
      success: false,
      error: 'La préparation d’expédition est invalide.',
    });
    expect(mocks.uploadSensitiveFile).not.toHaveBeenCalled();
  });
});
