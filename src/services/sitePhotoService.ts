import { supabase } from '@/lib/supabase';

/** Nombre maximal de photos par site. */
export const MAX_SITE_PHOTOS = 3;

const BUCKET = 'artisanal-sites';
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;

/** Redimensionne et compresse une image côté navigateur, puis renvoie une data URL JPEG. */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Image illisible.'));
      image.onload = () => {
        const ratio = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Compression indisponible sur ce navigateur.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const createPath = () =>
  `sites/${
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }.jpg`;

/**
 * Téléverse une photo dans le bucket privé et renvoie la **référence** à stocker.
 * En l'absence de bucket (environnement local, migration non appliquée), la photo
 * compressée est conservée telle quelle en data URL.
 */
export async function uploadSitePhoto(file: File): Promise<string> {
  const dataUrl = await compressImage(file);
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = createPath();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return path;
  } catch {
    return dataUrl;
  }
}

/** Transforme une référence stockée en URL affichable (URL signée pour le bucket privé). */
export async function resolvePhotoUrl(reference: string): Promise<string> {
  if (!reference) return '';
  if (reference.startsWith('data:') || reference.startsWith('http')) return reference;
  try {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(reference, 3600);
    return data?.signedUrl || '';
  } catch {
    return '';
  }
}
