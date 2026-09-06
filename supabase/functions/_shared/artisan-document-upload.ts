import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { ContextePersistanceUpload } from '../sensitive-upload/handler.ts';
import { niveauAssurance } from './assurance.ts';
import { supprimerObjetAvecCompensation } from './compensated-storage-delete.ts';
import {
  POLITIQUE_DOCUMENT_ARTISAN,
  POLITIQUE_PHOTO_ARTISAN,
  validerUploadServeur,
} from './secure-upload.ts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ArtisanDocumentMetadata = Record<string, unknown> & {
  fileName: string;
  artisanId: string;
  uploadId: string;
  ownerKind: 'artisan' | 'societe' | 'responsable';
  responsableId: string | null;
  documentType: string;
  title: string;
};
export function parseArtisanDocument(
  raw: unknown,
): ArtisanDocumentMetadata | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as ArtisanDocumentMetadata;
  if (
    Object.keys(m).length !== 7 ||
    !Object.keys(m).every((k) =>
      [
        'fileName',
        'artisanId',
        'uploadId',
        'ownerKind',
        'responsableId',
        'documentType',
        'title',
      ].includes(k),
    ) ||
    typeof m.fileName !== 'string' ||
    !m.fileName ||
    typeof m.title !== 'string' ||
    !m.title.trim() ||
    m.title.length > 150 ||
    !UUID.test(m.artisanId) ||
    !UUID.test(m.uploadId) ||
    !['artisan', 'societe', 'responsable'].includes(m.ownerKind) ||
    (m.ownerKind === 'responsable'
      ? !UUID.test(m.responsableId || '')
      : m.responsableId !== null) ||
    !(
      m.ownerKind === 'societe'
        ? ['rccm', 'ifu', 'autre']
        : ['photo', 'cni', 'passeport', 'permis', 'certificat', 'autre']
    ).includes(m.documentType) ||
    (m.documentType === 'photo' && m.ownerKind !== 'artisan')
  )
    return null;
  return m;
}
export async function artisanDocumentAccess(
  client: SupabaseClient,
  token: string,
  artisanId: string,
): Promise<boolean> {
  if (niveauAssurance(token) !== 'aal2') return false;
  const [session, access] = await Promise.all([
    client.rpc('snp_session_signaler_activite'),
    client.rpc('snp_artisan_document_allowed', { p_artisan_id: artisanId }),
  ]);
  return (
    !session.error &&
    !access.error &&
    session.data?.is_active === true &&
    access.data === true
  );
}

const BUCKET = 'artisan-dossiers';
const sha = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
export async function persistArtisanDocument(
  admin: SupabaseClient,
  client: SupabaseClient,
  input: ContextePersistanceUpload,
) {
  const m = input.metadata as ArtisanDocumentMetadata;
  if (!(await artisanDocumentAccess(client, input.token, m.artisanId)))
    throw new Error('document_forbidden');
  validerUploadServeur(
    {
      fileName: m.fileName,
      declaredMimeType: input.file.mimeType,
      bytes: input.bytes,
    },
    m.documentType === 'photo'
      ? POLITIQUE_PHOTO_ARTISAN
      : POLITIQUE_DOCUMENT_ARTISAN,
  );
  const path = `${m.artisanId}/${m.uploadId}.${input.file.extension}`;
  const hash = await sha(input.bytes);
  const row = {
    id: m.uploadId,
    artisan_id: m.artisanId,
    owner_kind: m.ownerKind,
    responsable_id: m.responsableId,
    type_document: m.documentType,
    titre: m.title,
    nom_fichier: input.file.safeFileName,
    chemin_fichier: path,
    taille_fichier: input.bytes.length,
    type_mime: input.file.mimeType,
    storage_bucket: BUCKET,
    sha256: hash,
  };
  const upload = await admin.storage
    .from(BUCKET)
    .upload(path, input.bytes, {
      contentType: input.file.mimeType,
      upsert: false,
      cacheControl: '0',
    });
  if (upload.error) {
    // A lost response may leave either a complete document or an object awaiting metadata.
    const previous = await admin.storage.from(BUCKET).download(path);
    if (
      previous.error ||
      !previous.data ||
      previous.data.size !== input.bytes.length ||
      (await sha(new Uint8Array(await previous.data.arrayBuffer()))) !== hash
    )
      throw new Error('document_upload_failed');
  }
  const result = await client.rpc('snp_register_artisan_document', {
    p_document: row,
  });
  if (result.error) {
    const existing = await admin
      .from('snp_artisan_documents')
      .select('id')
      .eq('id', m.uploadId)
      .maybeSingle();
    if (!existing.error && !existing.data && !upload.error) {
      const cleanup = await admin.storage.from(BUCKET).remove([path]);
      if (cleanup.error)
        console.error('[artisan-document] Compensation du dépôt indisponible.');
    }
    throw new Error('document_registration_failed');
  }
  return result.data;
}

export async function removeArtisanDocument(
  admin: SupabaseClient,
  client: SupabaseClient,
  token: string,
  actorId: string,
  resourceId: string,
) {
  const result = await admin
    .from('snp_artisan_documents')
    .select('*')
    .eq('id', resourceId)
    .eq('storage_bucket', BUCKET)
    .maybeSingle();
  const d = result.data;
  if (
    result.error ||
    !d ||
    !(await artisanDocumentAccess(client, token, d.artisan_id))
  )
    throw new Error('document_forbidden');
  if (d.deleted_at) return;
  const path = d.chemin_fichier;
  if (!new RegExp(`^${d.artisan_id}/${d.id}\\.(pdf|jpg|jpeg|png)$`).test(path))
    throw new Error('invalid_document_path');
  const backup = await admin.storage.from(BUCKET).download(path);
  if (backup.error || !backup.data || backup.data.size !== d.taille_fichier)
    throw new Error('backup_failed');
  const bytes = new Uint8Array(await backup.data.arrayBuffer());
  if ((await sha(bytes)) !== d.sha256) throw new Error('backup_invalid');
  await supprimerObjetAvecCompensation({
    expectedPath: path,
    async removeObject() {
      const r = await admin.storage.from(BUCKET).remove([path]);
      if (r.error) throw r.error;
    },
    async deleteMetadata() {
      const r = await admin.rpc('snp_delete_artisan_document_gateway', {
        p_document_id: resourceId,
        p_actor_id: actorId,
      });
      if (r.error || r.data !== path) throw new Error('metadata_delete_failed');
      return r.data;
    },
    async restoreObject() {
      const r = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType: d.type_mime,
          upsert: false,
          cacheControl: '0',
        });
      if (r.error) throw r.error;
    },
    onRestoreFailure() {
      console.error(
        '[artisan-document] Restauration compensatoire indisponible.',
      );
    },
  });
}
