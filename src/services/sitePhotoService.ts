import { supabase } from '@/lib/supabase';
import { secureRandomId } from '@/lib/secureRandom';

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
        try {
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
        } catch {
          reject(new Error('La préparation de la photo a échoué. Choisissez une image lisible.'));
        }
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const createPath = () => `sites/${secureRandomId()}.jpg`;

/**
 * Téléverse une photo dans le bucket privé et renvoie la **référence** à stocker.
 * Un échec Storage n'est jamais remplacé par une référence locale présentée comme déposée.
 */
export async function uploadSitePhoto(file: File): Promise<string> {
  const dataUrl = await compressImage(file);
  try {
    // Conversion locale : fetch(data:) est soumis à connect-src et peut être interdit.
    const prefix = 'data:image/jpeg;base64,';
    if (!dataUrl.startsWith(prefix)) throw new Error('JPEG compressé invalide.');
    const binary = atob(dataUrl.slice(prefix.length));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const path = createPath();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return path;
  } catch {
    throw new Error('Le dépôt de la photo a échoué. Réessayez ou retirez le fichier.');
  }
}

/** Transforme une référence stockée en URL affichable (URL signée pour le bucket privé). */
export async function resolvePhotoUrl(reference: string): Promise<string> {
  if (!reference) throw new Error('La photo est momentanément indisponible.');
  if (reference.startsWith('data:') || reference.startsWith('http')) return reference;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(reference, 3600);
    if (error || !data?.signedUrl) throw new Error('Photo unavailable');
    return data.signedUrl;
  } catch {
    throw new Error('La photo est momentanément indisponible. Réessayez.');
  }
}

/** Compensation des seuls dépôts créés par le formulaire courant, jamais des références historiques. */
export async function removeUnattachedSitePhoto(reference: string): Promise<void> {
  if (!/^sites\/[a-zA-Z0-9-]+\.jpg$/.test(reference)) throw new Error('Cette référence de photo ne peut pas être retirée du dépôt.');
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([reference]);
    if (error) throw error;
  } catch {
    throw new Error('Le retrait de la photo du dépôt a échoué. Réessayez avant de quitter.');
  }
}
