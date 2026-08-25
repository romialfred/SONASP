const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_ACCESS_VARIANTS = new Set(['public', 'sign', 'authenticated']);

export type ProfilSuppressionDocumentSensible =
  | 'mining-company-document'
  | 'assay-certificate'
  | 'shipping-document'
  | 'production-document';

export interface ContexteSuppressionDocumentSensible {
  actorId: string;
  parentId: string;
  tenantId: string;
  uploadedBy: string | null;
  activeSession: boolean;
  aal2: boolean;
  parentExists: boolean;
  parentPermission: boolean;
  hasWriteCapability: boolean;
  mayDeleteAnyUploader: boolean;
  mutable: boolean;
}

export function autoriserSuppressionDocumentSensible(
  contexte: ContexteSuppressionDocumentSensible,
): boolean {
  return UUID.test(contexte.actorId)
    && UUID.test(contexte.parentId)
    && UUID.test(contexte.tenantId)
    && contexte.activeSession
    && contexte.aal2
    && contexte.parentExists
    && contexte.parentPermission
    && contexte.hasWriteCapability
    && contexte.mutable
    && (
      contexte.mayDeleteAnyUploader
      || contexte.uploadedBy === contexte.actorId
    );
}

function decoderSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    if (
      decoded.length === 0
      || decoded.length > 255
      || decoded === '.'
      || decoded === '..'
      || /[\u0000-\u001f\u007f/\\]/u.test(decoded)
    ) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extrait uniquement le nom d'objet d'une référence Storage historique.
 * L'URL n'est jamais appelée et les segments sont décodés puis validés.
 */
export function normaliserReferenceObjetStorage(
  reference: unknown,
  bucket: string,
): string | null {
  if (
    typeof reference !== 'string'
    || reference.length === 0
    || reference.length > 4096
    || !/^[A-Za-z0-9._-]{1,100}$/u.test(bucket)
  ) return null;

  let segments: string[];
  if (/^https?:\/\//iu.test(reference)) {
    let url: URL;
    try {
      url = new URL(reference);
    } catch {
      return null;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const storageIndex = parts.findIndex((part, index) =>
      part === 'storage' && parts[index + 1] === 'v1' && parts[index + 2] === 'object'
    );
    if (storageIndex < 0) return null;
    let cursor = storageIndex + 3;
    if (STORAGE_ACCESS_VARIANTS.has(parts[cursor] ?? '')) cursor += 1;
    if (decoderSegment(parts[cursor] ?? '') !== bucket) return null;
    segments = parts.slice(cursor + 1);
  } else {
    if (/^[a-z][a-z0-9+.-]*:/iu.test(reference) || reference.includes('?') || reference.includes('#')) {
      return null;
    }
    segments = reference.replace(/^\/+/, '').split('/');
  }

  const decoded: string[] = [];
  for (const rawSegment of segments) {
    const segment = decoderSegment(rawSegment);
    if (!segment) return null;
    decoded.push(segment);
  }
  while (decoded[0] === bucket) decoded.shift();
  if (decoded.length === 0 || decoded.length > 8) return null;
  return decoded.join('/');
}

export function cheminObjetLieAuParent(
  reference: unknown,
  bucket: string,
  parentId: string,
): string | null {
  if (!UUID.test(parentId)) return null;
  const path = normaliserReferenceObjetStorage(reference, bucket);
  if (!path) return null;
  const segments = path.split('/');
  if (segments[0] !== parentId || segments.length < 2) return null;
  const objectName = segments[segments.length - 1] ?? '';
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,254}$/u.test(objectName)
    || objectName.startsWith('.')
    || objectName.endsWith('.')
  ) return null;
  return path;
}
