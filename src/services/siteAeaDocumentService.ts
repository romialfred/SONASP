import { supabase } from '@/lib/supabase';
import { createPrivateSignedUrl } from '@/lib/privateStorage';
import { validateUploadFile, UPLOAD_POLICIES } from '@/lib/uploadValidation';
import { secureRandomId } from '@/lib/secureRandom';

const BUCKET = 'artisanal-site-aea';

export function validateAeaFile(file: File) {
  return validateUploadFile(file, UPLOAD_POLICIES.siteAea);
}

export const siteAeaDocumentService = {
  async upload(siteId: string, file: File) {
    const validated = validateAeaFile(file);
    const path = `${siteId}/${secureRandomId()}.${validated.extension}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: validated.mimeType, upsert: false,
    });
    if (error) throw new Error('Le dépôt de l’AEA a échoué. Le site n’a pas été enregistré.');
    return { documentPath: path, documentName: file.name };
  },
  async remove(path: string) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  },
  url(path: string) { return createPrivateSignedUrl(BUCKET, path, 3600); },
};
