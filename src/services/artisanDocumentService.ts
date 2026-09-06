import { supabase } from '@/lib/supabase';
import {
  createPrivateSignedUrl,
  storageObjectPath,
} from '@/lib/privateStorage';
import { validateUploadFile, UPLOAD_POLICIES } from '@/lib/uploadValidation';
import {
  uploadSensitiveFile,
  deleteSensitiveResource,
} from './sensitiveUploadGateway';

export type DocumentOwner = 'artisan' | 'societe' | 'responsable';
export interface ArtisanDocument {
  id: string;
  artisan_id: string;
  owner_kind: DocumentOwner;
  responsable_id: string | null;
  type_document: string;
  titre: string | null;
  nom_fichier: string;
  chemin_fichier: string;
  type_mime: string | null;
  taille_fichier: number | null;
  storage_bucket: string;
  uploaded_at?: string | null;
}
export interface PendingArtisanDocument {
  id: string;
  owner: DocumentOwner;
  type: string;
  title: string;
  file: File;
  status: 'pending' | 'uploading' | 'failed' | 'saved';
  error?: string;
  replacesId?: string;
}
export const artisanDocumentService = {
  async list(artisanId: string): Promise<ArtisanDocument[]> {
    const { data, error } = await supabase
      .from('snp_artisan_documents')
      .select('*')
      .eq('artisan_id', artisanId)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });
    if (error)
      throw new Error(
        'Les documents du dossier n’ont pas pu être chargés. Réessayez.',
      );
    return data as ArtisanDocument[];
  },
  async upload(
    artisanId: string,
    document: PendingArtisanDocument,
    responsableId?: string,
  ): Promise<ArtisanDocument> {
    const file = validateUploadFile(
      document.file,
      document.type === 'photo'
        ? UPLOAD_POLICIES.artisanPhoto
        : UPLOAD_POLICIES.artisanDocument,
    );
    const result = (await uploadSensitiveFile(
      'artisan-document',
      document.file,
      {
        fileName: document.file.name,
        artisanId,
        uploadId: document.id,
        ownerKind: document.owner,
        responsableId:
          document.owner === 'responsable' ? responsableId || null : null,
        documentType: document.type,
        title: document.title,
      },
      { mimeType: file.mimeType },
    )) as ArtisanDocument;
    if (result?.id !== document.id)
      throw new Error('Le dépôt de la pièce n’a pas été confirmé.');
    return result;
  },
  async remove(id: string) {
    await deleteSensitiveResource('artisan-document', id);
  },
  url(document: ArtisanDocument) {
    return createPrivateSignedUrl(
      document.storage_bucket,
      document.chemin_fichier,
    );
  },
  async photoUrl(reference?: string | null): Promise<string> {
    if (!reference) return '';
    if (
      reference.startsWith('artisan-dossiers/') ||
      (/^https?:\/\//u.test(reference) &&
        storageObjectPath(reference, 'artisan-dossiers'))
    )
      return createPrivateSignedUrl('artisan-dossiers', reference);
    // Legacy references remain readable through their original bucket when available.
    return createPrivateSignedUrl('artisan-documents', reference);
  },
};
