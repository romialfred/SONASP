import { createPrivateSignedUrl, PRIVATE_STORAGE_BUCKETS } from '@/lib/privateStorage';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';
import { deleteSensitiveResource, uploadSensitiveFile } from './sensitiveUploadGateway';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set([
  'customs_declaration', 'customs_approval', 'transport_document',
  'bill_of_lading', 'export_invoice', 'bullion_summary', 'other',
]);

export type FreightCustomsBinaryDocumentType =
  | 'customs_declaration' | 'customs_approval' | 'transport_document'
  | 'bill_of_lading' | 'export_invoice' | 'bullion_summary' | 'other';

export interface FreightCustomsBinaryDocument {
  id: string;
  freight_customs_operation_id: string;
  document_type: FreightCustomsBinaryDocumentType;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

function isFreightDocument(
  value: unknown,
  expected: {
    operationId: string; documentType: FreightCustomsBinaryDocumentType;
    title: string; description: string | null; extension: string;
    fileSize: number; mimeType: string;
  },
): value is FreightCustomsBinaryDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<FreightCustomsBinaryDocument>;
  const segments = typeof document.file_path === 'string' ? document.file_path.split('/') : [];
  const objectName = segments[2] ?? '';
  return typeof document.id === 'string' && UUID.test(document.id)
    && document.freight_customs_operation_id === expected.operationId
    && document.document_type === expected.documentType && TYPES.has(document.document_type)
    && document.title === expected.title
    && document.description === expected.description
    && document.file_size === expected.fileSize
    && document.mime_type === expected.mimeType
    && typeof document.file_name === 'string'
    && !/[\\/\u0000-\u001f\u007f]/u.test(document.file_name)
    && document.file_name.toLowerCase().endsWith(`.${expected.extension}`)
    && segments.length === 3
    && segments[0] === 'freight-customs'
    && segments[1] === expected.operationId
    && UUID.test(objectName.split('.')[0] ?? '')
    && objectName.toLowerCase().endsWith(`.${expected.extension}`)
    && typeof document.uploaded_by === 'string' && UUID.test(document.uploaded_by)
    && typeof document.uploaded_at === 'string' && Number.isFinite(Date.parse(document.uploaded_at));
}

export async function uploadFreightCustomsBinary(input: {
  operationId: string;
  documentType: FreightCustomsBinaryDocumentType;
  title: string;
  description?: string;
  file: File;
}): Promise<FreightCustomsBinaryDocument> {
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  if (
    !UUID.test(input.operationId) || !TYPES.has(input.documentType)
    || title.length < 3 || title.length > 250
    || (description !== null && description.length > 2_000)
  ) throw new Error('Les informations du document fret sont invalides.');
  const validated = validateUploadFile(input.file, UPLOAD_POLICIES.freightCustomsDocument);
  const resource = await uploadSensitiveFile(
    'freight-customs-document',
    input.file,
    {
      operationId: input.operationId,
      documentType: input.documentType,
      title,
      description,
      fileName: input.file.name,
    },
    { mimeType: validated.mimeType },
  );
  if (!isFreightDocument(resource, {
    operationId: input.operationId,
    documentType: input.documentType,
    title,
    description,
    extension: validated.extension,
    fileSize: input.file.size,
    mimeType: validated.mimeType,
  })) throw new Error('La confirmation du dépôt fret est invalide.');
  return resource;
}

export async function getFreightCustomsBinaryUrl(reference: string): Promise<string> {
  return createPrivateSignedUrl(PRIVATE_STORAGE_BUCKETS.freightCustomsDocuments, reference, 300);
}

export async function deleteFreightCustomsBinary(documentId: string): Promise<void> {
  if (!UUID.test(documentId)) throw new Error('Le document fret est invalide.');
  await deleteSensitiveResource('freight-customs-document', documentId);
}
