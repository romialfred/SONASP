import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteFreightCustomsBinary,
  getFreightCustomsBinaryUrl,
  uploadFreightCustomsBinary,
} from './freightCustomsBinaryGateway';

const mocks = vi.hoisted(() => ({
  uploadSensitiveFile: vi.fn(), deleteSensitiveResource: vi.fn(), createSignedUrl: vi.fn(), from: vi.fn(),
}));
vi.mock('./sensitiveUploadGateway', () => ({
  uploadSensitiveFile: mocks.uploadSensitiveFile,
  deleteSensitiveResource: mocks.deleteSensitiveResource,
}));
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: mocks.from } } }));

const OPERATION = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const DOCUMENT = 'ac585840-4d30-4a67-9e66-8d1fd77279ee';
const ACTOR = '30d25b87-c4bf-4ca6-9582-6a736be3ba8c';

describe('freightCustomsBinaryGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
  });

  it('verse uniquement via le profil fret fermé', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'declaration.pdf', { type: 'application/pdf' });
    mocks.uploadSensitiveFile.mockResolvedValue({
      id: DOCUMENT, freight_customs_operation_id: OPERATION,
      document_type: 'customs_declaration', title: 'Déclaration douanière', description: null,
      file_path: `freight-customs/${OPERATION}/${DOCUMENT}.pdf`, file_name: 'declaration.pdf',
      file_size: file.size, mime_type: 'application/pdf', uploaded_by: ACTOR,
      uploaded_at: '2026-08-24T12:00:00.000Z',
    });
    await expect(uploadFreightCustomsBinary({
      operationId: OPERATION, documentType: 'customs_declaration',
      title: ' Déclaration douanière ', file,
    })).resolves.toEqual(expect.objectContaining({ id: DOCUMENT }));
    expect(mocks.uploadSensitiveFile).toHaveBeenCalledWith(
      'freight-customs-document', file,
      {
        operationId: OPERATION, documentType: 'customs_declaration',
        title: 'Déclaration douanière', description: null, fileName: 'declaration.pdf',
      },
      { mimeType: 'application/pdf' },
    );
  });

  it('rejette une confirmation hors parent', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'declaration.pdf', { type: 'application/pdf' });
    mocks.uploadSensitiveFile.mockResolvedValue({ id: DOCUMENT });
    await expect(uploadFreightCustomsBinary({
      operationId: OPERATION, documentType: 'other', title: 'Document annexe', file,
    })).rejects.toThrow('confirmation');
  });

  it('signe le chemin privé sans URL publique', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/freight' }, error: null });
    const path = `freight-customs/${OPERATION}/${DOCUMENT}.pdf`;
    await expect(getFreightCustomsBinaryUrl(path)).resolves.toBe('https://signed.example/freight');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(path, 300);
  });

  it('délègue la suppression compensée à Edge', async () => {
    mocks.deleteSensitiveResource.mockResolvedValue(undefined);
    await expect(deleteFreightCustomsBinary(DOCUMENT)).resolves.toBeUndefined();
    expect(mocks.deleteSensitiveResource).toHaveBeenCalledWith('freight-customs-document', DOCUMENT);
  });
});
