import { beforeEach, describe, expect, it, vi } from 'vitest';
import { miningCompanyDocumentService } from './miningCompanyDocumentService';
import { UploadValidationError } from '@/lib/uploadValidation';

const COMPANY_ID = '9b3fcaaa-9367-4c91-a82d-788f043f33f1';
const DOCUMENT_ID = '8bc56cf1-2830-4af3-8d2f-d4385f471880';
const ACTOR_ID = '271124cb-b8cd-43be-9c31-b7f5ed9ca24e';

const mocks = vi.hoisted(() => ({
  uploadSensitiveFile: vi.fn(),
  deleteSensitiveResource: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

vi.mock('@/services/sensitiveUploadGateway', () => ({
  uploadSensitiveFile: mocks.uploadSensitiveFile,
  deleteSensitiveResource: mocks.deleteSensitiveResource,
}));

function gatewayDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_ID,
    mining_company_id: COMPANY_ID,
    doc_type: 'autorisation',
    file_name: 'permis.pdf',
    file_path: `${COMPANY_ID}/format-validated/2026/08/${DOCUMENT_ID}.pdf`,
    file_size: 18,
    mime_type: 'application/pdf',
    uploaded_by: ACTOR_ID,
    created_at: '2026-08-24T12:00:00.000Z',
    ...overrides,
  };
}

describe('miningCompanyDocumentService.upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadSensitiveFile.mockResolvedValue(gatewayDocument());
  });

  it('migre le dépôt critique vers le gateway serveur', async () => {
    const file = new File(['%PDF-1.7\n%%EOF\n'], 'permis.pdf', { type: 'application/pdf' });
    const expected = gatewayDocument({ file_size: file.size });
    mocks.uploadSensitiveFile.mockResolvedValue(expected);

    await expect(miningCompanyDocumentService.upload(COMPANY_ID, file, 'autorisation'))
      .resolves.toEqual(expected);
    expect(mocks.uploadSensitiveFile).toHaveBeenCalledWith(
      'mining-company-document',
      file,
      { companyId: COMPANY_ID, documentType: 'autorisation', fileName: 'permis.pdf' },
      { mimeType: 'application/pdf' },
    );
  });

  it('bloque au client un nom à double extension dangereuse avant le réseau', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'permis.exe.pdf', { type: 'application/pdf' });

    await expect(miningCompanyDocumentService.upload(COMPANY_ID, file, 'autorisation'))
      .rejects.toBeInstanceOf(UploadValidationError);
    expect(mocks.uploadSensitiveFile).not.toHaveBeenCalled();
  });

  it('rejette un identifiant cible et une catégorie hors allowlist', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'permis.pdf', { type: 'application/pdf' });

    await expect(miningCompanyDocumentService.upload('mine-client', file, 'autorisation')).rejects.toThrow(/invalide/);
    await expect(miningCompanyDocumentService.upload(COMPANY_ID, file, 'executable')).rejects.toThrow(/invalide/);
    expect(mocks.uploadSensitiveFile).not.toHaveBeenCalled();
  });

  it('échoue fermé si la confirmation serveur ne correspond pas au tenant demandé', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'permis.pdf', { type: 'application/pdf' });
    mocks.uploadSensitiveFile.mockResolvedValue(gatewayDocument({
      mining_company_id: 'abef0136-48cb-4073-8d7b-931313cb7bdd',
      file_size: file.size,
    }));

    await expect(miningCompanyDocumentService.upload(COMPANY_ID, file, 'autorisation'))
      .rejects.toThrow('La confirmation du dépôt est invalide.');
  });

  it('délègue la suppression au endpoint compensé', async () => {
    mocks.deleteSensitiveResource.mockResolvedValue(undefined);
    await expect(miningCompanyDocumentService.remove({
      id: DOCUMENT_ID,
      file_path: `${COMPANY_ID}/document.pdf`,
    })).resolves.toBeUndefined();
    expect(mocks.deleteSensitiveResource).toHaveBeenCalledWith('mining-company-document', DOCUMENT_ID);
  });
});
