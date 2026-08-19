import type { ArtisanalSite } from '@/types/artisanalSite';

/** Préfixe commun à tous les sites artisanaux. */
export const SITE_CODE_PREFIX = 'SA';

const CODE_PATTERN = /^SA-[A-Z]{3}-(\d{4})-(\d{4})$/;

/**
 * Trigramme de la région : trois premières lettres, sans accent ni séparateur.
 * « Boucle du Mouhoun » → BOU, « Centre-Nord » → CEN, « Hauts-Bassins » → HAU.
 */
export function regionTrigram(region: string): string {
  const letters = (region || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '');
  return letters.slice(0, 3).toLocaleUpperCase('fr').padEnd(3, 'X');
}

/**
 * Prochain numéro incrémental, tous sites confondus : on lit le dernier segment
 * des codes déjà attribués et on repart du maximum + 1.
 */
export function nextSiteSequence(sites: ArtisanalSite[]): number {
  const used = sites
    .map((site) => CODE_PATTERN.exec(site.code || '')?.[2])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  return (used.length > 0 ? Math.max(...used) : 0) + 1;
}

/**
 * Code d'un site artisanal : `SA-XXX-YYYY-ZZZZ`.
 * SA = site artisanal · XXX = trigramme de la région · YYYY = année de création ·
 * ZZZZ = numéro incrémental sur quatre chiffres.
 */
export function generateSiteCode(
  region: string,
  sites: ArtisanalSite[],
  year: number = new Date().getFullYear(),
  sequence?: number
): string {
  const number = sequence ?? nextSiteSequence(sites);
  return `${SITE_CODE_PREFIX}-${regionTrigram(region)}-${year}-${String(number).padStart(4, '0')}`;
}
