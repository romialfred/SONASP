import { supabase } from '@/lib/supabase';
import {
  createPrivateSignedUrl,
  PRIVATE_STORAGE_BUCKETS,
  requireStorageObjectPath,
} from '@/lib/privateStorage';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';
import { uploadSensitiveFile } from '@/services/sensitiveUploadGateway';

const BUCKET = PRIVATE_STORAGE_BUCKETS.miningCompanyDocuments;

export interface MiningCompanyDocument {
  id: string;
  mining_company_id: string;
  doc_type: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Documents catégorisables joints à une société minière. */
export const MINING_COMPANY_DOC_TYPES = [
  { value: 'rccm', label: 'RCCM' },
  { value: 'ifu', label: 'IFU / Attestation fiscale' },
  { value: 'autorisation', label: "Autorisation / Permis d'exploitation" },
  { value: 'statuts', label: 'Statuts de la société' },
  { value: 'autre', label: 'Autre document' },
] as const;

const DOCUMENT_TYPES = new Set(MINING_COMPANY_DOC_TYPES.map(({ value }) => value));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUploadedDocument(
  value: unknown,
  expected: {
    companyId: string;
    docType: string;
    extension: string;
    fileSize: number;
    mimeType: string;
  },
): value is MiningCompanyDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<MiningCompanyDocument>;
  const escapedCompanyId = expected.companyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedExtension = expected.extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expectedPath = new RegExp(
    `^${escapedCompanyId}/format-validated/[0-9]{4}/(?:0[1-9]|1[0-2])/[0-9a-f-]{36}\\.${escapedExtension}$`,
    'i',
  );
  return typeof document.id === 'string'
    && UUID.test(document.id)
    && document.mining_company_id === expected.companyId
    && document.doc_type === expected.docType
    && typeof document.file_name === 'string'
    && !/[\\/\u0000-\u001f\u007f]/u.test(document.file_name)
    && typeof document.file_path === 'string'
    && expectedPath.test(document.file_path)
    && document.file_size === expected.fileSize
    && document.mime_type === expected.mimeType
    && typeof document.uploaded_by === 'string'
    && UUID.test(document.uploaded_by)
    && typeof document.created_at === 'string'
    && Number.isFinite(Date.parse(document.created_at));
}

export const miningCompanyDocumentService = {
  async list(companyId: string): Promise<MiningCompanyDocument[]> {
    const { data, error } = await supabase
      .from('mining_company_documents')
      .select('*')
      .eq('mining_company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async upload(companyId: string, file: File, docType: string): Promise<MiningCompanyDocument> {
    if (!UUID.test(companyId) || !DOCUMENT_TYPES.has(docType as typeof MINING_COMPANY_DOC_TYPES[number]['value'])) {
      throw new Error('Le dossier de destination ou le type de document est invalide.');
    }
    const validatedFile = validateUploadFile(file, UPLOAD_POLICIES.mineDocument);
    const resource = await uploadSensitiveFile(
      'mining-company-document',
      file,
      { companyId, documentType: docType, fileName: file.name },
      { mimeType: validatedFile.mimeType },
    );
    if (!isUploadedDocument(resource, {
      companyId,
      docType,
      extension: validatedFile.extension,
      fileSize: file.size,
      mimeType: validatedFile.mimeType,
    })) {
      throw new Error('La confirmation du dépôt est invalide.');
    }
    return resource;
  },

  async remove(doc: Pick<MiningCompanyDocument, 'id' | 'file_path'>): Promise<void> {
    const path = requireStorageObjectPath(doc.file_path, BUCKET);
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);
    if (storageError) throw storageError;
    const { error } = await supabase.from('mining_company_documents').delete().eq('id', doc.id);
    if (error) throw error;
  },

  /** URL signée (bucket privé) valable 1h pour consulter/télécharger un document. */
  async getSignedUrl(filePath: string): Promise<string | null> {
    try {
      return await createPrivateSignedUrl(BUCKET, filePath, 3600);
    } catch (error) {
      console.error('[miningCompanyDocumentService] signed url failed:', error);
      return null;
    }
  },
};
