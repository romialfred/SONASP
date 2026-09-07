import { validateUploadFile, UPLOAD_POLICIES } from '@/lib/uploadValidation';
export const validateAeaFile = (file: File) => validateUploadFile(file, UPLOAD_POLICIES.siteAea);
export const siteAeaDocumentService = { url: async () => { throw new Error('Document AEA indisponible dans le banc photo.'); } };
