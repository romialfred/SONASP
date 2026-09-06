import type { ArtisanalSite, SiteAea } from '@/types/artisanalSite';

export const FORMALIZATION_LABELS = {
  formalized: 'Site formalisé',
  non_formalized: 'Site non formalisé',
  unknown: 'À renseigner',
} as const;

/** Addition de mois calendaires, bornée au dernier jour du mois cible. */
export function aeaExpiryDate(issuedOn: string, durationMonths: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn) || !Number.isInteger(durationMonths)
    || durationMonths < 1 || durationMonths > 1200) return null;
  const [year, month, day] = issuedOn.split('-').map(Number);
  if (year < 1900 || year > 9899 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== issuedOn) return null;
  const lastDay = new Date(Date.UTC(year, month - 1 + durationMonths + 1, 0));
  const result = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), Math.min(day, lastDay.getUTCDate())));
  return result.toISOString().slice(0, 10);
}

export const emptyAea = (): SiteAea => ({
  number: '', issuedOn: '', durationMonths: 12, documentPath: '', documentName: '',
});

export function validateSiteAea(aea: SiteAea | null | undefined, hasNewFile = false): string | null {
  if (!aea?.number.trim()) return 'Le numéro de l’AEA est obligatoire.';
  if (!aeaExpiryDate(aea.issuedOn, aea.durationMonths)) return 'Renseignez une date d’émission valide et une durée entière de 1 à 1 200 mois.';
  if (!hasNewFile && !aea.documentPath) return 'Joignez le justificatif AEA du site formalisé.';
  return null;
}

export function siteAeaState(site: Pick<ArtisanalSite, 'formalization' | 'aea'>, today = new Date().toISOString().slice(0, 10)) {
  if (!site.formalization) return { label: 'Catégorie à renseigner', tone: 'pending' };
  if (site.formalization === 'non_formalized') return { label: 'Sans AEA', tone: 'pending' };
  if (validateSiteAea(site.aea)) return { label: 'Dossier AEA incomplet', tone: 'warning' };
  if (site.aea!.issuedOn > today) return { label: 'AEA à venir', tone: 'warning' };
  if (aeaExpiryDate(site.aea!.issuedOn, site.aea!.durationMonths)! < today) return { label: 'AEA expirée', tone: 'bad' };
  return { label: 'AEA en cours de validité', tone: 'good' };
}
