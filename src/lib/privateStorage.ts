import { supabase } from '@/lib/supabase';

export const PRIVATE_STORAGE_BUCKETS = {
  shippingDocuments: 'shipping-documents',
  assayCertificates: 'ASSAY-CERTIFICATES',
  miningCompanyDocuments: 'mining-company-documents',
  productionDocuments: 'production-documents',
  freightCustomsDocuments: 'freight-customs-documents',
} as const;

const STORAGE_ACCESS_VARIANTS = new Set(['public', 'sign', 'authenticated']);

function decodeSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    if (
      decoded.length === 0
      || decoded === '.'
      || decoded === '..'
      || /[\u0000-\u001f\u007f/\\]/u.test(decoded)
    ) return null;
    return decoded;
  } catch {
    return null;
  }
}

function canonicalizeSegments(rawSegments: string[], bucket: string): string | null {
  const decoded: string[] = [];
  for (const rawSegment of rawSegments) {
    const segment = decodeSegment(rawSegment);
    if (!segment) return null;
    decoded.push(segment);
  }

  // Les anciens appels envoyaient parfois `bucket/chemin` à l'intérieur du
  // bucket, créant `bucket/bucket/chemin`. Les deux préfixes sont retirés.
  while (decoded[0] === bucket) decoded.shift();
  return decoded.length > 0 ? decoded.join('/') : null;
}

/**
 * Convertit un chemin objet ou une ancienne URL Supabase en chemin canonique.
 * Aucune URL reçue n'est appelée : seule sa composante de chemin est analysée.
 */
export function storageObjectPath(reference: string | null | undefined, bucket: string): string | null {
  const value = reference?.trim();
  if (!value || value.length > 4096 || !/^[A-Za-z0-9._-]{1,100}$/u.test(bucket)) return null;

  if (/^https?:\/\//iu.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    const segments = url.pathname.split('/').filter(Boolean);
    const storageIndex = segments.findIndex((segment, index) =>
      segment === 'storage'
      && segments[index + 1] === 'v1'
      && segments[index + 2] === 'object',
    );
    if (storageIndex < 0) return null;

    let cursor = storageIndex + 3;
    if (STORAGE_ACCESS_VARIANTS.has(segments[cursor])) cursor += 1;
    if (decodeSegment(segments[cursor] ?? '') !== bucket) return null;
    return canonicalizeSegments(segments.slice(cursor + 1), bucket);
  }

  if (/^[a-z][a-z0-9+.-]*:/iu.test(value)) return null;
  if (value.includes('?') || value.includes('#')) return null;
  const segments = value.replace(/^\/+/, '').split('/');
  return canonicalizeSegments(segments, bucket);
}

export function requireStorageObjectPath(reference: string, bucket: string): string {
  const path = storageObjectPath(reference, bucket);
  if (!path) throw new Error('La référence du document privé est invalide.');
  return path;
}

export async function createPrivateSignedUrl(
  bucket: string,
  reference: string,
  expiresInSeconds = 300,
): Promise<string> {
  const path = requireStorageObjectPath(reference, bucket);
  const expiresIn = Number.isSafeInteger(expiresInSeconds)
    ? Math.min(Math.max(expiresInSeconds, 60), 3600)
    : 300;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error('Le document privé ne peut pas être ouvert pour le moment.');
  }
  return data.signedUrl;
}
